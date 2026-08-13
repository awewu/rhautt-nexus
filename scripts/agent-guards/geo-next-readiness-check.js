#!/usr/bin/env node
/**
 * Next 应用对外站 GEO 就绪守卫 —— 填补 `guard:geo` 的 UNMEASURED 盲区
 *
 * 背景（不是补门禁数量，是补真实漏洞）：
 *   `guard:geo` 只扫 `{app}/public` 下的静态 HTML。集团站 rhautt.com 是 Next 应用，
 *   页面在 `src/app`，因此其 GEO 就绪度**长期未被任何门禁验证**——该门禁自己把这条
 *   写进了 `evidence/release-evidence.json#geoUnmeasuredSites` 并留了处置意见。
 *   官方站点恰恰是 AI 引擎最可能引用的权威来源，这个盲区代价最大。
 *
 * 本门禁做**源码级**校验（不需构建、不联网、确定性）：
 *   1. 根布局：metadataBase / title / description / robots —— 缺失则全站元数据无基准；
 *   2. 每个路由：必须有自己的 title+description+canonical（写在 page.tsx 或同目录 layout.tsx），
 *      否则整站共用一句描述 —— 引擎无从区分页面主题，是实打实的可见度损失；
 *   3. 关键实体路由必须输出对应 JSON-LD：产品详情=Product、产品列表=ItemList/CollectionPage、
 *      文章详情=Article。只有 Organization 等于每页都在说"我们是家公司"；
 *   4. robots.ts / sitemap.ts 必须存在，且 robots 必须显式放行**检索型** AI 爬虫
 *      （OpenAI 官方：被 opt-out 掉 OAI-SearchBot 的站点不会出现在 ChatGPT 搜索答案中）。
 *
 * ⚠️ 诚实边界：这是**源码级**校验，不等于渲染产物验证。渲染层仍需构建后检查
 *   （`.next/server/app/**\/*.html`）；本门禁只保证"源码里写了"，不保证"渲染出来了"。
 *   同时 robots 放行是被引用的必要非充分条件，不得据此宣称可见度提升。
 *
 * Run: node scripts/agent-guards/geo-next-readiness-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUTWARD_TYPES = new Set(['group', 'brand-site', 'consumer-app']);

/** 检索型 AI 爬虫（决定能否在 AI 答案中被引用）。与门户 lib/ai-crawlers.ts 同源口径。 */
const REQUIRED_RETRIEVAL_CRAWLERS = ['OAI-SearchBot', 'PerplexityBot'];

/** 关键实体路由 → 必须出现的 schema.org 类型（任一即可）。 */
const ENTITY_REQUIREMENTS = [
  { route: 'products/[id]', anyOf: ['Product'], why: '产品是最该被引用的实体；宪章要求产品页 JSON-LD 源自 D2' },
  { route: 'products', anyOf: ['ItemList', 'CollectionPage'], why: '列表页需让引擎知道罗列了哪些型号' },
  { route: 'news/[slug]', anyOf: ['Article', 'NewsArticle', 'BlogPosting'], why: 'Article 是 AI 答案最常引用的类型之一' },
];

const failures = [];
const notes = [];

function read(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function loadNextOutwardSites() {
  const reg = JSON.parse(read(path.join(ROOT, 'brand-registry.json')));
  const sites = [];
  for (const b of reg.brands || []) {
    if (!OUTWARD_TYPES.has(b.type)) continue;
    const appDir = path.join(ROOT, b.app);
    const isNext = ['next.config.js', 'next.config.mjs', 'next.config.ts'].some((f) =>
      fs.existsSync(path.join(appDir, f)),
    );
    const appRoot = ['src/app', 'app'].map((d) => path.join(appDir, d)).find((d) => fs.existsSync(d));
    if (isNext && appRoot) sites.push({ id: b.slug, domain: b.domain, appDir, appRoot, rel: b.app });
  }
  return sites;
}

/** 收集路由：每个含 page.tsx 的目录即一个路由。 */
function collectRoutes(appRoot) {
  const routes = [];
  (function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && /^page\.tsx?$/.test(e.name))) {
      routes.push(dir);
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
    }
  })(appRoot);
  return routes;
}

/** 路由自身或同目录 layout 中声明的元数据（Next 的实际继承约定：route-level layout 亦生效）。 */
function routeMetadataSource(routeDir) {
  let src = '';
  for (const f of ['page.tsx', 'page.ts', 'layout.tsx', 'layout.ts']) {
    const c = read(path.join(routeDir, f));
    if (c) src += '\n' + c;
  }
  return src;
}

function jsonLdTypes(src) {
  return [...src.matchAll(/['"]?@type['"]?\s*:\s*['"]([A-Za-z]+)['"]/g)].map((m) => m[1]);
}

const sites = loadNextOutwardSites();
if (!sites.length) {
  console.log('GEO Next 就绪守卫 —— 无 Next 对外站，跳过');
  process.exit(0);
}

for (const site of sites) {
  const label = `[${site.id}] ${site.domain}`;

  // ① 根布局元数据基准
  const rootLayout = read(path.join(site.appRoot, 'layout.tsx')) || read(path.join(site.appRoot, 'layout.ts'));
  if (!rootLayout) {
    failures.push(`${label} 缺少根 layout（全站元数据无基准）`);
  } else {
    for (const [key, re] of [
      ['metadataBase', /metadataBase\s*:/],
      ['title', /title\s*:/],
      ['description', /description\s*:/],
      ['robots', /robots\s*:/],
    ]) {
      if (!re.test(rootLayout)) failures.push(`${label} 根布局缺少 ${key}`);
    }
  }

  // ② 每个路由必须有自己的 title/description/canonical
  const routes = collectRoutes(site.appRoot);
  const missingMeta = [];
  for (const dir of routes) {
    const rel = '/' + path.relative(site.appRoot, dir).replace(/\\/g, '/');
    const src = routeMetadataSource(dir);
    const hasMetaBlock = /export const metadata|generateMetadata/.test(src);
    const hasTitle = /title\s*:/.test(src);
    const hasDesc = /description\s*:/.test(src);
    const hasCanonical = /canonical\s*:/.test(src);
    // 根路由（/）由根布局提供，允许缺 canonical 覆盖（根布局 canonical:'/' 即其自身）
    const isRoot = rel === '/.' || rel === '/';
    if (!hasMetaBlock || !hasTitle || !hasDesc || (!hasCanonical && !isRoot)) {
      const lack = [
        !hasMetaBlock ? 'metadata 块' : null,
        !hasTitle ? 'title' : null,
        !hasDesc ? 'description' : null,
        !hasCanonical && !isRoot ? 'canonical' : null,
      ].filter(Boolean);
      missingMeta.push(`${rel}（缺 ${lack.join('/')}）`);
    }
  }
  if (missingMeta.length) {
    failures.push(
      `${label} 以下路由缺页面级元数据（将共用全站描述，引擎无法区分页面主题）：\n    - ${missingMeta.join('\n    - ')}`,
    );
  } else {
    notes.push(`${label} ${routes.length} 个路由均有页面级 title/description/canonical`);
  }

  // ③ 关键实体路由的 JSON-LD
  for (const req of ENTITY_REQUIREMENTS) {
    const dir = path.join(site.appRoot, req.route);
    if (!fs.existsSync(dir)) continue; // 该站没有此路由则不要求
    const src = routeMetadataSource(dir);
    const types = jsonLdTypes(src);
    // 允许通过 lib 构建器输出：构建器函数名含实体名即视为已接线，再由单测保证类型正确
    const viaBuilder = /build(Product|ProductList|Article|Breadcrumb)JsonLd/.test(src);
    const hit = req.anyOf.some((t) => types.includes(t)) || viaBuilder;
    if (!/ld\+json/.test(src) || !hit) {
      failures.push(
        `${label} 路由 ${req.route} 缺少 ${req.anyOf.join('/')} 结构化数据 —— ${req.why}`,
      );
    }
  }

  // ④ robots / sitemap 与检索型爬虫放行
  const robotsSrc = read(path.join(site.appRoot, 'robots.ts')) || read(path.join(site.appRoot, 'robots.js'));
  const sitemapSrc = read(path.join(site.appRoot, 'sitemap.ts')) || read(path.join(site.appRoot, 'sitemap.js'));
  if (!robotsSrc) failures.push(`${label} 缺少 app/robots.ts（爬虫无从得知抓取策略与 sitemap）`);
  if (!sitemapSrc) failures.push(`${label} 缺少 app/sitemap.ts（引擎难以发现全站页面）`);

  if (robotsSrc) {
    // 检索型爬虫必须显式放行；允许通过共享清单模块引入（避免两处维护 UA 名单）
    const viaSharedList = /AI_RETRIEVAL_CRAWLERS/.test(robotsSrc);
    const listSrc = viaSharedList
      ? read(path.join(site.appDir, 'src/lib/ai-crawlers.ts')) || ''
      : '';
    const haystack = robotsSrc + '\n' + listSrc;
    const missing = REQUIRED_RETRIEVAL_CRAWLERS.filter((ua) => !haystack.includes(ua));
    if (missing.length) {
      failures.push(
        `${label} robots 未显式放行检索型 AI 爬虫：${missing.join(' / ')}`
          + `（OpenAI 官方：被 opt-out 的站点不会出现在 ChatGPT 搜索答案中）`,
      );
    } else {
      notes.push(`${label} robots 显式放行检索型爬虫（含 ${REQUIRED_RETRIEVAL_CRAWLERS.join('/')}）`);
    }
    // 反向红线：检索型爬虫被 Disallow = 自断可见度
    for (const ua of REQUIRED_RETRIEVAL_CRAWLERS) {
      const blocked = new RegExp(`userAgent\\s*:\\s*['"]${ua}['"][^}]*disallow`, 'i').test(robotsSrc);
      if (blocked) failures.push(`${label} robots 对检索型爬虫 ${ua} 设了 disallow —— 等于放弃 AI 可见度`);
    }
  }
}

if (failures.length) {
  console.error('GEO Next 就绪守卫 —— FAIL');
  for (const f of failures) console.error(`- ${f}`);
  console.error(
    '\n注：本门禁为源码级校验，通过≠渲染产物已验证；robots 放行是被引用的必要非充分条件。',
  );
  process.exit(1);
}

console.log('GEO Next 就绪守卫 —— PASS');
for (const n of notes) console.log(`- ${n}`);
console.log('（源码级校验；渲染产物验证仍需构建后检查 .next/server/app 下 HTML）');
