export type GeoLoopPhase =
  | 'baseline-running'
  | 'content-needed'
  | 'content-review'
  | 'publication-needed'
  | 'ready-to-verify'
  | 'verification-running'
  | 'completed';

export interface GeoLoopExperimentView {
  status: string;
  baselineCitedRate?: number | null;
  verifyCitedRate?: number | null;
  lift?: number | null;
  copyAssetId?: string | null;
  publicationUrl?: string | null;
}

export interface GeoLoopCopyView {
  status?: string | null;
}

export function qwenProviderName(value = process.env.HERMES_CENTER_AI_PROVIDER): string {
  const provider = String(value || 'qwen-max').trim();
  return provider || 'qwen-max';
}

export function normalizePublicationUrl(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const privateHost =
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^169\.254\./.test(hostname);
    return privateHost ? '' : url.toString();
  } catch {
    return '';
  }
}

export function buildGeoLoopState(
  experiment: GeoLoopExperimentView,
  copyAsset?: GeoLoopCopyView | null
): { phase: GeoLoopPhase; nextAction: string; terminal: boolean } {
  if (['improved', 'no-change', 'regressed', 'killed'].includes(experiment.status)) {
    return { phase: 'completed', nextAction: 'review-result', terminal: true };
  }
  if (experiment.status === 'verifying') {
    return { phase: 'verification-running', nextAction: 'wait-for-lift', terminal: false };
  }
  if (experiment.status === 'content-linked' && experiment.publicationUrl) {
    return { phase: 'ready-to-verify', nextAction: 'verify-lift', terminal: false };
  }
  if (experiment.baselineCitedRate === null || experiment.baselineCitedRate === undefined) {
    return { phase: 'baseline-running', nextAction: 'wait-for-baseline', terminal: false };
  }
  if (!experiment.copyAssetId) {
    return { phase: 'content-needed', nextAction: 'generate-fact-grounded-draft', terminal: false };
  }
  if (copyAsset?.status !== 'approved' && copyAsset?.status !== 'published') {
    return { phase: 'content-review', nextAction: 'approve-draft', terminal: false };
  }
  return {
    phase: 'publication-needed',
    nextAction: 'record-publication-evidence',
    terminal: false,
  };
}
