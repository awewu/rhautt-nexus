'use client';
// 产品数据中台簇（模式按钮/工作队列/中台看板）
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

import { NormalizedProduct, WebsiteShelfAssignment, activeWebsiteAssignments, assignmentsForProduct, productImageSrc, productPublishRequiredReadiness, productReadinessSummary } from './products-shared';

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'btn btn-brand btn-sm' : 'btn btn-ghost btn-sm'}
      style={{
        borderRadius: 'var(--r-lg)',
        boxShadow: active ? 'var(--sh-xs)' : 'none',
      }}
    >
      {children}
    </button>
  );
}


type ProductDataConsoleIssue =
  'missingData' | 'missingImage' | 'missingDirectory' | 'pendingPublish' | 'websiteRisk';

export type ProductCatalogWorkFilter =
  'all' | 'admission' | 'directory' | 'publish' | 'review' | 'healthy';

export const PRODUCT_CATALOG_WORK_FILTER_LABELS: Record<ProductCatalogWorkFilter, string> = {
  all: '全部产品',
  admission: '发布准入未达',
  directory: '官网目录未承接',
  publish: '待发布',
  review: '公开复核',
  healthy: '发布健康',
};

type ProductDataConsoleItem = {
  product: NormalizedProduct;
  assignments: WebsiteShelfAssignment[];
  readiness: ReturnType<typeof productReadinessSummary>;
  issues: ProductDataConsoleIssue[];
  primaryAction: string;
  nextStep: string;
};


export function productDataConsoleItems(
  products: NormalizedProduct[],
  assignmentByProductKey: Map<string, WebsiteShelfAssignment[]>
): ProductDataConsoleItem[] {
  return products.map((product) => {
    const assignments = assignmentsForProduct(assignmentByProductKey, product);
    const activeAssignments = activeWebsiteAssignments(assignments);
    const publishedAssignments = activeAssignments.filter(
      (assignment) => assignment.status === 'published'
    );
    const readiness = productReadinessSummary(product);
    const publishReadiness = productPublishRequiredReadiness(product);
    const imageSrc = productImageSrc(product);
    const issues: ProductDataConsoleIssue[] = [];
    if (!publishReadiness.ready) issues.push('missingData');
    if (!activeAssignments.length) issues.push('missingDirectory');
    if (activeAssignments.length && !publishedAssignments.length) issues.push('pendingPublish');
    if (activeAssignments.length > publishedAssignments.length && publishedAssignments.length > 0)
      issues.push('websiteRisk');

    const primaryAction =
      issues.includes('missingData') || issues.includes('missingImage')
        ? '补齐资料'
        : issues.includes('missingDirectory')
          ? '配置官网目录'
          : issues.includes('pendingPublish')
            ? '发布到官网'
            : issues.includes('websiteRisk')
              ? '检查官网'
              : '查看详情';
    const nextStep = issues.includes('missingData')
      ? `发布必填项待补：${publishReadiness.missing.slice(0, 3).join('、')}${publishReadiness.missing.length > 3 ? '等' : ''}`
      : issues.includes('missingImage')
        ? '缺少主图，官网卡片展示风险'
        : issues.includes('missingDirectory')
          ? '未挂载官网目录，无法进入发布'
          : issues.includes('pendingPublish')
            ? '目录已配置，等待发布'
            : issues.includes('websiteRisk')
              ? '部分站点发布或回读需要复核'
              : '资料与官网发布状态正常';

    return { product, assignments, readiness, issues, primaryAction, nextStep };
  });
}


function ProductDataConsoleMetric({
  label,
  value,
  hint,
  suffix = '',
  tone = 'neutral',
}: {
  label: string;
  value: number;
  hint: string;
  suffix?: string;
  tone?: 'neutral' | 'warning' | 'success' | 'danger';
}) {
  const color =
    tone === 'success'
      ? 'var(--success)'
      : tone === 'danger'
        ? 'var(--danger)'
        : tone === 'warning'
          ? 'var(--warning)'
          : 'var(--t-primary)';
  return (
    <div className="product-data-console-metric">
      <span>{label}</span>
      <strong style={{ color }}>
        {value}
        {suffix}
      </strong>
      <small>{hint}</small>
    </div>
  );
}


function ProductDataConsoleBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: 'warning' | 'danger';
}) {
  const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className={`product-data-console-bar is-${tone}`}>
      <div className="product-data-console-bar__meta">
        <span>{label}</span>
        <strong>
          {value} 个 · {percent}%
        </strong>
      </div>
      <div className="product-data-console-bar__track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}


export function ProductCatalogWorkQueue({
  active,
  counts,
  onChange,
}: {
  active: ProductCatalogWorkFilter;
  counts: Record<ProductCatalogWorkFilter, number>;
  onChange: (value: ProductCatalogWorkFilter) => void;
}) {
  const items: Array<{ key: ProductCatalogWorkFilter; label: string; hint: string }> = [
    { key: 'all', label: '全部产品', hint: '当前筛选结果' },
    { key: 'admission', label: '准入未达', hint: '先补必填项' },
    { key: 'directory', label: '目录未承接', hint: '配置官网目录' },
    { key: 'publish', label: '待发布', hint: '执行官网发布' },
    { key: 'review', label: '公开复核', hint: '核对前台回读' },
    { key: 'healthy', label: '发布健康', hint: '无需处理' },
  ];
  return (
    <section className="product-catalog-workqueue" aria-label="产品目录运营任务筛选">
      {items.map((item) => {
        const selected = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className={selected ? 'is-active' : undefined}
            onClick={() => onChange(item.key)}
          >
            <span>{item.label}</span>
            <strong>{counts[item.key] || 0}</strong>
            <small>{item.hint}</small>
          </button>
        );
      })}
    </section>
  );
}


export function ProductDataConsole({
  products,
  assignmentByProductKey,
  isLoading,
  error,
  onOpenCatalog,
}: {
  products: NormalizedProduct[];
  assignmentByProductKey: Map<string, WebsiteShelfAssignment[]>;
  isLoading: boolean;
  error: unknown;
  onOpenCatalog: () => void;
}) {
  const rows = useMemo(
    () => productDataConsoleItems(products, assignmentByProductKey),
    [assignmentByProductKey, products]
  );
  const total = rows.length;
  const missingData = rows.filter(
    (item) => item.issues.includes('missingData') || item.issues.includes('missingImage')
  ).length;
  const missingDirectory = rows.filter((item) => item.issues.includes('missingDirectory')).length;
  const pendingPublish = rows.filter((item) => item.issues.includes('pendingPublish')).length;
  const websiteRisk = rows.filter((item) => item.issues.includes('websiteRisk')).length;
  const ready = rows.filter((item) => !item.issues.length).length;
  const dataReady = Math.max(total - missingData, 0);
  const directoryReady = Math.max(total - missingDirectory, 0);
  const publishedOrSafe = Math.max(total - pendingPublish - websiteRisk, 0);
  const dataReadyRate = total ? Math.round((dataReady / total) * 100) : 0;
  const directoryReadyRate = total ? Math.round((directoryReady / total) * 100) : 0;
  const publishReadyRate = total ? Math.round((publishedOrSafe / total) * 100) : 0;
  const healthRate = total ? Math.round((ready / total) * 100) : 0;
  const riskTotal = missingData + missingDirectory + pendingPublish + websiteRisk;
  const verdict = riskTotal ? `当前 ${riskTotal} 项问题影响产品发布质量` : '当前产品数据链路健康';
  const verdictDetail = missingData
    ? '第一风险是产品事实未达发布准入，不应进入官网发布。'
    : missingDirectory
      ? '产品事实已进入发布链路，当前阻塞点是官网目录承接。'
      : pendingPublish
        ? '产品事实与目录已准备，当前重点是发布执行。'
        : websiteRisk
          ? '已发布产品存在公开展示复核项，需要核对前台回读。'
          : '产品事实、目录挂载、发布状态和公开回读均处于稳定状态。';
  const riskRows = rows
    .filter((item) => item.issues.length)
    .sort((left, right) => right.issues.length - left.issues.length)
    .slice(0, 5);

  if (error) {
    return (
      <WorkbenchTableState
        type="error"
        title="产品数据中台暂时不可用"
        description={String((error as Error)?.message || error)}
      />
    );
  }

  if (isLoading && !products.length) {
    return (
      <WorkbenchTableState
        type="loading"
        title="正在同步产品数据中台"
        description="正在读取产品事实、资料完整度和官网挂载状态。"
      />
    );
  }

  return (
    <section className="product-data-console">
      <div className="product-data-console-hero">
        <div>
          <p className="t-label">产品数据中台 · 领导汇报视图</p>
          <h2>{verdict}</h2>
          <span>
            {verdictDetail} 数据口径覆盖产品事实、资料完整度、官网目录、发布状态和公开回读。
          </span>
        </div>
        <div className="product-data-console-hero__verdict">
          <strong>{healthRate}% 产品发布健康率</strong>
          <small>
            稳定展示产品 {ready} / {total || 0} 个；风险产品 {Math.max(total - ready, 0)} 个。
          </small>
          <button type="button" className="btn btn-brand btn-sm" onClick={onOpenCatalog}>
            <Package size={14} />
            进入产品目录管理
          </button>
        </div>
      </div>

      <div className="product-data-console-metrics">
        <ProductDataConsoleMetric label="产品总数" value={total} hint="当前产品事实库" />
        <ProductDataConsoleMetric
          label="发布准入率"
          value={dataReadyRate}
          suffix="%"
          hint={`${missingData} 个产品必填项待补`}
          tone={missingData ? 'warning' : 'success'}
        />
        <ProductDataConsoleMetric
          label="目录挂载率"
          value={directoryReadyRate}
          suffix="%"
          hint={`${missingDirectory} 个未挂载目录`}
          tone={missingDirectory ? 'danger' : 'success'}
        />
        <ProductDataConsoleMetric
          label="发布链路率"
          value={publishReadyRate}
          suffix="%"
          hint={`${pendingPublish + websiteRisk} 个待发布/复核`}
          tone={pendingPublish || websiteRisk ? 'warning' : 'success'}
        />
        <ProductDataConsoleMetric
          label="风险产品数"
          value={Math.max(total - ready, 0)}
          hint="影响官网稳定展示"
          tone={total - ready ? 'danger' : 'success'}
        />
      </div>

      <div className="product-data-console-layout">
        <section className="product-data-console-panel">
          <div className="product-data-console-panel__head">
            <div>
              <p className="t-label">问题分布</p>
              <h3>发布准入漏斗</h3>
            </div>
            <StatusPill tone={riskTotal ? 'warning' : 'success'}>
              {riskTotal ? `${riskTotal} 项问题` : '全部健康'}
            </StatusPill>
          </div>
          <div className="product-data-console-bars">
            <ProductDataConsoleBar
              label="1. 产品事实未达发布准入"
              value={missingData}
              total={total}
              tone="danger"
            />
            <ProductDataConsoleBar
              label="2. 官网目录未承接"
              value={missingDirectory}
              total={total}
              tone="warning"
            />
            <ProductDataConsoleBar
              label="3. 目录已承接待发布"
              value={pendingPublish}
              total={total}
              tone="warning"
            />
            <ProductDataConsoleBar
              label="4. 公开展示需复核"
              value={websiteRisk}
              total={total}
              tone="warning"
            />
          </div>
          <div className="product-data-console-funnel">
            <div>
              <span>产品事实</span>
              <strong>{total}</strong>
            </div>
            <div>
              <span>发布准入</span>
              <strong>{dataReady}</strong>
            </div>
            <div>
              <span>目录承接</span>
              <strong>{directoryReady}</strong>
            </div>
            <div>
              <span>发布无风险</span>
              <strong>{publishedOrSafe}</strong>
            </div>
          </div>
        </section>

        <aside className="product-data-console-panel">
          <div className="product-data-console-panel__head">
            <div>
              <p className="t-label">管理结论</p>
              <h3>本轮优先级</h3>
            </div>
          </div>
          <div className="product-data-console-health">
            <div>
              <span>第一优先级</span>
              <strong>
                {missingData
                  ? '发布准入'
                  : missingDirectory
                    ? '目录承接'
                    : pendingPublish
                      ? '发布执行'
                      : websiteRisk
                        ? '公开复核'
                        : '保持健康'}
              </strong>
            </div>
            <div>
              <span>影响范围</span>
              <strong>{Math.max(total - ready, 0)} 个产品</strong>
            </div>
            <div>
              <span>准入口径</span>
              <strong>{healthRate}% 健康</strong>
            </div>
          </div>
          <div
            className="inset"
            style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 12, lineHeight: 1.5 }}
          >
            发布治理口径：产品事实必填项完整后，才进入官网目录承接；目录承接后执行发布；已发布内容以公开回读作为最终校验。
          </div>
        </aside>
      </div>

      <section className="product-data-console-panel">
        <div className="product-data-console-panel__head">
          <div>
            <p className="t-label">重点风险产品</p>
            <h3>影响发布质量的产品清单</h3>
          </div>
          <StatusPill tone={riskRows.length ? 'warning' : 'success'}>
            {riskRows.length ? `展示前 ${riskRows.length} 个` : '暂无风险'}
          </StatusPill>
        </div>
        <div className="product-data-console-list">
          {riskRows.map((item) => (
            <ProductDataConsoleRow
              key={item.product.id}
              item={item}
              onOpenCatalog={onOpenCatalog}
            />
          ))}
          {!rows.length ? (
            <div
              className="inset"
              style={{ padding: 14, color: 'var(--t-secondary)', fontSize: 13 }}
            >
              当前还没有产品数据。可以先进入产品目录管理创建或导入产品。
            </div>
          ) : !riskRows.length ? (
            <div className="inset" style={{ padding: 14, color: 'var(--success)', fontSize: 13 }}>
              当前没有影响发布质量的重点风险产品。
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}


function ProductDataConsoleRow({
  item,
  onOpenCatalog,
}: {
  item: ProductDataConsoleItem;
  onOpenCatalog: () => void;
}) {
  const imageSrc = productImageSrc(item.product);
  const activeAssignments = activeWebsiteAssignments(item.assignments);
  return (
    <article className="product-data-console-row">
      <div className="product-data-console-row__image">
        {imageSrc ? (
          <img src={imageSrc} alt={item.product.name || item.product.model || '产品主图'} />
        ) : (
          <Image size={18} />
        )}
      </div>
      <div className="product-data-console-row__main">
        <div>
          <strong>{item.product.name || item.product.model || '未命名产品'}</strong>
          <span>
            {item.product.model || '待补型号'} · {item.product.sku || '待补 SKU'}
          </span>
        </div>
        <small>{item.product.categoryPath || item.product.category || '未绑定产品库分类'}</small>
        <div className="product-data-console-row__tags">
          {item.issues.includes('missingData') ? (
            <span className="badge badge-warning">发布准入未达</span>
          ) : null}
          {item.issues.includes('missingImage') ? (
            <span className="badge badge-warning">缺主图</span>
          ) : null}
          {item.issues.includes('missingDirectory') ? (
            <span className="badge badge-danger">未配置目录</span>
          ) : null}
          {item.issues.includes('pendingPublish') ? (
            <span className="badge badge-info">待发布</span>
          ) : null}
          {item.issues.includes('websiteRisk') ? (
            <span className="badge badge-warning">官网需复核</span>
          ) : null}
          {!item.issues.length ? <span className="badge badge-success">发布健康</span> : null}
        </div>
      </div>
      <div className="product-data-console-row__status">
        <span>
          {activeAssignments.length ? `${activeAssignments.length} 个官网挂载` : '未挂载官网'}
        </span>
        <small>{item.nextStep}</small>
      </div>
      <button type="button" className="btn btn-outline btn-sm" onClick={onOpenCatalog}>
        {item.primaryAction}
      </button>
    </article>
  );
}

