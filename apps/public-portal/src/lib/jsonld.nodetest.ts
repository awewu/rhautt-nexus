import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductJsonLd,
  buildProductListJsonLd,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  serializeJsonLd,
} from './jsonld';
import type { SiteProduct } from './site-products';

const SITE = 'https://rhautt.com';

function product(overrides: Partial<SiteProduct> = {}): SiteProduct {
  return {
    id: 'rheem-ap-500',
    name: 'Rheem 商用空气源热泵 AP-500',
    desc: '低温强热型空气源热泵机组',
    brand: 'Rheem',
    cat: '中央热水',
    code: 'AP',
    bg: '',
    metric: 'COP 4.2',
    eco: true,
    image: '/images/ap-500.jpg',
    specs: [
      { label: '制热量', value: '50 kW' },
      { label: 'COP', value: '4.2' },
    ],
    features: ['低温 -25℃ 稳定运行'],
    scenarios: ['酒店中央热水', '严寒地区采暖'],
    sku: 'AP-500-CN',
    mpn: '',
    gtin: '',
    ...overrides,
  };
}

// ── Product：规格必须落到 additionalProperty（引擎逐条抽取参数的标准位置）──

test('产品 JSON-LD：规格逐条落入 additionalProperty(PropertyValue)', () => {
  const ld = buildProductJsonLd(product(), { siteUrl: SITE, canonicalPath: '/products/rheem-ap-500' });
  assert.equal(ld['@type'], 'Product');
  const props = ld.additionalProperty as Array<Record<string, string>>;
  assert.equal(props.length, 2);
  assert.deepEqual(props[0], { '@type': 'PropertyValue', name: '制热量', value: '50 kW' });
  assert.ok(props.some((p) => p.name === 'COP' && p.value === '4.2'));
});

test('产品 JSON-LD：URL 与图片转为绝对地址（引擎不解析相对路径）', () => {
  const ld = buildProductJsonLd(product(), { siteUrl: SITE, canonicalPath: '/products/rheem-ap-500' });
  assert.equal(ld.url, 'https://rhautt.com/products/rheem-ap-500');
  assert.equal(ld.image, 'https://rhautt.com/images/ap-500.jpg');
});

test('产品 JSON-LD：已是绝对图片地址时不重复拼接站点前缀', () => {
  const ld = buildProductJsonLd(product({ image: 'https://cdn.example.com/a.jpg' }), {
    siteUrl: SITE,
    canonicalPath: '/products/x',
  });
  assert.equal(ld.image, 'https://cdn.example.com/a.jpg');
});

test('产品 JSON-LD：绝不输出价格/库存/评分（无事实即不得编造）', () => {
  const ld = buildProductJsonLd(product(), { siteUrl: SITE, canonicalPath: '/products/x' });
  for (const forbidden of ['offers', 'price', 'aggregateRating', 'review', 'availability']) {
    assert.equal(forbidden in ld, false, `不得输出 ${forbidden}（事实基座无此数据）`);
  }
});

test('产品 JSON-LD：缺失标识字段被省略而非输出空串', () => {
  const ld = buildProductJsonLd(product({ sku: '', mpn: '', gtin: '' }), {
    siteUrl: SITE,
    canonicalPath: '/products/x',
  });
  assert.equal('sku' in ld, false);
  assert.equal('mpn' in ld, false);
  assert.equal('gtin13' in ld, false);
});

test('产品 JSON-LD：存在的标识字段按 schema.org 键名输出', () => {
  const ld = buildProductJsonLd(product({ sku: 'S1', mpn: 'M1', gtin: '6901234567890' }), {
    siteUrl: SITE,
    canonicalPath: '/products/x',
  });
  assert.equal(ld.sku, 'S1');
  assert.equal(ld.mpn, 'M1');
  assert.equal(ld.gtin13, '6901234567890');
});

test('产品 JSON-LD：无规格时不输出空 additionalProperty 数组', () => {
  const ld = buildProductJsonLd(product({ specs: [] }), { siteUrl: SITE, canonicalPath: '/products/x' });
  assert.equal('additionalProperty' in ld, false);
});

// ── 列表 / 文章 / 面包屑 ──

test('列表 JSON-LD：CollectionPage 内含 ItemList 且计数与条目一致', () => {
  const ld = buildProductListJsonLd([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], {
    siteUrl: SITE,
    canonicalPath: '/products',
    name: '产品系列',
    description: '目录',
  });
  assert.equal(ld['@type'], 'CollectionPage');
  const list = ld.mainEntity as Record<string, unknown>;
  assert.equal(list['@type'], 'ItemList');
  assert.equal(list.numberOfItems, 2);
  assert.equal((list.itemListElement as unknown[]).length, 2);
});

test('列表 JSON-LD：条目 URL 对 id 做 URL 编码（型号含空格/斜杠不破链）', () => {
  const ld = buildProductListJsonLd([{ id: 'a b/c', name: 'X' }], {
    siteUrl: SITE,
    canonicalPath: '/products',
    name: 'n',
    description: 'd',
  });
  const first = (ld.mainEntity as any).itemListElement[0];
  assert.equal(first.url, 'https://rhautt.com/products/a%20b%2Fc');
});

test('文章 JSON-LD：输出 Article 且带发布时间与语言', () => {
  const ld = buildArticleJsonLd(
    { title: 'T', excerpt: 'E', slug: 's', date: '2026-05-18', category: '公司新闻' },
    { siteUrl: SITE },
  );
  assert.equal(ld['@type'], 'Article');
  assert.equal(ld.headline, 'T');
  assert.equal(ld.datePublished, '2026-05-18');
  assert.equal(ld.inLanguage, 'zh-CN');
  assert.equal(ld.url, 'https://rhautt.com/news/s');
});

test('面包屑 JSON-LD：position 从 1 递增且 item 为绝对地址', () => {
  const ld = buildBreadcrumbJsonLd(
    [{ name: '产品系列', path: '/products' }, { name: '型号', path: '/products/x' }],
    { siteUrl: SITE },
  );
  const items = ld.itemListElement as Array<Record<string, unknown>>;
  assert.deepEqual(items.map((i) => i.position), [1, 2]);
  assert.equal(items[1].item, 'https://rhautt.com/products/x');
});

// ── 序列化安全（Next 官方要求）──

test('序列化：< 被转义为 \\u003c，阻断 </script> 注入', () => {
  const out = serializeJsonLd({ name: '</script><img src=x onerror=alert(1)>' });
  assert.equal(out.includes('</script>'), false);
  assert.ok(out.includes('\\u003c'));
  // 转义后仍是合法 JSON
  assert.equal(JSON.parse(out).name, '</script><img src=x onerror=alert(1)>');
});

test('序列化：数组形式（一页多实体）可直接序列化', () => {
  const out = serializeJsonLd([{ '@type': 'Product' }, { '@type': 'BreadcrumbList' }]);
  assert.equal(JSON.parse(out).length, 2);
});
