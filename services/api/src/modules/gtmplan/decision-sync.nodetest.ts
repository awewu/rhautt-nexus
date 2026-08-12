import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCampaignDecisionPayload,
  syncDecisionToTandem,
  type CampaignLike,
} from './decision-sync';

function campaign(overrides: Partial<CampaignLike> = {}): CampaignLike {
  return {
    id: 'c-1',
    name: '2026 秋季热水器新品战役',
    buType: null,
    buRef: null,
    period: '2026Q3',
    budget: 500000,
    spend: 0,
    attributedRevenue: 0,
    status: 'planned',
    updatedAt: new Date('2026-08-12T10:00:00Z'),
    ...overrides,
  };
}

// ── payload 映射 ─────────────────────────────────────────────────────────

test('planned campaign → proposed, 无 finalDecision', () => {
  const p = buildCampaignDecisionPayload(campaign(), 'u-1');
  assert.equal(p.refId, 'campaign:c-1');
  assert.equal(p.type, 'campaign');
  assert.equal(p.status, 'proposed');
  assert.equal(p.finalDecision, undefined);
  assert.equal(p.decidedBy, undefined);
  assert.equal(p.expectedOutcome, 'budget=500000');
});

test('buType=bet 时 buRef 写入 betId (跨系统贯穿链)', () => {
  const p = buildCampaignDecisionPayload(campaign({ buType: 'bet', buRef: 'bet-hp' }), 'u-1');
  assert.equal(p.betId, 'bet-hp');
  assert.equal(p.evidenceRefs, undefined);
});

test('非 bet 的 buRef 进 evidenceRefs 而非 betId', () => {
  const p = buildCampaignDecisionPayload(campaign({ buType: 'brand', buRef: 'rheem-cn' }), 'u-1');
  assert.equal(p.betId, undefined);
  assert.deepEqual(p.evidenceRefs, ['gtm:bu:brand:rheem-cn']);
});

test('active + 人类操作者 → decided + finalDecision + decidedBy/decidedAt', () => {
  const p = buildCampaignDecisionPayload(campaign({ status: 'active' }), 'u-9');
  assert.equal(p.status, 'decided');
  assert.deepEqual(p.finalDecision, { decision: 'active', budget: 500000 });
  assert.equal(p.decidedBy, 'u-9');
  assert.equal(p.decidedAt, '2026-08-12T10:00:00.000Z');
});

test('active 但无操作者署名 → 保持 proposed (finalDecision 必须人类署名)', () => {
  const p = buildCampaignDecisionPayload(campaign({ status: 'active' }), '');
  assert.equal(p.status, 'proposed');
  assert.equal(p.finalDecision, undefined);
});

test('有 spend/收入时写 actualOutcome (结果回看素材)', () => {
  const p = buildCampaignDecisionPayload(campaign({ spend: 120000, attributedRevenue: 480000 }), 'u-1');
  assert.equal(p.actualOutcome, 'spend=120000; attributedRevenue=480000');
});

// ── HTTP 客户端 ──────────────────────────────────────────────────────────

const payload = buildCampaignDecisionPayload(campaign(), 'u-1');

test('未配置网关 → skipped, 不发请求', async () => {
  let called = false;
  const r = await syncDecisionToTandem(payload, {}, (async () => {
    called = true;
    return new Response(null, { status: 201 });
  }) as typeof fetch);
  assert.deepEqual(r, { ok: false, skipped: true });
  assert.equal(called, false);
});

test('201 成功 → ok, 且 URL/鉴权头正确', async () => {
  let url = '';
  let auth = '';
  const r = await syncDecisionToTandem(
    payload,
    { TANDEM_AI_GATEWAY_URL: 'https://tandem.example/', TANDEM_AI_GATEWAY_TOKEN: 'tok' },
    (async (input: any, init: any) => {
      url = String(input);
      auth = init.headers.authorization;
      return new Response('{}', { status: 201 });
    }) as typeof fetch,
  );
  assert.deepEqual(r, { ok: true, status: 201 });
  assert.equal(url, 'https://tandem.example/api/gateway/decisions');
  assert.equal(auth, 'Bearer tok');
});

test('HTTP 400 / 网络异常 → fail-soft 返回错误对象, 不抛', async () => {
  const env = { TANDEM_AI_GATEWAY_URL: 'https://t.example', TANDEM_AI_GATEWAY_TOKEN: 'tok' };
  const r400 = await syncDecisionToTandem(payload, env, (async () =>
    new Response('bad', { status: 400 })) as typeof fetch);
  assert.equal(r400.ok, false);
  if (!r400.ok && !('skipped' in r400 && r400.skipped)) assert.equal((r400 as any).status, 400);

  const rNet = await syncDecisionToTandem(payload, env, (async () => {
    throw new Error('ECONNREFUSED');
  }) as typeof fetch);
  assert.equal(rNet.ok, false);
  assert.match((rNet as any).error, /ECONNREFUSED/);
});
