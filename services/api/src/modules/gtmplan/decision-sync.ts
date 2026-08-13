/**
 * GTM → Tandem 统一 Decision 注册表 (decision.v1) 同步 adapter。
 *
 * 语义:
 * - Campaign 是 GTM 侧的"资源下注决定": 创建即 proposed;
 *   状态离开 planned(如 active/closed/cancelled)且有人类操作者时 → decided。
 * - betId 贯穿链约定: campaign.buType === 'bet' 时 buRef 即 StratOS Bet id。
 * - AI/服务不能写 finalDecision — decidedBy 必须是人类 userId(由调用方传入)。
 * - fail-soft: 未配置 TANDEM_AI_GATEWAY_URL/TOKEN 时静默跳过; 任何 HTTP/网络错误
 *   只返回结果对象, 不抛异常, 不阻断 campaign 主流程。
 * - 来源系统由 Tandem 按服务令牌判定为 gtm, 请求体不携带 sourceSystem。
 */

import type {
  DecisionStatus,
  DecisionType,
  DecisionUpsertInput,
} from '../../contracts/decision/decision.v1.contract';

export type CampaignLike = {
  id: string;
  name: string;
  buType: string | null;
  buRef: string | null;
  period: string | null;
  budget: number;
  spend: number;
  attributedRevenue: number;
  status: string;
  updatedAt: Date | string;
};

/**
 * Tandem decision.v1 上报体 — 类型直接派生自 vendored 单一契约源
 * (src/contracts/decision/decision.v1.contract.ts, 与 hermes-tandem 权威副本逐字节相同,
 * 指纹防漂移见 decision-contract.nodetest.ts)。
 */
export type DecisionUpsertPayload = DecisionUpsertInput & {
  type: Extract<DecisionType, 'campaign'>;
  status: Extract<DecisionStatus, 'proposed' | 'decided'>;
};

export type DecisionSyncResult =
  | { ok: true; status: number }
  | { ok: false; skipped: true }
  | { ok: false; skipped?: false; status?: number; error: string };

const DECIDED_STATUSES = new Set([
  'active',
  'running',
  'closed',
  'done',
  'completed',
  'cancelled',
  'killed',
]);

/** 纯函数: Campaign → Decision payload(可单测)。by 为人类操作者 userId, 服务身份传空串。 */
export function buildCampaignDecisionPayload(c: CampaignLike, by: string): DecisionUpsertPayload {
  const decided = DECIDED_STATUSES.has(c.status) && Boolean(by && by.trim());
  const payload: DecisionUpsertPayload = {
    refId: `campaign:${c.id}`,
    type: 'campaign',
    title: `[Campaign] ${c.name}${c.period ? ` · ${c.period}` : ''}`.slice(0, 500),
    status: decided ? 'decided' : 'proposed',
  };
  if (c.buType === 'bet' && c.buRef) payload.betId = c.buRef;
  const evidenceRefs = [
    c.buRef && c.buType !== 'bet' ? `gtm:bu:${c.buType ?? 'unknown'}:${c.buRef}` : null,
  ].filter((x): x is string => Boolean(x));
  if (evidenceRefs.length) payload.evidenceRefs = evidenceRefs;
  payload.expectedOutcome = `budget=${c.budget}`;
  if (c.spend > 0 || c.attributedRevenue > 0) {
    payload.actualOutcome = `spend=${c.spend}; attributedRevenue=${c.attributedRevenue}`;
  }
  if (decided) {
    payload.finalDecision = { decision: c.status, budget: c.budget };
    payload.decidedBy = by;
    payload.decidedAt = typeof c.updatedAt === 'string' ? c.updatedAt : c.updatedAt.toISOString();
  }
  return payload;
}

export async function syncDecisionToTandem(
  payload: DecisionUpsertPayload,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch
): Promise<DecisionSyncResult> {
  const url = env.TANDEM_AI_GATEWAY_URL?.trim();
  const token = env.TANDEM_AI_GATEWAY_TOKEN?.trim();
  if (!url || !token) return { ok: false, skipped: true };
  try {
    const res = await fetcher(`${url.replace(/\/+$/, '')}/api/gateway/decisions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok)
      return { ok: false, status: res.status, error: `decision sync HTTP ${res.status}` };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** fire-and-forget 便捷入口: 任何异常吞掉, 绝不影响 campaign 主流程。 */
export function syncCampaignDecision(c: CampaignLike, by: string): void {
  void syncDecisionToTandem(buildCampaignDecisionPayload(c, by)).catch(() => undefined);
}
