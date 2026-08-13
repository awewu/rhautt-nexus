export type PromptEvidenceState =
  'unverified' | 'promising' | 'proven' | 'negative' | 'inconclusive';

export type PromptEvidence = {
  verifiedCount: number;
  positiveCount: number;
  negativeCount: number;
  averageLift: number | string;
};

export function promptEvidenceState(evidence: PromptEvidence): PromptEvidenceState {
  const verified = Number(evidence.verifiedCount || 0);
  const positive = Number(evidence.positiveCount || 0);
  const average = Number(evidence.averageLift || 0);
  if (!verified) return 'unverified';
  if (average < 0) return 'negative';
  if (average === 0) return 'inconclusive';
  if (verified >= 2 && positive >= 2) return 'proven';
  return 'promising';
}

export function comparePromptEvidence<
  T extends PromptEvidence & { usageCount?: number; updatedAt?: Date | string },
>(a: T, b: T): number {
  const stateRank: Record<PromptEvidenceState, number> = {
    proven: 4,
    promising: 3,
    unverified: 2,
    inconclusive: 1,
    negative: 0,
  };
  const stateDelta = stateRank[promptEvidenceState(b)] - stateRank[promptEvidenceState(a)];
  if (stateDelta) return stateDelta;
  const liftDelta = Number(b.averageLift || 0) - Number(a.averageLift || 0);
  if (liftDelta) return liftDelta;
  const verifiedDelta = Number(b.verifiedCount || 0) - Number(a.verifiedCount || 0);
  if (verifiedDelta) return verifiedDelta;
  const usageDelta = Number(b.usageCount || 0) - Number(a.usageCount || 0);
  if (usageDelta) return usageDelta;
  return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
}

export function aggregatePromptLift(
  current: {
    verifiedCount: number;
    positiveCount: number;
    negativeCount: number;
    totalLift: number;
  },
  lifts: number[]
) {
  const totalLift = current.totalLift + lifts.reduce((sum, lift) => sum + lift, 0);
  const verifiedCount = current.verifiedCount + lifts.length;
  return {
    verifiedCount,
    positiveCount: current.positiveCount + lifts.filter((lift) => lift > 0).length,
    negativeCount: current.negativeCount + lifts.filter((lift) => lift < 0).length,
    totalLift,
    averageLift: verifiedCount ? Math.round((totalLift / verifiedCount) * 100) / 100 : 0,
  };
}
