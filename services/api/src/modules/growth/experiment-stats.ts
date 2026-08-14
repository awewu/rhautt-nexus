/**
 * GEO 实验统计闸（因果链第五环「能验证」的核心）
 *
 * 背景：此前 lift 判定是 `verify - baseline > 0 即 improved`——1 次探测对 1 次探测
 * 也敢下"内容有效"的结论。北极星是「GEO→高意向线索」，用噪声冒充证据会把
 * 内容策略引向随机方向。本模块把结论收敛到统计上站得住的口径。
 *
 * 方法（教科书标准方法，无自创统计）：
 *  - 单臂比例区间：Wilson score interval（小样本表现优于正态近似）；
 *  - 两比例差区间：Newcombe hybrid score（Wilson 区间组合），95% 置信；
 *  - 最小样本闸：任一臂 < MIN_ARM 次探测 → 'insufficient-data'，并说明还差几次；
 *  - 方向判定：差值 95% CI 下界 > 0 → improved；上界 < 0 → regressed；
 *    区间跨 0 → 'no-change'（措辞为"未达显著"，不是"没有效果"）。
 *
 * ⚠️ 诚实边界：
 *  - 前后对比不是随机对照——时间混杂（引擎索引更新/竞品动作）无法排除，
 *    结论字段永远标注 design:'before-after'，不得表述为因果已证；
 *  - 探测次数少时（5-20），CI 会很宽——这是事实，不是缺陷；宽区间如实展示。
 */

export const MIN_ARM_SAMPLES = 5;
const Z95 = 1.959963984540054;

export interface LiftEvaluation {
  /** 点估计差值（百分点，verify - baseline） */
  liftPoints: number;
  verdict: 'improved' | 'regressed' | 'no-change' | 'insufficient-data';
  /** 差值 95% CI（百分点）；样本不足时为 null */
  ci95: [number, number] | null;
  baseline: { cited: number; total: number; rate: number; ci95: [number, number] };
  verify: { cited: number; total: number; rate: number; ci95: [number, number] };
  design: 'before-after';
  /** 人可读结论（含区间与口径限定） */
  conclusion: string;
}

/** Wilson score interval（返回百分点 0-100） */
export function wilsonInterval(cited: number, total: number): [number, number] {
  if (total <= 0) return [0, 100];
  const p = cited / total;
  const z2 = Z95 * Z95;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const half = (Z95 * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denom;
  return [Math.max(0, (center - half) * 100), Math.min(100, (center + half) * 100)];
}

/** Newcombe hybrid score：两比例差的 95% CI（百分点） */
export function newcombeDiffInterval(
  cited1: number,
  total1: number,
  cited2: number,
  total2: number
): [number, number] {
  const p1 = (cited1 / total1) * 100;
  const p2 = (cited2 / total2) * 100;
  const [l1, u1] = wilsonInterval(cited1, total1);
  const [l2, u2] = wilsonInterval(cited2, total2);
  const diff = p2 - p1;
  const lower = diff - Math.sqrt((p2 - l2) ** 2 + (u1 - p1) ** 2);
  const upper = diff + Math.sqrt((u2 - p2) ** 2 + (p1 - l1) ** 2);
  return [lower, upper];
}

export function evaluateLift(input: {
  baselineCited: number;
  baselineTotal: number;
  verifyCited: number;
  verifyTotal: number;
}): LiftEvaluation {
  const b = { cited: Math.max(0, input.baselineCited), total: Math.max(0, input.baselineTotal) };
  const v = { cited: Math.max(0, input.verifyCited), total: Math.max(0, input.verifyTotal) };
  const bRate = b.total ? Math.round((b.cited / b.total) * 100) : 0;
  const vRate = v.total ? Math.round((v.cited / v.total) * 100) : 0;
  const liftPoints = vRate - bRate;
  const baseline = { ...b, rate: bRate, ci95: wilsonInterval(b.cited, b.total) };
  const verify = { ...v, rate: vRate, ci95: wilsonInterval(v.cited, v.total) };

  if (b.total < MIN_ARM_SAMPLES || v.total < MIN_ARM_SAMPLES) {
    const needB = Math.max(0, MIN_ARM_SAMPLES - b.total);
    const needV = Math.max(0, MIN_ARM_SAMPLES - v.total);
    return {
      liftPoints,
      verdict: 'insufficient-data',
      ci95: null,
      baseline,
      verify,
      design: 'before-after',
      conclusion:
        `样本不足（基线 ${b.total} 次 / 复投 ${v.total} 次，每臂至少 ${MIN_ARM_SAMPLES} 次）` +
        `——还差${needB ? ` 基线 ${needB} 次` : ''}${needB && needV ? '、' : ''}${needV ? `复投 ${needV} 次` : ''}，` +
        '当前差值是噪声还是效果无法区分，不下结论。',
    };
  }

  const ci = newcombeDiffInterval(b.cited, b.total, v.cited, v.total);
  const [lo, hi] = ci.map((x) => Math.round(x * 10) / 10) as [number, number];
  const range = `95%CI [${lo}, ${hi}] 百分点`;
  const scope = '（前后对比设计，无法排除时间混杂，不构成因果证明）';

  if (lo > 0) {
    return {
      liftPoints,
      verdict: 'improved',
      ci95: [lo, hi],
      baseline,
      verify,
      design: 'before-after',
      conclusion: `出现率 ${bRate}%(${b.cited}/${b.total}) → ${vRate}%(${v.cited}/${v.total})，提升显著，${range}${scope}。`,
    };
  }
  if (hi < 0) {
    return {
      liftPoints,
      verdict: 'regressed',
      ci95: [lo, hi],
      baseline,
      verify,
      design: 'before-after',
      conclusion: `出现率 ${bRate}%(${b.cited}/${b.total}) → ${vRate}%(${v.cited}/${v.total})，下降显著，${range}${scope}，需复核内容或外部变化。`,
    };
  }
  return {
    liftPoints,
    verdict: 'no-change',
    ci95: [lo, hi],
    baseline,
    verify,
    design: 'before-after',
    conclusion: `出现率 ${bRate}%(${b.cited}/${b.total}) → ${vRate}%(${v.cited}/${v.total})，差异未达显著（${range} 跨 0）——不是"没有效果"，是当前样本量下无法判定方向；加大探测次数可收窄区间。`,
  };
}
