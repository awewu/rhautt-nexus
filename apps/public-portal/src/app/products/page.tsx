import PageHero from '../../components/PageHero';
import { listSiteProducts } from '../../lib/site-products';
import { GROUP } from '../../lib/brand';
import { buildProductListJsonLd, serializeJsonLd } from '../../lib/jsonld';
import ProductCatalog from './ProductCatalog';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${GROUP.domain}`;

export default async function ProductsPage() {
  const result = await listSiteProducts();

  // ItemList：让引擎知道本页罗列了哪些真实型号（产品服务不可用时不输出空列表冒充有货）
  const jsonLd = result.items.length
    ? buildProductListJsonLd(result.items, {
        siteUrl: SITE_URL,
        canonicalPath: '/products',
        name: `${GROUP.nameShort} 产品系列`,
        description: 'Rheem、Ruud、Everhot 等品牌在集团官网明确发布的产品目录。',
      })
    : null;

  return (
    <main id="main">
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      ) : null}
      <PageHero
        minHeight={320}
        eyebrow="PRODUCT CATALOG · 产品目录"
        title={
          <>
            集团产品<span style={{ color: 'var(--rh-green)' }}>系列</span>
          </>
        }
        lead={<>浏览 Rheem、Ruud、Everhot 等品牌在集团官网明确发布的产品。</>}
      />
      <ProductCatalog products={result.items} unavailable={!result.ok} />
    </main>
  );
}
