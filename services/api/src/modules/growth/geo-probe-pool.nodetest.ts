import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProbeSeeds, summarizeProbePool } from './geo-focus.service';

test('GEO probe pool seeds cover more than one question strategy', () => {
  const seeds = buildProbeSeeds('中央热水', { region: '华东' });
  const probeTypes = new Set(seeds.map((seed) => seed.probeType));
  assert.ok(seeds.length >= 10);
  assert.deepEqual([...probeTypes].sort(), ['category', 'comparison', 'pain_point', 'region', 'role', 'scenario', 'selection']);
  assert.ok(seeds.some((seed) => seed.query.includes('Rheem')));
  assert.ok(seeds.some((seed) => seed.query.includes('华东')));
});

test('GEO probe pool summary separates pool coverage from ignition', () => {
  const targets = [
    { probeType: 'category', intentStage: 'awareness', priorityScore: 88, lastProbedAt: new Date() },
    { probeType: 'comparison', intentStage: 'compare', priorityScore: 72, lastProbedAt: null },
    { probeType: 'scenario', intentStage: 'selection', priorityScore: 54, lastProbedAt: null },
  ] as any[];
  assert.deepEqual(summarizeProbePool(targets), {
    total: 3,
    highPriority: 2,
    probed: 1,
    byType: { category: 1, scenario: 1, comparison: 1, selection: 0, pain_point: 0, region: 0, role: 0 },
    byStage: { awareness: 1, compare: 1, selection: 1, quote: 0, after_sales: 0 },
    coverageRate: 1 / 3,
  });
});
