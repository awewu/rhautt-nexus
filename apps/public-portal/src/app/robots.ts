import type { MetadataRoute } from 'next';
import { GROUP } from '../lib/brand';
import { AI_RETRIEVAL_CRAWLERS } from '../lib/ai-crawlers';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${GROUP.domain}`;

/**
 * robots.txt —— GEO 因果链第一环「能被抓取」。
 *
 * 为什么要**显式**列出检索型 AI 爬虫（而不只依赖通配 `*: Allow: /`）：
 *  1. OpenAI 官方文档明确：被 opt-out 掉 OAI-SearchBot 的站点**不会出现在 ChatGPT 搜索答案中**
 *     （developers.openai.com/api/docs/bots，检索 2026-08-13）。这是"能否被引用"的硬前置。
 *  2. 通配放行在语义上已足够，但**不可审计**——一旦有人后续加 Disallow 或 CDN/WAF 侧
 *     误拦，无人察觉。显式命名后由 `guard:ai-crawlability` 守护，回退即红灯。
 *  3. 检索型与训练型是**两个独立决策**：可以允许被引用、同时拒绝被用于训练。
 *     此处对训练型不做 Disallow（保持现状=允许），但把决策位置显式留在代码里供审阅，
 *     而不是藏在一条通配规则背后。
 *
 * ⚠️ 诚实边界：robots 放行是被引用的**必要非充分**条件——放行≠一定被引用，
 * 二者是相关而非因果（见 §GEO 策略库）。不得据此宣称可见度提升。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      // 检索型：决定能否出现在 AI 答案并被引用 → 明确放行
      ...AI_RETRIEVAL_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/' })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
