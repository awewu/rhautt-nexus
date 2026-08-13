/**
 * decision.v1 契约测试 (GTM 消费副本侧)
 * ─────────────────────────────────────────────────────
 * 1. 指纹锚定: vendored 副本的 SPEC 哈希 === CONTRACT_FINGERPRINT (防单方面漂移)。
 * 2. producer 契约: 本仓 Campaign adapter 产出的真实 payload 必须通过共享校验器
 *    validateDecisionInput — 与 Tandem 网关裁决是同一套规则。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTRACT_FINGERPRINT,
  computeContractFingerprint,
  validateDecisionInput,
} from '../../contracts/decision/decision.v1.contract';
import { buildCampaignDecisionPayload, type CampaignLike } from './decision-sync';

test('契约指纹: vendored 副本与锚定值一致', () => {
  assert.equal(computeContractFingerprint(), CONTRACT_FINGERPRINT);
});

const base: CampaignLike = {
  id: 'c-01',
  name: '热泵欧洲上市战役',
  buType: 'bet',
  buRef: 'bet-hp',
  period: '2026Q3',
  budget: 500000,
  spend: 120000,
  attributedRevenue: 300000,
  status: 'planned',
  updatedAt: '2026-08-12T10:00:00.000Z',
};

test('producer 契约: planned campaign → proposed payload 通过共享校验器, betId 贯穿', () => {
  const p = buildCampaignDecisionPayload(base, '');
  const r = validateDecisionInput(p);
  assert.equal(r.ok, true, r.ok ? undefined : r.error);
  assert.equal(p.betId, 'bet-hp');
  assert.equal(p.actualOutcome, 'spend=120000; attributedRevenue=300000');
});

test('producer 契约: 人类署名的 closed campaign → decided payload 通过共享校验器', () => {
  const p = buildCampaignDecisionPayload({ ...base, status: 'closed' }, 'ops@rhautt.com');
  const r = validateDecisionInput(p);
  assert.equal(r.ok, true, r.ok ? undefined : r.error);
  assert.equal(p.status, 'decided');
  assert.equal(p.decidedBy, 'ops@rhautt.com');
});

test('治理纪律: 服务账号署名的 decided payload 被共享校验器拒绝', () => {
  const p = buildCampaignDecisionPayload({ ...base, status: 'closed' }, '__service_gtm');
  assert.equal(validateDecisionInput(p).ok, false);
});
