import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPerceptionAccess, perceptionActor } from './gtm-digest.controller';
import { GtmDigestService } from './gtm-digest.service';
import type { MetricsService } from './metrics.service';

// ── 鉴权闸 ──────────────────────────────────────────────────────────────

test('未配置令牌/租户 → 503 (桥未启用, 诚实告知)', () => {
  const r = checkPerceptionAccess({}, 'Bearer x');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 503);
});

test('缺 GTM_PERCEPTION_TENANT_ID → 仍是 503 (令牌单独存在不放行)', () => {
  const r = checkPerceptionAccess({ GTM_PERCEPTION_TOKEN: 'secret' }, 'Bearer secret');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 503);
});

test('令牌不匹配 → 401', () => {
  const env = { GTM_PERCEPTION_TOKEN: 'secret', GTM_PERCEPTION_TENANT_ID: 't1' };
  for (const header of [undefined, '', 'Bearer wrong', 'Basic secret']) {
    const r = checkPerceptionAccess(env, header);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 401, `header=${header}`);
  }
});

test('令牌匹配 → 放行并带回固定租户', () => {
  const r = checkPerceptionAccess(
    { GTM_PERCEPTION_TOKEN: 'secret', GTM_PERCEPTION_TENANT_ID: 't1' },
    'Bearer secret',
  );
  assert.deepEqual(r, { ok: true, tenantId: 't1' });
});

test('合成 actor: 固定服务身份 + 只读角色 + 指定租户', () => {
  const a = perceptionActor('t1');
  assert.equal(a.tenantId, 't1');
  assert.equal(a.userId, 'stratos-perception');
  assert.equal(a.role, 'service-readonly');
  assert.deepEqual(a.permissions, []);
});

// ── 摘要聚合 ────────────────────────────────────────────────────────────

function fakeMetrics(rollup: Array<Record<string, unknown>>, channels: Array<Record<string, unknown>>) {
  return {
    getDailyRollup: async () => ({ rollup }),
    getChannelAttribution: async (_a: unknown, period: string, model: string) => ({ period, model, channels }),
  } as unknown as MetricsService;
}

test('漏斗跨行累加 + lead→revenue 转化率', async () => {
  const svc = new GtmDigestService(fakeMetrics(
    [
      { reach: 100, lead: 10, visit: 5, proposal: 3, revenue: 2, referral: 1 },
      { reach: 50, lead: 10, visit: 2, proposal: 1, revenue: 2, referral: 0 },
    ],
    [{ channel: 'geo', creditedConversions: 3, share: 1, touches: 9 }],
  ));
  const d = await svc.buildDigest(perceptionActor('t1'), { days: 30, period: '2026-08' });
  assert.equal(d.funnel.reach, 150);
  assert.equal(d.funnel.lead, 20);
  assert.equal(d.funnel.revenue, 4);
  assert.equal(d.funnel.leadToRevenueRate, 0.2);
  assert.equal(d.funnel.rollupRows, 2);
  assert.equal(d.attribution.channels.length, 1);
  assert.equal(d.dataSource, 'metrics-read-model');
});

test('lead=0 → 转化率为 null (区分"没线索"与"零转化")', async () => {
  const svc = new GtmDigestService(fakeMetrics([], []));
  const d = await svc.buildDigest(perceptionActor('t1'), {});
  assert.equal(d.funnel.leadToRevenueRate, null);
  assert.equal(d.funnel.rollupRows, 0);
});

test('days 越界收敛到 [1, 180]', async () => {
  const svc = new GtmDigestService(fakeMetrics([], []));
  const low = await svc.buildDigest(perceptionActor('t1'), { days: 0 });
  const high = await svc.buildDigest(perceptionActor('t1'), { days: 9999 });
  assert.equal(low.window.days, 1);
  assert.equal(high.window.days, 180);
});
