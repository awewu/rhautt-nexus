/**
 * 结构化数据（JSON-LD）构建器 —— 让 AI 引擎"看懂这页在讲哪个实体"
 *
 * 为什么必须有（GEO 因果链第二环「能被理解」）：
 * 集团站此前每一页的 JSON-LD 都只有根布局的 Organization/WebSite，
 * 等于每页都在说"我们是一家公司"——引擎无从判断这页讲的是哪款产品、什么参数、哪篇文章。
 * 产品页更是宪章硬要求（产品页 JSON-LD 须源自 D2 产品事实基座，禁手写事实）。
 *
 * 诚实边界：
 *  - **只输出事实基座真实存在的字段**，缺失即省略。绝不为凑 schema 完整度编造
 *    价格/库存/评分（虚构 offers 或 aggregateRating 是最典型的结构化数据造假，
 *    既误导用户也可能被引擎判为垃圾数据）。
 *  - 规格参数按 schema.org 的 PropertyValue 输出到 `additionalProperty`，
 *    这是引擎能逐条抽取"某型号某参数=某值"的标准位置。
 */

import { GROUP } from './brand';
import type { SiteProduct } from './site-products';

/** schema.org 节点（结构随实体类型变化，故用宽松索引签名） */
export type JsonLdNode = Record<string, unknown>;

/**
 * XSS 防护：Next 官方 JSON-LD 指南要求把 `<` 转义为 \u003c，
 * 因为 JSON.stringify 不会清理可注入 HTML 的字符串（见 next/dist/docs/01-app/02-guides/json-ld.md）。
 */
export function serializeJsonLd(node: JsonLdNode | JsonLdNode[]): string {
  return JSON.stringify(node).replace(/</g, '\\u003c');
}

/** 去掉值为空的键，避免输出 `"sku": ""` 这类噪声字段。 */
function compact(node: JsonLdNode): JsonLdNode {
  const out: JsonLdNode = {};
  for (const [k, v] of Object.entries(node)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function absolute(siteUrl: string, pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl.replace(/\/+$/, '')}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

/**
 * 产品实体。规格 → `additionalProperty`（PropertyValue），
 * 使"某型号的某项参数=某值"成为引擎可直接抽取的结构化事实。
 * ⚠️ 不输出 offers/price：站点产品事实基座当前不含价格，编造价格属结构化数据造假。
 */
export function buildProductJsonLd(
  product: SiteProduct,
  opts: { siteUrl: string; canonicalPath: string },
): JsonLdNode {
  const url = absolute(opts.siteUrl, opts.canonicalPath);
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.desc,
    url,
    image: product.image ? absolute(opts.siteUrl, product.image) : undefined,
    sku: product.sku,
    mpn: product.mpn,
    gtin13: product.gtin,
    category: product.cat,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    manufacturer: { '@type': 'Organization', name: GROUP.nameCn, url: opts.siteUrl },
    // 核心特性作为面向人的补充说明；参数走 additionalProperty（机器可抽取）
    additionalProperty: product.specs.map((spec) => ({
      '@type': 'PropertyValue',
      name: spec.label,
      value: spec.value,
    })),
    // 适用场景 → 引擎判断"这款产品适合什么工况"的依据
    audience: product.scenarios.length
      ? product.scenarios.map((scenario) => ({ '@type': 'Audience', audienceType: scenario }))
      : undefined,
  });
}

/** 面包屑：帮引擎理解站点层级（产品系列 → 品类 → 型号）。 */
export function buildBreadcrumbJsonLd(
  items: { name: string; path: string }[],
  opts: { siteUrl: string },
): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absolute(opts.siteUrl, item.path),
    })),
  };
}

/** 产品列表页：ItemList 让引擎知道"这页罗列了哪些型号"，而非一堆无结构链接。 */
export function buildProductListJsonLd(
  products: Pick<SiteProduct, 'id' | 'name'>[],
  opts: { siteUrl: string; canonicalPath: string; name: string; description: string },
): JsonLdNode {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: opts.name,
    description: opts.description,
    url: absolute(opts.siteUrl, opts.canonicalPath),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: product.name,
        url: absolute(opts.siteUrl, `/products/${encodeURIComponent(product.id)}`),
      })),
    },
  });
}

/** 文章实体：Article 是 AI 答案里最常被引用的类型之一，缺失等于放弃这部分可见度。 */
export function buildArticleJsonLd(
  article: { title: string; excerpt: string; slug: string; date?: string; category?: string },
  opts: { siteUrl: string },
): JsonLdNode {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    url: absolute(opts.siteUrl, `/news/${article.slug}`),
    datePublished: article.date,
    articleSection: article.category,
    inLanguage: 'zh-CN',
    author: { '@type': 'Organization', name: GROUP.nameCn, url: opts.siteUrl },
    publisher: { '@type': 'Organization', name: GROUP.nameCn, url: opts.siteUrl },
  });
}
