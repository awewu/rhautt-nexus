import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregatePromptLift,
  comparePromptEvidence,
  promptEvidenceState,
} from './prompt-reservoir';

test('saving a prompt does not claim effectiveness before an experiment', () => {
  assert.equal(
    promptEvidenceState({ verifiedCount: 0, positiveCount: 0, negativeCount: 0, averageLift: 0 }),
    'unverified'
  );
});

test('positive and negative experiment lifts update evidence counts', () => {
  assert.deepEqual(
    aggregatePromptLift(
      { verifiedCount: 0, positiveCount: 0, negativeCount: 0, totalLift: 0 },
      [20, -10, 0]
    ),
    { verifiedCount: 3, positiveCount: 1, negativeCount: 1, totalLift: 10, averageLift: 3.33 }
  );
});

test('ranking favors repeated positive evidence over unverified preference', () => {
  const templates = [
    {
      id: 'saved',
      verifiedCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      averageLift: 0,
      usageCount: 20,
    },
    {
      id: 'proven',
      verifiedCount: 2,
      positiveCount: 2,
      negativeCount: 0,
      averageLift: 12,
      usageCount: 2,
    },
    {
      id: 'negative',
      verifiedCount: 3,
      positiveCount: 0,
      negativeCount: 3,
      averageLift: -5,
      usageCount: 30,
    },
  ].sort(comparePromptEvidence);
  assert.deepEqual(
    templates.map((item) => item.id),
    ['proven', 'saved', 'negative']
  );
  assert.equal(promptEvidenceState(templates[0]), 'proven');
});
