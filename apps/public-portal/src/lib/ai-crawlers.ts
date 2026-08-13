/**
 * AI 爬虫清单（检索型 / 训练型）—— GEO「能被抓取」环的单一真相源
 *
 * 出处与检索日期：2026-08-13
 *  - OpenAI 官方：developers.openai.com/api/docs/bots
 *    原文要点：OAI-SearchBot 用于 ChatGPT 搜索结果；**被 opt-out 的站点不会出现在
 *    ChatGPT 搜索答案中**；GPTBot（训练）与 OAI-SearchBot（检索）是**相互独立**的设置。
 *  - 交叉核对：geodocs.dev/technical/robots-txt-for-ai-crawlers-spec、aicrawlability.com
 *    一致口径：检索型决定"能否被引用"，训练型决定"是否被用于训练"，两者应分开决策。
 *
 * 为什么分成两类而不是一把放行：
 *   放行检索型 = 争取被 AI 答案引用（GEO 的目的）；
 *   放行训练型 = 内容被用于训练模型（是**商业/法务决策**，不是技术默认值）。
 *   把两者混为一谈，等于让工程默认值替业务做决策。
 *
 * ⚠️ 诚实边界：robots 是**自愿协议**——不合规抓取方会忽略它；且"放行"是被引用的
 * 必要非充分条件（放行与被引用是相关关系，未经证实为因果）。不得据此宣称可见度提升。
 */

/** 检索型：抓取以回答用户实时提问，决定能否在 AI 答案中被引用 → 应放行。 */
export const AI_RETRIEVAL_CRAWLERS = [
  'OAI-SearchBot', // OpenAI · ChatGPT 搜索索引（被拦则不会出现在 ChatGPT 搜索答案）
  'ChatGPT-User', // OpenAI · 用户会话内取页
  'Claude-SearchBot', // Anthropic · Claude 搜索索引
  'Claude-User', // Anthropic · 用户会话内取页
  'PerplexityBot', // Perplexity · 索引并引用
  'Perplexity-User', // Perplexity · 用户会话内取页
  'Googlebot', // Google · 传统搜索 + AI Overviews / AI Mode
  'Bingbot', // Microsoft · 搜索 + Copilot 索引
] as const;

/**
 * 训练型：抓取用于训练基础模型，**不直接**带来引用。
 * 当前策略：不做 Disallow（即随通配规则允许）。若业务/法务决定拒绝训练用途，
 * 在此登记并在 robots 中对这些 UA 显式 Disallow —— 决策点显式留在代码里，便于审阅。
 */
export const AI_TRAINING_CRAWLERS = [
  'GPTBot', // OpenAI 训练
  'ClaudeBot', // Anthropic 训练
  'CCBot', // Common Crawl（被多家用作训练语料）
  'Google-Extended', // Google Gemini 训练用途开关（不实际抓取）
  'Applebot-Extended', // Apple Intelligence 训练用途开关
  'Bytespider', // 字节跳动（豆包相关）训练抓取
] as const;

export type AiRetrievalCrawler = (typeof AI_RETRIEVAL_CRAWLERS)[number];
export type AiTrainingCrawler = (typeof AI_TRAINING_CRAWLERS)[number];
