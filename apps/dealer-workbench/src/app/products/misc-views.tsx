'use client';
// 物料/产品基座/系统包视图簇
// 2026-08 从 products/page.tsx 机械化拆出：逻辑零改动，只做搬迁。
// 2026-08 全页 UX 重构三期 · WorkspaceKit 化：渲染层去内联样式，静态布局全走 Tailwind 语义 token。

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
    <section className="card-elevated overflow-hidden">
      <div className="border-b p-[18px]">
        <p className="t-label">Product Materials</p>
        <h2 className="t-headline mt-1">
          产品资料管理
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          管理每个产品编码的图片素材、定位资料和官网展示基础信息。
        </p>
      </div>
      <div className="g4 gap-3 p-4">
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
                  <div className="text-xs text-muted-foreground/70">
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
    <div className="grid gap-4">
      <section className="card-elevated p-[18px]">
        <p className="t-label">Catalog Foundation</p>
        <h2 className="t-headline mt-1">
          产品目录底座
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          维护分类底座、系统方案包和产品身份键，供报价、官网和设计模块复用。
          <span className="text-warning">
            （方案包为示例模板，接入 system-packs 后端后替换为真实方案；单价取自产品库真实价）
          </span>
        </p>
        <div className="g4 mt-4 gap-3">
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
      <section className="g2 gap-4">
        <div className="card-elevated p-4">
          <h3 className="t-headline">分类底座</h3>
          <div className="mt-3 grid gap-2">
            {categoryRows.map((category) => (
              <div
                key={category.key}
                className="inset flex justify-between gap-3"
              >
                <span>{category.label}</span>
                <strong className="tabular-nums">{category.count}</strong>
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
    <section className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
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
            className="card-elevated border-t-[3px] border-t-primary p-[18px]"
          >
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="t-headline">{pack.name}</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {pack.desc}
                </p>
              </div>
              <span
                className="pill-neutral self-start"
                title="示例套餐：单价来自产品库真实价，套餐组合为示例模板；接入 system-packs 后替换为真实方案包"
              >
                方案包 · 示例
              </span>
            </div>

            <p className="mt-2 text-xs text-muted-foreground/70">
              适用场景：{pack.scenario}
            </p>

            <div className="inset mt-3.5 grid gap-2">
              {pack.items.map((item) => {
                const product = productByModel.get(item.model);
                return (
                  <div
                    key={item.model}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span
                      className="min-w-0 truncate text-foreground"
                      title={product?.name || item.model}
                    >
                      {product?.name || item.model}
                    </span>
                    <span className="text-muted-foreground/70 tabular-nums">
                      x{item.qty}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3.5 flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] text-muted-foreground/70 line-through tabular-nums">
                  单品合计 {fmt(itemSum)}
                </div>
                <div className="mt-0.5 text-[26px] leading-[1.05] font-bold text-primary tabular-nums">
                  {fmt(pack.bundlePrice)}
                </div>
              </div>
              <div className="grid justify-items-end gap-1">
                <span className="pill-brand">立省 {fmt(save)}</span>
                <span className="text-[11px] text-muted-foreground/70 tabular-nums">
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

