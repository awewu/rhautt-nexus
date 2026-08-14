'use client';
// 物料/产品基座/系统包视图簇
// 2026-08 从 products/page.tsx 机械化拆出：逻辑零改动，只做搬迁。

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  Bold,
  Boxes,
  CheckCircle2,
  Edit3,
  ExternalLink,
  EyeOff,
  FileText,
  FolderOpen,
  Heading2,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Package,
  Plus,
  RefreshCw,
  Search,
  Table2,
  X,
  XCircle,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  StatusPill,
  WorkbenchFilterToolbar,
  WorkbenchPaginationFooter,
  WorkbenchSectionHeader,
  WorkbenchTableShell,
  WorkbenchTableState,
} from '../../components/WorkbenchCore';
import {
  auth,
  brandProductCategories,
  brandSites,
  fileArtifacts,
  products,
  publicSiteProducts,
  siteProductAssignments,
  siteProductCategories,
} from '../../lib/api';
import {
  getBrandProductPermissions,
  type BrandProductPermissions,
} from '../../lib/brand-product-adapter';
import {
  CATEGORIES,
  PRODUCTS,
  SYSTEM_PACKS,
  type CatKey,
  type Product,
} from '../../lib/products-data';

import { Metric, NormalizedProduct, fmt, pct, slug } from './products-shared';

export function ProductMaterialsView({ products: items }: { products: NormalizedProduct[] }) {
  const rows = items.map((product) => {
    const raw = product.raw || {};
    const assetRefs = Array.isArray(raw.assetRefs) ? raw.assetRefs : [];
    const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
    const positioning =
      raw.positioning && typeof raw.positioning === 'object' ? raw.positioning : {};
    const hasMainImage =
      assetRefs.some((ref: any) => ref?.role === 'main' || ref?.role === 'card') ||
      Boolean((meta as any).imageArtifactId);
    return {
      product,
      assetCount: assetRefs.length,
      hasMainImage,
      hasPositioning: Object.keys(positioning).length > 0,
      hasSeoBase: Boolean((meta as any).everhot?.slug || product.model),
    };
  });
  const withAssets = rows.filter((row) => row.assetCount > 0).length;
  const withMainImage = rows.filter((row) => row.hasMainImage).length;
  const withPositioning = rows.filter((row) => row.hasPositioning).length;

  return (
    <section className="card-elevated" style={{ overflow: 'hidden' }}>
      <div style={{ padding: 18, borderBottom: '1px solid var(--border)' }}>
        <p className="t-label">Product Materials</p>
        <h2 className="t-headline" style={{ marginTop: 4 }}>
          产品资料管理
        </h2>
        <p style={{ marginTop: 6, color: 'var(--t-secondary)', fontSize: 13 }}>
          管理每个产品编码的图片素材、定位资料和官网展示基础信息。
        </p>
      </div>
      <div className="g4" style={{ gap: 12, padding: 16 }}>
        <Metric
          label="已挂素材"
          value={`${withAssets}/${items.length}`}
          hint="assetRefs 或旧主图"
        />
        <Metric label="主图就绪" value={`${withMainImage}/${items.length}`} hint="官网卡片可展示" />
        <Metric
          label="定位资料"
          value={`${withPositioning}/${items.length}`}
          hint="人群/场景/卖点"
        />
        <Metric
          label="待补资料"
          value={String(Math.max(0, items.length - withMainImage))}
          hint="优先补主图与摘要"
        />
      </div>
      <WorkbenchTableShell>
        <table className="table">
          <thead>
            <tr>
              <th>产品编码</th>
              <th>品牌</th>
              <th>素材</th>
              <th>主图</th>
              <th>定位</th>
              <th>官网基础</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.product.id}>
                <td>
                  <strong>{row.product.name}</strong>
                  <div style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>
                    {row.product.model}
                  </div>
                </td>
                <td>{row.product.brand}</td>
                <td>{row.assetCount} 个素材</td>
                <td>
                  <span
                    className={row.hasMainImage ? 'badge badge-success' : 'badge badge-warning'}
                  >
                    {row.hasMainImage ? '已就绪' : '待补充'}
                  </span>
                </td>
                <td>
                  <span
                    className={row.hasPositioning ? 'badge badge-success' : 'badge badge-warning'}
                  >
                    {row.hasPositioning ? '已填写' : '待填写'}
                  </span>
                </td>
                <td>
                  <span className={row.hasSeoBase ? 'badge badge-success' : 'badge badge-warning'}>
                    {row.hasSeoBase ? '可生成' : '待完善'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </WorkbenchTableShell>
    </section>
  );
}


export function ProductBaseView({
  products: items,
  productByModel,
}: {
  products: NormalizedProduct[];
  productByModel: Map<string, NormalizedProduct>;
}) {
  const categoryRows = CATEGORIES.map((category) => ({
    ...category,
    count: items.filter((product) => product.category === category.key).length,
  }));
  const keyed = items.filter((product) => product.raw?.productKey).length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="card-elevated" style={{ padding: 18 }}>
        <p className="t-label">Catalog Foundation</p>
        <h2 className="t-headline" style={{ marginTop: 4 }}>
          产品目录底座
        </h2>
        <p style={{ marginTop: 6, color: 'var(--t-secondary)', fontSize: 13 }}>
          维护分类底座、系统方案包和产品身份键，供报价、官网和设计模块复用。
          <span style={{ color: 'var(--warning)' }}>
            （方案包为示例模板，接入 system-packs 后端后替换为真实方案；单价取自产品库真实价）
          </span>
        </p>
        <div className="g4" style={{ gap: 12, marginTop: 16 }}>
          <Metric label="分类数" value={String(CATEGORIES.length)} hint="目录筛选底座" />
          <Metric
            label="方案包"
            value={String(SYSTEM_PACKS.length)}
            hint="示例模板 · 待接 system-packs"
          />
          <Metric
            label="身份键覆盖"
            value={`${keyed}/${items.length}`}
            hint="productKey 去重基础"
          />
          <Metric
            label="可报价产品编码"
            value={String(items.filter((item) => item.marketPrice > 0).length)}
            hint="已有价格字段"
          />
        </div>
      </section>
      <section className="g2" style={{ gap: 16 }}>
        <div className="card-elevated" style={{ padding: 16 }}>
          <h3 className="t-headline">分类底座</h3>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {categoryRows.map((category) => (
              <div
                key={category.key}
                className="inset"
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
              >
                <span>{category.label}</span>
                <strong>{category.count}</strong>
              </div>
            ))}
          </div>
        </div>
        <PackGrid productByModel={productByModel} />
      </section>
    </div>
  );
}


function PackGrid({ productByModel }: { productByModel: Map<string, NormalizedProduct> }) {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 16,
      }}
    >
      {SYSTEM_PACKS.map((pack) => {
        const itemSum = pack.items.reduce((sum, item) => {
          const product = productByModel.get(item.model);
          return sum + (product ? product.marketPrice * item.qty : 0);
        }, 0);
        const save = Math.max(0, itemSum - pack.bundlePrice);
        const margin = itemSum ? (save / itemSum) * 100 : 0;

        return (
          <article
            key={pack.id}
            className="card-elevated"
            style={{
              padding: 18,
              borderTop: '3px solid var(--brand)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 className="t-headline">{pack.name}</h2>
                <p style={{ marginTop: 4, color: 'var(--t-secondary)', fontSize: 13 }}>
                  {pack.desc}
                </p>
              </div>
              <span
                className="pill-neutral"
                style={{ alignSelf: 'flex-start' }}
                title="示例套餐：单价来自产品库真实价，套餐组合为示例模板；接入 system-packs 后替换为真实方案包"
              >
                方案包 · 示例
              </span>
            </div>

            <p style={{ marginTop: 8, color: 'var(--t-tertiary)', fontSize: 12 }}>
              适用场景：{pack.scenario}
            </p>

            <div className="inset" style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              {pack.items.map((item) => {
                const product = productByModel.get(item.model);
                return (
                  <div
                    key={item.model}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--t-primary)',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={product?.name || item.model}
                    >
                      {product?.name || item.model}
                    </span>
                    <span
                      style={{ color: 'var(--t-tertiary)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      x{item.qty}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    color: 'var(--t-tertiary)',
                    fontSize: 11,
                    textDecoration: 'line-through',
                  }}
                >
                  单品合计 {fmt(itemSum)}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    color: 'var(--brand)',
                    fontSize: 26,
                    lineHeight: 1.05,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt(pack.bundlePrice)}
                </div>
              </div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                <span className="pill-brand">立省 {fmt(save)}</span>
                <span style={{ color: 'var(--t-tertiary)', fontSize: 11 }}>
                  组合让利 {pct(margin)}
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

