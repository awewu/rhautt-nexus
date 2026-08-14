import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateLift,
  wilsonInterval,
  newcombeDiffInterval,
  MIN_ARM_SAMPLES,
} from './experiment-stats';

// ── Wilson 区间：对照教科书已知值 ──

test('Wilson 区间：8/10 的 95%CI ≈ [49.0, 94.3]（教科书标准值）', () => {
  const [lo, hi] = wilsonInterval(8, 10);
  assert.ok(Math.abs(lo - 49.0) < 1, `lo=${lo}`);
  assert.ok(Math.abs(hi - 94.3) < 1, `hi=${hi}`);
});

test('Wilson 区间：0/5 下界为 0，1/1 不产出 [100,100] 的过度自信', () => {
  const [lo] = wilsonInterval(0, 5);
  assert.equal(lo, 0);
  const [l2, h2] = wilsonInterval(1, 1);
  assert.ok(l2 < 30, '单次成功不应给出高下界');
  assert.equal(h2, 100);
});

// ── 最小样本闸：这正是修的 bug ──

test('1 次对 1 次：即使 0%→100% 也拒绝下结论（此前会判 improved）', () => {
  const r = evaluateLift({ baselineCited: 0, baselineTotal: 1, verifyCited: 1, verifyTotal: 1 });
  assert.equal(r.verdict, 'insufficient-data');
  assert.equal(r.ci95, null);
  assert.ok(r.conclusion.includes('样本不足'));
  assert.ok(r.conclusion.includes('不下结论'));
});

test('样本不足时明确告知还差几次', () => {
  const r = evaluateLift({ baselineCited: 2, baselineTotal: 3, verifyCited: 4, verifyTotal: 5 });
  assert.equal(r.verdict, 'insufficient-data');
  assert.ok(r.conclusion.includes(`基线 ${MIN_ARM_SAMPLES - 3} 次`));
});

// ── 方向判定：CI 决定，不是点估计决定 ──

test('大幅提升且样本够：improved，CI 下界 > 0', () => {
  const r = evaluateLift({ baselineCited: 1, baselineTotal: 10, verifyCited: 9, verifyTotal: 10 });
  assert.equal(r.verdict, 'improved');
  assert.ok(r.ci95![0] > 0);
  assert.ok(r.conclusion.includes('95%CI'));
  assert.ok(r.conclusion.includes('不构成因果证明'), '前后对比设计必须声明混杂限制');
});

test('小幅波动（4/10→6/10）：点估计+20 但 CI 跨 0 → no-change 且措辞是"未达显著"', () => {
  const r = evaluateLift({ baselineCited: 4, baselineTotal: 10, verifyCited: 6, verifyTotal: 10 });
  assert.equal(r.verdict, 'no-change');
  assert.equal(r.liftPoints, 20, '点估计照实报');
  assert.ok(r.ci95![0] < 0 && r.ci95![1] > 0, 'CI 应跨 0');
  assert.ok(r.conclusion.includes('未达显著'));
  assert.ok(r.conclusion.includes('不是"没有效果"'), '不得把不显著说成无效');
});

test('显著下降（9/10→1/10）：regressed，CI 上界 < 0', () => {
  const r = evaluateLift({ baselineCited: 9, baselineTotal: 10, verifyCited: 1, verifyTotal: 10 });
  assert.equal(r.verdict, 'regressed');
  assert.ok(r.ci95![1] < 0);
});

// ── 设计口径 ──

test('design 永远是 before-after，防止下游包装成 RCT', () => {
  const r = evaluateLift({ baselineCited: 1, baselineTotal: 10, verifyCited: 9, verifyTotal: 10 });
  assert.equal(r.design, 'before-after');
});

test('Newcombe 区间对称性检查：交换两臂方向取反', () => {
  const [lo, hi] = newcombeDiffInterval(2, 10, 8, 10);
  const [lo2, hi2] = newcombeDiffInterval(8, 10, 2, 10);
  assert.ok(Math.abs(lo + hi2) < 0.001);
  assert.ok(Math.abs(hi + lo2) < 0.001);
});
