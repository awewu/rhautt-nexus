/**
 * 主销产品资格闸（纯逻辑，与服务解耦便于单测与复用）
 *
 * 为什么"主销"要过闸而不是打个标签：
 *   如果只是让人勾选"这是主销"，与拍脑袋无异。而"主销"一旦成立就会牵动 GEO 资源
 *   （选题优先级、探测配额、内容生产），把资源押在一个没有约束的声明上是危险的。
 *
 * 三道闸各自对应一种"推了会亏"的真实风险：
 *   1. 毛利闸（基座3）：毛利率低于下限 → 推得越狠亏得越多。复用既有 computeMargin，
 *      不另立一套毛利口径。
 *   2. 生命周期闸：eol（停产）不得作为主销 → 引流来了没货，线索白费、口碑受损。
 *   3. 卖点证据闸（基座4）：主销必须至少有一条带 evidenceRef 的卖点 →
 *      否则 GEO 内容没有事实来源，只能编造，直接踩"禁手写事实"红线。
 *
 * ⚠️ 诚实边界：主销是**品牌方策略声明**，不是对市场的事实断言（那需要销量/需求数据，
 *   当前不具备）。本闸只保证"这个声明不会明显自伤"，**不代表该型号真的好卖**。
 *   是否好卖须由后验数据（渠道报价 BOM / 成交）校验，不得由本闸背书。
 */

import { computeMargin } from './pricing-gate';

export type FocusGateId = 'margin' | 'lifecycle' | 'selling-point-evidence';

export interface FocusGateCheck {
  id: FocusGateId;
  passed: boolean;
  /** 人可读的判定理由（通过与不通过都给，便于审计复核） */
  reason: string;
  /** 判定所依据的数值/取值，便于事后复算 */
  detail?: Record<string, unknown>;
}

export interface FocusEligibility {
  eligible: boolean;
  checks: FocusGateCheck[];
  /** 未过闸的闸门 id，便于前端直接提示 */
  blockedBy: FocusGateId[];
}

/** 停产产品不得主销。intro/growth/mature 均允许（新品上市也需要推）。 */
export const FOCUS_FORBIDDEN_LIFECYCLE = new Set(['eol']);

export interface FocusGateInput {
  /** 产品生命周期阶段（ProductEntity.lifecycleStage） */
  lifecycleStage?: string | null;
  /** 已批准的定价政策（无则视为无定价依据 → 毛利闸不通过） */
  pricing?: { proposedPrice?: number | null; costPrice?: number | null; status?: string | null } | null;
  /** 该产品的卖点列表（只有带 evidenceRef 的才算有事实依据） */
  sellingPoints?: { claim?: string | null; evidenceRef?: string | null }[];
  /** 毛利下限（来自 PRICING_MARGIN_FLOOR，与基座3 同源） */
  marginFloor: number;
}

/**
 * 判定主销资格。三道闸**全部通过**才可生效；任一不通过则返回原因，
 * 调用方须如实展示而不是静默降级为"已生效"。
 */
export function evaluateFocusEligibility(input: FocusGateInput): FocusEligibility {
  const checks: FocusGateCheck[] = [];

  // ① 毛利闸（基座3）
  const pricing = input.pricing;
  if (!pricing || pricing.proposedPrice == null || pricing.costPrice == null) {
    checks.push({
      id: 'margin',
      passed: false,
      reason: '缺少已批准的定价政策（无拟定价/成本），无法核算毛利 —— 主销须先过毛利闸（基座3）',
      detail: { hasPricing: Boolean(pricing) },
    });
  } else if (pricing.status && pricing.status !== 'approved') {
    checks.push({
      id: 'margin',
      passed: false,
      reason: `定价政策状态为「${pricing.status}」，未获批准 —— 未批准的价格不得据以设为主销`,
      detail: { status: pricing.status },
    });
  } else {
    const m = computeMargin(Number(pricing.proposedPrice), Number(pricing.costPrice), input.marginFloor);
    checks.push({
      id: 'margin',
      passed: m.gatePassed,
      reason: m.gatePassed
        ? `毛利率 ${(m.marginRate * 100).toFixed(1)}% ≥ 下限 ${(m.floor * 100).toFixed(1)}%`
        : `毛利率 ${(m.marginRate * 100).toFixed(1)}% 低于下限 ${(m.floor * 100).toFixed(1)}% —— 推得越多亏得越多`,
      detail: { marginRate: m.marginRate, marginAmt: m.marginAmt, floor: m.floor },
    });
  }

  // ② 生命周期闸
  const stage = String(input.lifecycleStage || '').trim();
  if (!stage) {
    checks.push({
      id: 'lifecycle',
      passed: false,
      reason: '产品生命周期阶段未设置 —— 无法确认是否在售',
      detail: { lifecycleStage: null },
    });
  } else {
    const forbidden = FOCUS_FORBIDDEN_LIFECYCLE.has(stage);
    checks.push({
      id: 'lifecycle',
      passed: !forbidden,
      reason: forbidden
        ? `生命周期为「${stage}」（停产），不得设为主销 —— 引流来了无货可交`
        : `生命周期为「${stage}」，在售`,
      detail: { lifecycleStage: stage },
    });
  }

  // ③ 卖点证据闸（基座4）
  const points = Array.isArray(input.sellingPoints) ? input.sellingPoints : [];
  const withEvidence = points.filter(
    (p) => String(p?.claim || '').trim() && String(p?.evidenceRef || '').trim(),
  );
  checks.push({
    id: 'selling-point-evidence',
    passed: withEvidence.length > 0,
    reason: withEvidence.length
      ? `有 ${withEvidence.length} 条带事实依据的卖点，可作为 GEO 内容的事实来源`
      : points.length
        ? `${points.length} 条卖点均无 evidenceRef —— 无事实依据的卖点不能支撑对外内容（基座4）`
        : '尚无卖点 —— 主销产品必须先有带事实依据的卖点，否则 GEO 内容只能编造',
    detail: { total: points.length, withEvidence: withEvidence.length },
  });

  const blockedBy = checks.filter((c) => !c.passed).map((c) => c.id);
  return { eligible: blockedBy.length === 0, checks, blockedBy };
}
