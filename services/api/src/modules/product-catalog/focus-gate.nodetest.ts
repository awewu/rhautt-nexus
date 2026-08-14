import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFocusEligibility, FOCUS_FORBIDDEN_LIFECYCLE } from './focus-gate';

const FLOOR = 0.15;

function input(overrides: Partial<Parameters<typeof evaluateFocusEligibility>[0]> = {}) {
  return {
    lifecycleStage: 'mature',
    pricing: { proposedPrice: 10000, costPrice: 7000, status: 'approved' }, // 毛利 30%
    sellingPoints: [{ claim: '低温 -25℃ 稳定制热', evidenceRef: 'kernel:heatpump-lowtemp-2026' }],
    marginFloor: FLOOR,
    ...overrides,
  };
}

test('三闸全过 → 具备主销资格', () => {
  const r = evaluateFocusEligibility(input());
  assert.equal(r.eligible, true);
  assert.deepEqual(r.blockedBy, []);
  assert.equal(r.checks.length, 3);
  assert.ok(r.checks.every((c) => c.passed));
});

// ── 毛利闸（基座3）──

test('毛利率低于下限 → 拦下，且理由点明"推得越多亏得越多"', () => {
  const r = evaluateFocusEligibility(input({ pricing: { proposedPrice: 10000, costPrice: 9500, status: 'approved' } }));
  assert.equal(r.eligible, false);
  assert.deepEqual(r.blockedBy, ['margin']);
  const margin = r.checks.find((c) => c.id === 'margin')!;
  assert.ok(margin.reason.includes('低于下限'));
  assert.equal((margin.detail as any).marginRate, 0.05);
});

test('毛利率恰好等于下限 → 放行（边界含等号，与 computeMargin 同口径）', () => {
  // 价 10000 成本 8500 → 毛利率恰好 15%
  const r = evaluateFocusEligibility(input({ pricing: { proposedPrice: 10000, costPrice: 8500, status: 'approved' } }));
  assert.equal(r.eligible, true);
});

test('无定价政策 → 拦下（不得在无毛利依据时设主销）', () => {
  const r = evaluateFocusEligibility(input({ pricing: null }));
  assert.equal(r.eligible, false);
  assert.ok(r.blockedBy.includes('margin'));
  assert.ok(r.checks.find((c) => c.id === 'margin')!.reason.includes('无法核算毛利'));
});

test('定价政策未获批准 → 拦下（draft 价格不得据以设主销）', () => {
  const r = evaluateFocusEligibility(input({ pricing: { proposedPrice: 10000, costPrice: 5000, status: 'draft' } }));
  assert.equal(r.eligible, false);
  assert.ok(r.blockedBy.includes('margin'));
  assert.ok(r.checks.find((c) => c.id === 'margin')!.reason.includes('未获批准'));
});

// ── 生命周期闸 ──

test('停产(eol) → 拦下，理由点明无货可交', () => {
  const r = evaluateFocusEligibility(input({ lifecycleStage: 'eol' }));
  assert.equal(r.eligible, false);
  assert.deepEqual(r.blockedBy, ['lifecycle']);
  assert.ok(r.checks.find((c) => c.id === 'lifecycle')!.reason.includes('无货可交'));
});

test('新品(intro)与成长期(growth)允许主销（新品上市也需要推）', () => {
  for (const stage of ['intro', 'growth', 'mature']) {
    assert.equal(evaluateFocusEligibility(input({ lifecycleStage: stage })).eligible, true, stage);
  }
  assert.equal(FOCUS_FORBIDDEN_LIFECYCLE.has('eol'), true);
  assert.equal(FOCUS_FORBIDDEN_LIFECYCLE.has('mature'), false);
});

test('生命周期未设置 → 拦下（不假定在售）', () => {
  const r = evaluateFocusEligibility(input({ lifecycleStage: null }));
  assert.equal(r.eligible, false);
  assert.ok(r.blockedBy.includes('lifecycle'));
});

// ── 卖点证据闸（基座4）──

test('卖点无 evidenceRef → 拦下（无事实依据不能支撑对外内容）', () => {
  const r = evaluateFocusEligibility(input({ sellingPoints: [{ claim: '行业领先', evidenceRef: '' }] }));
  assert.equal(r.eligible, false);
  assert.deepEqual(r.blockedBy, ['selling-point-evidence']);
  assert.ok(r.checks.find((c) => c.id === 'selling-point-evidence')!.reason.includes('evidenceRef'));
});

test('完全无卖点 → 拦下，理由点明"只能编造"', () => {
  const r = evaluateFocusEligibility(input({ sellingPoints: [] }));
  assert.equal(r.eligible, false);
  const c = r.checks.find((x) => x.id === 'selling-point-evidence')!;
  assert.ok(c.reason.includes('编造'));
  assert.equal((c.detail as any).withEvidence, 0);
});

test('卖点有 evidenceRef 但 claim 为空 → 不计入（空声明不算事实来源）', () => {
  const r = evaluateFocusEligibility(input({ sellingPoints: [{ claim: '   ', evidenceRef: 'kernel:x' }] }));
  assert.equal(r.eligible, false);
  assert.ok(r.blockedBy.includes('selling-point-evidence'));
});

test('多条卖点中只要一条带证据即可放行，并如实计数', () => {
  const r = evaluateFocusEligibility(
    input({
      sellingPoints: [
        { claim: '口碑好', evidenceRef: '' },
        { claim: 'COP 4.2（AHRI 实测）', evidenceRef: 'ahri:340-360-cert' },
      ],
    }),
  );
  assert.equal(r.eligible, true);
  const c = r.checks.find((x) => x.id === 'selling-point-evidence')!;
  assert.equal((c.detail as any).total, 2);
  assert.equal((c.detail as any).withEvidence, 1);
});

// ── 多闸同时失败 ──

test('多闸同时不通过 → blockedBy 全量列出（不止报第一个）', () => {
  const r = evaluateFocusEligibility({
    lifecycleStage: 'eol',
    pricing: null,
    sellingPoints: [],
    marginFloor: FLOOR,
  });
  assert.equal(r.eligible, false);
  assert.deepEqual(r.blockedBy.sort(), ['lifecycle', 'margin', 'selling-point-evidence']);
});

test('通过的闸也给出理由（便于审计复核，不只在失败时说话）', () => {
  const r = evaluateFocusEligibility(input());
  for (const c of r.checks) assert.ok(c.reason.trim().length > 0, `${c.id} 缺理由`);
});
