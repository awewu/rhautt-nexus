import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AiGatewayService } from './ai-gateway.service';

/**
 * Tandem 统一治理网关收口路径测试（contracts/ai/tandem-governed-chat.contract.md）：
 *   1. 配置 TANDEM_AI_GATEWAY_URL/TOKEN 时，hermes-center-ai 文案生成优先走
 *      POST /api/gateway/ai-chat（Bearer 令牌、intent、user-only messages）；
 *   2. 网关失败时回退 legacy /api/llm-stream（阶梯降级，不静默丢请求）；
 *   3. 本地 scanCompliance 打标在网关路径依然生效（双保险）。
 */

const GATEWAY_ENV_KEYS = [
  'TANDEM_AI_GATEWAY_URL',
  'TANDEM_AI_GATEWAY_TOKEN',
  'HERMES_CENTER_AI_BASE_URL',
  'HERMES_CENTER_AI_PROVIDER',
  'HERMES_CENTER_AI_AUTH_HEADER',
  'HERMES_CENTER_AI_AUTH_TOKEN',
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const key of GATEWAY_ENV_KEYS) snap[key] = process.env[key];
  return snap;
}

function restoreEnvSnapshot(snap: Record<string, string | undefined>) {
  for (const key of GATEWAY_ENV_KEYS) {
    if (snap[key] === undefined) delete process.env[key];
    else process.env[key] = snap[key];
  }
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } }
  );
}

test('copy generation prefers Tandem governed gateway when configured', async () => {
  const snap = snapshotEnv();
  const oldFetch = global.fetch;
  let capturedUrl = '';
  let capturedAuth = '';
  let capturedBody: any = null;

  process.env.TANDEM_AI_GATEWAY_URL = 'https://tandem.test/';
  process.env.TANDEM_AI_GATEWAY_TOKEN = 'gtm-gateway-token';
  // legacy 也配置，验证优先级在网关侧
  process.env.HERMES_CENTER_AI_BASE_URL = 'https://center-ai.test';

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedAuth = (init?.headers as Record<string, string>).authorization;
    capturedBody = JSON.parse(String(init?.body || '{}'));
    return new Response(
      JSON.stringify({ ok: true, answer: '标题：地暖挑选指南（治理网关草稿，绝对好用）', checkId: 'chk-1' }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const service = new AiGatewayService();
    const result = await service.generateDraft({
      provider: 'hermes-center-ai',
      requireRealProvider: true,
      channel: 'xiaohongshu',
      prompt: '家用地暖怎么选',
      brand: { name: 'Rhautt Comfort' },
    });

    assert.equal(capturedUrl, 'https://tandem.test/api/gateway/ai-chat');
    assert.equal(capturedAuth, 'Bearer gtm-gateway-token');
    assert.equal(capturedBody.intent, 'gtm.copy.xiaohongshu');
    // 网关禁止 system 角色：只允许 user/assistant
    for (const m of capturedBody.messages) {
      assert.notEqual(m.role, 'system');
    }
    assert.equal(result.provider, 'hermes-center-ai');
    assert.equal(result.model, 'tandem-governed-chat');
    assert.match(result.draft, /治理网关草稿/);
    // 本地合规打标在网关路径依然生效（“绝对”命中基线词库）
    assert.ok(result.complianceFlags.includes('绝对'));
  } finally {
    restoreEnvSnapshot(snap);
    global.fetch = oldFetch;
  }
});

test('copy generation falls back to legacy llm-stream when governed gateway fails', async () => {
  const snap = snapshotEnv();
  const oldFetch = global.fetch;
  const urls: string[] = [];

  process.env.TANDEM_AI_GATEWAY_URL = 'https://tandem.test';
  process.env.TANDEM_AI_GATEWAY_TOKEN = 'gtm-gateway-token';
  process.env.HERMES_CENTER_AI_BASE_URL = 'https://center-ai.test';
  process.env.HERMES_CENTER_AI_PROVIDER = 'qwen-max';

  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/api/gateway/ai-chat')) {
      return new Response(JSON.stringify({ ok: false, error: 'gateway down' }), { status: 502 });
    }
    return sseResponse(['data: {"content":"回退路径草稿正文"}\n\n']);
  }) as typeof fetch;

  try {
    const service = new AiGatewayService();
    const result = await service.generateDraft({
      provider: 'hermes-center-ai',
      requireRealProvider: true,
      channel: 'wechat',
      prompt: '两联供是什么',
    });

    assert.deepEqual(urls, [
      'https://tandem.test/api/gateway/ai-chat',
      'https://center-ai.test/api/llm-stream',
    ]);
    assert.equal(result.model, 'qwen-max');
    assert.match(result.draft, /回退路径草稿正文/);
  } finally {
    restoreEnvSnapshot(snap);
    global.fetch = oldFetch;
  }
});

test('governed gateway is skipped entirely when not configured (legacy unchanged)', async () => {
  const snap = snapshotEnv();
  const oldFetch = global.fetch;
  const urls: string[] = [];

  delete process.env.TANDEM_AI_GATEWAY_URL;
  delete process.env.TANDEM_AI_GATEWAY_TOKEN;
  process.env.HERMES_CENTER_AI_BASE_URL = 'https://center-ai.test';

  global.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return sseResponse(['data: {"content":"legacy 直连草稿"}\n\n']);
  }) as typeof fetch;

  try {
    const service = new AiGatewayService();
    const result = await service.generateDraft({
      provider: 'hermes-center-ai',
      requireRealProvider: true,
      channel: 'zhihu',
      prompt: '空气源热泵原理',
    });

    assert.deepEqual(urls, ['https://center-ai.test/api/llm-stream']);
    assert.match(result.draft, /legacy 直连草稿/);
  } finally {
    restoreEnvSnapshot(snap);
    global.fetch = oldFetch;
  }
});
