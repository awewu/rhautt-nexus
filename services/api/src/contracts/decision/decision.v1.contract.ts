/**
 * decision.v1 共享契约 · 单一契约源 (Single Source of Truth)
 * ════════════════════════════════════════════════════════════════════════
 * 本文件是「统一 Decision 对象」跨四系统 (Tandem/StratOS/PLM/GTM) 的唯一契约源。
 *
 * 分发方式 (无私有 npm registry 的多仓 vendored 模式):
 *   - 权威副本: hermes-tandem/contracts/decision.v1.contract.ts (本文件)
 *   - 消费副本: StrategyOS / PLM / rhautt_gtm 各 vendor 一份逐字节相同的副本
 *   - 防漂移: CONTRACT_FINGERPRINT 由 SPEC 内容确定性哈希得出;
 *     每个仓的 contract test 断言 computeContractFingerprint() === CONTRACT_FINGERPRINT。
 *     任何一侧擅自改动词表/限制 → 指纹变化 → 该仓测试立即红。
 *   - 升级流程: 先改本权威副本并更新 CONTRACT_FINGERPRINT (见文件底部说明),
 *     再把整个文件原样复制到三个消费仓, 各仓测试转绿即同步完成。
 *
 * 治理纪律 (与网关实现一致, 违反即 400):
 *   - AI/服务只能写 recommendation / evidenceRefs;
 *   - finalDecision 必须携带人类 decidedBy (禁止 __service_ 前缀);
 *   - status=decided 必须有 finalDecision;
 *   - outcomeStatus=hit/miss/mixed 必须附 actualOutcome;
 *   - Outcome Review 不可改 finalDecision / status / recommendation。
 *
 * 本文件必须保持零依赖 (仅 node:crypto), 可被 Next.js / NestJS / tsx 直接引入。
 */

import { createHash } from 'node:crypto';

// ── 契约词表与限制 (指纹的输入 · 改这里必须走升级流程) ──────────────────────

export const DECISION_SCHEMA_VERSION = 'decision.v1' as const;

export const DECISION_SOURCE_SYSTEMS = ['stratos', 'tandem', 'plm', 'gtm'] as const;
export type DecisionSourceSystem = (typeof DECISION_SOURCE_SYSTEMS)[number];

/** 决策类型 · 各来源系统映射到统一词表 (可扩展, 但必须在此白名单内) */
export const DECISION_TYPES = [
  /** StrategyOS: 战略下注 Gate 裁决 (approve/kill/pivot/defer) */
  'bet_gate',
  /** StrategyOS: 战略前提/合理性裁决 */
  'strategy_verdict',
  /** Tandem: 决策卡 (DecisionCard COMMIT) */
  'decision_card',
  /** PLM: Gate0-5 评审放行 */
  'gate_review',
  /** PLM: 工程变更单 (ECO) 审批 */
  'eco',
  /** GTM: Campaign 立项/预算决策 */
  'campaign',
  /** 其他 (必须在 title 里说明) */
  'other',
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const DECISION_STATUSES = ['proposed', 'decided', 'superseded'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/** 结果回看状态 · pending=未回看, hit/miss/mixed=已回看 */
export const DECISION_OUTCOME_STATUSES = ['pending', 'hit', 'miss', 'mixed'] as const;
export type DecisionOutcomeStatus = (typeof DECISION_OUTCOME_STATUSES)[number];

export const DECISION_LIMITS = {
  maxTitle: 500,
  maxRefs: 100,
  maxOutcome: 4000,
} as const;

/** 服务账号前缀 — 不能作为人类署名 (decidedBy / reviewedBy) */
export const SERVICE_ACCOUNT_PREFIX = '__service_' as const;

// ── 契约指纹 (防漂移锚点) ────────────────────────────────────────────────

/** SPEC 的确定性序列化 → sha256 前 16 位。任何词表/限制改动都会改变指纹。 */
export function computeContractFingerprint(): string {
  const spec = JSON.stringify({
    schemaVersion: DECISION_SCHEMA_VERSION,
    sourceSystems: DECISION_SOURCE_SYSTEMS,
    types: DECISION_TYPES,
    statuses: DECISION_STATUSES,
    outcomeStatuses: DECISION_OUTCOME_STATUSES,
    limits: DECISION_LIMITS,
    servicePrefix: SERVICE_ACCOUNT_PREFIX,
    // 治理规则版本号: 校验器语义变化 (即使词表不变) 时 +1
    // v2: POST 上报也收口 Outcome Review 纪律 — hit/miss/mixed 必须
    //     status≠proposed、必须人类 outcomeReviewedBy (禁服务账号),
    //     并补齐 outcomeReviewedBy/outcomeReviewedAt/outcomeReviewNote 类型校验。
    governanceRules: 2,
  });
  return createHash('sha256').update(spec).digest('hex').slice(0, 16);
}

/**
 * 当前契约指纹 (四仓 contract test 共同断言的值)。
 * 升级流程: 改动 SPEC 后运行 computeContractFingerprint() 取新值填入此处,
 * 然后把整个文件同步到 StrategyOS / PLM / rhautt_gtm 的 vendored 副本。
 */
export const CONTRACT_FINGERPRINT = '292878317b41828d' as const;

// ── 对象类型 ────────────────────────────────────────────────────────────

export interface Decision {
  id: string;
  schemaVersion: typeof DECISION_SCHEMA_VERSION;
  tenantId: string;

  /** 决策来源系统 (由服务令牌判定, 请求体不可伪造) */
  sourceSystem: DecisionSourceSystem;
  /** 来源系统内的对象 id (Bet id / DecisionCard id / GateInstance id / ECO id / Campaign id) */
  refId: string;
  type: DecisionType;
  title: string;
  status: DecisionStatus;

  /** 战略下注链: StrategyOS ProductBet/GtmBet 的 id · 贯穿四系统的主线索 */
  betId?: string;

  /** 决策依据链 */
  premiseIds: string[];
  /** 证据引用 (URL / 文档 id / checkId 等, 来源系统自定义格式但必须可回溯) */
  evidenceRefs: string[];

  /** AI/规则引擎的建议 (允许为任意结构化内容, 只读参考, 非真值) */
  recommendation?: unknown;
  /** 最终决定 (必须由人类做出) */
  finalDecision?: unknown;
  /** 最终决定人 (人类 user id; finalDecision 存在时必填) */
  decidedBy?: string;
  decidedAt?: string;

  /** 结果回看 */
  expectedOutcome?: string;
  actualOutcome?: string;
  outcomeStatus: DecisionOutcomeStatus;
  outcomeReviewedAt?: string;
  /** 结果回看署名 (必须是人类; 服务账号被拒) */
  outcomeReviewedBy?: string;
  /** 结果回看说明 (为什么判 hit/miss/mixed — 先例图谱的对错依据) */
  outcomeReviewNote?: string;

  /** 被更新的旧决策 id (决策链) */
  supersedes?: string;
  /** 审计引用 (Tandem checkId / 来源系统审计记录 id) */
  auditRef?: string;

  createdAt: string;
  updatedAt: string;
}

/** POST /api/gateway/decisions 请求体 (来源系统上报用, id/tenant/时间戳由服务端管理) */
export type DecisionUpsertInput = Omit<
  Decision,
  | 'id'
  | 'schemaVersion'
  | 'tenantId'
  | 'createdAt'
  | 'updatedAt'
  | 'outcomeStatus'
  | 'sourceSystem'
  | 'premiseIds'
  | 'evidenceRefs'
> & {
  tenantId?: string;
  outcomeStatus?: DecisionOutcomeStatus;
  premiseIds?: string[];
  evidenceRefs?: string[];
};

/**
 * PATCH /api/gateway/decisions 请求体 — Outcome Review (结果回看动作)
 * 只允许改 outcome 字段; finalDecision / status / recommendation 一律不可经此路径改动。
 */
export interface DecisionOutcomeReviewInput {
  /** 目标决策: 来源系统内 refId (与调用方令牌的 sourceSystem 组成定位键) */
  refId: string;
  outcomeStatus: Exclude<DecisionOutcomeStatus, 'pending'>;
  actualOutcome: string;
  /** 人类回看者 id — 服务账号被拒 */
  reviewedBy: string;
  reviewNote?: string;
}

// ── API 响应契约 ─────────────────────────────────────────────────────────

/** POST 成功响应 (201 创建 / 200 幂等更新) */
export interface DecisionUpsertResponse {
  ok: true;
  created: boolean;
  decision: Decision;
}

/** GET 成功响应 */
export interface DecisionListResponse {
  ok: true;
  count: number;
  decisions: Decision[];
}

/** 错误响应 (400/401/403/404/409/503) */
export interface DecisionErrorResponse {
  ok: false;
  error: string;
}

export interface DecisionValidation {
  ok: boolean;
  error?: string;
}

// ── 共享校验器 (producer 侧上报前预检 = consumer 侧网关同一套规则) ─────────

/** 上报体校验 · 契约与治理纪律 (AI 不能写 finalDecision) 在此收口 */
export function validateDecisionInput(body: unknown): DecisionValidation {
  if (!body || typeof body !== 'object') return { ok: false, error: '请求体必须是 JSON 对象' };
  const b = body as Record<string, unknown>;

  if (typeof b.refId !== 'string' || !b.refId.trim()) {
    return { ok: false, error: '缺少 refId (来源系统内对象 id, 幂等 upsert 键)' };
  }
  if (typeof b.type !== 'string' || !(DECISION_TYPES as readonly string[]).includes(b.type)) {
    return { ok: false, error: `type 必须是: ${DECISION_TYPES.join(' | ')}` };
  }
  if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > DECISION_LIMITS.maxTitle) {
    return { ok: false, error: `title 必填且不超过 ${DECISION_LIMITS.maxTitle} 字符` };
  }
  if (b.status !== 'proposed' && b.status !== 'decided' && b.status !== 'superseded') {
    return { ok: false, error: 'status 必须是 proposed | decided | superseded' };
  }
  for (const key of ['premiseIds', 'evidenceRefs'] as const) {
    const v = b[key];
    if (v !== undefined) {
      if (
        !Array.isArray(v) ||
        v.length > DECISION_LIMITS.maxRefs ||
        v.some((x) => typeof x !== 'string' || !x.trim())
      ) {
        return { ok: false, error: `${key} 必须是非空字符串数组 (≤${DECISION_LIMITS.maxRefs} 条)` };
      }
    }
  }
  // 治理纪律: finalDecision 必须由人类决策者署名
  if (b.finalDecision !== undefined && b.finalDecision !== null) {
    if (typeof b.decidedBy !== 'string' || !b.decidedBy.trim()) {
      return { ok: false, error: 'finalDecision 必须携带 decidedBy (人类决策者 id) — AI/服务不能写最终决定' };
    }
    if (b.decidedBy.startsWith(SERVICE_ACCOUNT_PREFIX)) {
      return { ok: false, error: 'decidedBy 不能是服务账号 — 最终决定必须归属人类决策者' };
    }
  }
  if (b.status === 'decided' && (b.finalDecision === undefined || b.finalDecision === null)) {
    return { ok: false, error: 'status=decided 时必须提供 finalDecision' };
  }
  if (
    b.outcomeStatus !== undefined &&
    !(DECISION_OUTCOME_STATUSES as readonly string[]).includes(b.outcomeStatus as string)
  ) {
    return { ok: false, error: 'outcomeStatus 必须是 pending | hit | miss | mixed' };
  }
  if (b.outcomeStatus === 'hit' || b.outcomeStatus === 'miss' || b.outcomeStatus === 'mixed') {
    if (typeof b.actualOutcome !== 'string' || !b.actualOutcome.trim()) {
      return { ok: false, error: '结果回看 (outcomeStatus=hit/miss/mixed) 必须附 actualOutcome 说明' };
    }
    // 治理纪律 (v2): POST 上报回看结果与 PATCH 同一套规则 — 不能绕过人类署名
    if (b.status === 'proposed') {
      return { ok: false, error: '不能回看未定案的决策 (status=proposed) — 先有人类 finalDecision 才有对错可标注' };
    }
    if (typeof b.outcomeReviewedBy !== 'string' || !b.outcomeReviewedBy.trim()) {
      return { ok: false, error: '结果回看 (outcomeStatus=hit/miss/mixed) 必须携带 outcomeReviewedBy (人类回看者 id)' };
    }
    if (b.outcomeReviewedBy.startsWith(SERVICE_ACCOUNT_PREFIX)) {
      return { ok: false, error: 'outcomeReviewedBy 不能是服务账号 — 对错标注必须归属人类' };
    }
  }
  for (const key of ['betId', 'decidedAt', 'expectedOutcome', 'actualOutcome', 'supersedes', 'auditRef', 'tenantId', 'outcomeReviewedBy', 'outcomeReviewedAt', 'outcomeReviewNote'] as const) {
    const v = b[key];
    if (v !== undefined && typeof v !== 'string') {
      return { ok: false, error: `${key} 必须是字符串` };
    }
  }
  return { ok: true };
}

/** Outcome Review 校验 — hit/miss/mixed 必附 actualOutcome, 且必须人类署名 */
export function validateOutcomeReview(body: unknown): DecisionValidation {
  if (!body || typeof body !== 'object') return { ok: false, error: '请求体不是合法 JSON' };
  const b = body as Record<string, unknown>;
  if (typeof b.refId !== 'string' || !b.refId.trim()) {
    return { ok: false, error: '缺少 refId (来源系统内对象 id)' };
  }
  if (b.outcomeStatus !== 'hit' && b.outcomeStatus !== 'miss' && b.outcomeStatus !== 'mixed') {
    return { ok: false, error: 'outcomeStatus 必须是 hit | miss | mixed (回看不能写 pending)' };
  }
  if (
    typeof b.actualOutcome !== 'string' ||
    !b.actualOutcome.trim() ||
    b.actualOutcome.length > DECISION_LIMITS.maxOutcome
  ) {
    return { ok: false, error: `结果回看必须附 actualOutcome 说明 (≤${DECISION_LIMITS.maxOutcome} 字符)` };
  }
  if (typeof b.reviewedBy !== 'string' || !b.reviewedBy.trim()) {
    return { ok: false, error: '结果回看必须携带 reviewedBy (人类回看者 id)' };
  }
  if (b.reviewedBy.startsWith(SERVICE_ACCOUNT_PREFIX)) {
    return { ok: false, error: 'reviewedBy 不能是服务账号 — 对错标注必须归属人类' };
  }
  if (b.reviewNote !== undefined && (typeof b.reviewNote !== 'string' || b.reviewNote.length > DECISION_LIMITS.maxOutcome)) {
    return { ok: false, error: `reviewNote 必须是字符串 (≤${DECISION_LIMITS.maxOutcome} 字符)` };
  }
  return { ok: true };
}
