'use client';
// 产品就绪度簇（货架摘要/编辑进度条/就绪清单/标签）
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

import { CatalogCategoryFilter, CreateProductDraft, EditProductDraft, NormalizedProduct, ProductBrand, ProductCategoryNode, WebsiteShelfAssignment, activeWebsiteAssignments, assignmentWebsiteCategoryPath, displayBrand, flattenCategoryTree, keyValueLines, nonNegativeInt, normalizeBrand, objectOrEmpty, preferredWebsiteAssignment, productBrandMeta, productCategoryBinding, productLibraryMeta, savedProductManualPdfs, slug, text, websiteShelfSummary } from './products-shared';


export function WebsiteShelfSummaryCell({
  assignments,
  productBrand,
}: {
  assignments: WebsiteShelfAssignment[];
  productBrand?: string;
}) {
  const active = activeWebsiteAssignments(assignments);
  const summary = websiteShelfSummary(assignments);
  const primary = preferredWebsiteAssignment(assignments, productBrand);
  const categoryPath = primary ? assignmentWebsiteCategoryPath(primary) : '';
  const nextStep = !active.length
    ? '下一步：配置官网目录'
    : active.some((assignment) => assignment.status === 'published')
      ? '公开展示已可回读'
      : '下一步：发布到官网';

  return (
    <div
      className="product-catalog-website-cell"
      style={{ display: 'grid', gap: 6, minWidth: 220 }}
    >
      <div
        className="product-catalog-website-cell__status"
        style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <StatusPill tone={summary.tone}>{summary.label}</StatusPill>
        {active.length > 1 ? (
          <span className="badge badge-grey">{active.length} 个站点</span>
        ) : null}
      </div>
      {primary ? (
        <>
          <span
            className="product-catalog-website-cell__path"
            style={{ color: 'var(--t-secondary)', fontSize: 12 }}
          >
            {displayBrand(normalizeBrand(primary.siteCode))} / {categoryPath || '未选择目录'}
          </span>
          <span
            className="product-catalog-website-cell__slug"
            style={{ color: 'var(--t-tertiary)', fontSize: 11 }}
          >
            slug: {text(primary.publicSlug) || '待生成'}
          </span>
        </>
      ) : (
        <span
          className="product-catalog-website-cell__path"
          style={{ color: 'var(--t-secondary)', fontSize: 12 }}
        >
          还没有官网挂载配置
        </span>
      )}
      <span
        className="product-catalog-website-cell__next"
        style={{
          color: active.some((assignment) => assignment.status === 'published')
            ? 'var(--success)'
            : 'var(--warning)',
          fontSize: 11,
        }}
      >
        {nextStep}
      </span>
    </div>
  );
}


export type ProductEditProgressItem = {
  label: string;
  status: 'ready' | 'todo' | 'blocked';
  detail: string;
  targetId: string;
};


type ProductChecklistStatus = 'ready' | 'missing' | 'recommended';

type ProductChecklistRequirement = 'required' | 'optional';

type ProductChecklistItem = {
  key: string;
  label: string;
  requirement: ProductChecklistRequirement;
  status: ProductChecklistStatus;
  detail: string;
  targetId: string;
};


export function ProductEditProgressStrip({
  items,
  onNavigate,
}: {
  items: ProductEditProgressItem[];
  onNavigate: (targetId: string) => void;
}) {
  const readyCount = items.filter((item) => item.status === 'ready').length;
  const percent = items.length ? Math.round((readyCount / items.length) * 100) : 0;
  const statusText =
    readyCount === items.length ? '可进入发布校验' : `还差 ${items.length - readyCount} 项`;

  return (
    <section className="product-edit-progress" aria-label="运营填报进度">
      <div className="product-edit-progress__summary">
        <div>
          <p className="t-label">运营填报进度</p>
          <strong>{percent}%</strong>
          <span>{statusText}</span>
        </div>
        <div className="product-edit-progress__bar" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="product-edit-progress__items">
        {items.map((item) => {
          const ready = item.status === 'ready';
          return (
            <button
              key={item.label}
              type="button"
              className={`product-edit-progress__item is-${item.status}`}
              onClick={() => onNavigate(item.targetId)}
              aria-label={`定位到${item.label}`}
            >
              {ready ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}


export function ProductReadinessChecklistPanel({
  items,
  title = '资料完整度清单',
  compact = false,
  saveMode = false,
  onNavigate,
}: {
  items: ProductChecklistItem[];
  title?: string;
  compact?: boolean;
  saveMode?: boolean;
  onNavigate: (targetId: string) => void;
}) {
  const requiredItems = items.filter((item) => item.requirement === 'required');
  const requiredReady = requiredItems.filter((item) => item.status === 'ready').length;
  const requiredMissing = requiredItems.filter((item) => item.status !== 'ready');
  const optionalRecommended = items.filter(
    (item) => item.requirement === 'optional' && item.status !== 'ready'
  );
  const summary = requiredMissing.length
    ? `必填项还差 ${requiredMissing.length} 项`
    : optionalRecommended.length
      ? `必填项已齐，建议补 ${optionalRecommended.length} 项`
      : '资料已满足发布检查';

  return (
    <section
      className={`product-readiness-checklist ${compact ? 'is-compact' : ''}`}
      aria-label={title}
    >
      <div className="product-readiness-checklist__head">
        <div>
          <p className="t-label">{saveMode ? '保存后发布检查' : title}</p>
          <strong>{summary}</strong>
          <span>
            {requiredReady}/{requiredItems.length} 个必填项完成
          </span>
        </div>
        <StatusPill tone={requiredMissing.length ? 'warning' : 'success'}>
          {requiredMissing.length ? '不可直接发布' : '可进入发布'}
        </StatusPill>
      </div>
      <div className="product-readiness-checklist__grid">
        {items.map((item) => {
          const ready = item.status === 'ready';
          const required = item.requirement === 'required';
          const tone = ready ? 'success' : required ? 'warning' : 'info';
          const statusText = ready ? '已完成' : required ? '待补必填' : '建议补齐';
          return (
            <button
              key={item.key}
              type="button"
              className={`product-readiness-checklist__item is-${tone}`}
              onClick={() => onNavigate(item.targetId)}
            >
              {ready ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              <div>
                <span>
                  <strong>{item.label}</strong>
                  <em>{required ? '必填' : '可填'}</em>
                </span>
                <small>
                  {statusText} · {item.detail}
                </small>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}


export function formatSaveChecklistFeedback(items: ProductChecklistItem[], published: boolean): string {
  const missing = items.filter(
    (item) => item.requirement === 'required' && item.status !== 'ready'
  );
  if (missing.length) {
    return `产品库已保存；发布前还需补齐 ${missing.length} 个必填项：${missing
      .map((item) => item.label)
      .slice(0, 3)
      .join('、')}${missing.length > 3 ? '等' : ''}。`;
  }
  if (published) return '产品库已保存；必填资料已齐，官网已发布，可刷新官网回读校验。';
  return '产品库已保存；必填资料已齐，下一步发布到官网。';
}


export function buildProductEditChecklist({
  productId,
  draft,
  selectedProductCategoryPath,
  imageSrc,
  activeAssignments,
  hasPublishedWebsite,
}: {
  productId: string;
  draft: EditProductDraft;
  selectedProductCategoryPath: string;
  imageSrc: string;
  activeAssignments: WebsiteShelfAssignment[];
  hasPublishedWebsite: boolean;
}): ProductChecklistItem[] {
  const physicalValues = [
    draft.lengthMm,
    draft.widthMm,
    draft.heightMm,
    draft.netWeightKg,
    draft.packageLengthMm,
    draft.packageWidthMm,
    draft.packageHeightMm,
    draft.grossWeightKg,
  ].filter((value) => text(value));
  const hasWebsiteCopy = Boolean(
    text(draft.publicSummary) && (text(draft.featureBenefits) || text(draft.sellingPoints))
  );
  const hasMainImage = Boolean(draft.mainImage || imageSrc);
  const hasDetailAsset = Boolean(text(draft.officialDetailHtml) || draft.manualPdfs.length);
  return [
    {
      key: 'identity',
      label: '名称与型号',
      requirement: 'required',
      status: text(draft.name) && text(draft.model) ? 'ready' : 'missing',
      detail: text(draft.name) && text(draft.model) ? '产品可被识别' : '需填写产品名称和型号',
      targetId: `product-edit-section-master-${productId}`,
    },
    {
      key: 'category',
      label: '产品库分类',
      requirement: 'required',
      status: draft.categoryLevel1Id && draft.categoryLevel2Id ? 'ready' : 'missing',
      detail: draft.categoryLevel2Id
        ? selectedProductCategoryPath || '已绑定到二级分类'
        : '需选择一级和二级分类',
      targetId: `product-edit-section-category-${productId}`,
    },
    {
      key: 'website-copy',
      label: '官网摘要与卖点',
      requirement: 'required',
      status: hasWebsiteCopy ? 'ready' : 'missing',
      detail: hasWebsiteCopy
        ? '官网卡片和详情页可读取'
        : '需填写官网摘要，并至少维护卖点或功能说明',
      targetId: `product-edit-section-website-content-${productId}`,
    },
    {
      key: 'main-image',
      label: '产品主图',
      requirement: 'required',
      status: hasMainImage ? 'ready' : 'missing',
      detail: hasMainImage ? '列表和官网卡片可展示图片' : '需上传或保留一张产品主图',
      targetId: `product-edit-section-assets-${productId}`,
    },
    {
      key: 'website-directory',
      label: '官网目录挂载',
      requirement: 'required',
      status: activeAssignments.length ? 'ready' : 'missing',
      detail: activeAssignments.length
        ? `已配置 ${activeAssignments.length} 个官网挂载`
        : '需选择官网和展示目录',
      targetId: `product-edit-section-website-mapping-${productId}`,
    },
    {
      key: 'publish-status',
      label: '官网发布状态',
      requirement: 'optional',
      status: hasPublishedWebsite ? 'ready' : 'recommended',
      detail: hasPublishedWebsite ? '已有发布记录，可回读校验' : '保存后仍需发布到官网',
      targetId: `product-edit-section-check-${productId}`,
    },
    {
      key: 'physical',
      label: '尺寸与重量',
      requirement: 'optional',
      status: physicalValues.length ? 'ready' : 'recommended',
      detail: physicalValues.length
        ? `已维护 ${physicalValues.length} 个基础规格`
        : '建议补齐长宽高、净重、包装尺寸和毛重',
      targetId: `product-edit-section-library-${productId}`,
    },
    {
      key: 'technical',
      label: '技术参数',
      requirement: 'optional',
      status: text(draft.technicalSpecs) ? 'ready' : 'recommended',
      detail: text(draft.technicalSpecs)
        ? '参数表已有基础内容'
        : '建议维护容量、能效、燃气/电源等参数',
      targetId: `product-edit-section-library-${productId}`,
    },
    {
      key: 'detail-assets',
      label: '详情长图 / PDF',
      requirement: 'optional',
      status: hasDetailAsset ? 'ready' : 'recommended',
      detail: hasDetailAsset ? '已有详情资料' : '建议补产品详情长图或说明书 PDF',
      targetId: `product-edit-section-assets-detail-${productId}`,
    },
    {
      key: 'price',
      label: '价格展示',
      requirement: 'optional',
      status:
        draft.websitePriceDisplayMode !== 'not_shown' || text(draft.listPrice)
          ? 'ready'
          : 'recommended',
      detail:
        draft.websitePriceDisplayMode !== 'not_shown'
          ? '已设置官网价格策略'
          : '可按运营策略选择展示或不展示价格',
      targetId: `product-edit-section-website-content-${productId}`,
    },
  ];
}


export function catalogCategoryFilterOptions(tree: ProductCategoryNode[]) {
  return flattenCategoryTree(tree)
    .filter((item) => item.status !== 'inactive')
    .map((item) => ({
      value: `${item.level}:${item.id}`,
      label: `${'　'.repeat(Math.max(0, item.level - 1))}${item.name || item.code}`,
    }));
}


export function productMatchesCatalogCategory(product: NormalizedProduct, value: CatalogCategoryFilter) {
  if (value === 'all') return true;
  const [level, categoryId] = value.split(':');
  const binding = productCategoryBinding(product);
  if (categoryId) {
    if (level === '1') return binding.categoryLevel1Id === categoryId;
    if (level === '2') return binding.categoryLevel2Id === categoryId;
    if (level === '3') return binding.categoryLevel3Id === categoryId;
  }
  return product.category === value;
}


export function applyCatalogCategoryQuery(query: Record<string, string>, category: CatalogCategoryFilter) {
  if (category === 'all') return;
  if (!category.includes(':')) {
    query.category = category;
    return;
  }
  const [level, categoryId] = category.split(':');
  if (!categoryId) return;
  if (level === '1') query.categoryLevel1Id = categoryId;
  if (level === '2') query.categoryLevel2Id = categoryId;
  if (level === '3') query.categoryLevel3Id = categoryId;
}


function skeletonSku(brand: ProductBrand, seed: string): string {
  const suffix =
    slug(seed || `${brand}-${Date.now()}`)
      .replace(/-/g, '')
      .slice(0, 24) || String(Date.now());
  return `${brand.toUpperCase()}-${suffix.toUpperCase()}`;
}


export function emptyCreateDraft(): CreateProductDraft {
  return {
    brand: '',
    brands: [],
    name: '',
    model: '',
    materialCode: '',
    skuSeed: '',
    categoryLevel1Id: '',
    categoryLevel2Id: '',
    categoryLevel3Id: '',
    productType: '',
    lifecycleStage: 'intro',
    manufacturer: '',
    countryOfOrigin: '中国',
    marketCode: 'CN',
    launchDate: '',
    discontinueDate: '',
    salesUnit: '台',
    lengthMm: '',
    widthMm: '',
    heightMm: '',
    netWeightKg: '',
    packageLengthMm: '',
    packageWidthMm: '',
    packageHeightMm: '',
    grossWeightKg: '',
    packageSpec: '',
    configurationNotes: '',
    installationRequirement: '',
    warrantyPolicy: '',
    technicalSpecs: '',
    sellingPoints: '',
    applicationScenarios: '',
    complianceCertificates: '',
    listPrice: '',
    costPrice: '',
    currency: 'CNY',
    websitePriceDisplayMode: 'not_shown',
    websitePrice: '',
    websitePriceMin: '',
    websitePriceMax: '',
    promoPrice: '',
    priceUnit: '台',
    priceLabel: '官网参考价',
    priceNote: '',
    taxIncluded: true,
    publicSlug: '',
    series: '',
    tagline: '',
    publicSummary: '',
    featureBenefits: '',
    highlightMetrics: '',
    faqs: '',
    websiteCategory: '',
    displayOrder: '0',
    badges: '',
    officialEnglishName: '',
    officialDetailHtml: '',
    mainImage: null,
    manualPdfs: [],
  };
}


export function editDraftFromProduct(product: NormalizedProduct): EditProductDraft {
  const brandMeta = productBrandMeta(product);
  const categoryBinding = productCategoryBinding(product);
  const spec = objectOrEmpty(product.raw?.spec);
  const libraryMeta = productLibraryMeta(product);
  const websitePricing = objectOrEmpty(
    product.raw?.websitePricing || objectOrEmpty(product.raw?.meta).websitePricing
  );
  const skuMeta = objectOrEmpty(libraryMeta.sku);
  const lifecycle = objectOrEmpty(libraryMeta.lifecycle);
  const compliance = objectOrEmpty(libraryMeta.compliance);
  const positioning = objectOrEmpty(product.raw?.positioning);
  const librarySellingPoints = Array.isArray(libraryMeta.sellingPoints)
    ? libraryMeta.sellingPoints
    : [];
  const libraryScenarios = Array.isArray(libraryMeta.applicationScenarios)
    ? libraryMeta.applicationScenarios
    : Array.isArray(libraryMeta.scenarios)
      ? libraryMeta.scenarios
      : [];
  return {
    name: text(product.name),
    model: text(product.model),
    category: text(product.category),
    system: text(product.system),
    categoryLevel1Id: categoryBinding.categoryLevel1Id,
    categoryLevel2Id: categoryBinding.categoryLevel2Id,
    categoryLevel3Id: categoryBinding.categoryLevel3Id,
    productType: text(spec.productType || libraryMeta.productType),
    lifecycleStage: text(product.raw?.lifecycleStage || lifecycle.stage) || 'intro',
    manufacturer: text(spec.manufacturer || libraryMeta.manufacturer),
    countryOfOrigin: text(spec.countryOfOrigin || libraryMeta.countryOfOrigin) || '中国',
    marketCode: text(spec.marketCode || libraryMeta.marketCode) || 'CN',
    launchDate: text(lifecycle.launchDate),
    discontinueDate: text(lifecycle.discontinueDate),
    salesUnit: text(skuMeta.salesUnit) || '台',
    lengthMm: text((product.raw as any)?.lengthMm),
    widthMm: text((product.raw as any)?.widthMm),
    heightMm: text((product.raw as any)?.heightMm),
    netWeightKg: text((product.raw as any)?.netWeightKg),
    packageLengthMm: text((product.raw as any)?.packageLengthMm),
    packageWidthMm: text((product.raw as any)?.packageWidthMm),
    packageHeightMm: text((product.raw as any)?.packageHeightMm),
    grossWeightKg: text((product.raw as any)?.grossWeightKg),
    packageSpec: text(skuMeta.packageSpec),
    configurationNotes: text(skuMeta.configurationNotes),
    installationRequirement: text(libraryMeta.installationRequirement),
    warrantyPolicy: text(libraryMeta.warrantyPolicy),
    technicalSpecs: keyValueLines(spec.technicalSpecs || brandMeta.specs),
    sellingPoints:
      Array.isArray(positioning.sellingPoints) && positioning.sellingPoints.length
        ? positioning.sellingPoints.map(text).filter(Boolean).join('\n')
        : librarySellingPoints.map(text).filter(Boolean).join('\n'),
    applicationScenarios:
      Array.isArray(positioning.scenarios) && positioning.scenarios.length
        ? positioning.scenarios.map(text).filter(Boolean).join('\n')
        : Array.isArray(positioning.applicationScenarios) && positioning.applicationScenarios.length
          ? positioning.applicationScenarios.map(text).filter(Boolean).join('\n')
          : libraryScenarios.map(text).filter(Boolean).join('\n'),
    complianceCertificates: Array.isArray(compliance.certificates)
      ? compliance.certificates.map(text).filter(Boolean).join('\n')
      : '',
    listPrice: text((product.raw as any)?.listPrice ?? product.marketPrice),
    costPrice: text((product.raw as any)?.costPrice ?? product.dealerPrice),
    currency: text((product.raw as any)?.currency) || 'CNY',
    websitePriceDisplayMode: text(websitePricing.priceDisplayMode) || 'not_shown',
    websitePrice: text(websitePricing.websitePrice),
    websitePriceMin: text(websitePricing.websitePriceMin),
    websitePriceMax: text(websitePricing.websitePriceMax),
    promoPrice: text(websitePricing.promoPrice),
    priceUnit: text(websitePricing.priceUnit) || '台',
    priceLabel: text(websitePricing.priceLabel) || '官网参考价',
    priceNote: text(websitePricing.priceNote),
    taxIncluded: websitePricing.taxIncluded !== false,
    publicSlug: text(brandMeta.slug) || slug(text(product.sku)),
    series: text(brandMeta.series),
    tagline: text(brandMeta.tagline),
    publicSummary: '',
    featureBenefits: '',
    highlightMetrics: '',
    faqs: '',
    websiteCategory: text(
      brandMeta.websiteCategory || brandMeta.websiteMenuCategory || brandMeta.cat
    ),
    displayOrder: String(nonNegativeInt(brandMeta.displayOrder ?? brandMeta.sortOrder)),
    badges: Array.isArray(brandMeta.badges)
      ? brandMeta.badges.map(text).filter(Boolean).join(', ')
      : '',
    officialEnglishName: text(brandMeta.en || brandMeta.officialEnglishName),
    officialDetailHtml: text((product.raw as any)?.officialDetailHtml),
    mainImage: null,
    manualPdfs: savedProductManualPdfs(product),
  };
}

