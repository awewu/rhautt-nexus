import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeoLoopState, normalizePublicationUrl, qwenProviderName } from './geo-loop';

test('GEO loop exposes one honest next action for every phase', () => {
  assert.equal(
    buildGeoLoopState({ status: 'baseline', baselineCitedRate: null }).nextAction,
    'wait-for-baseline'
  );
  assert.equal(
    buildGeoLoopState({ status: 'baseline', baselineCitedRate: 0 }).nextAction,
    'generate-fact-grounded-draft'
  );
  assert.equal(
    buildGeoLoopState(
      { status: 'baseline', baselineCitedRate: 0, copyAssetId: 'copy-1' },
      { status: 'draft' }
    ).nextAction,
    'approve-draft'
  );
  assert.equal(
    buildGeoLoopState(
      { status: 'baseline', baselineCitedRate: 0, copyAssetId: 'copy-1' },
      { status: 'approved' }
    ).nextAction,
    'record-publication-evidence'
  );
  assert.equal(
    buildGeoLoopState(
      {
        status: 'content-linked',
        baselineCitedRate: 0,
        copyAssetId: 'copy-1',
        publicationUrl: 'https://example.com/a',
      },
      { status: 'published' }
    ).nextAction,
    'verify-lift'
  );
  assert.equal(buildGeoLoopState({ status: 'verifying' }).nextAction, 'wait-for-lift');
  assert.deepEqual(buildGeoLoopState({ status: 'improved', lift: 10 }), {
    phase: 'completed',
    nextAction: 'review-result',
    terminal: true,
  });
});

test('publication evidence accepts only absolute HTTP(S) URLs', () => {
  assert.equal(normalizePublicationUrl('javascript:alert(1)'), '');
  assert.equal(normalizePublicationUrl('/relative'), '');
  assert.equal(normalizePublicationUrl('http://localhost:3000/article'), '');
  assert.equal(normalizePublicationUrl('https://192.168.1.10/article'), '');
  assert.equal(normalizePublicationUrl('https://user:pass@example.com/article'), '');
  assert.equal(
    normalizePublicationUrl('https://www.rheem.com.cn/article'),
    'https://www.rheem.com.cn/article'
  );
});

test('Qwen is the explicit default behind the governed center AI adapter', () => {
  assert.equal(qwenProviderName(undefined), 'qwen-max');
  assert.equal(qwenProviderName(' qwen-plus '), 'qwen-plus');
});
