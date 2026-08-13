# 契约 · Tandem 中央治理 AI（governed-chat）

> 决策(§7-3)：Nexus 营销/GEO/问诊/陪跑等 AI 一律**收口到 Tandem 中央治理 AI**。本契约定义 Nexus(消费方) 与 Tandem(提供方) 的接口边界。
> 三产品收敛：**Tandem = 中央治理大脑；Nexus / StratOS = 消费方**。

## 提供方 / 消费方

- **提供方**：Tandem 仓（hermes-tandem），已落地统一网关 **`POST /api/gateway/ai-chat`**（Bearer 服务令牌 `AI_GATEWAY_GTM_TOKEN`，输入闸 → LLM router → 输出闸 → 审计）。早期设想的 `/api/ai/governed-chat` 已由该网关实现替代。
- **消费方**：Nexus `services/api/src/modules/growth/ai-gateway.service.ts`：`provider:'hermes-center-ai'` 文案生成已收口 —— 配置 `TANDEM_AI_GATEWAY_URL/TOKEN` 后优先走治理网关，回退阶梯见下。

## 现状（2026-08-13 已收口文案生成路径）

`generateHermesDraft()` 阶梯：**① Tandem 统一治理网关** `POST {TANDEM_AI_GATEWAY_URL}/api/gateway/ai-chat`（配置即优先）→ ② legacy `/api/llm-stream`（待网关全量后移除）→ ③ 确定性桩（仅 `requireRealProvider=false`）。三条路径均保留本地 `scanCompliance` 打标。GEO 探针（growth.service `runHermesCenterAiProbeRaw`）仍走 `/api/llm-stream`，为下一步收口对象。

### 历史背景（保留存档）

`ai-gateway.service` 的 `callHermesCenterAi()` 已 `fetch(${HERMES_CENTER_AI_BASE_URL}/api/llm-stream)`（SSE，teamProvider 默认 qwen-max），并内置 `scanCompliance`(广告法禁语) + draft 默认 + 成本标注 + fail-soft 回落确定性桩。
→ **升级路径**：把目标从 `/api/llm-stream`（裸流）改为 `/api/ai/governed-chat`（带治理闸），保留本地合规兜底。

## 接口（实际已实现版本）

```
POST {TANDEM_AI_GATEWAY_URL}/api/gateway/ai-chat
Headers: Authorization: Bearer {TANDEM_AI_GATEWAY_TOKEN}   (AI_GATEWAY_GTM_TOKEN，可单独轮换/吊销)
```

**请求**（system 角色禁止，由治理层注入；调用方 system 提示词并入首条 user 消息）

```json
{
  "intent": "gtm.copy.<channel>",
  "scenario": "high_frequency",
  "temperature": 0.72,
  "messages": [{ "role": "user|assistant", "content": "string" }],
  "maxTokens": 4096,
  "responseFormat": "text"
}
```

**响应**

```json
{
  "ok": true,
  "client": "gtm",
  "generatedAt": "ISO8601",
  "answer": "string",
  "gates": {},
  "warnings": ["string"],
  "checkId": "string(审计可溯)"
}
```

拦截时 `403 { ok:false, blocked, gates, error }`；未启用 `503`；令牌不匹配 `401`。usage 暂不透传，成本在 Tandem 侧集中计量（checkId 可溯）。

## 治理闸（Tandem 侧，四闸，呼应 governedChat）

1. **基线闸**：场景/角色鉴权（服务令牌 + scenario 白名单）。
2. **合规词闸**：广告法禁语/竞品抹黑/虚假承诺 → `blocked=true`。
3. **事实链闸**：`factRefs` 注入产品真参数/国标；产出**不得回写**精算内核/产品可信链。
4. **输出闸**：对外可见产出默认 `draft` 语义（核准在 Nexus 各引擎 service）。

- 每次调用记 model/tokens/cost/prompt 版本 → Tandem 审计（`auditId` 回传）。

## Fail-soft（Tandem 未就绪/超时）

Nexus 侧回落顺序（已实现）：`/api/gateway/ai-chat` → 现有 `hermes-center-ai /api/llm-stream` → 确定性桩（`stub:deterministic`）。**Nexus 本地 `scanCompliance` 始终兜底**，不因中央 AI 不可用而漏合规。

## 环境变量（Nexus）

收口路径：`TANDEM_AI_GATEWAY_URL` · `TANDEM_AI_GATEWAY_TOKEN` · `TANDEM_AI_GATEWAY_TIMEOUT_MS`（默认 60s）。
回退路径：`HERMES_CENTER_AI_BASE_URL` · `HERMES_CENTER_AI_AUTH_HEADER` · `HERMES_CENTER_AI_AUTH_TOKEN` · `HERMES_CENTER_AI_PROVIDER`（模型偏好，可插拔 DeepSeek/豆包/通义/qwen…）。

## 验收

- Nexus：`ai-gateway-governed.nodetest.ts` 覆盖 governed→llm-stream 回落、未配置时 legacy 不变、网关路径本地合规打标；`ai-gateway-hermes-copy.nodetest.ts` 保留 legacy 路径回归。
- Tandem：`/api/gateway/ai-chat` 已有鉴权/校验纯函数层（`lib/gateway/ai-gateway.ts`）+ 治理链 governedChat。
- 待办：GEO 探针收口、usage 透传（成本回传 Nexus governance 计量）。
