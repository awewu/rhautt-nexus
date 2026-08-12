'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Archive, Bold, Boxes, CheckCircle2, Edit3, ExternalLink, EyeOff, FileText, FolderOpen, Heading2, Image, Italic, Link, List, ListOrdered, Package, Plus, RefreshCw, Search, Table2, X, XCircle } from 'lucide-react';
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
import { auth, brandProductCategories, brandSites, fileArtifacts, products, publicSiteProducts, siteProductAssignments, siteProductCategories } from '../../lib/api';
import { getBrandProductPermissions, type BrandProductPermissions } from '../../lib/brand-product-adapter';
import { CATEGORIES, PRODUCTS, SYSTEM_PACKS, type CatKey, type Product } from '../../lib/products-data';

type ProductModule = 'dashboard' | 'catalog' | 'materials' | 'base' | 'categories';
type ProductStock = Product['stock'];
type BrandFilter = string;
type ProductBrand = string;
type CatalogCategoryFilter = 'all' | string;
type StatusFilter = 'all' | 'active' | 'inactive' | 'archived';
type AssignmentStatus = 'draft' | 'published' | 'hidden';
type WebsiteShelfTransition = 'publishing' | 'hiding';
type WebsiteShelfAssignment = {
  id: string;
  siteCode?: string;
  siteId?: string;
  brand?: string;
  productTenantId: string;
  productId: string;
  status: AssignmentStatus;
  publicSlug?: string;
  siteProductCategoryId?: string | null;
  websiteCategory?: string | null;
  menuGroup?: string | null;
  displayOrder?: number;
  isFeatured?: boolean;
  siteTitle?: string | null;
  siteSummary?: string | null;
  siteMeta?: Record<string, unknown> | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
};
type FloatingDialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};
type FloatingPromptOptions = FloatingDialogOptions & {
  defaultValue?: string;
  placeholder?: string;
};
type FloatingDialogState =
  | (FloatingDialogOptions & { kind: 'alert'; resolve: () => void })
  | (FloatingDialogOptions & { kind: 'confirm'; resolve: (value: boolean) => void })
  | (FloatingPromptOptions & { kind: 'prompt'; resolve: (value: string | null) => void });

const EMPTY_BRAND_PRODUCT_PERMISSIONS: BrandProductPermissions = {
  canCreateProduct: false,
  canUpdateProduct: false,
  canDeleteProduct: false,
  canPublishProduct: false,
  canCreateBrandLibrary: false,
  canUpdateBrandLibrary: false,
  canDeleteBrandLibrary: false,
  canPublishBrandLibrary: false,
  canAnyProductWrite: false,
  canAnyBrandWrite: false,
  canAnyWrite: false,
};

function useFloatingDialog() {
  const [dialog, setDialog] = useState<FloatingDialogState | null>(null);

  const alertFloating = (options: FloatingDialogOptions) => new Promise<void>((resolve) => {
    setDialog({
      kind: 'alert',
      title: options.title || '系统提示',
      message: options.message,
      confirmLabel: options.confirmLabel || '知道了',
      tone: options.tone || 'default',
      resolve,
    });
  });

  const confirmFloating = (options: FloatingDialogOptions) => new Promise<boolean>((resolve) => {
    setDialog({
      kind: 'confirm',
      title: options.title || '操作确认',
      message: options.message,
      confirmLabel: options.confirmLabel || '确定',
      cancelLabel: options.cancelLabel || '取消',
      tone: options.tone || 'default',
      resolve,
    });
  });

  const promptFloating = (options: FloatingPromptOptions) => new Promise<string | null>((resolve) => {
    setDialog({
      kind: 'prompt',
      title: options.title || '请输入内容',
      message: options.message,
      defaultValue: options.defaultValue || '',
      placeholder: options.placeholder || '',
      confirmLabel: options.confirmLabel || '确定',
      cancelLabel: options.cancelLabel || '取消',
      tone: options.tone || 'default',
      resolve,
    });
  });

  const closeDialog = (value: boolean | string | null) => {
    setDialog((current) => {
      if (!current) return current;
      if (current.kind === 'alert') current.resolve();
      else current.resolve(value as never);
      return null;
    });
  };

  return {
    alertFloating,
    confirmFloating,
    promptFloating,
    floatingDialog: dialog ? <FloatingDialog dialog={dialog} onClose={closeDialog} /> : null,
  };
}

function FloatingDialog({ dialog, onClose }: { dialog: FloatingDialogState; onClose: (value: boolean | string | null) => void }) {
  const [inputValue, setInputValue] = useState(dialog.kind === 'prompt' ? dialog.defaultValue || '' : '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (dialog.kind !== 'prompt') return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dialog.kind]);

  if (typeof document === 'undefined') return null;

  const cancelValue = dialog.kind === 'prompt' ? null : false;
  return createPortal(
    <div className="product-floating-dialog-backdrop" role="presentation" onMouseDown={() => onClose(cancelValue)}>
      <form
        className={`product-floating-dialog${dialog.tone === 'danger' ? ' is-danger' : ''}`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onClose(dialog.kind === 'prompt' ? inputValue : true);
        }}
      >
        <header>
          <div>
            <p className="t-label">系统提示</p>
            <h2>{dialog.title}</h2>
          </div>
          <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => onClose(cancelValue)} aria-label="关闭弹框">
            <X size={15} />
          </button>
        </header>
        <div className="product-floating-dialog-body">
          <p>{dialog.message}</p>
          {dialog.kind === 'prompt' && (
            <input ref={inputRef} className="input" value={inputValue} placeholder={dialog.placeholder} onChange={(event) => setInputValue(event.target.value)} />
          )}
        </div>
        <footer>
          {dialog.kind !== 'alert' && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onClose(cancelValue)}>
              {dialog.cancelLabel || '取消'}
            </button>
          )}
          <button type="submit" className={`btn btn-sm ${dialog.tone === 'danger' ? 'btn-danger' : 'btn-brand'}`}>
            {dialog.confirmLabel || '确定'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
type CreateProductDraft = {
  brand: ProductBrand | '';
  brands: ProductBrand[];
  name: string;
  model: string;
  materialCode: string;
  skuSeed: string;
  categoryLevel1Id: string;
  categoryLevel2Id: string;
  categoryLevel3Id: string;
  productType: string;
  lifecycleStage: string;
  manufacturer: string;
  countryOfOrigin: string;
  marketCode: string;
  launchDate: string;
  discontinueDate: string;
  salesUnit: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  netWeightKg: string;
  packageLengthMm: string;
  packageWidthMm: string;
  packageHeightMm: string;
  grossWeightKg: string;
  packageSpec: string;
  configurationNotes: string;
  installationRequirement: string;
  warrantyPolicy: string;
  technicalSpecs: string;
  sellingPoints: string;
  applicationScenarios: string;
  complianceCertificates: string;
  listPrice: string;
  costPrice: string;
  currency: string;
  websitePriceDisplayMode: string;
  websitePrice: string;
  websitePriceMin: string;
  websitePriceMax: string;
  promoPrice: string;
  priceUnit: string;
  priceLabel: string;
  priceNote: string;
  taxIncluded: boolean;
  publicSlug: string;
  series: string;
  tagline: string;
  publicSummary: string;
  featureBenefits: string;
  highlightMetrics: string;
  faqs: string;
  websiteCategory: string;
  displayOrder: string;
  badges: string;
  officialEnglishName: string;
  officialDetailHtml: string;
  mainImage: ProductPendingImageDraft | null;
  manualPdfs: ProductManualPdfDraft[];
};
type ProductPendingImageDraft = {
  file: File;
  previewUrl: string;
};
type ProductManualPdfDraft = {
  id: string;
  file?: File;
  artifactId?: string;
  objectKey?: string;
  name: string;
  mimeType?: string;
  previewUrl: string;
  saved?: boolean;
  sortOrder?: number;
};
type EditProductDraft = {
  name: string;
  model: string;
  category: string;
  system: string;
  categoryLevel1Id: string;
  categoryLevel2Id: string;
  categoryLevel3Id: string;
  productType: string;
  lifecycleStage: string;
  manufacturer: string;
  countryOfOrigin: string;
  marketCode: string;
  launchDate: string;
  discontinueDate: string;
  salesUnit: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  netWeightKg: string;
  packageLengthMm: string;
  packageWidthMm: string;
  packageHeightMm: string;
  grossWeightKg: string;
  packageSpec: string;
  configurationNotes: string;
  installationRequirement: string;
  warrantyPolicy: string;
  technicalSpecs: string;
  sellingPoints: string;
  applicationScenarios: string;
  complianceCertificates: string;
  listPrice: string;
  costPrice: string;
  currency: string;
  websitePriceDisplayMode: string;
  websitePrice: string;
  websitePriceMin: string;
  websitePriceMax: string;
  promoPrice: string;
  priceUnit: string;
  priceLabel: string;
  priceNote: string;
  taxIncluded: boolean;
  publicSlug: string;
  series: string;
  tagline: string;
  publicSummary: string;
  featureBenefits: string;
  highlightMetrics: string;
  faqs: string;
  websiteCategory: string;
  displayOrder: string;
  badges: string;
  officialEnglishName: string;
  officialDetailHtml: string;
  mainImage: ProductPendingImageDraft | null;
  manualPdfs: ProductManualPdfDraft[];
};
type RowActionState = {
  dirty: boolean;
  saving: boolean;
  savingAction?: 'save' | 'status' | 'archive';
  success: string;
  error: string;
};
type NormalizedProduct = Product & {
  sku: string;
  status: string;
  system: string;
  materialCode: string;
  materialCategory: string;
  productLine: string;
  categoryPath: string;
  applicationScenarios: string[];
  marginRate: number;
  raw?: Record<string, any>;
};
type ProductPilotSummary = {
  products: number;
  categories: number;
  websitePublished: number;
  needsCompletion: number;
};
type ProductCategoryNode = {
  id: string;
  parentId: string | null;
  level: number;
  code: string;
  name: string;
  nameCn: string;
  nameEn: string;
  slug: string;
  status: string;
  showOnWebsite: boolean;
  sortOrder: number;
  description: string;
  hasChildren: boolean;
  childCategoryCount: number;
  directProductCount: number;
  descendantProductCount: number;
  children: ProductCategoryNode[];
};
type ProductCategoryDraft = {
  nameCn: string;
  code: string;
  slug: string;
  sortOrder: string;
  status: 'active' | 'inactive';
  showOnWebsite: boolean;
  description: string;
};
type ProductCategoryUsage = {
  boundProductCount: number;
  childCategoryCount?: number;
};
type SiteProductCategoryRow = {
  id?: string;
  parentId?: string | null;
  level?: number;
  code?: string;
  name?: string;
  slug?: string | null;
  websiteCategory: string;
  menuGroup?: string | null;
  menuGroups: string[];
  mappedBaseCategoryId?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
  isFeatured?: boolean;
  status?: string;
  description?: string | null;
  assignmentIds: string[];
  productCount: number;
  publishedCount: number;
  hiddenCount: number;
  draftCount: number;
  featuredCount: number;
  displayOrder: number;
};
type SiteProductCategoryResponse = {
  siteCode: string;
  total: number;
  productCount: number;
  items: SiteProductCategoryRow[];
};
type SitePublishingSuggestion = {
  siteCode: string;
  productId: string;
  productTenantId: string;
  productCategory: {
    primaryCategoryId?: string | null;
    categoryLevel1Id?: string | null;
    categoryLevel2Id?: string | null;
    categoryLevel3Id?: string | null;
    matchedBaseCategoryId?: string | null;
    pathLabel?: string;
  };
  suggestedWebsiteCategory?: {
    id: string;
    name: string;
    path: string;
    level: number;
    mappedBaseCategoryId?: string | null;
    matchReason: 'mapped_base_category_id' | 'first_and_leaf_name' | 'name_fallback' | 'none';
  } | null;
  suggestedSeries?: {
    value?: string;
    source?: string;
  };
};
type SiteProductCategoryTreeNode = SiteProductCategoryRow & {
  id: string;
  name: string;
  path: string;
  level: number;
  children: SiteProductCategoryTreeNode[];
};
type SiteProductCategorySelectOption = {
  value: string;
  label: string;
  name: string;
  path: string;
  code?: string;
};

const CATEGORY_KEYS = new Set<string>(CATEGORIES.map((category) => category.key));
const DEFAULT_BRAND_OPTIONS: Array<{ value: BrandFilter; label: string }> = [
  { value: 'all', label: '全部品牌' },
  { value: 'rheem', label: '瑞美 Rheem' },
  { value: 'ruud', label: '瑞德 Ruud' },
  { value: 'everhot', label: '恒热 Everhot' },
];
const DEFAULT_CREATE_BRAND_OPTIONS: Array<{ value: ProductBrand; label: string }> = [
  { value: 'rheem', label: '瑞美 Rheem' },
  { value: 'ruud', label: '瑞德 Ruud' },
  { value: 'everhot', label: '恒热 Everhot' },
];
const DEFAULT_PRODUCT_BRANDS: ProductBrand[] = ['rheem', 'ruud', 'everhot'];
const PRODUCT_BASE_CATEGORY_BRAND = 'common';
const BRAND_PRODUCT_TENANTS: Record<string, string | undefined> = {
  rheem: process.env.NEXT_PUBLIC_RHEEM_TENANT_ID || '4aee0000-0000-4000-8000-000000000001',
  ruud: process.env.NEXT_PUBLIC_RUUD_TENANT_ID || '7aad0000-0000-4000-8000-000000000001',
  everhot: process.env.NEXT_PUBLIC_EVERHOT_TENANT_ID || 'e5e40000-0000-4000-8000-000000000001',
};
const PRODUCT_LIBRARY_TENANT_ID =
  process.env.NEXT_PUBLIC_PRODUCT_LIBRARY_TENANT_ID
  || process.env.NEXT_PUBLIC_RHAUTT_COMFORT_TENANT_ID
  || process.env.NEXT_PUBLIC_EVERHOT_TENANT_ID
  || 'e5e40000-0000-4000-8000-000000000001';
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部产品库状态' },
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '停用' },
  { value: 'archived', label: '已归档' },
];
const PRODUCT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const STOCK: Record<ProductStock, { label: string; className: string; tone: string }> = {
  in: { label: '现货', className: 'badge-success', tone: 'var(--success)' },
  low: { label: '低库存', className: 'badge-warning', tone: 'var(--warning)' },
  order: { label: '需订货', className: 'badge-danger', tone: 'var(--danger)' },
};
const PRODUCT_DETAIL_LOCALE = 'zh-CN';
const PRODUCT_DETAIL_ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'A', 'IMG',
  'H2', 'H3', 'H4', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
]);

const fmt = (value: number) => `￥${Math.round(value || 0).toLocaleString('zh-CN')}`;
const pct = (value: number) => `${Math.round(value || 0)}%`;

function normalizeModule(value: unknown): ProductModule {
  return value === 'catalog' || value === 'materials' || value === 'base' || value === 'categories' ? value : 'dashboard';
}

function normalizeCategory(value: unknown): CatKey {
  const raw = text(value);
  return raw ? (raw as CatKey) : 'heat_pump';
}

function productCategoryNodeValue(node: ProductCategoryNode | null | undefined): string {
  return text(node?.code || node?.slug || node?.nameCn || node?.name || node?.id);
}

function productCategoryDisplayLabel(value: unknown, tree: ProductCategoryNode[] = []): string {
  const raw = text(value);
  if (!raw) return '';
  const flat = flattenCategoryTree(tree);
  const matched = flat.find((node) => [node.id, node.code, node.slug, node.nameCn, node.name, node.nameEn].some((item) => text(item) === raw));
  if (matched) return categoryOptionLabel(matched);
  const builtin = CATEGORIES.find((category) => category.key === raw);
  return builtin?.label || raw;
}

function normalizeBrand(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function displayBrand(value: string): string {
  if (value === 'common') return '公共产品库';
  if (value === 'rheem') return '瑞美 Rheem';
  if (value === 'ruud') return '瑞德 Ruud';
  if (value === 'everhot') return '恒热 Everhot';
  return value || '未绑定';
}

function brandOptionsFromSites(result: unknown): Array<{ value: ProductBrand; label: string }> {
  const rows = Array.isArray((result as any)?.items) ? (result as any).items : [];
  const options = rows
    .filter((site: Record<string, any>) => site.status === 'active' && !site.deletedAt && site.code !== 'rhautt-group')
    .map((site: Record<string, any>) => ({
      value: normalizeBrand(site.code),
      label: `${site.nameCn || site.nameEn || site.code} ${site.nameEn || ''}`.trim(),
      sortOrder: Number(site.sortOrder || 0),
    }))
    .filter((site: { value: string }) => site.value)
    .sort((left: { sortOrder: number }, right: { sortOrder: number }) => left.sortOrder - right.sortOrder)
    .map(({ value, label }: { value: string; label: string }) => ({ value, label }));
  return options.length ? options : DEFAULT_CREATE_BRAND_OPTIONS;
}

function statusLabel(status: string): string {
  if (status === 'active') return '启用';
  if (status === 'inactive') return '停用';
  if (status === 'archived') return '已归档';
  return status || '未知';
}

function statusTone(status: string): 'success' | 'warning' | 'neutral' | 'info' {
  if (status === 'active') return 'success';
  if (status === 'inactive') return 'warning';
  if (status === 'archived') return 'neutral';
  return 'info';
}

function productStatusSortRank(status: string): number {
  if (status === 'active') return 0;
  if (status === 'inactive') return 1;
  if (status === 'archived') return 2;
  return 3;
}

function sortProductsByStatusThenOrder(items: NormalizedProduct[]): NormalizedProduct[] {
  return [...items].sort((left, right) => {
    const byStatus = productStatusSortRank(left.status) - productStatusSortRank(right.status);
    if (byStatus) return byStatus;
    const byBrand = displayBrand(left.brand).localeCompare(displayBrand(right.brand), 'zh-CN');
    if (byBrand) return byBrand;
    return String(left.name || left.model || left.sku).localeCompare(String(right.name || right.model || right.sku), 'zh-CN');
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function productDetailContentItems(result: unknown): Array<Record<string, any>> {
  const payload = (result as any)?.data ?? result;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function officialDetailFromContent(result: unknown): string {
  const item = productDetailContentItems(result).find((row) => row?.locale === PRODUCT_DETAIL_LOCALE)
    || productDetailContentItems(result)[0];
  return text(item?.officialDetailHtml);
}

function productContentItem(result: unknown): Record<string, any> {
  return productDetailContentItems(result).find((row) => row?.locale === PRODUCT_DETAIL_LOCALE)
    || productDetailContentItems(result)[0]
    || {};
}

function featureBenefitLines(value: unknown): string {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => {
      const row = objectOrEmpty(item);
      const title = text(row.title || row.feature);
      const desc = text(row.desc || row.description || row.benefit);
      return desc ? `${title}: ${desc}` : title;
    })
    .filter(Boolean)
    .join('\n');
}

function highlightMetricLines(value: unknown): string {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => {
      if (typeof item === 'string') return text(item);
      const row = objectOrEmpty(item);
      const label = text(row.label || row.k || row.key);
      const metric = text(row.value || row.v);
      return metric ? `${label}: ${metric}` : label;
    })
    .filter(Boolean)
    .join('\n');
}

function faqLines(value: unknown): string {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => {
      const row = objectOrEmpty(item);
      const question = text(row.q || row.question);
      const answer = text(row.a || row.answer);
      return question && answer ? `${question}: ${answer}` : question;
    })
    .filter(Boolean)
    .join('\n');
}

function contentDraftPatchFromResult(result: unknown): Partial<EditProductDraft> {
  const item = productContentItem(result);
  const marketing = objectOrEmpty(item.marketing);
  const patch: Partial<EditProductDraft> = {};
  if ('officialDetailHtml' in item) patch.officialDetailHtml = text(item.officialDetailHtml);
  if ('series' in marketing) patch.series = text(marketing.series);
  if ('headline' in marketing) patch.tagline = text(marketing.headline);
  if ('subhead' in marketing) patch.publicSummary = text(marketing.subhead);
  if ('officialEnglishName' in marketing) patch.officialEnglishName = text(marketing.officialEnglishName);
  if ('badges' in marketing) patch.badges = Array.isArray(marketing.badges) ? marketing.badges.map(text).filter(Boolean).join(', ') : '';
  if ('certs' in marketing) patch.complianceCertificates = Array.isArray(marketing.certs) ? marketing.certs.map(text).filter(Boolean).join('\n') : '';
  if ('features' in marketing || 'featureBenefits' in marketing) patch.featureBenefits = featureBenefitLines(marketing.features || marketing.featureBenefits);
  if ('highlights' in marketing) patch.highlightMetrics = highlightMetricLines(marketing.highlights);
  if ('faq' in marketing) patch.faqs = faqLines(marketing.faq);
  return patch;
}

function escapeProductDetailHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function productDetailPlainText(value: string) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeOfficialProductDetailHtml(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (typeof document === 'undefined') {
    return escapeProductDetailHtml(raw).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  }

  const template = document.createElement('template');
  template.innerHTML = raw;

  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    const tag = element.tagName.toUpperCase();
    if (!PRODUCT_DETAIL_ALLOWED_TAGS.has(tag)) {
      const fragment = document.createDocumentFragment();
      Array.from(element.childNodes).forEach((child) => {
        const clean = cleanNode(child);
        if (clean) fragment.appendChild(clean);
      });
      return fragment;
    }

    const output = document.createElement(tag.toLowerCase());
    if (tag === 'A') {
      const href = element.getAttribute('href') || '';
      if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(href)) {
        output.setAttribute('href', href);
        output.setAttribute('rel', 'noopener noreferrer');
        if (/^https?:\/\//i.test(href)) output.setAttribute('target', '_blank');
      }
    }
    if (tag === 'IMG') {
      const src = element.getAttribute('src') || '';
      if (/^(https?:\/\/|\/api\/|\/assets\/|\/uploads\/)/i.test(src)) {
        output.setAttribute('src', src);
        output.setAttribute('alt', element.getAttribute('alt') || '');
        output.setAttribute('loading', 'lazy');
      } else {
        return null;
      }
    }
    Array.from(element.childNodes).forEach((child) => {
      const clean = cleanNode(child);
      if (clean) output.appendChild(clean);
    });
    return output;
  }

  const fragment = document.createDocumentFragment();
  Array.from(template.content.childNodes).forEach((child) => {
    const clean = cleanNode(child);
    if (clean) fragment.appendChild(clean);
  });
  const container = document.createElement('div');
  container.appendChild(fragment);
  const sanitized = container.innerHTML.trim();
  if (sanitized && !/<[a-z][\s\S]*>/i.test(sanitized)) {
    return `<p>${escapeProductDetailHtml(productDetailPlainText(sanitized))}</p>`;
  }
  return sanitized || `<p>${escapeProductDetailHtml(productDetailPlainText(raw))}</p>`;
}

function assignmentItems(payload: unknown): WebsiteShelfAssignment[] {
  const data = (payload as any)?.data ?? payload;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function publicSiteProductItems(payload: unknown): Record<string, any>[] {
  const data = (payload as any)?.data ?? payload;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function assignmentKey(productId: string, tenantId: string): string {
  return `${tenantId || '-'}:${productId}`;
}

function assignmentMatchesProduct(assignment: WebsiteShelfAssignment | undefined, product: NormalizedProduct) {
  return Boolean(
    assignment &&
      !assignment.deletedAt &&
      assignment.productId === product.id &&
      assignment.productTenantId === tenantIdForProduct(product)
  );
}

function assignmentsForProduct(
  map: Map<string, WebsiteShelfAssignment[]>,
  product: NormalizedProduct,
): WebsiteShelfAssignment[] {
  const byTenant = map.get(assignmentKey(product.id, tenantIdForProduct(product))) || [];
  const byProduct = map.get(product.id) || [];
  const seen = new Set<string>();
  return [...byTenant, ...byProduct].filter((assignment) => {
    const key = assignment.id || `${assignment.siteCode || ''}:${assignment.productTenantId || ''}:${assignment.productId || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return !assignment.deletedAt;
  });
}

function activeWebsiteAssignments(assignments: WebsiteShelfAssignment[]): WebsiteShelfAssignment[] {
  return assignments.filter((assignment) => !assignment.deletedAt && assignment.status !== 'hidden');
}

function websiteShelfMeta(assignment?: WebsiteShelfAssignment, transition?: WebsiteShelfTransition) {
  if (transition === 'publishing') return { label: '官网发布中', tone: 'info' as const };
  if (transition === 'hiding') return { label: '官网隐藏中', tone: 'warning' as const };
  if (!assignment) return { label: '未配置官网', tone: 'neutral' as const };
  if (assignment.deletedAt || assignment.status === 'hidden') return { label: '官网已隐藏', tone: 'warning' as const };
  if (assignment.status === 'published') return { label: '官网已发布', tone: 'success' as const };
  return { label: '草稿待发布', tone: 'neutral' as const };
}

function websiteShelfSummary(assignments: WebsiteShelfAssignment[]) {
  const active = activeWebsiteAssignments(assignments);
  if (!active.length) return { label: '未配置官网', tone: 'neutral' as const };
  const published = active.filter((assignment) => assignment.status === 'published').length;
  if (active.length === 1) return websiteShelfMeta(active[0]);
  if (published === active.length) return { label: `已发布 ${active.length} 个官网`, tone: 'success' as const };
  if (published > 0) return { label: `部分发布 ${published}/${active.length}`, tone: 'info' as const };
  return { label: `待发布 ${active.length} 个官网`, tone: 'neutral' as const };
}

function websitePublishingStatusMeta(assignment: WebsiteShelfAssignment) {
  if (assignment.deletedAt) return { label: '已移除', tone: 'neutral' as const };
  if (assignment.status === 'published') return { label: '已发布，官网可见', tone: 'success' as const };
  if (assignment.status === 'hidden') return { label: '已隐藏，官网不可见', tone: 'warning' as const };
  return { label: '草稿，未发布到官网', tone: 'neutral' as const };
}

function assignmentWebsiteCategoryPath(assignment: WebsiteShelfAssignment): string {
  const meta = objectOrEmpty(assignment.siteMeta);
  const categoryMeta = objectOrEmpty(meta.siteProductCategory);
  return text(meta.websiteCategoryPath || categoryMeta.path || assignment.websiteCategory);
}

function preferredWebsiteAssignment(assignments: WebsiteShelfAssignment[], productBrand?: string): WebsiteShelfAssignment | null {
  const active = activeWebsiteAssignments(assignments);
  const brand = normalizeBrand(productBrand);
  return active.find((assignment) => assignment.status === 'published' && normalizeBrand(assignment.siteCode) === brand)
    || active.find((assignment) => assignment.status === 'published')
    || active.find((assignment) => normalizeBrand(assignment.siteCode) === brand)
    || active[0]
    || null;
}

function WebsiteShelfSummaryCell({ assignments, productBrand }: { assignments: WebsiteShelfAssignment[]; productBrand?: string }) {
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
    <div className="product-catalog-website-cell" style={{ display: 'grid', gap: 6, minWidth: 220 }}>
      <div className="product-catalog-website-cell__status" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <StatusPill tone={summary.tone}>{summary.label}</StatusPill>
        {active.length > 1 ? <span className="badge badge-grey">{active.length} 个站点</span> : null}
      </div>
      {primary ? (
        <>
          <span className="product-catalog-website-cell__path" style={{ color: 'var(--t-secondary)', fontSize: 12 }}>
            {displayBrand(normalizeBrand(primary.siteCode))} / {categoryPath || '未选择目录'}
          </span>
          <span className="product-catalog-website-cell__slug" style={{ color: 'var(--t-tertiary)', fontSize: 11 }}>
            slug: {text(primary.publicSlug) || '待生成'}
          </span>
        </>
      ) : (
        <span className="product-catalog-website-cell__path" style={{ color: 'var(--t-secondary)', fontSize: 12 }}>还没有官网挂载配置</span>
      )}
      <span className="product-catalog-website-cell__next" style={{ color: active.some((assignment) => assignment.status === 'published') ? 'var(--success)' : 'var(--warning)', fontSize: 11 }}>
        {nextStep}
      </span>
    </div>
  );
}

function MappingCheckItem({
  label,
  value,
  tone = 'neutral',
  note,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'info' | 'neutral';
  note?: string;
}) {
  const color = tone === 'success'
    ? 'var(--success)'
    : tone === 'warning'
      ? 'var(--warning)'
      : tone === 'info'
        ? 'var(--brand-500, var(--brand))'
        : 'var(--t-secondary)';
  return (
    <div className="product-edit-check-item" style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <span className="t-label">{label}</span>
      <strong style={{ color, fontSize: 13, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{value || '未维护'}</strong>
      {note ? <span style={{ color: 'var(--t-tertiary)', fontSize: 11, lineHeight: 1.35 }}>{note}</span> : null}
    </div>
  );
}

type ProductEditProgressItem = {
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

function ProductEditProgressStrip({
  items,
  onNavigate,
}: {
  items: ProductEditProgressItem[];
  onNavigate: (targetId: string) => void;
}) {
  const readyCount = items.filter((item) => item.status === 'ready').length;
  const percent = items.length ? Math.round((readyCount / items.length) * 100) : 0;
  const statusText = readyCount === items.length ? '可进入发布校验' : `还差 ${items.length - readyCount} 项`;

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

function ProductReadinessChecklistPanel({
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
  const optionalRecommended = items.filter((item) => item.requirement === 'optional' && item.status !== 'ready');
  const summary = requiredMissing.length
    ? `必填项还差 ${requiredMissing.length} 项`
    : optionalRecommended.length
      ? `必填项已齐，建议补 ${optionalRecommended.length} 项`
      : '资料已满足发布检查';

  return (
    <section className={`product-readiness-checklist ${compact ? 'is-compact' : ''}`} aria-label={title}>
      <div className="product-readiness-checklist__head">
        <div>
          <p className="t-label">{saveMode ? '保存后发布检查' : title}</p>
          <strong>{summary}</strong>
          <span>{requiredReady}/{requiredItems.length} 个必填项完成</span>
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
                <small>{statusText} · {item.detail}</small>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function formatSaveChecklistFeedback(items: ProductChecklistItem[], published: boolean): string {
  const missing = items.filter((item) => item.requirement === 'required' && item.status !== 'ready');
  if (missing.length) {
    return `产品库已保存；发布前还需补齐 ${missing.length} 个必填项：${missing.map((item) => item.label).slice(0, 3).join('、')}${missing.length > 3 ? '等' : ''}。`;
  }
  if (published) return '产品库已保存；必填资料已齐，官网已发布，可刷新官网回读校验。';
  return '产品库已保存；必填资料已齐，下一步发布到官网。';
}

function buildProductEditChecklist({
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
  const hasWebsiteCopy = Boolean(text(draft.publicSummary) && (text(draft.featureBenefits) || text(draft.sellingPoints)));
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
      detail: draft.categoryLevel2Id ? (selectedProductCategoryPath || '已绑定到二级分类') : '需选择一级和二级分类',
      targetId: `product-edit-section-category-${productId}`,
    },
    {
      key: 'website-copy',
      label: '官网摘要与卖点',
      requirement: 'required',
      status: hasWebsiteCopy ? 'ready' : 'missing',
      detail: hasWebsiteCopy ? '官网卡片和详情页可读取' : '需填写官网摘要，并至少维护卖点或功能说明',
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
      detail: activeAssignments.length ? `已配置 ${activeAssignments.length} 个官网挂载` : '需选择官网和展示目录',
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
      detail: physicalValues.length ? `已维护 ${physicalValues.length} 个基础规格` : '建议补齐长宽高、净重、包装尺寸和毛重',
      targetId: `product-edit-section-library-${productId}`,
    },
    {
      key: 'technical',
      label: '技术参数',
      requirement: 'optional',
      status: text(draft.technicalSpecs) ? 'ready' : 'recommended',
      detail: text(draft.technicalSpecs) ? '参数表已有基础内容' : '建议维护容量、能效、燃气/电源等参数',
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
      status: draft.websitePriceDisplayMode !== 'not_shown' || text(draft.listPrice) ? 'ready' : 'recommended',
      detail: draft.websitePriceDisplayMode !== 'not_shown' ? '已设置官网价格策略' : '可按运营策略选择展示或不展示价格',
      targetId: `product-edit-section-website-content-${productId}`,
    },
  ];
}

function catalogCategoryFilterOptions(tree: ProductCategoryNode[]) {
  return flattenCategoryTree(tree)
    .filter((item) => item.status !== 'inactive')
    .map((item) => ({
      value: `${item.level}:${item.id}`,
      label: `${'　'.repeat(Math.max(0, item.level - 1))}${item.name || item.code}`,
    }));
}

function productMatchesCatalogCategory(product: NormalizedProduct, value: CatalogCategoryFilter) {
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

function applyCatalogCategoryQuery(query: Record<string, string>, category: CatalogCategoryFilter) {
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

function productCategoryItems(result: unknown): Record<string, any>[] {
  if (Array.isArray(result)) return result as Record<string, any>[];
  if (Array.isArray((result as any)?.items)) return (result as any).items;
  if (Array.isArray((result as any)?.categories)) return (result as any).categories;
  if (Array.isArray((result as any)?.tree)) return flattenRawCategoryItems((result as any).tree);
  return [];
}

function flattenRawCategoryItems(items: Record<string, any>[]): Record<string, any>[] {
  return items.flatMap((item) => [item, ...flattenRawCategoryItems(Array.isArray(item.children) ? item.children : [])]);
}

function normalizeProductCategoryTree(result: unknown): ProductCategoryNode[] {
  const rows = productCategoryItems(result)
    .map((item) => {
      const id = text(item.id || item._id || item.code);
      const parentId = text(item.parentId || item.parent_id) || null;
      const level = Math.max(1, Number(item.level || 1));
      if (!id) return null;
      return {
        id,
        parentId,
        level,
        code: text(item.code),
        name: text(item.nameCn || item.name || item.label || item.nameEn || item.code),
        nameCn: text(item.nameCn || item.name || item.label || item.code),
        nameEn: text(item.nameEn),
        slug: text(item.slug),
        status: text(item.status || 'active'),
        showOnWebsite: item.showOnWebsite !== false && item.show_on_website !== false,
        sortOrder: Number(item.sortOrder ?? item.sort_order ?? 0),
        description: text(item.description),
        hasChildren: Boolean(item.hasChildren || (Array.isArray(item.children) && item.children.length)),
        childCategoryCount: Number(item.childCategoryCount || 0),
        directProductCount: Number(item.directProductCount || item.exactBoundProductCount || 0),
        descendantProductCount: Number(item.descendantProductCount || item.descendantBoundProductCount || 0),
        children: [],
      } satisfies ProductCategoryNode;
    })
    .filter(Boolean) as ProductCategoryNode[];
  const byId = new Map(rows.map((item) => [item.id, item]));
  const roots: ProductCategoryNode[] = [];
  rows.forEach((item) => {
    const parent = item.parentId ? byId.get(item.parentId) : null;
    if (parent && item.level > parent.level) {
      parent.children.push(item);
    } else {
      roots.push(item);
    }
  });
  const sortTree = (items: ProductCategoryNode[]) => {
    items.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
    items.forEach((item) => sortTree(item.children));
    return items;
  };
  return sortTree(roots);
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function skeletonSku(brand: ProductBrand, seed: string): string {
  const suffix = slug(seed || `${brand}-${Date.now()}`).replace(/-/g, '').slice(0, 24) || String(Date.now());
  return `${brand.toUpperCase()}-${suffix.toUpperCase()}`;
}

function internalCategoryCode(prefix = 'cat'): string {
  return `${prefix}-${Date.now().toString(36)}`.replace(/[^a-z0-9-]+/g, '-');
}

function emptyCreateDraft(): CreateProductDraft {
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

function editDraftFromProduct(product: NormalizedProduct): EditProductDraft {
  const brandMeta = productBrandMeta(product);
  const categoryBinding = productCategoryBinding(product);
  const spec = objectOrEmpty(product.raw?.spec);
  const libraryMeta = productLibraryMeta(product);
  const websitePricing = objectOrEmpty(product.raw?.websitePricing || objectOrEmpty(product.raw?.meta).websitePricing);
  const skuMeta = objectOrEmpty(libraryMeta.sku);
  const lifecycle = objectOrEmpty(libraryMeta.lifecycle);
  const compliance = objectOrEmpty(libraryMeta.compliance);
  const positioning = objectOrEmpty(product.raw?.positioning);
  const librarySellingPoints = Array.isArray(libraryMeta.sellingPoints) ? libraryMeta.sellingPoints : [];
  const libraryScenarios = Array.isArray(libraryMeta.applicationScenarios) ? libraryMeta.applicationScenarios : Array.isArray(libraryMeta.scenarios) ? libraryMeta.scenarios : [];
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
    sellingPoints: Array.isArray(positioning.sellingPoints) && positioning.sellingPoints.length
      ? positioning.sellingPoints.map(text).filter(Boolean).join('\n')
      : librarySellingPoints.map(text).filter(Boolean).join('\n'),
    applicationScenarios: Array.isArray(positioning.scenarios) && positioning.scenarios.length
      ? positioning.scenarios.map(text).filter(Boolean).join('\n')
      : Array.isArray(positioning.applicationScenarios) && positioning.applicationScenarios.length
        ? positioning.applicationScenarios.map(text).filter(Boolean).join('\n')
        : libraryScenarios.map(text).filter(Boolean).join('\n'),
    complianceCertificates: Array.isArray(compliance.certificates) ? compliance.certificates.map(text).filter(Boolean).join('\n') : '',
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
    websiteCategory: text(brandMeta.websiteCategory || brandMeta.websiteMenuCategory || brandMeta.cat),
    displayOrder: String(nonNegativeInt(brandMeta.displayOrder ?? brandMeta.sortOrder)),
    badges: Array.isArray(brandMeta.badges) ? brandMeta.badges.map(text).filter(Boolean).join(', ') : '',
    officialEnglishName: text(brandMeta.en || brandMeta.officialEnglishName),
    officialDetailHtml: text((product.raw as any)?.officialDetailHtml),
    mainImage: null,
    manualPdfs: savedProductManualPdfs(product),
  };
}

function tenantIdForProduct(product: NormalizedProduct): string {
  return text(product.raw?.tenantId);
}

function productBrandMeta(product: NormalizedProduct): Record<string, any> {
  const meta = objectOrEmpty(product.raw?.meta);
  return objectOrEmpty(meta[normalizeBrand(product.brand)]);
}

function productLibraryMeta(product: NormalizedProduct): Record<string, any> {
  return objectOrEmpty(objectOrEmpty(product.raw?.meta).productLibrary);
}

const PRODUCT_READINESS_LABELS: Record<string, string> = {
  identity: '身份',
  taxonomy: '分类',
  sku: 'SKU',
  technical: '技术',
  compliance: '合规',
  content: '内容',
  assets: '素材',
  market: '市场',
};

function productReadinessSummary(product: NormalizedProduct) {
  const libraryMeta = productLibraryMeta(product);
  const dimensions = objectOrEmpty(libraryMeta.readinessDimensions);
  const entries = Object.entries(PRODUCT_READINESS_LABELS).map(([key, label]) => {
    const value = dimensions[key];
    const detail = typeof value === 'string' ? { status: value } : objectOrEmpty(value);
    return { key, label, status: text(detail.status) || 'incomplete', note: text(detail.note) };
  });
  const ready = entries.filter((item) => item.status === 'ready' || item.status === 'not_applicable').length;
  return {
    status: text(libraryMeta.dataReadinessStatus),
    ready,
    total: entries.length,
    details: entries.map((item) => `${item.label}：${item.status === 'ready' ? '就绪' : item.status === 'not_applicable' ? '不适用' : '待补全'}${item.note ? `（${item.note}）` : ''}`).join('\n'),
  };
}

function productPublishRequiredReadiness(product: NormalizedProduct): { ready: boolean; missing: string[] } {
  const categoryBinding = productCategoryBinding(product);
  const content = productContentItem(product.raw?.publicContent || product.raw?.content || product.raw);
  const marketing = objectOrEmpty(content.marketing || product.raw?.marketing);
  const brandMeta = productBrandMeta(product);
  const libraryMeta = productLibraryMeta(product);
  const positioning = objectOrEmpty(product.raw?.positioning);
  const features = marketing.features || marketing.featureBenefits;
  const hasFeatureCopy = Array.isArray(features)
    ? features.length > 0
    : Boolean(
        text(features || marketing.sellingPoints)
        || (Array.isArray(positioning.sellingPoints) && positioning.sellingPoints.length > 0)
        || (Array.isArray(libraryMeta.sellingPoints) && libraryMeta.sellingPoints.length > 0)
      );
  const hasSummary = Boolean(text(
    marketing.subhead
    || marketing.summary
    || marketing.description
    || product.raw?.publicSummary
    || brandMeta.tagline
    || product.spec
  ));
  const missing = [
    !text(product.name) ? '产品名称' : '',
    !text(product.model) ? '型号' : '',
    !(categoryBinding.categoryLevel1Id && categoryBinding.categoryLevel2Id) ? '产品库分类' : '',
    !hasSummary ? '官网摘要' : '',
    !hasFeatureCopy ? '官网卖点' : '',
    !productImageSrc(product) ? '产品主图' : '',
  ].filter(Boolean);
  return { ready: missing.length === 0, missing };
}

function productCategoryBinding(product: NormalizedProduct): {
  primaryCategoryId: string;
  categoryLevel1Id: string;
  categoryLevel2Id: string;
  categoryLevel3Id: string;
} {
  const raw = objectOrEmpty(product.raw);
  const meta = objectOrEmpty(raw.meta);
  const brandMeta = productBrandMeta(product);
  const categoryMeta = objectOrEmpty(meta.categoryBinding);
  return {
    primaryCategoryId: text(raw.primaryCategoryId || brandMeta.primaryCategoryId || meta.primaryCategoryId || categoryMeta.primaryCategoryId),
    categoryLevel1Id: text(raw.categoryLevel1Id || brandMeta.categoryLevel1Id || meta.categoryLevel1Id || categoryMeta.categoryLevel1Id),
    categoryLevel2Id: text(raw.categoryLevel2Id || brandMeta.categoryLevel2Id || meta.categoryLevel2Id || categoryMeta.categoryLevel2Id),
    categoryLevel3Id: text(raw.categoryLevel3Id || brandMeta.categoryLevel3Id || meta.categoryLevel3Id || categoryMeta.categoryLevel3Id),
  };
}

function nonNegativeInt(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function optionalNonNegativeNumber(value: unknown): number | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function nullableNonNegativeNumber(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function splitBadges(value: string): string[] {
  return value
    .split(/[,，\n]/g)
    .map(text)
    .filter(Boolean);
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n|[;；]/g)
    .map(text)
    .filter(Boolean);
}

function parseKeyValueLines(value: string): Array<{ k: string; v: string }> {
  return splitLines(value).map((line) => {
    const parts = line.split(/[:：=]/);
    const k = text(parts.shift());
    const v = text(parts.join(':'));
    return k && v ? { k, v } : { k: line, v: '' };
  });
}

function keyValueLines(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((item) => {
      const row = objectOrEmpty(item);
      const k = text(row.k || row.label || row.name || row.key);
      const v = text(row.v || row.value || row.desc || row.description);
      return v ? `${k}: ${v}` : k;
    })
    .filter(Boolean)
    .join('\n');
}

function productUpdatePayload(
  product: NormalizedProduct,
  draft: EditProductDraft,
  status?: 'active' | 'inactive',
): Record<string, unknown> {
  const name = text(draft.name);
  const model = text(draft.model);
  const category = text(draft.category);
  const system = text(draft.system);
  const categoryLevel1Id = text(draft.categoryLevel1Id);
  const categoryLevel2Id = text(draft.categoryLevel2Id);
  const categoryLevel3Id = text(draft.categoryLevel3Id);
  const primaryCategoryId = categoryLevel3Id || categoryLevel2Id || categoryLevel1Id;
  if (!name) throw new Error('请填写产品名称。');
  if (!model) throw new Error('请填写产品型号。');
  if (!category) throw new Error('请选择分类。');
  if (!system) throw new Error('请填写系统。');
  if (!categoryLevel1Id) throw new Error('请选择一级产品分类。');
  if (!categoryLevel2Id) throw new Error('请选择二级产品分类。');
  const previousSpec = objectOrEmpty(product.raw?.spec);
  const brand = normalizeBrand(product.brand);
  const previousMeta = objectOrEmpty(product.raw?.meta);
  const previousBrandMeta = objectOrEmpty(previousMeta[brand]);
  const publicSlug = slug(draft.publicSlug);
  const websiteCategory = text(draft.websiteCategory);
  const displayOrder = nonNegativeInt(draft.displayOrder);
  const tenantId = tenantIdForProduct(product);
  const previousLibraryMeta = objectOrEmpty(previousMeta.productLibrary);
  const listPrice = optionalNonNegativeNumber(draft.listPrice);
  const costPrice = optionalNonNegativeNumber(draft.costPrice);
  const websitePrice = optionalNonNegativeNumber(draft.websitePrice);
  const websitePriceMin = optionalNonNegativeNumber(draft.websitePriceMin);
  const websitePriceMax = optionalNonNegativeNumber(draft.websitePriceMax);
  const promoPrice = optionalNonNegativeNumber(draft.promoPrice);
  const lengthMm = nullableNonNegativeNumber(draft.lengthMm);
  const widthMm = nullableNonNegativeNumber(draft.widthMm);
  const heightMm = nullableNonNegativeNumber(draft.heightMm);
  const netWeightKg = nullableNonNegativeNumber(draft.netWeightKg);
  const packageLengthMm = nullableNonNegativeNumber(draft.packageLengthMm);
  const packageWidthMm = nullableNonNegativeNumber(draft.packageWidthMm);
  const packageHeightMm = nullableNonNegativeNumber(draft.packageHeightMm);
  const grossWeightKg = nullableNonNegativeNumber(draft.grossWeightKg);
  const technicalSpecs = parseKeyValueLines(draft.technicalSpecs);
  const sellingPoints = splitLines(draft.sellingPoints);
  const applicationScenarios = splitLines(draft.applicationScenarios);
  const complianceCertificates = splitLines(draft.complianceCertificates);
  return {
    ...(tenantId ? { tenantId } : {}),
    name,
    category,
    ...(listPrice !== undefined ? { listPrice } : {}),
    ...(costPrice !== undefined ? { costPrice } : {}),
    lengthMm,
    widthMm,
    heightMm,
    netWeightKg,
    packageLengthMm,
    packageWidthMm,
    packageHeightMm,
    grossWeightKg,
    currency: text(draft.currency) || 'CNY',
    websitePricing: {
      brandCode: brand,
      siteCode: brand,
      locale: PRODUCT_DETAIL_LOCALE,
      priceDisplayMode: text(draft.websitePriceDisplayMode) || 'not_shown',
      ...(websitePrice !== undefined ? { websitePrice } : {}),
      ...(websitePriceMin !== undefined ? { websitePriceMin } : {}),
      ...(websitePriceMax !== undefined ? { websitePriceMax } : {}),
      ...(promoPrice !== undefined ? { promoPrice } : {}),
      currency: text(draft.currency) || 'CNY',
      priceUnit: text(draft.priceUnit),
      priceLabel: text(draft.priceLabel),
      priceNote: text(draft.priceNote),
      taxIncluded: draft.taxIncluded,
    },
    lifecycleStage: text(draft.lifecycleStage) || 'intro',
    primaryCategoryId,
    categoryLevel1Id,
    categoryLevel2Id,
    categoryLevel3Id: categoryLevel3Id || null,
    ...(status ? { status } : {}),
    spec: {
      ...previousSpec,
      officialModel: model,
      model,
      system,
      productType: text(draft.productType),
      manufacturer: text(draft.manufacturer),
      countryOfOrigin: text(draft.countryOfOrigin),
      marketCode: text(draft.marketCode) || 'CN',
      technicalSpecs,
    },
    positioning: {
      ...(objectOrEmpty(product.raw?.positioning) as any),
      sellingPoints,
      scenarios: applicationScenarios,
    },
    meta: {
      ...previousMeta,
      productLibrary: {
        ...previousLibraryMeta,
        productType: text(draft.productType),
        manufacturer: text(draft.manufacturer),
        countryOfOrigin: text(draft.countryOfOrigin),
        marketCode: text(draft.marketCode) || 'CN',
        lifecycle: {
          ...objectOrEmpty(previousLibraryMeta.lifecycle),
          stage: text(draft.lifecycleStage) || 'intro',
          launchDate: text(draft.launchDate),
          discontinueDate: text(draft.discontinueDate),
        },
        sku: {
          ...objectOrEmpty(previousLibraryMeta.sku),
          salesUnit: text(draft.salesUnit),
          packageSpec: text(draft.packageSpec),
          configurationNotes: text(draft.configurationNotes),
        },
        sellingPoints,
        applicationScenarios,
        installationRequirement: text(draft.installationRequirement),
        warrantyPolicy: text(draft.warrantyPolicy),
        compliance: {
          ...objectOrEmpty(previousLibraryMeta.compliance),
          certificates: complianceCertificates,
        },
      },
      [brand]: {
        ...previousBrandMeta,
        slug: publicSlug,
        name,
        model,
        cat: websiteCategory || category,
        websiteCategory,
        websiteMenuCategory: websiteCategory,
        sys: system,
        displayOrder,
        sortOrder: displayOrder,
        primaryCategoryId,
        categoryLevel1Id,
        categoryLevel2Id,
        categoryLevel3Id: categoryLevel3Id || null,
        series: text(draft.series),
        tagline: text(draft.tagline),
        en: text(draft.officialEnglishName),
        badges: splitBadges(draft.badges),
      },
    },
  };
}

function productStatusPayload(
  product: NormalizedProduct,
  status: 'active' | 'inactive',
): Record<string, unknown> {
  const tenantId = tenantIdForProduct(product);
  return { status, ...(tenantId ? { tenantId } : {}) };
}

function productImageSrc(product: NormalizedProduct): string {
  return productMainImageSrc(product);
}

function artifactContentUrl(artifactId: unknown): string {
  const id = text(artifactId);
  return id ? `/api/v2/file-artifact/${encodeURIComponent(id)}/content` : '';
}

const PRODUCT_DETAIL_ARTIFACT_SRC_ATTR = 'data-product-artifact-src';
const PRODUCT_DETAIL_ARTIFACT_STATUS_ATTR = 'data-product-artifact-status';
const FILE_ARTIFACT_CONTENT_SRC_RE = /(?:https?:\/\/[^"'<>\s]+)?(\/api\/v2\/file-artifact\/([0-9a-fA-F-]{36})\/content)(?:[?#][^"'<>\s]*)?/i;
const PUBLIC_PRODUCT_IMAGE_SRC_RE = /(?:https?:\/\/[^"'<>\s]+)?\/api\/v2\/brand\/[^"'<>\s]+\/products\/[^"'<>\s]+\/images\/([0-9a-fA-F-]{36})(?:[?#][^"'<>\s]*)?/i;

function productDetailImageArtifactId(src: unknown): string {
  const raw = text(src);
  return text(raw.match(FILE_ARTIFACT_CONTENT_SRC_RE)?.[2] || raw.match(PUBLIC_PRODUCT_IMAGE_SRC_RE)?.[1]);
}

function productDetailPersistentImageSrc(src: unknown): string {
  const raw = text(src);
  const artifactPath = raw.match(FILE_ARTIFACT_CONTENT_SRC_RE)?.[1];
  return artifactPath || raw;
}

function productDetailImageDataUrl(artifact: any): string {
  const mimeType = text(artifact?.mimeType) || 'image/png';
  const dataBase64 = text(artifact?.dataBase64);
  return dataBase64 && mimeType.toLowerCase().startsWith('image/')
    ? `data:${mimeType};base64,${dataBase64}`
    : '';
}

async function hydrateOfficialDetailEditorImages(editor: HTMLDivElement) {
  const images = Array.from(editor.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(images.map(async (image) => {
    const originalSrc = image.getAttribute(PRODUCT_DETAIL_ARTIFACT_SRC_ATTR) || image.getAttribute('src') || '';
    const artifactId = productDetailImageArtifactId(originalSrc);
    if (!artifactId || image.getAttribute('src')?.startsWith('data:')) return;
    image.setAttribute(PRODUCT_DETAIL_ARTIFACT_SRC_ATTR, productDetailPersistentImageSrc(originalSrc));
    image.setAttribute(PRODUCT_DETAIL_ARTIFACT_STATUS_ATTR, 'loading');
    try {
      const artifact = await fileArtifacts.getBase64(artifactId);
      const dataUrl = productDetailImageDataUrl(artifact);
      if (!dataUrl) throw new Error('image preview data is empty');
      image.setAttribute('src', dataUrl);
      image.setAttribute(PRODUCT_DETAIL_ARTIFACT_STATUS_ATTR, 'ready');
    } catch {
      image.setAttribute(PRODUCT_DETAIL_ARTIFACT_STATUS_ATTR, 'failed');
    }
  }));
}

function serializeOfficialDetailEditorHtml(editor: HTMLDivElement | null): string {
  if (!editor) return '';
  const clone = editor.cloneNode(true) as HTMLDivElement;
  clone.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    const persistentSrc = image.getAttribute(PRODUCT_DETAIL_ARTIFACT_SRC_ATTR);
    if (persistentSrc) image.setAttribute('src', productDetailPersistentImageSrc(persistentSrc));
    image.removeAttribute(PRODUCT_DETAIL_ARTIFACT_SRC_ATTR);
    image.removeAttribute(PRODUCT_DETAIL_ARTIFACT_STATUS_ATTR);
  });
  return sanitizeOfficialProductDetailHtml(clone.innerHTML || '');
}

function productAssetUrl(ref: Record<string, any>): string {
  return text(
    ref.contentUrl ||
      ref.base64Url ||
      ref.url ||
      ref.src ||
      ref.previewUrl ||
      ref.href ||
      artifactContentUrl(ref.artifactId || ref.id)
  );
}

function isImageAsset(ref: Record<string, any>) {
  const role = text(ref.role).toLowerCase();
  const mimeType = text(ref.mimeType || ref.type).toLowerCase();
  const name = text(ref.filename || ref.name || ref.url || ref.src).toLowerCase();
  return role === 'main' || role === 'card' || role === 'image' || mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)(?:$|\?)/i.test(name);
}

function isManualPdfAsset(ref: Record<string, any>) {
  const role = text(ref.role).toLowerCase();
  const mimeType = text(ref.mimeType || ref.type).toLowerCase();
  const name = text(ref.filename || ref.name || ref.url || ref.src).toLowerCase();
  return role === 'doc' || role === 'manual' || role === 'pdf' || mimeType === 'application/pdf' || /\.pdf(?:$|\?)/i.test(name);
}

function productMainImageSrc(product: NormalizedProduct): string {
  const raw = objectOrEmpty(product.raw);
  const meta = objectOrEmpty(raw.meta);
  const brandMeta = productBrandMeta(product);
  const assetRefs = Array.isArray(raw.assetRefs) ? raw.assetRefs : [];
  const imageRef = assetRefs.find((item: Record<string, any>) => isImageAsset(item)) || {};
  return text(
    productAssetUrl(imageRef) ||
      artifactContentUrl(meta.imageArtifactId || brandMeta.imageArtifactId || raw.imageArtifactId) ||
      brandMeta.image ||
      brandMeta.imageUrl ||
      meta.imageUrl ||
      meta.mainImageUrl ||
      raw.imageUrl ||
      raw.image
  );
}

function savedProductManualPdfs(product: NormalizedProduct): ProductManualPdfDraft[] {
  const raw = objectOrEmpty(product.raw);
  const assetRefs = Array.isArray(raw.assetRefs) ? raw.assetRefs : [];
  return assetRefs
    .filter((ref: Record<string, any>) => isManualPdfAsset(ref))
    .sort((left: Record<string, any>, right: Record<string, any>) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    .map((ref: Record<string, any>, index: number) => {
      const artifactId = text(ref.artifactId || ref.id);
      const name = text(ref.filename || ref.name || ref.originalName) || `产品说明 ${index + 1}.pdf`;
      return {
        id: artifactId || text(ref.objectKey) || `${name}-${index}`,
        artifactId,
        objectKey: text(ref.objectKey || ref.fileKey),
        name,
        mimeType: text(ref.mimeType) || 'application/pdf',
        previewUrl: productAssetUrl(ref) || artifactContentUrl(artifactId),
        saved: true,
        sortOrder: Number(ref.sortOrder || index),
      };
    });
}

function readBrowserFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;]+;base64,/, ''));
    reader.onerror = () => reject(reader.error || new Error('File read failed.'));
    reader.readAsDataURL(file);
  });
}

async function uploadProductMainImageRef(mainImage: ProductPendingImageDraft | null, entityId: string) {
  if (!mainImage?.file) return null;
  const artifact = await fileArtifacts.uploadBase64({
    entityType: 'product-main-image',
    entityId,
    filename: mainImage.file.name || `${entityId}-main-image.png`,
    mimeType: mainImage.file.type || 'image/png',
    dataBase64: await readBrowserFileBase64(mainImage.file),
  });
  const artifactId = text((artifact as any)?.id || (artifact as any)?.artifactId);
  if (!artifactId) throw new Error('Main image upload did not return an artifact id.');
  return {
    role: 'main',
    artifactId,
    objectKey: text((artifact as any)?.fileKey || (artifact as any)?.objectKey),
    filename: text((artifact as any)?.originalName) || mainImage.file.name,
    mimeType: text((artifact as any)?.mimeType) || mainImage.file.type || 'image/png',
    sortOrder: 0,
    url: text((artifact as any)?.contentUrl) || `/api/v2/file-artifact/${encodeURIComponent(artifactId)}/content`,
  };
}

async function uploadProductManualPdfRefs(manualPdfs: ProductManualPdfDraft[], sku: string) {
  return Promise.all(
    manualPdfs.map(async (manual, index) => {
      if (!manual.file && manual.saved) {
        return {
          role: 'doc',
          artifactId: manual.artifactId,
          objectKey: manual.objectKey,
          filename: manual.name,
          mimeType: manual.mimeType || 'application/pdf',
          sortOrder: index,
          url: manual.previewUrl,
        };
      }
      if (!manual.file) return null;
      const artifact = await fileArtifacts.uploadBase64({
        entityType: 'product-manual-pdf',
        entityId: sku,
        filename: manual.name || manual.file.name || `${sku}-manual-${index + 1}.pdf`,
        mimeType: manual.file.type || 'application/pdf',
        dataBase64: await readBrowserFileBase64(manual.file),
      });
      const artifactId = text((artifact as any)?.id || (artifact as any)?.artifactId);
      if (!artifactId) throw new Error('PDF upload did not return an artifact id.');
      return {
        role: 'doc',
        artifactId,
        objectKey: text((artifact as any)?.fileKey || (artifact as any)?.objectKey),
        filename: text((artifact as any)?.originalName) || manual.name || manual.file.name,
        mimeType: text((artifact as any)?.mimeType) || manual.file.type || 'application/pdf',
        sortOrder: index,
        url: text((artifact as any)?.contentUrl) || `/api/v2/file-artifact/${encodeURIComponent(artifactId)}/content`,
      };
    })
  ).then((refs) => refs.filter(Boolean));
}

function productPublicContentPayload(product: NormalizedProduct | null, draft: Pick<CreateProductDraft, 'name' | 'currency' | 'series' | 'tagline' | 'publicSummary' | 'officialEnglishName' | 'badges' | 'technicalSpecs' | 'sellingPoints' | 'featureBenefits' | 'highlightMetrics' | 'faqs' | 'complianceCertificates' | 'officialDetailHtml'>) {
  const specs = parseKeyValueLines(draft.technicalSpecs);
  const featureBenefits = parseKeyValueLines(draft.featureBenefits || draft.sellingPoints).map((item) => ({
    title: item.k,
    desc: item.v,
  }));
  const highlights = parseKeyValueLines(draft.highlightMetrics).map((item) => ({
    label: item.k,
    value: item.v,
  }));
  const faq = parseKeyValueLines(draft.faqs).map((item) => ({
    q: item.k,
    a: item.v,
  })).filter((item) => item.q && item.a);
  return {
    name: text(draft.name),
    locale: PRODUCT_DETAIL_LOCALE,
    status: 'published',
    displayCurrency: text(draft.currency) || 'CNY',
    officialDetailHtml: sanitizeOfficialProductDetailHtml(draft.officialDetailHtml),
    marketing: {
      headline: text(draft.tagline),
      subhead: text(draft.publicSummary),
      series: text(draft.series),
      officialEnglishName: text(draft.officialEnglishName),
      badges: splitBadges(draft.badges),
      certs: splitLines(draft.complianceCertificates),
      specs,
      features: featureBenefits,
      featureBenefits: featureBenefits.map((item) => ({ feature: item.title, benefit: item.desc })),
      highlights,
      faq,
    },
    seo: {
      metaTitle: text(product?.name || draft.name),
      metaDescription: text(draft.publicSummary || draft.tagline),
      canonical: '',
      ogImage: '',
      keywords: splitBadges(draft.badges),
    },
  };
}

function productPublicContentSignature(value: unknown): string {
  const item = productContentItem(value);
  return JSON.stringify({
    officialDetailHtml: text(item.officialDetailHtml),
    marketing: objectOrEmpty(item.marketing),
  });
}

async function saveProductPublicContent(productId: string, tenantId: string, product: NormalizedProduct | null, draft: Pick<CreateProductDraft, 'name' | 'currency' | 'series' | 'tagline' | 'publicSummary' | 'officialEnglishName' | 'badges' | 'technicalSpecs' | 'sellingPoints' | 'featureBenefits' | 'highlightMetrics' | 'faqs' | 'complianceCertificates' | 'officialDetailHtml'>) {
  await products.upsertContent(productId, {
    ...(tenantId ? { tenantId } : {}),
    ...productPublicContentPayload(product, draft),
  });
}

function createCategorySelection(draft: CreateProductDraft, tree: ProductCategoryNode[]) {
  const flat = flattenCategoryTree(tree);
  const level1 = flat.find((item) => item.id === draft.categoryLevel1Id) || null;
  const level2 = flat.find((item) => item.id === draft.categoryLevel2Id) || null;
  const level3 = flat.find((item) => item.id === draft.categoryLevel3Id) || null;
  const leaf = level3 || level2 || level1;
  const path = [level1, level2, level3].filter(Boolean).map((item) => item?.name || item?.code).join(' / ');
  return { level1, level2, level3, leaf, path };
}

function createProductPayload(
  draft: CreateProductDraft,
  categoryTree: ProductCategoryNode[],
  brandOverride?: ProductBrand,
  options: { includeCategoryBinding?: boolean } = {},
): Record<string, unknown> {
  const brand = brandOverride || draft.brand;
  if (!brand) throw new Error('请选择产品品牌。');
  const selectedBrands = draft.brands.length ? draft.brands : [brand];
  const includeCategoryBinding = options.includeCategoryBinding !== false;
  const tenantId = PRODUCT_LIBRARY_TENANT_ID;
  const name = text(draft.name);
  const model = text(draft.model || draft.skuSeed);
  const materialCode = text(draft.materialCode) || model;
  const categorySelection = createCategorySelection(draft, categoryTree);
  const category = text(categorySelection.leaf?.code);
  const categoryLevel1Id = text(categorySelection.level1?.id);
  const categoryLevel2Id = text(categorySelection.level2?.id);
  const categoryLevel3Id = text(categorySelection.level3?.id);
  const primaryCategoryId = text(categorySelection.leaf?.id);
  const publicSlug = slug(draft.publicSlug || model);
  const websiteCategory = text(draft.websiteCategory) || category;
  const displayOrder = nonNegativeInt(draft.displayOrder);
  if (!name) throw new Error('请填写产品名称。');
  if (!model) throw new Error('请填写产品型号。');
  if (!materialCode) throw new Error('请填写 SKU/物料编码。');
  if (!categoryLevel1Id) throw new Error('请选择一级产品分类。');
  if (!categoryLevel2Id) throw new Error('请选择二级产品分类。');
  if (!category) throw new Error('请选择产品分类。');
  const system = category;
  const sku = materialCode;
  const listPrice = optionalNonNegativeNumber(draft.listPrice);
  const costPrice = optionalNonNegativeNumber(draft.costPrice);
  const websitePrice = optionalNonNegativeNumber(draft.websitePrice);
  const websitePriceMin = optionalNonNegativeNumber(draft.websitePriceMin);
  const websitePriceMax = optionalNonNegativeNumber(draft.websitePriceMax);
  const promoPrice = optionalNonNegativeNumber(draft.promoPrice);
  const lengthMm = nullableNonNegativeNumber(draft.lengthMm);
  const widthMm = nullableNonNegativeNumber(draft.widthMm);
  const heightMm = nullableNonNegativeNumber(draft.heightMm);
  const netWeightKg = nullableNonNegativeNumber(draft.netWeightKg);
  const packageLengthMm = nullableNonNegativeNumber(draft.packageLengthMm);
  const packageWidthMm = nullableNonNegativeNumber(draft.packageWidthMm);
  const packageHeightMm = nullableNonNegativeNumber(draft.packageHeightMm);
  const grossWeightKg = nullableNonNegativeNumber(draft.grossWeightKg);
  const technicalSpecs = parseKeyValueLines(draft.technicalSpecs);
  const sellingPoints = splitLines(draft.sellingPoints);
  const applicationScenarios = splitLines(draft.applicationScenarios);
  const complianceCertificates = splitLines(draft.complianceCertificates);
  return {
    ...(tenantId ? { tenantId } : {}),
    sku,
    materialCode: sku,
    name,
    brand,
    brandCode: brand,
    brands: selectedBrands,
    brandCodes: selectedBrands,
    model,
    category,
    primaryCategoryId,
    productType: text(draft.productType),
    lifecycleStage: text(draft.lifecycleStage) || 'intro',
    ...(includeCategoryBinding ? {
      primaryCategoryId,
      categoryLevel1Id,
      categoryLevel2Id,
      categoryLevel3Id: categoryLevel3Id || null,
      categoryPath: categorySelection.path,
    } : {}),
    ...(listPrice !== undefined ? { listPrice } : {}),
    ...(costPrice !== undefined ? { costPrice } : {}),
    lengthMm,
    widthMm,
    heightMm,
    netWeightKg,
    packageLengthMm,
    packageWidthMm,
    packageHeightMm,
    grossWeightKg,
    currency: text(draft.currency) || 'CNY',
    websitePricing: {
      brandCode: brand,
      siteCode: brand,
      locale: PRODUCT_DETAIL_LOCALE,
      priceDisplayMode: text(draft.websitePriceDisplayMode) || 'not_shown',
      ...(websitePrice !== undefined ? { websitePrice } : {}),
      ...(websitePriceMin !== undefined ? { websitePriceMin } : {}),
      ...(websitePriceMax !== undefined ? { websitePriceMax } : {}),
      ...(promoPrice !== undefined ? { promoPrice } : {}),
      currency: text(draft.currency) || 'CNY',
      priceUnit: text(draft.priceUnit),
      priceLabel: text(draft.priceLabel),
      priceNote: text(draft.priceNote),
      taxIncluded: draft.taxIncluded,
    },
    status: 'active',
    spec: {
      officialModel: model,
      model,
      system,
      productType: text(draft.productType),
      manufacturer: text(draft.manufacturer),
      countryOfOrigin: text(draft.countryOfOrigin),
      marketCode: text(draft.marketCode) || 'CN',
      technicalSpecs,
    },
    positioning: {
      sellingPoints,
      scenarios: applicationScenarios,
    },
    meta: {
      productLibrary: {
        productType: text(draft.productType),
        manufacturer: text(draft.manufacturer),
        countryOfOrigin: text(draft.countryOfOrigin),
        marketCode: text(draft.marketCode) || 'CN',
        lifecycle: {
          stage: text(draft.lifecycleStage) || 'intro',
          launchDate: text(draft.launchDate),
          discontinueDate: text(draft.discontinueDate),
        },
        sku: {
          salesUnit: text(draft.salesUnit),
          packageSpec: text(draft.packageSpec),
          configurationNotes: text(draft.configurationNotes),
        },
        sellingPoints,
        applicationScenarios,
        installationRequirement: text(draft.installationRequirement),
        warrantyPolicy: text(draft.warrantyPolicy),
        compliance: {
          certificates: complianceCertificates,
        },
      },
      [brand]: {
        slug: publicSlug || slug(sku),
        name,
        model,
        cat: websiteCategory,
        websiteCategory,
        websiteMenuCategory: websiteCategory,
        sys: system,
        displayOrder,
        sortOrder: displayOrder,
        ...(includeCategoryBinding ? {
          primaryCategoryId,
          categoryLevel1Id,
          categoryLevel2Id,
          categoryLevel3Id: categoryLevel3Id || null,
        } : {}),
        series: text(draft.series),
        tagline: text(draft.tagline),
        en: text(draft.officialEnglishName),
        badges: splitBadges(draft.badges),
      },
    },
  };
}

function isProductModelExistsError(error: unknown): boolean {
  const details = (error as any)?.details;
  return Number((error as any)?.status) === 409 && details?.code === 'PRODUCT_MODEL_EXISTS';
}

function productModelExistsMessage(error: unknown): string {
  const details = (error as any)?.details || {};
  const existing = details?.data?.existingProduct || {};
  const proposed = details?.data?.proposedSku || {};
  const lines = [
    String(details.message || (error as Error)?.message || '产品型号已存在。'),
    existing.name ? `已有产品：${existing.name}` : '',
    existing.model ? `已有型号：${existing.model}` : '',
    proposed.skuCode ? `本次 SKU/物料编码：${proposed.skuCode}` : '',
    '确认后会更新该产品资料，并追加/更新本次 SKU；取消则不写入。',
  ].filter(Boolean);
  return lines.join('\n');
}

function objectOrEmpty(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function productModel(item: Record<string, any>): string {
  const spec = objectOrEmpty(item.spec);
  const meta = objectOrEmpty(item.meta);
  const brandMeta = objectOrEmpty(meta[normalizeBrand(item.brand)]);
  return (
    text(item.model) ||
    text(spec.officialModel) ||
    text(spec.model) ||
    text(brandMeta.model) ||
    text(item.sku)
  );
}

function productSystem(item: Record<string, any>): string {
  const spec = objectOrEmpty(item.spec);
  const meta = objectOrEmpty(item.meta);
  const brandMeta = objectOrEmpty(meta[normalizeBrand(item.brand)]);
  return text(item.systemFamily) || text(item.system) || text(spec.system) || text(brandMeta.sys);
}

function normalizeStock(value: unknown): ProductStock {
  if (value === 'low' || value === 'order') return value;
  if (typeof value === 'string') {
    const text = value.toLowerCase();
    if (text.includes('low') || text.includes('缺') || text.includes('少')) return 'low';
    if (text.includes('order') || text.includes('订') || text.includes('期货')) return 'order';
  }
  return 'in';
}

function getProductItems(apiData: any): any[] {
  const payload = apiData?.data ?? apiData;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.devices)) return payload.devices;
  return [];
}

function getProductTotal(apiData: any): number {
  const payload = apiData?.data ?? apiData;
  return Number(payload?.total ?? getProductItems(apiData).length);
}

function mergeCatalogResponses(responses: any[]): { items: any[]; total: number } {
  const byId = new Map<string, any>();
  for (const response of responses) {
    for (const item of getProductItems(response)) {
      const key = text(item?.id || item?._id || `${item?.tenantId || ''}:${item?.sku || item?.model || item?.name || ''}`);
      if (key) byId.set(key, item);
    }
  }
  const items = Array.from(byId.values());
  return {
    items,
    total: responses.reduce((sum, response) => sum + getProductTotal(response), 0),
  };
}

function normalizeProduct(item: any): NormalizedProduct {
  const spec = objectOrEmpty(item.spec);
  const meta = objectOrEmpty(item.meta);
  const brandMeta = objectOrEmpty(meta[normalizeBrand(item.brand)]);
  const positioning = objectOrEmpty(item.positioning);
  const marketPrice = Number(item.marketPrice ?? item.listPrice ?? item.retailPrice ?? item.msrp ?? 0);
  const dealerPrice = Number(item.dealerPrice ?? item.costPrice ?? item.tradePrice ?? item.price ?? 0);
  const safeMarketPrice = marketPrice || dealerPrice;
  const safeDealerPrice = dealerPrice || marketPrice;
  const marginRate = safeMarketPrice
    ? ((safeMarketPrice - safeDealerPrice) / safeMarketPrice) * 100
    : 0;

  return {
    id: String(item.id || item._id || item.sku || item.model || item.name),
    category: normalizeCategory(item.category || item.systemFamily || item.family),
    brand: normalizeBrand(item.brand || item.manufacturer || 'rhautt'),
    sku: text(item.sku),
    model: productModel(item),
    name: item.name || item.productName || item.title || '未命名产品',
    spec:
      (typeof item.spec === 'string' ? item.spec : item.spec?.text) ||
      item.description ||
      item.summary ||
      '',
    system: productSystem(item),
    materialCode: text(spec.materialCode) || text(item.sku),
    materialCategory: text(spec.materialCategory) || text(brandMeta.materialCategory),
    productLine: text(spec.productLine) || text(brandMeta.productLine),
    categoryPath: text(item.categoryPath) || text(brandMeta.categoryPath),
    applicationScenarios: Array.isArray(positioning.scenarios)
      ? positioning.scenarios.map(text).filter(Boolean)
      : Array.isArray(positioning.applicationScenarios)
        ? positioning.applicationScenarios.map(text).filter(Boolean)
        : [],
    status: text(item.status) || 'active',
    marketPrice: safeMarketPrice,
    dealerPrice: safeDealerPrice,
    stock: normalizeStock(item.stock || item.meta?.stock || item.availability),
    isNew: Boolean(item.isNew ?? item.meta?.isNew ?? item.tags?.includes?.('new')),
    marginRate,
    raw: item,
  };
}

function normalizeFallbackProduct(item: Product): NormalizedProduct {
  return {
    ...item,
    sku: item.model,
    status: 'active',
    system: '',
    materialCode: item.model,
    materialCategory: '',
    productLine: '',
    categoryPath: '',
    applicationScenarios: [],
    marginRate: item.marketPrice ? ((item.marketPrice - item.dealerPrice) / item.marketPrice) * 100 : 0,
  };
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeModule = normalizeModule(searchParams.get('module'));
  const requestedBrand = text(searchParams.get('brand'));
  const requestedStatus = text(searchParams.get('status')) as StatusFilter;
  const [category, setCategory] = useState<CatalogCategoryFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [deferredKeyword, setDeferredKeyword] = useState('');
  const [brandFilter, setBrandFilter] = useState<BrandFilter>(requestedBrand || 'all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    STATUS_OPTIONS.some((item) => item.value === requestedStatus) ? requestedStatus : 'active',
  );
  const [batchFilter, setBatchFilter] = useState(text(searchParams.get('batch')));
  const [pageSize, setPageSize] = useState(20);
  const [catalogPage, setCatalogPage] = useState(1);
  const [productPermissions, setProductPermissions] = useState<BrandProductPermissions>(EMPTY_BRAND_PRODUCT_PERMISSIONS);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const { data: brandSiteData } = useSWR('/api/v2/brand-sites', () => brandSites.list(), { revalidateOnFocus: false });
  const createBrandOptions = useMemo(() => brandOptionsFromSites(brandSiteData), [brandSiteData]);
  const brandOptions = useMemo(
    () => [DEFAULT_BRAND_OPTIONS[0], ...createBrandOptions],
    [createBrandOptions],
  );
  const supportedProductBrands = useMemo(
    () => createBrandOptions.map((option) => option.value).filter(Boolean),
    [createBrandOptions],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDeferredKeyword(keyword.trim()), 260);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const makeCatalogQueries = (status: StatusFilter, pageSizeValue = '100') => {
    const query: Record<string, string> = { page: '1', pageSize: '100' };
    query.pageSize = pageSizeValue;
    const q = deferredKeyword;
    if (q) query.q = q;
    if (brandFilter !== 'all') {
      query.brand = brandFilter;
      const tenantId = PRODUCT_LIBRARY_TENANT_ID;
      if (tenantId) query.tenantId = tenantId;
    }
    if (status !== 'all') query.status = status;
    applyCatalogCategoryQuery(query, category);
    if (brandFilter !== 'all') return [query];
    return (supportedProductBrands.length ? supportedProductBrands : DEFAULT_PRODUCT_BRANDS).map((brand) => ({
      ...query,
      brand,
      tenantId: PRODUCT_LIBRARY_TENANT_ID,
    }));
  };

  const catalogQueries = useMemo(
    () => makeCatalogQueries(statusFilter),
    [brandFilter, category, deferredKeyword, statusFilter, supportedProductBrands]
  );

  const { data: apiData, error, isLoading, mutate } = useSWR(
    ['/api/v2/product-catalog/devices', catalogQueries],
    async () => {
      const responses = await Promise.all(catalogQueries.map((query) => products.list(query)));
      return responses.length === 1 ? responses[0] : mergeCatalogResponses(responses);
    },
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    let cancelled = false;
    auth.me()
      .then((me) => {
        if (!cancelled) setProductPermissions(getBrandProductPermissions(me));
      })
      .catch(() => {
        if (!cancelled) setProductPermissions(EMPTY_BRAND_PRODUCT_PERMISSIONS);
      })
      .finally(() => {
        if (!cancelled) setPermissionsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setModule(nextModule: ProductModule) {
    router.push(nextModule === 'dashboard' ? '/products' : `/products?module=${nextModule}`);
  }

  const liveProductList = useMemo(() => {
    return getProductItems(apiData).map(normalizeProduct).filter((item) => item.id);
  }, [apiData]);

  const productList = useMemo(() => {
    const liveProducts = liveProductList;
    return liveProducts.length ? liveProducts : PRODUCTS.map(normalizeFallbackProduct);
  }, [liveProductList]);

  const catalogAssignmentBrands = useMemo(() => {
    return supportedProductBrands.length ? supportedProductBrands : DEFAULT_PRODUCT_BRANDS;
  }, [supportedProductBrands]);

  const categoryFilterBrands = useMemo(() => {
    return [PRODUCT_BASE_CATEGORY_BRAND];
  }, []);

  const { data: catalogCategoryData } = useSWR(
    categoryFilterBrands.length ? ['/api/v2/brand-product-categories/catalog-filter', categoryFilterBrands] : null,
    async () => {
      const responses = await Promise.all(
        categoryFilterBrands.map((brandCode) =>
          brandProductCategories
            .list({ brandCode })
            .then((result) => normalizeProductCategoryTree(result))
            .catch(() => [])
        )
      );
      const seen = new Set<string>();
      return responses.flatMap((tree) =>
        catalogCategoryFilterOptions(tree).filter((option) => {
          if (seen.has(option.value)) return false;
          seen.add(option.value);
          return true;
        })
      );
    },
    { revalidateOnFocus: false }
  );

  const { data: statusFilterCounts } = useSWR(
    ['/api/v2/product-catalog/devices/status-counts', brandFilter, category, deferredKeyword, supportedProductBrands.join('|')],
    async () => {
      const entries = await Promise.all(
        STATUS_OPTIONS.map(async (status) => {
          const queries = makeCatalogQueries(status.value, '1');
          const responses = await Promise.all(queries.map((query) => products.list(query)));
          return [status.value, responses.reduce((sum, response) => sum + getProductTotal(response), 0)] as const;
        })
      );
      return Object.fromEntries(entries) as Record<StatusFilter, number>;
    },
    { revalidateOnFocus: false }
  );
  const catalogCategoryOptions = catalogCategoryData?.length
    ? catalogCategoryData
    : CATEGORIES.map((item) => ({ value: item.key, label: item.label }));

  const { data: shelfAssignmentData, mutate: mutateShelfAssignments } = useSWR(
    catalogAssignmentBrands.length ? ['/api/v2/brand-sites/product-assignments', catalogAssignmentBrands] : null,
    async () => {
      const responses = await Promise.all(
        catalogAssignmentBrands.map((brand) =>
          siteProductAssignments
            .list(brand, { page: '1', pageSize: '500' })
            .then((result) => assignmentItems(result).map((assignment) => ({ ...assignment, siteCode: assignment.siteCode || brand })))
            .catch(() => [])
        )
      );
      return responses.flat();
    },
    { revalidateOnFocus: false }
  );

  const assignmentsByProductKey = useMemo(() => {
    const map = new Map<string, WebsiteShelfAssignment[]>();
    const add = (key: string, assignment: WebsiteShelfAssignment) => {
      const items = map.get(key) || [];
      if (!items.some((item) => item.id === assignment.id)) items.push(assignment);
      map.set(key, items);
    };
    for (const assignment of shelfAssignmentData || []) {
      if (!assignment.productId) continue;
      add(assignmentKey(assignment.productId, assignment.productTenantId), assignment);
      add(assignment.productId, assignment);
    }
    return map;
  }, [shelfAssignmentData]);

  const visibleProducts = useMemo(() => {
    const query = deferredKeyword.toLowerCase();
    return productList.filter((product) => {
      const categoryMatch = productMatchesCatalogCategory(product, category);
      if (!categoryMatch) return false;
      if (!query) return true;
      return [product.name, product.brand, product.model, product.spec]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [category, deferredKeyword, productList]);

  const visibleCatalogProducts = useMemo(() => {
    const query = deferredKeyword.toLowerCase();
    const filtered = liveProductList.filter((product) => {
      if (brandFilter !== 'all' && normalizeBrand(product.brand) !== brandFilter) return false;
      if (statusFilter !== 'all' && product.status !== statusFilter) return false;
      if (batchFilter && text(productLibraryMeta(product).batchCode) !== batchFilter) return false;
      if (!productMatchesCatalogCategory(product, category)) return false;
      if (!query) return true;
      const libraryMeta = productLibraryMeta(product);
      return [product.sku, product.name, product.model, productBrandMeta(product).series, libraryMeta.sourceCategory, ...(Array.isArray(libraryMeta.reviewNotes) ? libraryMeta.reviewNotes : [])]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
    return sortProductsByStatusThenOrder(filtered);
  }, [batchFilter, brandFilter, category, deferredKeyword, liveProductList, statusFilter]);

  const pilotSummary = useMemo<ProductPilotSummary | null>(() => {
    const pilotProducts = visibleCatalogProducts.filter((product) => productLibraryMeta(product).pilot === true);
    if (!pilotProducts.length) return null;
    const categories = new Set(pilotProducts.map((product) => text(productLibraryMeta(product).sourceCategory) || product.category).filter(Boolean));
    const websitePublished = pilotProducts.filter((product) => {
      return assignmentsForProduct(assignmentsByProductKey, product).some((assignment) => assignment.status === 'published' && !assignment.deletedAt);
    }).length;
    return {
      products: pilotProducts.length,
      categories: categories.size,
      websitePublished,
      needsCompletion: pilotProducts.filter((product) => productLibraryMeta(product).dataReadinessStatus === 'needs_completion').length,
    };
  }, [assignmentsByProductKey, visibleCatalogProducts]);

  const catalogTotalPages = Math.max(Math.ceil(visibleCatalogProducts.length / pageSize), 1);
  const productDataConsoleProducts = useMemo(
    () => sortProductsByStatusThenOrder(liveProductList),
    [liveProductList]
  );

  const pagedCatalogProducts = useMemo(() => {
    const safePage = Math.min(Math.max(catalogPage, 1), catalogTotalPages);
    const start = (safePage - 1) * pageSize;
    return visibleCatalogProducts.slice(start, start + pageSize);
  }, [catalogPage, catalogTotalPages, pageSize, visibleCatalogProducts]);

  useEffect(() => {
    setCatalogPage(1);
  }, [batchFilter, brandFilter, category, deferredKeyword, pageSize, statusFilter]);

  const productByModel = useMemo(() => {
    const map = new Map<string, NormalizedProduct>();
    PRODUCTS.map(normalizeFallbackProduct).forEach((product) => map.set(product.model, product));
    productList.forEach((product) => {
      if (product.model) map.set(product.model, product);
    });
    return map;
  }, [productList]);

  const statsProducts = activeModule === 'catalog' ? liveProductList : productList;
  const stats = useMemo(() => {
    const total = statsProducts.length;
    const stock = statsProducts.filter((product) => product.stock === 'in').length;
    const newest = statsProducts.filter((product) => product.isNew).length;
    const avgMargin = total
      ? statsProducts.reduce((sum, product) => sum + product.marginRate, 0) / total
      : 0;
    return { total, stock, newest, avgMargin };
  }, [statsProducts]);

  return (
    <div
      style={{
        background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)',
        minHeight: '100%',
      }}
    >
      <style jsx global>{`
        .product-floating-dialog-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 34px 20px;
          background: rgba(15, 23, 42, 0.12);
        }
        .product-floating-dialog {
          width: min(448px, calc(100vw - 32px));
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          background: var(--surface-1);
          box-shadow: var(--sh-lg);
        }
        .product-floating-dialog.is-danger {
          border-color: rgba(200, 32, 44, .28);
        }
        .product-floating-dialog header,
        .product-floating-dialog footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 18px;
        }
        .product-floating-dialog header {
          border-bottom: 1px solid var(--border);
        }
        .product-floating-dialog h2 {
          margin: 2px 0 0;
          color: var(--t-primary);
          font-size: 16px;
          font-weight: 900;
        }
        .product-floating-dialog-body {
          display: grid;
          gap: 14px;
          padding: 18px;
        }
        .product-floating-dialog-body p {
          margin: 0;
          color: var(--t-secondary);
          font-size: 14px;
          line-height: 1.7;
        }
        .product-floating-dialog footer {
          justify-content: flex-end;
          border-top: 1px solid var(--border);
          background: var(--surface-2);
        }
        .product-edit-backdrop {
          background:
            radial-gradient(circle at 20% 12%, rgba(255,255,255,.28), transparent 32%),
            rgba(15, 23, 42, .54) !important;
        }
        .product-edit-modal {
          border-radius: 14px !important;
          border-color: rgba(15, 23, 42, .14) !important;
          background: #f8fafc !important;
          box-shadow: 0 28px 72px rgba(15, 23, 42, .24), 0 2px 8px rgba(15, 23, 42, .08) !important;
        }
        .product-edit-modal-head {
          padding: 18px 22px !important;
          background: linear-gradient(180deg, #ffffff 0%, #fbfcfd 100%);
          border-bottom-color: rgba(15, 23, 42, .10) !important;
        }
        .product-edit-modal-head h2 {
          margin: 3px 0 4px;
          color: var(--t-primary);
          font-size: 20px;
          line-height: 1.25;
          font-weight: 900;
          letter-spacing: 0;
        }
        .product-edit-modal-head span {
          color: var(--t-secondary);
          font-size: 13px;
          line-height: 1.45;
        }
        .product-edit-modal-body {
          padding: 18px 22px 22px !important;
          gap: 16px !important;
          background: #f8fafc;
        }
        .product-edit-modal-actions {
          padding: 14px 22px !important;
          border-top-color: rgba(15, 23, 42, .10) !important;
          background: rgba(255,255,255,.94) !important;
          backdrop-filter: blur(12px);
        }
        .product-edit-section {
          gap: 14px !important;
          padding: 16px;
          border: 1px solid rgba(15, 23, 42, .10);
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
          scroll-margin-top: 12px;
        }
        .product-edit-section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(15, 23, 42, .07);
        }
        .product-edit-section-head h3 {
          margin: 0;
          color: var(--t-primary);
          font-size: 15px;
          line-height: 1.35;
          font-weight: 900;
          letter-spacing: 0;
        }
        .product-edit-section-head .badge {
          flex: 0 0 auto;
        }
        .product-edit-field-grid {
          gap: 14px !important;
        }
        .product-edit-field-grid label {
          min-width: 0;
        }
        .product-edit-field-grid .t-label {
          color: var(--t-secondary);
          font-size: 11px;
          font-weight: 800;
        }
        .product-edit-modal .input {
          min-height: 38px;
          border-color: rgba(15, 23, 42, .16);
          border-radius: 7px;
          background: #fff;
          box-shadow: 0 1px 1px rgba(15, 23, 42, .03);
        }
        .product-edit-modal textarea.input {
          min-height: 108px;
          line-height: 1.55;
        }
        .product-edit-modal .input:focus {
          border-color: rgba(200, 32, 44, .45);
          box-shadow: 0 0 0 3px rgba(200, 32, 44, .10);
        }
        .product-edit-modal .input:disabled,
        .product-edit-modal .input[readonly] {
          background: #f3f5f7;
          color: var(--t-secondary);
          box-shadow: none;
        }
        .product-edit-modal .inset {
          border-color: rgba(15, 23, 42, .09);
          border-radius: 8px;
          background: #f6f8fa;
        }
        .product-edit-media-panel {
          padding: 12px;
          border: 1px solid rgba(15, 23, 42, .09);
          border-radius: 10px;
          background: #f8fafc;
        }
        .product-edit-media-thumb {
          border: 1px solid rgba(15, 23, 42, .12);
          border-radius: 9px;
          background:
            linear-gradient(45deg, rgba(15,23,42,.04) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(15,23,42,.04) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(15,23,42,.04) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(15,23,42,.04) 75%),
            #fff;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0;
          background-size: 16px 16px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
        }
        .product-edit-check-item {
          padding: 12px;
          border: 1px solid rgba(15, 23, 42, .09);
          border-radius: 8px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.76);
        }
        .product-edit-progress {
          display: grid;
          grid-template-columns: minmax(220px, 270px) minmax(0, 1fr);
          gap: 14px;
          align-items: stretch;
          padding: 14px;
          border: 1px solid rgba(15, 23, 42, .10);
          border-radius: 10px;
          background: linear-gradient(135deg, #ffffff 0%, #f7f9fb 54%, #fff7f8 100%);
          box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
        }
        .product-edit-progress__summary {
          display: grid;
          align-content: space-between;
          gap: 10px;
          min-width: 0;
          padding: 12px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, .08);
          box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
        }
        .product-edit-progress__summary p,
        .product-edit-progress__summary strong,
        .product-edit-progress__summary span {
          margin: 0;
        }
        .product-edit-progress__summary strong {
          display: block;
          color: var(--t-primary);
          font-size: 28px;
          line-height: 1.1;
          letter-spacing: 0;
        }
        .product-edit-progress__summary > div:first-child > span {
          color: var(--t-secondary);
          font-size: 12px;
        }
        .product-edit-progress__bar {
          height: 6px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(15, 23, 42, .08);
        }
        .product-edit-progress__bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--brand-500, var(--brand));
        }
        .product-edit-progress__items {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 156px), 1fr));
          gap: 8px;
          min-width: 0;
        }
        .product-edit-progress__item {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          min-width: 0;
          padding: 10px 11px;
          border: 1px solid rgba(15, 23, 42, .08);
          border-radius: 8px;
          background: rgba(255,255,255,.86);
          color: var(--t-secondary);
          cursor: pointer;
          text-align: left;
          appearance: none;
          transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease, background-color 150ms ease;
        }
        .product-edit-progress__item:hover {
          border-color: rgba(200, 32, 44, .28);
          box-shadow: 0 4px 12px rgba(15, 23, 42, .08);
          transform: translateY(-1px);
        }
        .product-edit-progress__item:focus-visible {
          outline: 3px solid rgba(200, 32, 44, .16);
          outline-offset: 2px;
        }
        .product-edit-progress__item:active {
          transform: translateY(0);
          box-shadow: 0 1px 3px rgba(15, 23, 42, .08);
        }
        .product-edit-progress__item.is-ready {
          border-color: rgba(34, 197, 94, .22);
          background: rgba(240, 253, 244, .72);
        }
        .product-edit-progress__item.is-todo,
        .product-edit-progress__item.is-blocked {
          border-color: rgba(245, 158, 11, .24);
          background: rgba(255, 251, 235, .72);
        }
        .product-edit-progress__item svg {
          flex: 0 0 auto;
          margin-top: 2px;
        }
        .product-edit-progress__item.is-ready svg {
          color: var(--success);
        }
        .product-edit-progress__item.is-todo svg,
        .product-edit-progress__item.is-blocked svg {
          color: var(--warning);
        }
        .product-edit-progress__item div {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .product-edit-progress__item strong {
          color: var(--t-primary);
          font-size: 12px;
          line-height: 1.35;
        }
        .product-edit-progress__item span {
          color: var(--t-tertiary);
          font-size: 11px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .product-readiness-checklist {
          display: grid;
          gap: 12px;
          padding: 14px;
          border: 1px solid rgba(15, 23, 42, .10);
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
        }
        .product-readiness-checklist.is-compact {
          padding: 12px;
          background: #f8fafc;
        }
        .product-readiness-checklist__head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          min-width: 0;
        }
        .product-readiness-checklist__head div {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .product-readiness-checklist__head p,
        .product-readiness-checklist__head strong,
        .product-readiness-checklist__head span {
          margin: 0;
        }
        .product-readiness-checklist__head strong {
          color: var(--t-primary);
          font-size: 16px;
          line-height: 1.35;
          font-weight: 900;
        }
        .product-readiness-checklist__head div > span {
          color: var(--t-secondary);
          font-size: 12px;
        }
        .product-readiness-checklist__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
          gap: 8px;
        }
        .product-readiness-checklist__item {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          min-width: 0;
          min-height: 62px;
          padding: 10px 11px;
          border: 1px solid rgba(15, 23, 42, .08);
          border-radius: 8px;
          background: #fff;
          color: var(--t-secondary);
          cursor: pointer;
          text-align: left;
          appearance: none;
          transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
        }
        .product-readiness-checklist__item:hover {
          border-color: rgba(15, 23, 42, .18);
          box-shadow: 0 4px 12px rgba(15, 23, 42, .07);
          transform: translateY(-1px);
        }
        .product-readiness-checklist__item:focus-visible {
          outline: 3px solid rgba(200, 32, 44, .16);
          outline-offset: 2px;
        }
        .product-readiness-checklist__item.is-success {
          border-color: rgba(34, 197, 94, .22);
          background: rgba(240, 253, 244, .72);
        }
        .product-readiness-checklist__item.is-warning {
          border-color: rgba(245, 158, 11, .28);
          background: rgba(255, 251, 235, .78);
        }
        .product-readiness-checklist__item.is-info {
          border-color: rgba(59, 130, 246, .18);
          background: rgba(239, 246, 255, .72);
        }
        .product-readiness-checklist__item svg {
          flex: 0 0 auto;
          margin-top: 2px;
        }
        .product-readiness-checklist__item.is-success svg {
          color: var(--success);
        }
        .product-readiness-checklist__item.is-warning svg {
          color: var(--warning);
        }
        .product-readiness-checklist__item.is-info svg {
          color: var(--brand-500, var(--brand));
        }
        .product-readiness-checklist__item div {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .product-readiness-checklist__item span {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .product-readiness-checklist__item strong {
          color: var(--t-primary);
          font-size: 12px;
          line-height: 1.35;
          font-weight: 900;
        }
        .product-readiness-checklist__item em {
          flex: 0 0 auto;
          padding: 2px 5px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, .10);
          background: rgba(255,255,255,.72);
          color: var(--t-secondary);
          font-size: 10px;
          line-height: 1;
          font-style: normal;
          font-weight: 900;
        }
        .product-readiness-checklist__item small {
          color: var(--t-tertiary);
          font-size: 11px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .product-data-console {
          display: grid;
          gap: 16px;
        }
        .product-data-console-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, .55fr);
          gap: 18px;
          padding: 22px;
          border: 1px solid rgba(15, 23, 42, .12);
          border-radius: var(--r-lg);
          background: linear-gradient(135deg, #101828 0%, #1f2937 54%, #3a0f16 100%);
          box-shadow: var(--sh-md);
          color: #fff;
        }
        .product-data-console-hero h2 {
          margin: 4px 0 0;
          color: #fff;
          font-size: 26px;
          line-height: 1.2;
          font-weight: 900;
        }
        .product-data-console-hero span {
          display: block;
          margin-top: 8px;
          color: rgba(255,255,255,.72);
          font-size: 13px;
          line-height: 1.5;
        }
        .product-data-console-hero .t-label {
          color: rgba(255,255,255,.68);
        }
        .product-data-console-hero__verdict {
          display: grid;
          gap: 8px;
          align-content: center;
          padding: 14px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: var(--r-md);
          background: rgba(255,255,255,.08);
        }
        .product-data-console-hero__verdict strong {
          color: #fff;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 900;
        }
        .product-data-console-hero__verdict small {
          color: rgba(255,255,255,.70);
          font-size: 12px;
          line-height: 1.45;
        }
        .product-data-console-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          background: var(--surface-1);
          box-shadow: var(--sh-xs);
        }
        .product-data-console-metric {
          display: grid;
          gap: 5px;
          min-width: 0;
          padding: 16px;
          border-right: 1px solid var(--border);
          background: transparent;
        }
        .product-data-console-metric:last-child {
          border-right: 0;
        }
        .product-data-console-metric span,
        .product-data-console-metric small {
          color: var(--t-secondary);
          font-size: 12px;
          line-height: 1.35;
        }
        .product-data-console-metric strong {
          color: var(--t-primary);
          font-size: 28px;
          line-height: 1.05;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .product-data-console-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(360px, .75fr);
          gap: 14px;
          align-items: start;
        }
        .product-data-console-panel {
          display: grid;
          gap: 12px;
          min-width: 0;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          background: var(--surface-1);
          box-shadow: var(--sh-xs);
        }
        .product-data-console-panel__head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .product-data-console-panel__head h3 {
          margin: 3px 0 0;
          color: var(--t-primary);
          font-size: 16px;
          line-height: 1.3;
          font-weight: 900;
        }
        .product-data-console-list {
          display: grid;
          gap: 8px;
        }
        .product-data-console-bars {
          display: grid;
          gap: 10px;
        }
        .product-data-console-bar {
          display: grid;
          gap: 6px;
        }
        .product-data-console-bar__meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: var(--t-secondary);
          font-size: 12px;
          font-weight: 800;
        }
        .product-data-console-bar__track {
          height: 9px;
          overflow: hidden;
          border-radius: 999px;
          background: var(--surface-2);
          border: 1px solid var(--border);
        }
        .product-data-console-bar__track span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--brand);
        }
        .product-data-console-bar.is-warning .product-data-console-bar__track span {
          background: var(--warning);
        }
        .product-data-console-bar.is-danger .product-data-console-bar__track span {
          background: var(--danger);
        }
        .product-data-console-funnel {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .product-data-console-funnel div {
          display: grid;
          gap: 4px;
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-2);
        }
        .product-data-console-funnel span {
          color: var(--t-secondary);
          font-size: 12px;
          line-height: 1.35;
        }
        .product-data-console-funnel strong {
          color: var(--t-primary);
          font-size: 22px;
          line-height: 1.1;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .product-data-console-row {
          display: grid;
          grid-template-columns: 48px minmax(0, 1.4fr) minmax(190px, .7fr) auto;
          gap: 12px;
          align-items: center;
          min-width: 0;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--surface-2);
        }
        .product-data-console-row__image {
          width: 48px;
          aspect-ratio: 1 / 1;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-1);
          color: var(--t-tertiary);
        }
        .product-data-console-row__image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .product-data-console-row__main,
        .product-data-console-row__status {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .product-data-console-row__main strong {
          color: var(--t-primary);
          font-size: 14px;
          line-height: 1.35;
          font-weight: 900;
        }
        .product-data-console-row__main span,
        .product-data-console-row__main small,
        .product-data-console-row__status span,
        .product-data-console-row__status small {
          color: var(--t-secondary);
          font-size: 12px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .product-data-console-row__tags {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }
        .product-data-console-health {
          display: grid;
          gap: 8px;
        }
        .product-data-console-health div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 40px;
          padding: 9px 11px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-2);
        }
        .product-data-console-health span {
          color: var(--t-secondary);
          font-size: 12px;
        }
        .product-data-console-health strong {
          color: var(--t-primary);
          font-size: 18px;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .product-catalog-filterline {
          display: grid;
          grid-template-columns: minmax(280px, 1fr) 160px 170px 190px auto;
          gap: 8px;
          align-items: center;
          width: 100%;
        }
        .product-catalog-filterline > select {
          width: 100%;
          min-width: 0;
        }
        .product-catalog-search {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .product-catalog-shell {
          overflow: hidden;
          max-width: 100%;
          border: 1px solid rgba(15, 23, 42, .10);
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, .04), 0 10px 30px rgba(15, 23, 42, .04);
        }
        .product-catalog-commandbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          border-bottom: 1px solid rgba(15, 23, 42, .09);
          background: linear-gradient(180deg, #ffffff 0%, #fbfcfd 100%);
        }
        .product-catalog-commandbar__main {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .product-catalog-commandbar__main p {
          margin: 0;
          color: var(--brand);
          font-size: 12px;
          font-weight: 900;
          line-height: 1.2;
        }
        .product-catalog-commandbar__main h2 {
          margin: 0;
          color: var(--t-primary);
          font-size: 20px;
          line-height: 1.25;
          font-weight: 900;
          letter-spacing: 0;
        }
        .product-catalog-commandbar__main span {
          color: var(--t-secondary);
          font-size: 12px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .product-catalog-commandbar__meta {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .product-catalog-workqueue {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 0;
          padding: 0 18px;
          border-bottom: 1px solid rgba(15, 23, 42, .09);
          background: #ffffff;
        }
        .product-catalog-workqueue button {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 2px 8px;
          align-items: center;
          min-width: 0;
          min-height: 58px;
          padding: 10px 12px 9px;
          border: 0;
          border-right: 1px solid rgba(15, 23, 42, .08);
          border-bottom: 2px solid transparent;
          border-radius: 0;
          background: transparent;
          color: var(--t-secondary);
          text-align: left;
          cursor: pointer;
          transition: background .16s ease, border-color .16s ease;
        }
        .product-catalog-workqueue button:first-child {
          border-left: 1px solid rgba(15, 23, 42, .08);
        }
        .product-catalog-workqueue button:hover,
        .product-catalog-workqueue button:focus-visible {
          border-bottom-color: rgba(200,32,44,.35);
          background: #fbfcfd;
          outline: none;
        }
        .product-catalog-workqueue button.is-active {
          border-bottom-color: var(--brand);
          background: rgba(200,32,44,.045);
        }
        .product-catalog-workqueue span {
          color: var(--t-primary);
          font-size: 12px;
          font-weight: 900;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .product-catalog-workqueue strong {
          color: var(--t-primary);
          font-size: 18px;
          line-height: 1;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .product-catalog-workqueue small {
          grid-column: 1 / -1;
          color: var(--t-tertiary);
          font-size: 11px;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .product-catalog-feedback {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 42px;
          padding: 9px 18px;
          border-bottom: 1px solid rgba(15, 23, 42, .09);
          background: #f8fafc;
        }
        .product-catalog-feedback strong {
          color: var(--t-primary);
          font-size: 12px;
          line-height: 1.35;
        }
        .product-catalog-feedback span {
          color: var(--t-secondary);
          font-size: 12px;
          line-height: 1.35;
        }
        .product-catalog-table {
          border-collapse: separate;
          border-spacing: 0;
        }
        .product-catalog-table th {
          height: 34px;
          padding-top: 7px !important;
          padding-bottom: 7px !important;
          font-size: 11px;
          line-height: 1.2;
          white-space: nowrap;
          background: #f8fafc;
        }
        .product-catalog-table td {
          padding-top: 9px !important;
          padding-bottom: 9px !important;
          vertical-align: middle;
          line-height: 1.35;
        }
        .product-catalog-table h3 {
          font-size: 14px !important;
          line-height: 1.25 !important;
          -webkit-line-clamp: 1 !important;
        }
        .product-catalog-table .badge,
        .product-catalog-table .pill-brand {
          min-height: 22px;
          padding-top: 2px;
          padding-bottom: 2px;
          line-height: 1.2;
        }
        .product-catalog-table .mono-cell {
          font-size: 12px;
        }
        .product-catalog-image-preview {
          width: 34px !important;
          height: 32px !important;
          border-radius: 6px !important;
        }
        .product-catalog-website-cell {
          gap: 3px !important;
          min-width: 210px !important;
          max-width: 310px;
        }
        .product-catalog-website-cell__status {
          gap: 4px !important;
        }
        .product-catalog-website-cell__path,
        .product-catalog-website-cell__slug,
        .product-catalog-website-cell__next {
          display: block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.25;
        }
        .product-catalog-table .product-catalog-website-cell__slug,
        .product-catalog-table .product-catalog-website-cell__next {
          display: none;
        }
        .product-catalog-row-actions {
          gap: 6px !important;
          justify-content: flex-end;
          flex-wrap: nowrap !important;
        }
        .product-catalog-row-actions .btn {
          min-height: 32px;
          height: 32px;
          padding: 0 10px;
          font-size: 12px;
          white-space: nowrap;
        }
        @media (max-width: 760px) {
          .product-data-console-hero,
          .product-data-console-panel__head {
            grid-template-columns: 1fr;
          }
          .product-data-console-metrics,
          .product-data-console-layout,
          .product-data-console-funnel,
          .product-data-console-row,
          .product-catalog-filterline,
          .product-catalog-commandbar,
          .product-catalog-workqueue {
            grid-template-columns: 1fr;
          }
          .product-catalog-commandbar {
            display: grid;
          }
          .product-catalog-commandbar__meta {
            justify-content: flex-start;
          }
          .product-data-console-metric {
            border-right: 0;
            border-bottom: 1px solid var(--border);
          }
          .product-edit-progress {
            grid-template-columns: 1fr;
          }
          .product-edit-media-panel {
            grid-template-columns: 1fr !important;
          }
          .product-edit-media-thumb {
            width: min(180px, 100%) !important;
          }
        }
      `}</style>
      <div
        className="page-container products-page"
        style={{
          display: 'grid',
          gap: 20,
          maxWidth: 'none',
          width: '100%',
        }}
      >
        {activeModule !== 'dashboard' && activeModule !== 'catalog' ? (
          <WorkbenchSectionHeader
            eyebrow="营销工作台"
            title={activeModule === 'materials' ? '产品资料管理' : '产品目录底座'}
            description="产品库 CRUD、产品资料和目录底座继续作为独立管理入口保留。"
          />
        ) : null}

        {activeModule === 'catalog' && (
          <>
            <WorkbenchFilterToolbar>
              <div className="product-catalog-filterline">
                <div className="product-catalog-search">
                  <Search size={16} style={{ color: 'var(--t-tertiary)', flexShrink: 0 }} />
                  <input
                    className="input"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="搜索 SKU、slug、名称、型号"
                    style={{ width: '100%', minWidth: 0 }}
                  />
                </div>
                <select
                  className="input"
                  value={brandFilter}
                  onChange={(event) => setBrandFilter(event.target.value)}
                  aria-label="产品库品牌筛选"
                >
                  {brandOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  aria-label="产品库状态筛选"
                >
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {statusFilterCounts ? `${item.label} (${statusFilterCounts[item.value] ?? 0})` : item.label}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as CatalogCategoryFilter)}
                  aria-label="产品库分类筛选"
                >
                  <option value="all">全部产品库分类</option>
                  {catalogCategoryOptions.map((item, index) => (
                    <option key={`${item.value || item.label}-${index}`} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {batchFilter ? (
                  <span className="badge badge-info" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', maxWidth: 260 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>试导入批次：{batchFilter}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setBatchFilter('')}
                      aria-label="清除试导入批次筛选"
                      title="清除试导入批次筛选"
                      style={{ width: 24, minWidth: 24, height: 24, padding: 0 }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ) : null}
                <span
                  className={error ? 'badge badge-warning' : 'badge badge-success'}
                  title={error ? String(error.message || error) : undefined}
                  style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}
                >
                  {error ? '产品加载失败' : isLoading ? '同步中' : '产品库已同步'}
                </span>
              </div>
            </WorkbenchFilterToolbar>
          </>
        )}

        {activeModule === 'dashboard' ? (
          <ProductDataConsole
            products={productDataConsoleProducts}
            assignmentByProductKey={assignmentsByProductKey}
            isLoading={isLoading}
            error={error}
            onOpenCatalog={() => setModule('catalog')}
          />
        ) : activeModule === 'catalog' ? (
          <ProductCatalogShell
            products={pagedCatalogProducts}
            allProducts={visibleCatalogProducts}
            total={visibleCatalogProducts.length}
            currentPage={Math.min(catalogPage, catalogTotalPages)}
            totalPages={catalogTotalPages}
            pageSize={pageSize}
            pageSizeOptions={PRODUCT_PAGE_SIZE_OPTIONS}
            isLoading={isLoading}
            error={error}
            permissionsReady={permissionsReady}
            canCreateProduct={productPermissions.canCreateProduct}
            canUpdateProduct={productPermissions.canUpdateProduct}
            canPublishProduct={productPermissions.canPublishProduct}
            canDeleteProduct={productPermissions.canDeleteProduct}
            brandOptions={createBrandOptions}
            assignmentByProductKey={assignmentsByProductKey}
            pilotSummary={pilotSummary}
            actionNotice={actionNotice}
            onNotice={setActionNotice}
            onCreated={(brand) => {
              setBrandFilter(brand);
              setStatusFilter('active');
              setCategory('all');
              setKeyword('');
              return Promise.all([mutate(), mutateShelfAssignments()]);
            }}
            onChanged={() => Promise.all([mutate(), mutateShelfAssignments()])}
            onPageChange={setCatalogPage}
            onPageSizeChange={setPageSize}
            onReset={() => {
              setCategory('all');
              setBrandFilter('all');
              setStatusFilter('all');
              setBatchFilter('');
              setKeyword('');
            }}
          />
        ) : activeModule === 'materials' ? (
          <ProductMaterialsView products={productList} />
        ) : activeModule === 'categories' ? (
          <ProductCategoryManagerCrudView
            canCreate={productPermissions.canCreateBrandLibrary}
            canUpdate={productPermissions.canUpdateBrandLibrary}
            canDelete={productPermissions.canDeleteBrandLibrary}
          />
        ) : (
          <ProductBaseView products={productList} productByModel={productByModel} />
        )}
      </div>
    </div>
  );
}

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

function CategoryChip({
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
      className={active ? 'pill-brand' : 'pill-neutral'}
      style={{
        minHeight: 28,
        borderColor: active ? 'var(--brand-100)' : 'var(--border)',
        fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card-elevated" style={{ padding: '16px 18px' }}>
      <div className="t-label">{label}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 28,
          lineHeight: 1.1,
          fontWeight: 700,
          color: 'var(--t-strong)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <p style={{ marginTop: 4, fontSize: 12, color: 'var(--t-tertiary)' }}>{hint}</p>
    </div>
  );
}

function CategoryCountPill({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'success' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 30,
        padding: '5px 10px',
        borderRadius: 999,
        border: tone === 'success' ? '1px solid rgba(76, 175, 80, 0.28)' : '1px solid var(--border)',
        background: tone === 'success' ? 'rgba(76, 175, 80, 0.08)' : 'var(--surface-2)',
        color: tone === 'success' ? 'var(--success)' : 'var(--t-secondary)',
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <strong style={{ color: 'var(--t-primary)', fontSize: 14 }}>{value}</strong>
    </span>
  );
}

type ProductDataConsoleIssue = 'missingData' | 'missingImage' | 'missingDirectory' | 'pendingPublish' | 'websiteRisk';
type ProductCatalogWorkFilter = 'all' | 'admission' | 'directory' | 'publish' | 'review' | 'healthy';
const PRODUCT_CATALOG_WORK_FILTER_LABELS: Record<ProductCatalogWorkFilter, string> = {
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

function productDataConsoleItems(
  products: NormalizedProduct[],
  assignmentByProductKey: Map<string, WebsiteShelfAssignment[]>,
): ProductDataConsoleItem[] {
  return products.map((product) => {
    const assignments = assignmentsForProduct(assignmentByProductKey, product);
    const activeAssignments = activeWebsiteAssignments(assignments);
    const publishedAssignments = activeAssignments.filter((assignment) => assignment.status === 'published');
    const readiness = productReadinessSummary(product);
    const publishReadiness = productPublishRequiredReadiness(product);
    const imageSrc = productImageSrc(product);
    const issues: ProductDataConsoleIssue[] = [];
    if (!publishReadiness.ready) issues.push('missingData');
    if (!activeAssignments.length) issues.push('missingDirectory');
    if (activeAssignments.length && !publishedAssignments.length) issues.push('pendingPublish');
    if (activeAssignments.length > publishedAssignments.length && publishedAssignments.length > 0) issues.push('websiteRisk');

    const primaryAction = issues.includes('missingData') || issues.includes('missingImage')
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
  const color = tone === 'success'
    ? 'var(--success)'
    : tone === 'danger'
      ? 'var(--danger)'
      : tone === 'warning'
        ? 'var(--warning)'
        : 'var(--t-primary)';
  return (
    <div className="product-data-console-metric">
      <span>{label}</span>
      <strong style={{ color }}>{value}{suffix}</strong>
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
        <strong>{value} 个 · {percent}%</strong>
      </div>
      <div className="product-data-console-bar__track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ProductCatalogWorkQueue({
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

function ProductDataConsole({
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
  const rows = useMemo(() => productDataConsoleItems(products, assignmentByProductKey), [assignmentByProductKey, products]);
  const total = rows.length;
  const missingData = rows.filter((item) => item.issues.includes('missingData') || item.issues.includes('missingImage')).length;
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
  const verdict = riskTotal
    ? `当前 ${riskTotal} 项问题影响产品发布质量`
    : '当前产品数据链路健康';
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
          <span>{verdictDetail} 数据口径覆盖产品事实、资料完整度、官网目录、发布状态和公开回读。</span>
        </div>
        <div className="product-data-console-hero__verdict">
          <strong>{healthRate}% 产品发布健康率</strong>
          <small>稳定展示产品 {ready} / {total || 0} 个；风险产品 {Math.max(total - ready, 0)} 个。</small>
          <button type="button" className="btn btn-brand btn-sm" onClick={onOpenCatalog}>
            <Package size={14} />
            进入产品目录管理
          </button>
        </div>
      </div>

      <div className="product-data-console-metrics">
        <ProductDataConsoleMetric label="产品总数" value={total} hint="当前产品事实库" />
        <ProductDataConsoleMetric label="发布准入率" value={dataReadyRate} suffix="%" hint={`${missingData} 个产品必填项待补`} tone={missingData ? 'warning' : 'success'} />
        <ProductDataConsoleMetric label="目录挂载率" value={directoryReadyRate} suffix="%" hint={`${missingDirectory} 个未挂载目录`} tone={missingDirectory ? 'danger' : 'success'} />
        <ProductDataConsoleMetric label="发布链路率" value={publishReadyRate} suffix="%" hint={`${pendingPublish + websiteRisk} 个待发布/复核`} tone={pendingPublish || websiteRisk ? 'warning' : 'success'} />
        <ProductDataConsoleMetric label="风险产品数" value={Math.max(total - ready, 0)} hint="影响官网稳定展示" tone={total - ready ? 'danger' : 'success'} />
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
            <ProductDataConsoleBar label="1. 产品事实未达发布准入" value={missingData} total={total} tone="danger" />
            <ProductDataConsoleBar label="2. 官网目录未承接" value={missingDirectory} total={total} tone="warning" />
            <ProductDataConsoleBar label="3. 目录已承接待发布" value={pendingPublish} total={total} tone="warning" />
            <ProductDataConsoleBar label="4. 公开展示需复核" value={websiteRisk} total={total} tone="warning" />
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
              <strong>{missingData ? '发布准入' : missingDirectory ? '目录承接' : pendingPublish ? '发布执行' : websiteRisk ? '公开复核' : '保持健康'}</strong>
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
          <div className="inset" style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 12, lineHeight: 1.5 }}>
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
            <ProductDataConsoleRow key={item.product.id} item={item} onOpenCatalog={onOpenCatalog} />
          ))}
          {!rows.length ? (
            <div className="inset" style={{ padding: 14, color: 'var(--t-secondary)', fontSize: 13 }}>
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
        {imageSrc ? <img src={imageSrc} alt={item.product.name || item.product.model || '产品主图'} /> : <Image size={18} />}
      </div>
      <div className="product-data-console-row__main">
        <div>
          <strong>{item.product.name || item.product.model || '未命名产品'}</strong>
          <span>{item.product.model || '待补型号'} · {item.product.sku || '待补 SKU'}</span>
        </div>
        <small>{item.product.categoryPath || item.product.category || '未绑定产品库分类'}</small>
        <div className="product-data-console-row__tags">
          {item.issues.includes('missingData') ? <span className="badge badge-warning">发布准入未达</span> : null}
          {item.issues.includes('missingImage') ? <span className="badge badge-warning">缺主图</span> : null}
          {item.issues.includes('missingDirectory') ? <span className="badge badge-danger">未配置目录</span> : null}
          {item.issues.includes('pendingPublish') ? <span className="badge badge-info">待发布</span> : null}
          {item.issues.includes('websiteRisk') ? <span className="badge badge-warning">官网需复核</span> : null}
          {!item.issues.length ? <span className="badge badge-success">发布健康</span> : null}
        </div>
      </div>
      <div className="product-data-console-row__status">
        <span>{activeAssignments.length ? `${activeAssignments.length} 个官网挂载` : '未挂载官网'}</span>
        <small>{item.nextStep}</small>
      </div>
      <button type="button" className="btn btn-outline btn-sm" onClick={onOpenCatalog}>
        {item.primaryAction}
      </button>
    </article>
  );
}

function ProductCatalogShell({
  products: items,
  allProducts,
  total,
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  isLoading,
  error,
  permissionsReady,
  canCreateProduct,
  canUpdateProduct,
  canPublishProduct,
  canDeleteProduct,
  brandOptions,
  assignmentByProductKey,
  pilotSummary,
  actionNotice,
  onNotice,
  onCreated,
  onChanged,
  onPageChange,
  onPageSizeChange,
  onReset,
}: {
  products: NormalizedProduct[];
  allProducts: NormalizedProduct[];
  total: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  isLoading: boolean;
  error: unknown;
  permissionsReady: boolean;
  canCreateProduct: boolean;
  canUpdateProduct: boolean;
  canPublishProduct: boolean;
  canDeleteProduct: boolean;
  brandOptions: Array<{ value: ProductBrand; label: string }>;
  assignmentByProductKey: Map<string, WebsiteShelfAssignment[]>;
  pilotSummary: ProductPilotSummary | null;
  actionNotice: string;
  onNotice: (text: string) => void;
  onCreated: (brand: ProductBrand) => Promise<unknown>;
  onChanged: () => Promise<unknown>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onReset: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateProductDraft>(() => emptyCreateDraft());
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<'active' | 'inactive' | ''>('');
  const [workFilter, setWorkFilter] = useState<ProductCatalogWorkFilter>('all');
  const { confirmFloating, floatingDialog } = useFloatingDialog();
  const createBrandCode = normalizeBrand(createDraft.brand);
  const { data: createCategoryData, error: createCategoryError, isLoading: createCategoryLoading } = useSWR(
    showCreate && createBrandCode ? ['/api/v2/brand-product-categories', PRODUCT_BASE_CATEGORY_BRAND, 'product-create'] : null,
    async () => {
      const result = await brandProductCategories.list({ brandCode: PRODUCT_BASE_CATEGORY_BRAND });
      return { tree: normalizeProductCategoryTree(result) };
    },
    { revalidateOnFocus: false },
  );
  const createCategoryTree = createCategoryData?.tree || [];

  const showSelectionColumn = canPublishProduct;
  const showProductActionColumn = canUpdateProduct || canPublishProduct || canDeleteProduct;
  const productCatalogColSpan = 9 + (showSelectionColumn ? 1 : 0) + (showProductActionColumn ? 1 : 0);
  const catalogWorkItems = useMemo(
    () => productDataConsoleItems(allProducts, assignmentByProductKey),
    [allProducts, assignmentByProductKey]
  );
  const workCounts = useMemo(() => ({
    all: catalogWorkItems.length,
    admission: catalogWorkItems.filter((item) => item.issues.includes('missingData')).length,
    directory: catalogWorkItems.filter((item) => item.issues.includes('missingDirectory')).length,
    publish: catalogWorkItems.filter((item) => item.issues.includes('pendingPublish')).length,
    review: catalogWorkItems.filter((item) => item.issues.includes('websiteRisk')).length,
    healthy: catalogWorkItems.filter((item) => !item.issues.length).length,
  }), [catalogWorkItems]);
  const visibleItems = useMemo(() => {
    if (workFilter === 'all') return items;
    const matchedIds = new Set(catalogWorkItems
      .filter((item) => {
        if (workFilter === 'admission') return item.issues.includes('missingData');
        if (workFilter === 'directory') return item.issues.includes('missingDirectory');
        if (workFilter === 'publish') return item.issues.includes('pendingPublish');
        if (workFilter === 'review') return item.issues.includes('websiteRisk');
        if (workFilter === 'healthy') return !item.issues.length;
        return true;
      })
      .map((item) => item.product.id));
    return items.filter((product) => matchedIds.has(product.id));
  }, [catalogWorkItems, items, workFilter]);
  const visibleProductIds = useMemo(() => visibleItems.map((product) => product.id).filter(Boolean), [visibleItems]);
  const selectedItems = useMemo(() => {
    const selected = new Set(selectedProductIds);
    return visibleItems.filter((product) => selected.has(product.id));
  }, [selectedProductIds, visibleItems]);
  const allVisibleSelected = visibleProductIds.length > 0 && visibleProductIds.every((id) => selectedProductIds.includes(id));
  const someVisibleSelected = visibleProductIds.some((id) => selectedProductIds.includes(id));

  function toggleVisibleSelection(checked: boolean) {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      visibleProductIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return Array.from(next);
    });
  }

  async function runBulkStatus(nextStatus: 'active' | 'inactive') {
    if (!canPublishProduct || !selectedItems.length || bulkStatus) return;
    setBulkStatus(nextStatus);
    const writableItems = selectedItems.filter((product) => product.status !== 'archived');
    try {
      await Promise.all(
        writableItems.map((product) => products.update(product.id, productStatusPayload(product, nextStatus)))
      );
      onNotice(`已批量${nextStatus === 'active' ? '启用' : '停用'} ${writableItems.length} 个产品库产品。`);
      setSelectedProductIds((current) => current.filter((id) => !selectedItems.some((product) => product.id === id)));
      await onChanged();
    } catch (e) {
      onNotice((e as Error)?.message || '批量更新产品库状态失败。');
    } finally {
      setBulkStatus('');
    }
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!canCreateProduct) return;
    setCreating(true);
    setCreateError('');
    try {
      const selectedBrands = createDraft.brands.length ? createDraft.brands : (createDraft.brand ? [createDraft.brand] : []);
      if (!selectedBrands.length) throw new Error('请选择至少一个产品品牌。');
      const primaryBrand = createDraft.brand || selectedBrands[0];
      const entityId = String(createDraft.materialCode || createDraft.model || createDraft.name);
      const mainImageRef = await uploadProductMainImageRef(createDraft.mainImage, entityId);
      const manualPdfRefs = await uploadProductManualPdfRefs(createDraft.manualPdfs, entityId);
      const assetRefs = [mainImageRef, ...manualPdfRefs].filter(Boolean);
      const createdRows: Array<{ brand: ProductBrand; payload: Record<string, unknown>; created: unknown }> = [];
      for (const brand of [primaryBrand]) {
        const basePayload = createProductPayload(createDraft, createCategoryTree, brand, {
          includeCategoryBinding: brand === primaryBrand,
        });
        const payload = assetRefs.length ? { ...basePayload, assetRefs } : basePayload;
        let created: unknown;
        try {
          created = await products.create(payload);
        } catch (error) {
          if (!isProductModelExistsError(error)) throw error;
          const confirmed = await confirmFloating({
            title: '产品型号已存在',
            message: `${displayBrand(brand)}：\n${productModelExistsMessage(error)}`,
            confirmLabel: '更新并追加 SKU',
            cancelLabel: '取消录入',
          });
          if (!confirmed) {
            setCreateError(`已取消 ${displayBrand(brand)} 的录入，后续品牌未继续提交。`);
            return;
          }
          created = await products.create({ ...payload, confirmExistingProduct: true });
        }
        createdRows.push({ brand, payload, created });
        const createdId = text((created as any)?.id);
        if (createdId) {
          await saveProductPublicContent(createdId, text((payload as any).tenantId), null, createDraft);
        }
      }
      createDraft.manualPdfs.forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
      if (createDraft.mainImage) URL.revokeObjectURL(createDraft.mainImage.previewUrl);
      setCreateDraft(emptyCreateDraft());
      setShowCreate(false);
      onNotice(`已创建/更新 ${createdRows.length} 个品牌的产品：${selectedBrands.map(displayBrand).join('、')}。`);
      await Promise.all(selectedBrands.map((brand) => onCreated(brand)));
    } catch (e) {
      const message = (e as Error)?.message || 'Create product failed.';
      setCreateError(message);
      onNotice(message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="product-catalog-shell">
      <div className="product-catalog-commandbar">
        <div className="product-catalog-commandbar__main">
          <p>产品目录运营台</p>
          <h2>真实产品主数据</h2>
          <span>产品事实必填项完整 → 官网目录承接 → 发布执行 → 公开回读复核</span>
        </div>
        <div className="product-catalog-commandbar__meta">
          {!permissionsReady ? (
            <span className="badge badge-grey">正在确认权限</span>
          ) : canCreateProduct ? (
            <button
              type="button"
              className="btn btn-brand btn-sm"
              onClick={() => {
                setCreateError('');
                setCreateDraft(emptyCreateDraft());
                setShowCreate(true);
              }}
            >
              <Plus size={14} />
              新增产品
            </button>
          ) : (
            <span className="badge badge-grey">只读查看</span>
          )}
        </div>
      </div>

      <ProductCatalogWorkQueue
        active={workFilter}
        counts={workCounts}
        onChange={(next) => {
          setWorkFilter(next);
          setSelectedProductIds([]);
          onNotice(next === 'all' ? '已切换到全部产品。' : `已切换到${PRODUCT_CATALOG_WORK_FILTER_LABELS[next]}任务视图。`);
        }}
      />

      {pilotSummary ? (
        <div
          role="status"
          style={{
            padding: '10px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flexWrap: 'wrap',
            background: 'var(--surface-2)',
            color: 'var(--t-secondary)',
            fontSize: 12,
          }}
        >
          <strong style={{ color: 'var(--t-primary)' }}>{pilotSummary.products} 个试导入产品</strong>
          <span>{pilotSummary.categories} 个品类</span>
          <span>{pilotSummary.websitePublished} 个官网上架</span>
          <span>{pilotSummary.needsCompletion} 个待补全</span>
        </div>
      ) : null}

      {canCreateProduct && showCreate && (
          <CreateProductForm
            draft={createDraft}
            brandOptions={brandOptions}
            categoryTree={createCategoryTree}
            categoryLoading={createCategoryLoading}
            categoryError={createCategoryError}
            error={createError}
          submitting={creating}
          onChange={setCreateDraft}
            onCancel={() => {
              createDraft.manualPdfs.forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
              if (createDraft.mainImage) URL.revokeObjectURL(createDraft.mainImage.previewUrl);
              setCreateDraft(emptyCreateDraft());
            setCreateError('');
            setShowCreate(false);
          }}
          onSubmit={submitCreate}
        />
      )}

      <div className="product-catalog-feedback" role="status">
        <span>
          {isLoading ? '正在加载真实产品...' : `当前视图显示 ${visibleItems.length} / ${items.length} 个，本次筛选共 ${total} 个产品`}
        </span>
        {actionNotice && (
          <strong>
            {actionNotice}
          </strong>
        )}
      </div>

      {!permissionsReady ? (
        <WorkbenchTableState
          type="loading"
          title="正在确认操作权限"
          description="正在读取当前账号的产品库操作权限，确认后再展示可用操作。"
        />
      ) : error ? (
        <EmptyCatalogState
          type="error"
          title="产品暂不可用"
          description={String((error as Error)?.message || error)}
          onReset={onReset}
        />
      ) : !isLoading && !visibleItems.length ? (
        <EmptyCatalogState
          title={workFilter === 'all' ? '当前筛选下没有真实产品' : `当前没有${PRODUCT_CATALOG_WORK_FILTER_LABELS[workFilter]}任务`}
          description={workFilter === 'all' ? '可以清空筛选重新查看，或在后续写入表单补齐后创建新产品。' : '这个任务视图下没有待处理产品，可以切回全部产品查看。'}
          onReset={workFilter === 'all' ? onReset : () => setWorkFilter('all')}
        />
      ) : (
        <WorkbenchTableShell>
          {canPublishProduct && selectedItems.length ? (
            <div
              role="status"
              style={{
                padding: '10px 18px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                background: 'rgba(200, 32, 44, 0.04)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800 }}>已选 {selectedItems.length} 个产品库产品</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-brand btn-sm"
                  onClick={() => runBulkStatus('active')}
                  disabled={Boolean(bulkStatus)}
                >
                  <CheckCircle2 size={13} />
                  {bulkStatus === 'active' ? '批量启用中' : '批量启用'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => runBulkStatus('inactive')}
                  disabled={Boolean(bulkStatus)}
                >
                  <EyeOff size={13} />
                  {bulkStatus === 'inactive' ? '批量停用中' : '批量停用'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => toggleVisibleSelection(false)}
                  disabled={Boolean(bulkStatus)}
                >
                  取消选择
                </button>
              </div>
            </div>
          ) : null}
          <div style={{ overflowX: 'auto' }}>
            <table className="table product-catalog-table" style={{ minWidth: showProductActionColumn ? 1560 : 1440 }}>
              <thead>
                <tr>
                  {showSelectionColumn ? (
                    <th style={{ width: 44 }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        disabled={!visibleProductIds.length || Boolean(bulkStatus)}
                        ref={(node) => {
                          if (node) node.indeterminate = someVisibleSelected && !allVisibleSelected;
                        }}
                        onChange={(event) => toggleVisibleSelection(event.target.checked)}
                        aria-label="选择当前页全部产品库产品"
                      />
                    </th>
                  ) : null}
                  <th>产品库分类</th>
                  <th>产品</th>
                  <th>型号 / SKU</th>
                  <th>系列</th>
                  <th>资料完整度</th>
                  <th>品牌</th>
                  <th>图片</th>
                  <th>产品库状态</th>
                  <th>官网展示健康</th>
                  {showProductActionColumn ? <th style={{ textAlign: 'right' }}>操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((product) => {
                  const assignments = assignmentsForProduct(assignmentByProductKey, product);
                  return (
                    <ProductCatalogRow
                      key={product.id}
                      product={product}
                      canUpdateProduct={canUpdateProduct}
                      canPublishProduct={canPublishProduct}
                      canDeleteProduct={canDeleteProduct}
                      assignments={assignments}
                      brandOptions={brandOptions}
                      showSelectionColumn={showSelectionColumn}
                      selected={selectedProductIds.includes(product.id)}
                      selectionDisabled={!canPublishProduct || Boolean(bulkStatus)}
                      onSelectionChange={(checked) => {
                        setSelectedProductIds((current) => {
                          const next = new Set(current);
                          if (checked) next.add(product.id);
                          else next.delete(product.id);
                          return Array.from(next);
                        });
                      }}
                      onNotice={onNotice}
                      onChanged={onChanged}
                      feedbackColSpan={productCatalogColSpan}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          <WorkbenchPaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            onPageSizeChange={onPageSizeChange}
            onPageChange={isLoading ? undefined : onPageChange}
            onPrevious={isLoading || currentPage <= 1 ? undefined : () => onPageChange(Math.max(currentPage - 1, 1))}
            onNext={isLoading || currentPage >= totalPages ? undefined : () => onPageChange(currentPage + 1)}
          />
        </WorkbenchTableShell>
      )}
      {floatingDialog}
    </section>
  );
}

type ProductLibraryCompletenessDraft = Pick<
  CreateProductDraft,
  | 'productType'
  | 'lifecycleStage'
  | 'manufacturer'
  | 'countryOfOrigin'
  | 'marketCode'
  | 'launchDate'
  | 'discontinueDate'
  | 'salesUnit'
  | 'lengthMm'
  | 'widthMm'
  | 'heightMm'
  | 'netWeightKg'
  | 'packageLengthMm'
  | 'packageWidthMm'
  | 'packageHeightMm'
  | 'grossWeightKg'
  | 'packageSpec'
  | 'configurationNotes'
  | 'installationRequirement'
  | 'warrantyPolicy'
  | 'technicalSpecs'
  | 'sellingPoints'
  | 'applicationScenarios'
  | 'complianceCertificates'
>;

function ProductLibraryCompletenessFields({
  draft,
  disabled = false,
  onPatch,
}: {
  draft: ProductLibraryCompletenessDraft;
  disabled?: boolean;
  onPatch: (next: Partial<ProductLibraryCompletenessDraft>) => void;
}) {
  return (
    <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
      <div className="product-edit-section-head">
        <h3>产品资料完整度</h3>
        <span className="badge badge-grey">产品库字段，不代表官网发布</span>
      </div>
      <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">产品类型</span>
          <input className="input" value={draft.productType} disabled={disabled} onChange={(event) => onPatch({ productType: event.target.value })} placeholder="如：燃气热水器 / 热泵 / 采暖炉" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">生命周期</span>
          <select className="input" value={draft.lifecycleStage} disabled={disabled} onChange={(event) => onPatch({ lifecycleStage: event.target.value })}>
            <option value="intro">导入 / 上新</option>
            <option value="growth">成长</option>
            <option value="mature">成熟</option>
            <option value="withdrawn">停售</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">制造商</span>
          <input className="input" value={draft.manufacturer} disabled={disabled} onChange={(event) => onPatch({ manufacturer: event.target.value })} placeholder="如：Rheem / Everhot" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">产地</span>
          <input className="input" value={draft.countryOfOrigin} disabled={disabled} onChange={(event) => onPatch({ countryOfOrigin: event.target.value })} placeholder="中国" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">适用市场</span>
          <input className="input" value={draft.marketCode} disabled={disabled} onChange={(event) => onPatch({ marketCode: event.target.value })} placeholder="CN" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">上市日期</span>
          <input className="input" type="date" value={draft.launchDate} disabled={disabled} onChange={(event) => onPatch({ launchDate: event.target.value })} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">停售日期</span>
          <input className="input" type="date" value={draft.discontinueDate} disabled={disabled} onChange={(event) => onPatch({ discontinueDate: event.target.value })} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">销售单位</span>
          <input className="input" value={draft.salesUnit} disabled={disabled} onChange={(event) => onPatch({ salesUnit: event.target.value })} placeholder="台 / 套 / 件" />
        </label>
      </div>
      <div className="product-edit-subsection" style={{ display: 'grid', gap: 10 }}>
        <div className="product-edit-section-head" style={{ padding: 0, border: 0 }}>
          <h4 style={{ margin: 0, fontSize: 14 }}>基础尺寸与重量</h4>
          <span className="badge badge-grey">产品主表字段 · 尺寸 mm / 重量 kg</span>
        </div>
        <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">产品长 mm</span>
            <input className="input" type="number" min={0} step="0.01" value={draft.lengthMm} disabled={disabled} onChange={(event) => onPatch({ lengthMm: event.target.value })} placeholder="如：720" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">产品宽 mm</span>
            <input className="input" type="number" min={0} step="0.01" value={draft.widthMm} disabled={disabled} onChange={(event) => onPatch({ widthMm: event.target.value })} placeholder="如：450" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">产品高 mm</span>
            <input className="input" type="number" min={0} step="0.01" value={draft.heightMm} disabled={disabled} onChange={(event) => onPatch({ heightMm: event.target.value })} placeholder="如：260" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">净重 kg</span>
            <input className="input" type="number" min={0} step="0.001" value={draft.netWeightKg} disabled={disabled} onChange={(event) => onPatch({ netWeightKg: event.target.value })} placeholder="如：18.5" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">包装长 mm</span>
            <input className="input" type="number" min={0} step="0.01" value={draft.packageLengthMm} disabled={disabled} onChange={(event) => onPatch({ packageLengthMm: event.target.value })} placeholder="如：820" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">包装宽 mm</span>
            <input className="input" type="number" min={0} step="0.01" value={draft.packageWidthMm} disabled={disabled} onChange={(event) => onPatch({ packageWidthMm: event.target.value })} placeholder="如：520" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">包装高 mm</span>
            <input className="input" type="number" min={0} step="0.01" value={draft.packageHeightMm} disabled={disabled} onChange={(event) => onPatch({ packageHeightMm: event.target.value })} placeholder="如：360" />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">毛重 kg</span>
            <input className="input" type="number" min={0} step="0.001" value={draft.grossWeightKg} disabled={disabled} onChange={(event) => onPatch({ grossWeightKg: event.target.value })} placeholder="如：21" />
          </label>
        </div>
      </div>
      <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">包装/配置说明</span>
          <input className="input" value={draft.packageSpec} disabled={disabled} onChange={(event) => onPatch({ packageSpec: event.target.value })} placeholder="如：整机+附件包" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">SKU 配置差异</span>
          <input className="input" value={draft.configurationNotes} disabled={disabled} onChange={(event) => onPatch({ configurationNotes: event.target.value })} placeholder="如：不同容量/包装/销售配置" />
        </label>
      </div>
      <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">技术参数</span>
          <textarea className="input" rows={5} value={draft.technicalSpecs} disabled={disabled} onChange={(event) => onPatch({ technicalSpecs: event.target.value })} placeholder={'一行一个，例如：\n容量: 16L\n能效等级: 一级\n燃气种类: 天然气'} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">产品卖点</span>
          <textarea className="input" rows={5} value={draft.sellingPoints} disabled={disabled} onChange={(event) => onPatch({ sellingPoints: event.target.value })} placeholder={'一行一个，例如：\n恒温控制\n低噪运行\n安全防护'} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">应用场景</span>
          <textarea className="input" rows={5} value={draft.applicationScenarios} disabled={disabled} onChange={(event) => onPatch({ applicationScenarios: event.target.value })} placeholder={'一行一个，例如：\n住宅热水\n公寓\n别墅'} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">安装条件</span>
          <textarea className="input" rows={5} value={draft.installationRequirement} disabled={disabled} onChange={(event) => onPatch({ installationRequirement: event.target.value })} placeholder="如：排烟、燃气压力、水压、电源、安装空间要求" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">保修政策</span>
          <textarea className="input" rows={5} value={draft.warrantyPolicy} disabled={disabled} onChange={(event) => onPatch({ warrantyPolicy: event.target.value })} placeholder="如：整机保修年限、核心部件保修、适用条件" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">合规/证书</span>
          <textarea className="input" rows={5} value={draft.complianceCertificates} disabled={disabled} onChange={(event) => onPatch({ complianceCertificates: event.target.value })} placeholder={'一行一个，例如：\nCCC 证书\n能效备案\n检测报告'} />
        </label>
      </div>
    </section>
  );
}

function CreateProductForm({
  draft,
  brandOptions,
  categoryTree,
  categoryLoading,
  categoryError,
  error,
  submitting,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: CreateProductDraft;
  brandOptions: Array<{ value: ProductBrand; label: string }>;
  categoryTree: ProductCategoryNode[];
  categoryLoading: boolean;
  categoryError: unknown;
  error: string;
  submitting: boolean;
  onChange: (draft: CreateProductDraft) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const patch = (next: Partial<CreateProductDraft>) => onChange({ ...draft, ...next });
  const tenantId = draft.brand ? PRODUCT_LIBRARY_TENANT_ID : '';
  const categoryFlat = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const selectedLevel1 = categoryFlat.find((item) => item.id === draft.categoryLevel1Id) || null;
  const selectedLevel2 = categoryFlat.find((item) => item.id === draft.categoryLevel2Id) || null;
  const selectedLevel3 = categoryFlat.find((item) => item.id === draft.categoryLevel3Id) || null;
  const level1Options = activeCategoryOptions(categoryTree, selectedLevel1);
  const level2Options = activeCategoryOptions(selectedLevel1?.children || [], selectedLevel2);
  const level3Options = activeCategoryOptions(selectedLevel2?.children || [], selectedLevel3);
  const selectedPath = [selectedLevel1, selectedLevel2, selectedLevel3].filter(Boolean).map((item) => item?.name || item?.code).join(' / ');
  const selectedBrands = draft.brands.length ? draft.brands : (draft.brand ? [draft.brand] : []);
  const createBrandOptions = brandOptions.length ? brandOptions : DEFAULT_CREATE_BRAND_OPTIONS;
  function toggleDraftBrand(brand: ProductBrand, checked: boolean) {
    const next = checked
      ? [...new Set([...selectedBrands, brand])]
      : selectedBrands.filter((item) => item !== brand);
    onChange({
      ...draft,
      brands: next,
      brand: next[0] || '',
      categoryLevel1Id: next[0] === draft.brand ? draft.categoryLevel1Id : '',
      categoryLevel2Id: next[0] === draft.brand ? draft.categoryLevel2Id : '',
      categoryLevel3Id: next[0] === draft.brand ? draft.categoryLevel3Id : '',
      officialEnglishName: next[0] ? String(next[0]).toUpperCase() : draft.officialEnglishName,
    });
  }
  const { alertFloating, floatingDialog } = useFloatingDialog();
  async function selectMainImage(file: File | null) {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) {
      await alertFloating({ title: '图片格式不支持', message: '只能上传 JPG / PNG 图片。' });
      return;
    }
    if (draft.mainImage) URL.revokeObjectURL(draft.mainImage.previewUrl);
    patch({ mainImage: { file, previewUrl: URL.createObjectURL(file) } });
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="product-edit-backdrop"
      role="presentation"
      onMouseDown={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'rgba(15, 23, 42, 0.45)',
      }}
    >
      <form
        className="product-edit-modal"
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-create-title"
        style={{
          width: 'min(1040px, 100%)',
          maxHeight: 'min(860px, calc(100vh - 48px))',
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr) auto',
          background: 'var(--surface-1)',
          borderRadius: 'var(--r-xl)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--sh-lg)',
          overflow: 'hidden',
        }}
      >
        <header
          className="product-edit-modal-head"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'flex-start',
            padding: 18,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <p className="t-label">新增产品</p>
            <h2 id="product-create-title">{draft.name || '新增产品库主数据'}</h2>
            <span>{draft.brand ? `${displayBrand(draft.brand)} · ${selectedPath || '请选择产品分类'}` : '先选择品牌，再选择该品牌已有分类'}</span>
          </div>
          <button type="button" className="btn btn-outline btn-sm icon-only" onClick={onCancel} aria-label="关闭新增产品" disabled={submitting}>
            <X size={15} />
          </button>
        </header>

        <div className="product-edit-modal-body" style={{ overflow: 'auto', padding: 18, display: 'grid', gap: 14 }}>
          <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
            <div className="product-edit-section-head">
              <h3>基础信息</h3>
              <span className={tenantId ? 'badge badge-success' : 'badge badge-warning'}>
                {tenantId ? `tenantId: ${tenantId}` : '请选择品牌'}
              </span>
            </div>
            <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">品牌</span>
                <div className="inset" style={{ padding: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {createBrandOptions.map((brand) => (
                    <label key={brand.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand.value)}
                        onChange={(event) => toggleDraftBrand(brand.value, event.target.checked)}
                      />
                      {brand.label}
                    </label>
                  ))}
                </div>
                <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>
                  可选择一个或多个品牌；提交后只保存一条公共产品记录，并建立多个品牌绑定。
                </span>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">产品名称</span>
                <input className="input" value={draft.name} required onChange={(event) => patch({ name: event.target.value })} placeholder="恒热燃气热水器 RGS-A" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">产品型号</span>
                <input className="input" value={draft.model} required onChange={(event) => patch({ model: event.target.value })} placeholder="RGS-A" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">SKU / 物料编码</span>
                <input className="input" value={draft.materialCode} required onChange={(event) => patch({ materialCode: event.target.value })} placeholder="10012345" />
              </label>
            </div>
          </section>

          <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
            <div className="product-edit-section-head">
              <h3>产品分类绑定</h3>
              <span className="badge badge-grey">来自当前品牌分类树</span>
            </div>
            {categoryLoading ? (
              <div className="inset" style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 13 }}>正在加载产品分类...</div>
            ) : categoryError ? (
              <div className="inset" role="alert" style={{ padding: 12, color: 'var(--danger)', fontSize: 13 }}>
                产品分类加载失败：{String((categoryError as Error)?.message || categoryError)}
              </div>
            ) : !draft.brand ? (
              <div className="inset" style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 13 }}>请选择品牌后加载该品牌分类。</div>
            ) : !categoryTree.length ? (
              <div className="inset" style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 13 }}>当前品牌暂无分类，请先在“产品分类”中维护分类树。</div>
            ) : (
              <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">一级分类</span>
                  <select
                    className="input"
                    value={draft.categoryLevel1Id}
                    required
                    onChange={(event) => patch({ categoryLevel1Id: event.target.value, categoryLevel2Id: '', categoryLevel3Id: '' })}
                  >
                    <option value="">请选择一级分类</option>
                    {level1Options.map((item) => (
                      <option key={item.id} value={item.id}>{categoryOptionLabel(item)}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">二级分类</span>
                  <select
                    className="input"
                    value={draft.categoryLevel2Id}
                    required
                    disabled={!draft.categoryLevel1Id}
                    onChange={(event) => patch({ categoryLevel2Id: event.target.value, categoryLevel3Id: '' })}
                  >
                    <option value="">请选择二级分类</option>
                    {level2Options.map((item) => (
                      <option key={item.id} value={item.id}>{categoryOptionLabel(item)}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">三级分类（可选）</span>
                  <select className="input" value={draft.categoryLevel3Id} disabled={!draft.categoryLevel2Id} onChange={(event) => patch({ categoryLevel3Id: event.target.value })}>
                    <option value="">不选择三级分类</option>
                    {level3Options.map((item) => (
                      <option key={item.id} value={item.id}>{categoryOptionLabel(item)}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </section>

          <ProductLibraryCompletenessFields
            draft={draft}
            disabled={submitting}
            onPatch={patch}
          />

          <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
            <div className="product-edit-section-head">
              <h3>价格信息</h3>
              <span className="badge badge-grey">目录价与官网展示价分开维护</span>
            </div>
            <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">产品库目录价</span>
                <input className="input" type="number" min={0} step="0.01" value={draft.listPrice} onChange={(event) => patch({ listPrice: event.target.value })} placeholder="不填则为 0" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">经销商基准价</span>
                <input className="input" type="number" min={0} step="0.01" value={draft.costPrice} onChange={(event) => patch({ costPrice: event.target.value })} placeholder="内部供货/结算参考价，不对官网展示" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">币种</span>
                <input className="input" value={draft.currency} onChange={(event) => patch({ currency: event.target.value || 'CNY' })} placeholder="CNY" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">官网价格展示方式</span>
                <select className="input" value={draft.websitePriceDisplayMode} onChange={(event) => patch({ websitePriceDisplayMode: event.target.value })}>
                  <option value="not_shown">不展示价格</option>
                  <option value="show_price">显示官网参考价</option>
                  <option value="price_range">显示价格区间</option>
                  <option value="inquiry">面议</option>
                  <option value="contact_dealer">联系经销商</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">官网参考价</span>
                <input className="input" type="number" min={0} step="0.01" value={draft.websitePrice} disabled={draft.websitePriceDisplayMode !== 'show_price'} onChange={(event) => patch({ websitePrice: event.target.value })} placeholder="选择显示官网参考价时填写" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">官网最低价</span>
                <input className="input" type="number" min={0} step="0.01" value={draft.websitePriceMin} disabled={draft.websitePriceDisplayMode !== 'price_range'} onChange={(event) => patch({ websitePriceMin: event.target.value })} placeholder="价格区间最低价" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">官网最高价</span>
                <input className="input" type="number" min={0} step="0.01" value={draft.websitePriceMax} disabled={draft.websitePriceDisplayMode !== 'price_range'} onChange={(event) => patch({ websitePriceMax: event.target.value })} placeholder="价格区间最高价" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">活动价</span>
                <input className="input" type="number" min={0} step="0.01" value={draft.promoPrice} onChange={(event) => patch({ promoPrice: event.target.value })} placeholder="可选" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">价格单位</span>
                <input className="input" value={draft.priceUnit} onChange={(event) => patch({ priceUnit: event.target.value })} placeholder="台 / 套 / 件" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">价格标签</span>
                <input className="input" value={draft.priceLabel} onChange={(event) => patch({ priceLabel: event.target.value })} placeholder="官网参考价 / 起售价" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">价格说明</span>
                <input className="input" value={draft.priceNote} onChange={(event) => patch({ priceNote: event.target.value })} placeholder="例如：最终成交价以经销商报价为准" />
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 22 }}>
                <input type="checkbox" checked={draft.taxIncluded} onChange={(event) => patch({ taxIncluded: event.target.checked })} />
                <span className="t-label">价格含税</span>
              </label>
            </div>
          </section>

          <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
            <div className="product-edit-section-head">
              <h3>官网元数据</h3>
            </div>
            <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">公开路径</span>
                <input className="input" value={draft.publicSlug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => patch({ publicSlug: event.target.value })} placeholder="留空则按型号生成" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">系列</span>
                <input className="input" value={draft.series} onChange={(event) => patch({ series: event.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">英文名</span>
                <input className="input" value={draft.officialEnglishName} onChange={(event) => patch({ officialEnglishName: event.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">排序</span>
                <input className="input" type="number" min={0} value={draft.displayOrder} onChange={(event) => patch({ displayOrder: event.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">标语</span>
                <input className="input" value={draft.tagline} onChange={(event) => patch({ tagline: event.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">标签</span>
                <input className="input" value={draft.badges} onChange={(event) => patch({ badges: event.target.value })} placeholder="用逗号分隔" />
              </label>
            </div>
          </section>

          <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
            <div className="product-edit-section-head">
              <h3>图片 / 素材</h3>
              <span className={draft.mainImage ? 'badge badge-success' : 'badge badge-warning'}>
                {draft.mainImage ? '已选择主图' : '未上传图片'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
              <div style={{ width: 146, aspectRatio: '1 / 1', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                {draft.mainImage ? (
                  <img src={draft.mainImage.previewUrl} alt="产品主图预览" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Image size={28} style={{ color: 'var(--t-tertiary)' }} />
                )}
              </div>
              <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <p style={{ margin: 0, color: 'var(--t-secondary)', fontSize: 12 }}>维护产品主图，保存后会进入产品库素材引用，并在产品库列表和品牌产品页面同步读取。</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label className="btn btn-outline btn-sm">
                    <Image size={13} />
                    上传主图
                    <input
                      type="file"
                      accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        selectMainImage(event.target.files?.[0] || null);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!draft.mainImage || submitting}
                    onClick={() => {
                      if (draft.mainImage) URL.revokeObjectURL(draft.mainImage.previewUrl);
                      patch({ mainImage: null });
                    }}
                  >
                    <X size={13} />
                    删除
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
            <div className="product-edit-section-head">
              <h3>官网产品详情</h3>
              <span className="badge badge-grey">750px 长图</span>
            </div>
            <OfficialProductDetailEditor
              value={draft.officialDetailHtml}
              onChange={(officialDetailHtml) => patch({ officialDetailHtml })}
              entityId={draft.materialCode || draft.model || draft.name || 'new-product'}
              disabled={submitting}
            />
          </section>

          <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
            <div className="product-edit-section-head">
              <h3>产品说明 PDF</h3>
              <span className="badge badge-grey">不限数量</span>
            </div>
            <ProductManualPdfUploader
              manualPdfs={draft.manualPdfs}
              disabled={submitting}
              onChange={(manualPdfs) => patch({ manualPdfs })}
            />
          </section>
        </div>

        <footer
          className="product-edit-modal-actions"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            padding: 18,
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
          }}
        >
          {error && <span className="row-feedback error" role="alert">{error}</span>}
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={submitting}>
            <X size={13} />
            取消
          </button>
          <button type="submit" className="btn btn-brand btn-sm" disabled={submitting || categoryLoading}>
            <Plus size={14} />
            {submitting ? '创建中...' : '创建'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}

function ProductCatalogRow({
  product,
  canUpdateProduct,
  canPublishProduct,
  canDeleteProduct,
  assignments,
  brandOptions,
  showSelectionColumn,
  selected,
  selectionDisabled,
  onSelectionChange,
  onNotice,
  onChanged,
  feedbackColSpan,
}: {
  product: NormalizedProduct;
  canUpdateProduct: boolean;
  canPublishProduct: boolean;
  canDeleteProduct: boolean;
  assignments: WebsiteShelfAssignment[];
  brandOptions: Array<{ value: ProductBrand; label: string }>;
  showSelectionColumn: boolean;
  selected: boolean;
  selectionDisabled: boolean;
  onSelectionChange: (checked: boolean) => void;
  onNotice: (text: string) => void;
  onChanged: () => Promise<unknown>;
  feedbackColSpan: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditProductDraft>(() => editDraftFromProduct(product));
  const [rowState, setRowState] = useState<RowActionState>({
    dirty: false,
    saving: false,
    success: '',
    error: '',
  });
  const editBodyRef = useRef<HTMLDivElement | null>(null);
  const { alertFloating, confirmFloating, floatingDialog } = useFloatingDialog();
  const { data: categoryData, error: categoryError, isLoading: categoryLoading } = useSWR(
    editing ? ['/api/v2/brand-product-categories', PRODUCT_BASE_CATEGORY_BRAND, 'product-edit'] : null,
    async () => {
      const result = await brandProductCategories.list({ brandCode: PRODUCT_BASE_CATEGORY_BRAND });
      return { tree: normalizeProductCategoryTree(result) };
    },
    { revalidateOnFocus: false },
  );
  const { data: contentData, error: contentError, isLoading: contentLoading } = useSWR(
    editing && product.id ? ['/api/v2/product-catalog/devices/content', product.id, tenantIdForProduct(product)] : null,
    async () => products.listContent(product.id, tenantIdForProduct(product) ? { tenantId: tenantIdForProduct(product) } : undefined),
    { revalidateOnFocus: false },
  );
  const productCategoryTree = categoryData?.tree || [];
  const productCategoryFlat = useMemo(() => flattenCategoryTree(productCategoryTree), [productCategoryTree]);
  const selectedLevel1 = productCategoryFlat.find((item) => item.id === draft.categoryLevel1Id) || null;
  const selectedLevel2 = productCategoryFlat.find((item) => item.id === draft.categoryLevel2Id) || null;
  const selectedLevel3 = productCategoryFlat.find((item) => item.id === draft.categoryLevel3Id) || null;
  const level2Children = selectedLevel1?.children || [];
  const level3Children = selectedLevel2?.children || [];
  const level1Options = activeCategoryOptions(productCategoryTree, selectedLevel1);
  const level2Options = activeCategoryOptions(level2Children, selectedLevel2);
  const level3Options = activeCategoryOptions(level3Children, selectedLevel3);
  const systemDisplayValue = productCategoryDisplayLabel(draft.system || draft.category, productCategoryTree);
  const inactiveCategoryBindings = [selectedLevel1, selectedLevel2, selectedLevel3].filter(
    (item): item is ProductCategoryNode => Boolean(item && item.status === 'inactive'),
  );

  useEffect(() => {
    setDraft(editDraftFromProduct(product));
    setRowState({ dirty: false, saving: false, success: '', error: '' });
  }, [
    product.id,
    product.name,
    product.model,
    product.category,
    product.system,
    product.status,
    product.raw?.categoryLevel1Id,
    product.raw?.categoryLevel2Id,
    product.raw?.categoryLevel3Id,
    product.raw?.assetRefs,
    product.raw?.meta,
  ]);

  useEffect(() => {
    if (!editing || !contentData) return;
    setDraft((current) => ({ ...current, ...contentDraftPatchFromResult(contentData) }));
    setRowState((state) => ({ ...state, dirty: false, success: '', error: '' }));
  }, [contentData, editing]);

  function patchDraft(next: Partial<EditProductDraft>) {
    const updated = { ...draft, ...next };
    setDraft(updated);
    setRowState((state) => ({
      ...state,
      dirty: JSON.stringify(updated) !== JSON.stringify(editDraftFromProduct(product)),
      success: '',
      error: '',
    }));
  }

  function scrollToEditSection(targetId: string) {
    const container = editBodyRef.current;
    const target = targetId ? document.getElementById(targetId) : null;
    if (!container || !target) return;
    const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 12;
    container.scrollTo({ top: Math.max(offset, 0), behavior: 'smooth' });
  }

  async function selectEditMainImage(file: File | null) {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) {
      await alertFloating({ title: '图片格式不支持', message: '只能上传 JPG / PNG 图片。' });
      return;
    }
    if (draft.mainImage) URL.revokeObjectURL(draft.mainImage.previewUrl);
    patchDraft({ mainImage: { file, previewUrl: URL.createObjectURL(file) } });
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!canUpdateProduct) return;
    setRowState((state) => ({ ...state, saving: true, savingAction: 'save', error: '', success: '' }));
    try {
      const mainImageRef = await uploadProductMainImageRef(draft.mainImage, product.sku || product.id);
      const manualPdfRefs = await uploadProductManualPdfRefs(draft.manualPdfs, product.sku || product.id);
      const previousRefs = Array.isArray(product.raw?.assetRefs) ? product.raw.assetRefs : [];
      const payload = productUpdatePayload(product, draft);
      const retainedRefs = previousRefs.filter((ref: Record<string, any>) => {
        if (isManualPdfAsset(ref)) return false;
        if (mainImageRef && (ref?.role === 'main' || ref?.role === 'card')) return false;
        return true;
      });
      const nextAssetRefs = [mainImageRef, ...retainedRefs, ...manualPdfRefs].filter(Boolean);
      await products.update(product.id, { ...payload, assetRefs: nextAssetRefs });
      const previousPublicContent = productPublicContentSignature(contentData);
      const nextPublicContent = productPublicContentSignature({
        data: { items: [{ officialDetailHtml: sanitizeOfficialProductDetailHtml(draft.officialDetailHtml), marketing: productPublicContentPayload(product, draft).marketing }] },
      });
      if (nextPublicContent !== previousPublicContent) {
        await saveProductPublicContent(product.id, tenantIdForProduct(product), product, draft);
      }
      if (draft.mainImage) URL.revokeObjectURL(draft.mainImage.previewUrl);
      draft.manualPdfs.forEach((manual) => {
        if (manual.file && manual.previewUrl.startsWith('blob:')) URL.revokeObjectURL(manual.previewUrl);
      });
      const saveFeedback = formatSaveChecklistFeedback(editChecklistItems, hasPublishedWebsite);
      setRowState({ dirty: false, saving: false, success: saveFeedback, error: '' });
      onNotice(saveFeedback);
      await onChanged();
    } catch (e) {
      const message = (e as Error)?.message || '保存产品失败。';
      setRowState((state) => ({ ...state, saving: false, savingAction: undefined, error: message, success: '' }));
      onNotice(message);
    }
  }

  async function changeStatus(nextStatus: 'active' | 'inactive') {
    if (!canPublishProduct) return;
    setRowState((state) => ({ ...state, saving: true, savingAction: 'status', error: '', success: '' }));
    try {
      await products.update(product.id, productStatusPayload(product, nextStatus));
      setRowState({ dirty: false, saving: false, success: `状态已切换为${statusLabel(nextStatus)}。`, error: '' });
      onNotice(`状态已切换为${statusLabel(nextStatus)}：${product.sku || product.name}`);
      await onChanged();
    } catch (e) {
      const message = (e as Error)?.message || '状态切换失败。';
      setRowState((state) => ({ ...state, saving: false, savingAction: undefined, error: message, success: '' }));
      onNotice(message);
    }
  }

  async function archiveProduct() {
    if (!canDeleteProduct) return;
    const confirmed = await confirmFloating({
      title: '归档产品',
      message: `确认归档「${product.name}」？归档后会从默认产品列表移出，但不会物理删除。`,
      confirmLabel: '归档',
      tone: 'danger',
    });
    if (!confirmed) return;
    setRowState((state) => ({ ...state, saving: true, savingAction: 'archive', error: '', success: '' }));
    try {
      await products.archive(product.id, tenantIdForProduct(product) || undefined);
      setRowState({ dirty: false, saving: false, success: '已归档，默认列表不再显示。', error: '' });
      onNotice(`已归档 ${product.sku || product.name}。`);
      await onChanged();
    } catch (e) {
      const message = (e as Error)?.message || '归档产品失败。';
      setRowState((state) => ({ ...state, saving: false, savingAction: undefined, error: message, success: '' }));
      onNotice(message);
    }
  }

  const statusTarget = product.status === 'active' ? 'inactive' : 'active';
  const customCategory = draft.category && !CATEGORY_KEYS.has(draft.category);
  const brandMeta = productBrandMeta(product);
  const libraryMeta = productLibraryMeta(product);
  const readiness = productReadinessSummary(product);
  const reviewNotes = Array.isArray(libraryMeta.reviewNotes) ? libraryMeta.reviewNotes.map(text).filter(Boolean) : [];
  const websiteCategory = text(brandMeta.websiteCategory || brandMeta.websiteMenuCategory || brandMeta.cat);
  const imageSrc = productImageSrc(product);
  const rowBusyText = rowState.savingAction === 'save'
    ? '正在保存内容...'
    : rowState.savingAction === 'status'
      ? '正在切换状态...'
      : rowState.savingAction === 'archive'
        ? '正在归档...'
        : '';
  const activeAssignmentsInEdit = activeWebsiteAssignments(assignments);
  const hasPublishedWebsite = activeAssignmentsInEdit.some((assignment) => assignment.status === 'published');
  const selectedProductCategoryPath = [selectedLevel1, selectedLevel2, selectedLevel3]
    .filter(Boolean)
    .map((item) => item?.name || item?.code)
    .join(' / ');
  const editChecklistItems = buildProductEditChecklist({
    productId: product.id,
    draft,
    selectedProductCategoryPath,
    imageSrc,
    activeAssignments: activeAssignmentsInEdit,
    hasPublishedWebsite,
  });
  const editProgressItems: ProductEditProgressItem[] = [
    {
      label: '产品主数据',
      status: draft.name && draft.model && draft.categoryLevel1Id && draft.categoryLevel2Id ? 'ready' : 'blocked',
      detail: draft.categoryLevel2Id ? (selectedProductCategoryPath || '分类已绑定') : '需补齐名称、型号和二级分类',
      targetId: `product-edit-section-master-${product.id}`,
    },
    {
      label: '官网展示文案',
      status: draft.series && draft.publicSummary && (draft.featureBenefits || draft.sellingPoints) ? 'ready' : 'todo',
      detail: draft.publicSummary ? '摘要与卖点已维护' : '需补官网摘要、卖点和系列',
      targetId: `product-edit-section-website-content-${product.id}`,
    },
    {
      label: '素材详情',
      status: (draft.mainImage || imageSrc) && (draft.officialDetailHtml || draft.manualPdfs.length) ? 'ready' : 'todo',
      detail: draft.mainImage || imageSrc ? '主图已准备，继续核对详情/PDF' : '至少需要主图和详情资料',
      targetId: `product-edit-section-assets-${product.id}`,
    },
    {
      label: '官网目录',
      status: activeAssignmentsInEdit.length ? 'ready' : 'blocked',
      detail: activeAssignmentsInEdit.length ? `已配置 ${activeAssignmentsInEdit.length} 个官网挂载` : '需要选择官网与展示目录',
      targetId: `product-edit-section-website-mapping-${product.id}`,
    },
    {
      label: '发布检查',
      status: hasPublishedWebsite ? 'ready' : 'todo',
      detail: hasPublishedWebsite ? '已有官网发布记录，可回读校验' : '保存后再发布到官网',
      targetId: `product-edit-section-check-${product.id}`,
    },
  ];
  const saveFeedbackPreview = formatSaveChecklistFeedback(editChecklistItems, hasPublishedWebsite);
  const editDialog = canUpdateProduct && editing && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="product-edit-backdrop"
        role="presentation"
        onMouseDown={() => setEditing(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: 'rgba(15, 23, 42, 0.45)',
        }}
      >
        <form
          className="product-edit-modal"
          onSubmit={saveEdit}
          onMouseDown={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`product-edit-title-${product.id}`}
          style={{
            width: 'min(1120px, 100%)',
            maxHeight: 'min(900px, calc(100vh - 48px))',
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr) auto',
            background: 'var(--surface-1)',
            borderRadius: 'var(--r-xl)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--sh-lg)',
            overflow: 'hidden',
          }}
        >
          <header
            className="product-edit-modal-head"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              alignItems: 'flex-start',
              padding: 18,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <p className="t-label">编辑产品</p>
              <h2 id={`product-edit-title-${product.id}`}>{draft.name || product.name || '编辑产品'}</h2>
              <span>{displayBrand(product.brand)} / {product.sku || product.model || product.id}</span>
            </div>
            <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => setEditing(false)} aria-label="关闭编辑产品" disabled={rowState.saving}>
              <X size={15} />
            </button>
          </header>

          <div ref={editBodyRef} className="product-edit-modal-body" style={{ overflow: 'auto', padding: 18, display: 'grid', gap: 14 }}>
            <ProductEditProgressStrip items={editProgressItems} onNavigate={scrollToEditSection} />
            <ProductReadinessChecklistPanel items={editChecklistItems} onNavigate={scrollToEditSection} />

            <section id={`product-edit-section-master-${product.id}`} className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
              <div className="product-edit-section-head">
                <h3>1. 产品主数据</h3>
                <span className="badge badge-grey">产品库必填 · {displayBrand(product.brand)}</span>
              </div>
              <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">品牌</span>
                  <input className="input" value={displayBrand(product.brand)} disabled readOnly />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">产品名称</span>
                  <input className="input" value={draft.name} required onChange={(event) => patchDraft({ name: event.target.value })} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">型号</span>
                  <input className="input" value={draft.model} required onChange={(event) => patchDraft({ model: event.target.value })} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">分类</span>
                  <select className="input" value={draft.category} required onChange={(event) => patchDraft({ category: event.target.value })}>
                    {customCategory && <option value={draft.category}>{productCategoryDisplayLabel(draft.category, productCategoryTree)}</option>}
                    {CATEGORIES.map((category) => (
                      <option key={category.key} value={category.key}>{category.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">系统</span>
                  <input className="input" value={systemDisplayValue} required disabled readOnly title={draft.system} />
                </label>
              </div>
            </section>

            <section id={`product-edit-section-category-${product.id}`} className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
              <div className="product-edit-section-head">
                <h3>产品分类绑定</h3>
                <span className="badge badge-grey">来自产品库分类树，会驱动官网默认映射</span>
              </div>
              {categoryLoading ? (
                <div className="inset" style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 13 }}>正在加载产品分类...</div>
              ) : categoryError ? (
                <div className="inset" role="alert" style={{ padding: 12, color: 'var(--danger)', fontSize: 13 }}>
                  产品分类加载失败：{String((categoryError as Error)?.message || categoryError)}
                </div>
              ) : !productCategoryTree.length ? (
                <div className="inset" style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 13 }}>当前品牌暂无可绑定的产品分类。</div>
              ) : (
                <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span className="t-label">一级分类</span>
                    <select className="input" value={draft.categoryLevel1Id} required onChange={(event) => patchDraft({ categoryLevel1Id: event.target.value, categoryLevel2Id: '', categoryLevel3Id: '' })}>
                      <option value="">请选择一级分类</option>
                      {level1Options.map((item) => <option key={item.id} value={item.id}>{categoryOptionLabel(item)}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span className="t-label">二级分类</span>
                    <select className="input" value={draft.categoryLevel2Id} required disabled={!draft.categoryLevel1Id} onChange={(event) => {
                      const selectedCategory = level2Options.find((item) => item.id === event.target.value) || null;
                      const selectedValue = productCategoryNodeValue(selectedCategory);
                      patchDraft({
                        categoryLevel2Id: event.target.value,
                        categoryLevel3Id: '',
                        ...(selectedValue ? { category: selectedValue, system: selectedValue } : {}),
                      });
                    }}>
                      <option value="">请选择二级分类</option>
                      {level2Options.map((item) => <option key={item.id} value={item.id}>{categoryOptionLabel(item)}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span className="t-label">三级分类（可选）</span>
                    <select className="input" value={draft.categoryLevel3Id} disabled={!draft.categoryLevel2Id} onChange={(event) => {
                      const selectedCategory = level3Options.find((item) => item.id === event.target.value) || selectedLevel2;
                      const selectedValue = productCategoryNodeValue(selectedCategory);
                      patchDraft({
                        categoryLevel3Id: event.target.value,
                        ...(selectedValue ? { category: selectedValue, system: selectedValue } : {}),
                      });
                    }}>
                      <option value="">不选择三级分类</option>
                      {level3Options.map((item) => <option key={item.id} value={item.id}>{categoryOptionLabel(item)}</option>)}
                    </select>
                  </label>
                </div>
              )}
              <p style={{ margin: 0, color: 'var(--t-tertiary)', fontSize: 12 }}>
                当前分类路径：{selectedProductCategoryPath || product.categoryPath || '未完成绑定'}。运营只需要选产品库真实分类，官网目录可自动映射，也可在下方人工覆盖。
              </p>
            </section>

            <div id={`product-edit-section-library-${product.id}`}>
              <ProductLibraryCompletenessFields
                draft={draft}
                disabled={rowState.saving}
                onPatch={patchDraft}
              />
            </div>

            <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
              <div className="product-edit-section-head">
                <h3>产品库内部价格</h3>
                {rowState.dirty && <span className="badge badge-warning">有未保存修改</span>}
              </div>
              <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">产品库目录价</span>
                  <input className="input" type="number" min={0} step="0.01" value={draft.listPrice} disabled={rowState.saving} onChange={(event) => patchDraft({ listPrice: event.target.value })} placeholder="不填则为 0" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">经销商基准价</span>
                  <input className="input" type="number" min={0} step="0.01" value={draft.costPrice} disabled={rowState.saving} onChange={(event) => patchDraft({ costPrice: event.target.value })} placeholder="内部供货/结算参考价，不对官网展示" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">币种</span>
                  <input className="input" value={draft.currency} disabled={rowState.saving} onChange={(event) => patchDraft({ currency: event.target.value || 'CNY' })} placeholder="CNY" />
                </label>
              </div>
              <p style={{ margin: 0, color: 'var(--t-tertiary)', fontSize: 12 }}>
                经销商基准价属于产品库内部价，不会进入官网展示；具体到某个经销商的协议价后续应走价格表/报价模块。
              </p>
            </section>

            <section id={`product-edit-section-website-content-${product.id}`} className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
              <div className="product-edit-section-head">
                <h3>2. 官网展示内容</h3>
                <span className="badge badge-grey">保存产品库公共内容，供官网读取</span>
              </div>
              <div className="inset" style={{ padding: 12, display: 'grid', gap: 4, color: 'var(--t-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--t-primary)' }}>运营填报重点：先确认官网标题/摘要/卖点，再确认价格展示方式，最后检查官网目录挂载。</strong>
                <span>这些内容属于产品事实发布口径；保存产品后，官网挂载仍需要在下一块配置中保存/发布。</span>
              </div>
              <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">公开路径 slug</span>
                  <input className="input" value={draft.publicSlug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => patchDraft({ publicSlug: event.target.value })} placeholder="留空则按 SKU 生成" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">系列</span>
                  <input className="input" value={draft.series} onChange={(event) => patchDraft({ series: event.target.value })} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">英文名</span>
                  <input className="input" value={draft.officialEnglishName} onChange={(event) => patchDraft({ officialEnglishName: event.target.value })} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">标语</span>
                  <input className="input" value={draft.tagline} onChange={(event) => patchDraft({ tagline: event.target.value })} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">官网摘要</span>
                  <input className="input" value={draft.publicSummary} onChange={(event) => patchDraft({ publicSummary: event.target.value })} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">标签</span>
                  <input className="input" value={draft.badges} onChange={(event) => patchDraft({ badges: event.target.value })} placeholder="新品, 高端" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">官网排序</span>
                  <input className="input" type="number" min={0} value={draft.displayOrder} onChange={(event) => patchDraft({ displayOrder: event.target.value })} />
                </label>
              </div>
              <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">官网价格展示方式</span>
                  <select className="input" value={draft.websitePriceDisplayMode} onChange={(event) => patchDraft({ websitePriceDisplayMode: event.target.value })}>
                    <option value="not_shown">不展示价格</option>
                    <option value="show_price">显示官网参考价</option>
                    <option value="price_range">显示价格区间</option>
                    <option value="inquiry">面议</option>
                    <option value="contact_dealer">联系经销商</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">官网参考价</span>
                  <input className="input" type="number" min={0} step="0.01" value={draft.websitePrice} disabled={draft.websitePriceDisplayMode !== 'show_price'} onChange={(event) => patchDraft({ websitePrice: event.target.value })} placeholder="选择显示官网参考价时填写" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">官网最低价</span>
                  <input className="input" type="number" min={0} step="0.01" value={draft.websitePriceMin} disabled={draft.websitePriceDisplayMode !== 'price_range'} onChange={(event) => patchDraft({ websitePriceMin: event.target.value })} placeholder="价格区间最低价" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">官网最高价</span>
                  <input className="input" type="number" min={0} step="0.01" value={draft.websitePriceMax} disabled={draft.websitePriceDisplayMode !== 'price_range'} onChange={(event) => patchDraft({ websitePriceMax: event.target.value })} placeholder="价格区间最高价" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">活动价</span>
                  <input className="input" type="number" min={0} step="0.01" value={draft.promoPrice} onChange={(event) => patchDraft({ promoPrice: event.target.value })} placeholder="可选" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">价格单位</span>
                  <input className="input" value={draft.priceUnit} onChange={(event) => patchDraft({ priceUnit: event.target.value })} placeholder="台 / 套 / 件" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">价格标签</span>
                  <input className="input" value={draft.priceLabel} onChange={(event) => patchDraft({ priceLabel: event.target.value })} placeholder="官网参考价 / 起售价" />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">价格说明</span>
                  <input className="input" value={draft.priceNote} onChange={(event) => patchDraft({ priceNote: event.target.value })} placeholder="例如：最终成交价以经销商报价为准" />
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 22 }}>
                  <input type="checkbox" checked={draft.taxIncluded} onChange={(event) => patchDraft({ taxIncluded: event.target.checked })} />
                  <span className="t-label">价格含税</span>
                </label>
              </div>
              <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">官网功能说明</span>
                  <textarea className="input" rows={4} value={draft.featureBenefits} onChange={(event) => patchDraft({ featureBenefits: event.target.value })} placeholder={'一行一个，例如：\n恒温控制: 出水温度更稳定\n低噪运行: 夜间使用更安静'} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">官网核心亮点</span>
                  <textarea className="input" rows={4} value={draft.highlightMetrics} onChange={(event) => patchDraft({ highlightMetrics: event.target.value })} placeholder={'一行一个，例如：\n热效率: 95%\n适用面积: 80-180m2'} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">官网常见问题</span>
                  <textarea className="input" rows={4} value={draft.faqs} onChange={(event) => patchDraft({ faqs: event.target.value })} placeholder={'一行一个，例如：\n如何安装？: 由授权服务商安装\n质保多久？: 以官网政策为准'} />
                </label>
              </div>
            </section>

            <section id={`product-edit-section-website-mapping-${product.id}`} className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
              <div className="product-edit-section-head">
                <h3>官网目录与发布</h3>
                <span className="badge badge-grey">默认自动映射，也支持人工覆盖</span>
              </div>
              <ProductSitePublishingPanel
                product={product}
                assignments={assignments}
                brandOptions={brandOptions}
                disabled={rowState.saving}
                canPublish={canPublishProduct}
                onNotice={onNotice}
                onChanged={onChanged}
              />
            </section>

            <section id={`product-edit-section-assets-${product.id}`} className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
              <div className="product-edit-section-head">
                <h3>3. 图片 / 素材</h3>
                <span className={draft.mainImage || imageSrc ? 'badge badge-success' : 'badge badge-warning'}>{draft.mainImage ? '已选择新主图' : imageSrc ? '已有主图' : '未上传图片'}</span>
              </div>
              <div className="product-edit-media-panel" style={{ display: 'grid', gridTemplateColumns: '160px minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
                <div className="product-edit-media-thumb" style={{ width: 146, aspectRatio: '1 / 1', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                  {draft.mainImage ? (
                    <img src={draft.mainImage.previewUrl} alt="新产品主图预览" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : imageSrc ? (
                    <img src={imageSrc} alt={product.name || '产品主图'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Image size={28} style={{ color: 'var(--t-tertiary)' }} />
                  )}
                </div>
                <div style={{ display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
                  <p style={{ margin: 0, color: 'var(--t-secondary)', fontSize: 12 }}>编辑产品库主图，保存后同步到产品库素材引用。</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <label className="btn btn-outline btn-sm">
                      <Image size={13} />
                      上传主图
                      <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(event) => {
                        selectEditMainImage(event.target.files?.[0] || null);
                        event.currentTarget.value = '';
                      }} />
                    </label>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={!draft.mainImage || rowState.saving} onClick={() => {
                      if (draft.mainImage) URL.revokeObjectURL(draft.mainImage.previewUrl);
                      patchDraft({ mainImage: null });
                    }}>
                      <X size={13} />
                      取消新图
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section id={`product-edit-section-assets-detail-${product.id}`} className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
              <div className="product-edit-section-head">
                <h3>产品公共详情 / 长图</h3>
                <span className="badge badge-grey">750px 长图</span>
              </div>
              {contentLoading ? (
                <div className="inset" style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 13 }}>正在加载官网产品详情...</div>
              ) : contentError ? (
                <div className="inset" role="alert" style={{ padding: 12, color: 'var(--warning)', fontSize: 13 }}>
                  官网产品详情加载失败；基础信息仍可编辑保存。{String((contentError as Error)?.message || contentError)}
                </div>
              ) : (
                <OfficialProductDetailEditor
                  value={draft.officialDetailHtml}
                  onChange={(officialDetailHtml) => patchDraft({ officialDetailHtml })}
                  entityId={product.sku || product.id}
                  disabled={rowState.saving}
                />
              )}
            </section>
            <section id={`product-edit-section-manuals-${product.id}`} className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
              <div className="product-edit-section-head">
                <h3>产品说明 PDF</h3>
                <span className="badge badge-grey">不限数量</span>
              </div>
              <ProductManualPdfUploader
                manualPdfs={draft.manualPdfs}
                disabled={rowState.saving}
                onChange={(manualPdfs) => patchDraft({ manualPdfs })}
              />
            </section>

            <section id={`product-edit-section-check-${product.id}`} className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
              <div className="product-edit-section-head">
                <h3>4. 发布检查</h3>
                <span className={hasPublishedWebsite ? 'badge badge-success' : 'badge badge-warning'}>
                  {hasPublishedWebsite ? '已有官网发布' : '待发布'}
                </span>
              </div>
              <ProductReadinessChecklistPanel
                items={editChecklistItems}
                title="发布前资料清单"
                compact
                saveMode={Boolean(rowState.success)}
                onNavigate={scrollToEditSection}
              />
              <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                {editProgressItems.map((item) => (
                  <MappingCheckItem
                    key={item.label}
                    label={item.label}
                    value={item.status === 'ready' ? '已就绪' : item.status === 'blocked' ? '需先处理' : '建议补齐'}
                    tone={item.status === 'ready' ? 'success' : item.status === 'blocked' ? 'warning' : 'info'}
                    note={item.detail}
                  />
                ))}
              </div>
              <div className="inset" style={{ padding: 12, color: rowState.success ? 'var(--success)' : 'var(--t-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                {rowState.success || saveFeedbackPreview}
              </div>
              {rowState.error ? <div className="inset" role="alert" style={{ padding: 12, color: 'var(--danger)', fontSize: 13 }}>{rowState.error}</div> : null}
            </section>
          </div>

          <footer
            className="product-edit-modal-actions"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 18, borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
          >
            <span className={rowState.dirty ? 'badge badge-warning' : 'badge badge-grey'}>{rowState.dirty ? '有未保存修改' : '无未保存修改'}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)} disabled={rowState.saving}>
                <X size={13} />
                取消
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                if (draft.mainImage) URL.revokeObjectURL(draft.mainImage.previewUrl);
                draft.manualPdfs.forEach((manual) => {
                  if (manual.file && manual.previewUrl.startsWith('blob:')) URL.revokeObjectURL(manual.previewUrl);
                });
                setDraft(editDraftFromProduct(product));
                setRowState({ dirty: false, saving: false, success: '', error: '' });
              }} disabled={rowState.saving}>
                重置内容
              </button>
              <button type="submit" className="btn btn-brand btn-sm" disabled={rowState.saving || !rowState.dirty}>
                {rowState.saving ? '保存中...' : '保存内容'}
              </button>
            </div>
          </footer>
        </form>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      {editDialog}
      {floatingDialog}
      <tr className={selected ? 'is-selected' : undefined}>
        {showSelectionColumn ? (
          <td>
            <input
              type="checkbox"
              checked={selected}
              disabled={selectionDisabled}
              onChange={(event) => onSelectionChange(event.target.checked)}
              aria-label={`选择 ${product.name || product.sku || '产品库产品'}`}
            />
          </td>
        ) : null}
        <td>
          <div style={{ minWidth: 0, fontWeight: 800 }}>
            {product.categoryPath ||
              websiteCategory ||
              product.category ||
              '未分类'}
          </div>
        </td>
        <td>
          {libraryMeta.pilot === true ? (
            <div style={{ marginBottom: 6 }}>
              <StatusPill tone="info">试导入</StatusPill>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
            {rowState.dirty && <span className="badge badge-warning">有未保存修改</span>}
            {rowBusyText && <span className="badge badge-info">{rowBusyText}</span>}
          </div>
          <h3
            style={{
              margin: 0,
              color: 'var(--t-primary)',
              fontSize: 15,
              lineHeight: 1.32,
              fontWeight: 800,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
            title={product.name}
          >
            {product.name}
          </h3>
        </td>
        <td>
          <div style={{ display: 'grid', gap: 5, minWidth: 150 }}>
            <span className="mono-cell" title="产品型号">{product.model || '待补齐'}</span>
            <span style={{ color: 'var(--t-tertiary)', fontSize: 11 }}>SKU · <span className="mono-cell">{product.sku || '待补齐'}</span></span>
          </div>
        </td>
        <td>
          <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>{text(brandMeta.series || libraryMeta.series) || '待补齐'}</span>
        </td>
        <td>
          {readiness.status ? (
            <div style={{ display: 'grid', gap: 5, minWidth: 150 }} title={readiness.details}>
              <StatusPill tone={readiness.status === 'needs_completion' ? 'warning' : 'success'}>
                {readiness.status === 'needs_completion' ? '待补全' : '资料就绪'}
              </StatusPill>
              <span style={{ color: 'var(--t-secondary)', fontSize: 11 }}>{readiness.ready} / {readiness.total} 个维度就绪</span>
              {reviewNotes.length ? (
                <span style={{ color: 'var(--warning)', fontSize: 11, lineHeight: 1.35 }} title={reviewNotes.join('\n')}>
                  {reviewNotes[0]}
                </span>
              ) : null}
            </div>
          ) : (
            <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>未评估</span>
          )}
        </td>
        <td>
          <span className="pill-brand" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayBrand(product.brand)}
          </span>
        </td>
        <td>
          <ProductCatalogImagePreview src={imageSrc} alt={product.name || product.model || '产品图片'} />
        </td>
        <td>
          <StatusPill tone={statusTone(product.status)}>
            {statusLabel(product.status)}
          </StatusPill>
        </td>
        <td>
          <WebsiteShelfSummaryCell assignments={assignments} productBrand={product.brand} />
        </td>
        {canUpdateProduct || canPublishProduct || canDeleteProduct ? (
          <td style={{ textAlign: 'right' }}>
            <div className="table-row-actions product-catalog-row-actions">
              {canUpdateProduct && (
                <button
                  type="button"
                  className="btn btn-brand btn-sm"
                  onClick={() => setEditing(true)}
                  disabled={rowState.saving}
                >
                  <Edit3 size={14} />
                  {rowState.savingAction === 'save' ? '保存中' : '编辑'}
                </button>
              )}
              {canPublishProduct && product.status !== 'archived' && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => changeStatus(statusTarget)}
                  disabled={rowState.saving}
                >
                  {rowState.savingAction === 'status' ? '处理中' : statusTarget === 'active' ? '启用' : '停用'}
                </button>
              )}
              {canDeleteProduct && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={archiveProduct}
                  disabled={rowState.saving || product.status === 'archived'}
                >
                  <Archive size={14} />
                  {rowState.savingAction === 'archive' ? '归档中' : '归档'}
                </button>
              )}
            </div>
          </td>
        ) : null}
      </tr>

      {(rowState.success || rowState.error) && (
        <tr>
          <td colSpan={feedbackColSpan}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {rowState.success && (
                <span className="badge badge-success" role="status" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                  <CheckCircle2 size={13} />
                  {rowState.success}
                </span>
              )}
              {rowState.error && (
                <span className="badge badge-warning" role="alert" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                  <XCircle size={13} />
                  {rowState.error}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

type ProductSitePublishingDraft = {
  siteCode: string;
  publicSlug: string;
  siteProductCategoryId: string;
  websiteCategory: string;
  websiteCategoryPath: string;
  displayOrder: string;
  isFeatured: boolean;
  siteTitle: string;
  siteSummary: string;
  tags: string;
  series: string;
};

function productSitePublishingDefaults(product: NormalizedProduct, siteCode = normalizeBrand(product.brand)): ProductSitePublishingDraft {
  const siteMeta = objectOrEmpty(objectOrEmpty(product.raw?.meta)[siteCode]);
  const brandMeta = Object.keys(siteMeta).length ? siteMeta : productBrandMeta(product);
  const libraryMeta = productLibraryMeta(product);
  const firstSellingPoint = Array.isArray(libraryMeta.sellingPoints) ? text(libraryMeta.sellingPoints[0]) : '';
  const baseSlug = text(brandMeta.slug) || text(product.sku) || text(product.model) || text(product.id);
  const badges = Array.isArray(brandMeta.badges) ? brandMeta.badges.map(text).filter(Boolean) : [];
  return {
    siteCode,
    publicSlug: slug(baseSlug),
    siteProductCategoryId: '',
    websiteCategory: '',
    websiteCategoryPath: '',
    displayOrder: String(nonNegativeInt(brandMeta.displayOrder ?? brandMeta.sortOrder ?? 0)),
    isFeatured: Boolean(brandMeta.isFeatured),
    siteTitle: text(brandMeta.name || product.name),
    siteSummary: text(brandMeta.tagline || firstSellingPoint),
    tags: badges.join(', '),
    series: text(brandMeta.series || libraryMeta.series),
  };
}

function productSitePublishingDraftFromAssignment(product: NormalizedProduct, assignment?: WebsiteShelfAssignment, siteCode?: string): ProductSitePublishingDraft {
  const defaults = productSitePublishingDefaults(product, siteCode || assignment?.siteCode || normalizeBrand(product.brand));
  const meta = objectOrEmpty(assignment?.siteMeta);
  const metaCategory = objectOrEmpty(meta.siteProductCategory);
  return {
    ...defaults,
    siteCode: assignment?.siteCode || defaults.siteCode,
    publicSlug: text(assignment?.publicSlug) || defaults.publicSlug,
    siteProductCategoryId: text(assignment?.siteProductCategoryId || metaCategory.id),
    websiteCategory: text(assignment?.websiteCategory) || defaults.websiteCategory,
    websiteCategoryPath: text(meta.websiteCategoryPath || metaCategory.path || assignment?.websiteCategory),
    displayOrder: String(nonNegativeInt(assignment?.displayOrder ?? defaults.displayOrder)),
    isFeatured: Boolean(assignment?.isFeatured),
    siteTitle: text(assignment?.siteTitle) || defaults.siteTitle,
    siteSummary: text(assignment?.siteSummary) || defaults.siteSummary,
    tags: Array.isArray(meta.tags) ? meta.tags.map(text).filter(Boolean).join(', ') : defaults.tags,
    series: text(meta.series) || defaults.series,
  };
}

function productSitePublishingPayload(product: NormalizedProduct, draft: ProductSitePublishingDraft, options: { includeProductRef?: boolean; suggestion?: SitePublishingSuggestion | null } = {}): Record<string, unknown> {
  const publicSlug = slug(draft.publicSlug);
  const siteProductCategoryId = text(draft.siteProductCategoryId);
  const suggestedCategoryId = text(options.suggestion?.suggestedWebsiteCategory?.id);
  const suggestedCategory = text(options.suggestion?.suggestedWebsiteCategory?.name);
  const suggestedCategoryPath = text(options.suggestion?.suggestedWebsiteCategory?.path || options.suggestion?.suggestedWebsiteCategory?.name);
  const suggestedSeries = text(options.suggestion?.suggestedSeries?.value);
  if (!publicSlug) throw new Error('请填写官网 URL slug。');
  if (!siteProductCategoryId) throw new Error('请选择官网目录。');
  return {
    ...(options.includeProductRef === false ? {} : {
      productId: product.id,
      productTenantId: tenantIdForProduct(product) || PRODUCT_LIBRARY_TENANT_ID,
    }),
    publicSlug,
    siteProductCategoryId,
    websiteCategory: text(draft.websiteCategory),
    displayOrder: nonNegativeInt(draft.displayOrder),
    isFeatured: Boolean(draft.isFeatured),
    siteTitle: text(draft.siteTitle) || null,
    siteSummary: text(draft.siteSummary) || null,
    siteMeta: {
      series: text(draft.series),
      tags: splitBadges(draft.tags),
      defaultWebsiteCategory: suggestedCategory || null,
      defaultWebsiteCategoryPath: suggestedCategoryPath || null,
      defaultSiteProductCategoryId: suggestedCategoryId || null,
      websiteCategoryPath: text(draft.websiteCategoryPath) || text(draft.websiteCategory),
      websiteCategorySource: suggestedCategoryId && siteProductCategoryId !== suggestedCategoryId ? 'manual' : (options.suggestion?.suggestedWebsiteCategory?.matchReason || 'manual'),
      productCategoryBinding: options.suggestion?.productCategory || productCategoryBinding(product),
      defaultSeries: suggestedSeries || null,
      seriesSource: suggestedSeries && text(draft.series) !== suggestedSeries ? 'manual' : (options.suggestion?.suggestedSeries?.source || 'manual'),
    },
  };
}

function siteCategorySelectOptions(rows: SiteProductCategoryRow[]): SiteProductCategorySelectOption[] {
  const byId = new Map(rows.filter((row) => text(row.id)).map((row) => [text(row.id), row]));
  const isSelectable = (row: SiteProductCategoryRow, seen = new Set<string>()): boolean => {
    const id = text(row.id);
    if (id && seen.has(id)) return false;
    if (id) seen.add(id);
    if (row.status === 'inactive' || row.isVisible === false) return false;
    const parentId = text(row.parentId);
    if (!parentId) return true;
    const parent = byId.get(parentId);
    return Boolean(parent && isSelectable(parent, seen));
  };
  const tree = buildSiteProductCategoryTree(rows.filter((row) => isSelectable(row)));
  const out: SiteProductCategorySelectOption[] = [];
  const visit = (items: SiteProductCategoryTreeNode[], parentPath = '') => {
    items.forEach((item) => {
      const value = text(item.id);
      const name = text(item.name || item.websiteCategory);
      const path = [parentPath, name].filter(Boolean).join(' / ');
      if (value) {
        out.push({
          value,
          name,
          path,
          code: text(item.code),
          label: `${'　'.repeat(Math.max(0, (item.level || 1) - 1))}${path}`,
        });
      }
      if (item.children?.length) visit(item.children, path);
    });
  };
  visit(tree);
  return out;
}

function publicProjectionPath(product: Record<string, any> | null): string {
  if (!product) return '';
  return text(product.websiteCategoryPath || objectOrEmpty(product.siteMeta).websiteCategoryPath || product.websiteCategory);
}

function ProductPublicProjectionReadback({
  product,
  siteCode,
  productTenantId,
  publicSlug,
  expectedCategoryPath,
  status,
  refreshVersion,
  variant = 'line',
}: {
  product: NormalizedProduct;
  siteCode: string;
  productTenantId: string;
  publicSlug?: string | null;
  expectedCategoryPath: string;
  status?: AssignmentStatus | null;
  refreshVersion: number;
  variant?: 'line' | 'panel';
}) {
  const normalizedSiteCode = normalizeBrand(siteCode);
  const { data, isLoading, error } = useSWR(
    normalizedSiteCode && product.id
      ? ['/api/v2/sites/products/public-projection', normalizedSiteCode, product.id, productTenantId, refreshVersion]
      : null,
    async () => publicSiteProducts.list(normalizedSiteCode, {
      locale: 'zh-CN',
      productId: product.id,
      sku: text(product.sku) || undefined,
    }),
    { revalidateOnFocus: false },
  );
  const publicProduct = publicSiteProductItems(data)[0] || null;
  const publicCategoryPath = publicProjectionPath(publicProduct);
  const matches = Boolean(publicProduct && expectedCategoryPath && publicCategoryPath === expectedCategoryPath);
  const isPublished = status === 'published';
  const statusText = isLoading
    ? '校验中...'
    : error
      ? '读取失败'
      : publicProduct
        ? (publicCategoryPath || '未返回目录')
        : isPublished
          ? '已发布但公开接口未找到'
          : '未发布或公开接口未找到';
  const tone = error || (isPublished && (!publicProduct || !matches)) ? 'var(--warning)' : publicProduct ? 'var(--success)' : 'var(--t-tertiary)';
  const matchText = publicProduct ? (matches ? '一致' : '与后台保存不一致') : '';

  if (variant === 'panel') {
    return (
      <div className="inset" style={{ padding: 10, display: 'grid', gap: 4, color: 'var(--t-secondary)', fontSize: 12 }}>
        <strong style={{ color: 'var(--t-primary)', fontSize: 12 }}>公开官网回读</strong>
        <span>后台准备保存目录：{expectedCategoryPath || '未选择'}</span>
        <span>公开接口当前目录：{statusText}</span>
        {publicProduct ? <span>公开 URL slug：{text(publicProduct.slug || publicSlug) || '未返回'}</span> : null}
        <span style={{ color: tone }}>{publicProduct ? (matches ? '公开接口与后台目录一致' : '公开接口与后台目录不一致，保存/发布后请刷新校验') : statusText}</span>
      </div>
    );
  }

  return (
    <span>
      公开官网接口：{statusText}
      {matchText ? <span style={{ color: tone, marginLeft: 6 }}>{matchText}</span> : null}
    </span>
  );
}

function OverrideHint({ value, fallback }: { value: string; fallback: string }) {
  const overridden = text(value) && text(value) !== text(fallback);
  return <span className={overridden ? 'badge badge-info' : 'badge badge-grey'}>{overridden ? '官网覆盖' : '产品库默认'}</span>;
}

function ProductSitePublishingPanel({
  product,
  assignments,
  brandOptions,
  disabled,
  canPublish,
  onNotice,
  onChanged,
}: {
  product: NormalizedProduct;
  assignments: WebsiteShelfAssignment[];
  brandOptions: Array<{ value: ProductBrand; label: string }>;
  disabled: boolean;
  canPublish: boolean;
  onNotice: (text: string) => void;
  onChanged: () => Promise<unknown>;
}) {
  const liveAssignments = assignments.filter((assignment) => !assignment.deletedAt);
  const configuredSites = new Set(liveAssignments.map((assignment) => normalizeBrand(assignment.siteCode)));
  const productBrandSite = normalizeBrand(product.brand);
  const preferredSite = brandOptions.find((option) => normalizeBrand(option.value) === productBrandSite && !configuredSites.has(productBrandSite));
  const firstAvailableSite = (preferredSite || brandOptions.find((option) => !configuredSites.has(normalizeBrand(option.value))) || brandOptions[0])?.value || productBrandSite;
  const [editing, setEditing] = useState<WebsiteShelfAssignment | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<ProductSitePublishingDraft>(() => productSitePublishingDraftFromAssignment(product, undefined, firstAvailableSite));
  const [saving, setSaving] = useState(false);
  const [publicReadbackVersion, setPublicReadbackVersion] = useState(0);
  const activeSiteCode = normalizeBrand(draft.siteCode || editing?.siteCode || firstAvailableSite);
  const defaults = productSitePublishingDefaults(product, activeSiteCode);
  const { data: categoryData, isLoading: categoryLoading, error: categoryError } = useSWR(
    activeSiteCode ? ['/api/v2/brand-sites/product-categories/select', activeSiteCode] : null,
    async () => siteProductCategories.list(activeSiteCode, { selectable: true }) as Promise<SiteProductCategoryResponse>,
    { revalidateOnFocus: false },
  );
  const categoryOptions = useMemo(() => siteCategorySelectOptions(categoryData?.items || []), [categoryData]);
  const categoryOptionById = useMemo(() => new Map(categoryOptions.map((option) => [option.value, option])), [categoryOptions]);
  const showEditor = Boolean(creating || editing);
  const productTenantId = tenantIdForProduct(product) || PRODUCT_LIBRARY_TENANT_ID;
  const { data: publishingSuggestion, isLoading: suggestionLoading } = useSWR(
    showEditor && activeSiteCode && product.id ? ['/api/v2/brand-sites/product-categories/suggestion', activeSiteCode, product.id, productTenantId] : null,
    async () => siteProductCategories.suggestion(activeSiteCode, { productId: product.id, productTenantId }) as Promise<SitePublishingSuggestion>,
    { revalidateOnFocus: false },
  );
  const selectedWebsiteCategory = categoryOptionById.get(text(draft.siteProductCategoryId));
  const suggestedWebsiteCategory = text(publishingSuggestion?.suggestedWebsiteCategory?.name);
  const suggestedWebsiteCategoryId = text(publishingSuggestion?.suggestedWebsiteCategory?.id);
  const suggestedWebsiteCategoryPath = text(publishingSuggestion?.suggestedWebsiteCategory?.path || publishingSuggestion?.suggestedWebsiteCategory?.name);
  const suggestedSeries = text(publishingSuggestion?.suggestedSeries?.value);
  const currentWebsiteCategoryPath = text(selectedWebsiteCategory?.path || draft.websiteCategoryPath || draft.websiteCategory);
  const websiteCategoryOverridden = Boolean(suggestedWebsiteCategoryId && text(draft.siteProductCategoryId) && text(draft.siteProductCategoryId) !== suggestedWebsiteCategoryId);
  const websiteCategoryMappingMode = websiteCategoryOverridden || !suggestedWebsiteCategoryId ? 'manual' : 'auto';
  const seriesOverridden = Boolean(suggestedSeries && text(draft.series) && text(draft.series) !== suggestedSeries);

  useEffect(() => {
    if (!showEditor || !publishingSuggestion) return;
    const nextCategoryId = text(publishingSuggestion.suggestedWebsiteCategory?.id);
    const nextCategory = text(publishingSuggestion.suggestedWebsiteCategory?.name);
    const nextCategoryPath = text(publishingSuggestion.suggestedWebsiteCategory?.path || nextCategory);
    const nextSeries = text(publishingSuggestion.suggestedSeries?.value);
    setDraft((current) => ({
      ...current,
      siteProductCategoryId: text(current.siteProductCategoryId) ? current.siteProductCategoryId : nextCategoryId || current.siteProductCategoryId,
      websiteCategory: text(current.websiteCategory) ? current.websiteCategory : nextCategory || current.websiteCategory,
      websiteCategoryPath: text(current.websiteCategoryPath) ? current.websiteCategoryPath : nextCategoryPath || current.websiteCategoryPath,
      series: text(current.series) ? current.series : nextSeries || current.series,
    }));
  }, [showEditor, publishingSuggestion]);

  function applyWebsiteCategory(categoryId: string) {
    const option = categoryOptionById.get(categoryId);
    setDraft((current) => ({
      ...current,
      siteProductCategoryId: categoryId,
      websiteCategory: option?.name || '',
      websiteCategoryPath: option?.path || '',
    }));
  }

  function applyAutoWebsiteCategory() {
    if (!suggestedWebsiteCategoryId) return;
    setDraft((current) => ({
      ...current,
      siteProductCategoryId: suggestedWebsiteCategoryId,
      websiteCategory: suggestedWebsiteCategory,
      websiteCategoryPath: suggestedWebsiteCategoryPath,
    }));
  }

  function startCreate() {
    const siteCode = (preferredSite || brandOptions.find((option) => !configuredSites.has(normalizeBrand(option.value))) || brandOptions[0])?.value || productBrandSite;
    setEditing(null);
    setCreating(true);
    setDraft(productSitePublishingDraftFromAssignment(product, undefined, siteCode));
  }

  function startEdit(assignment: WebsiteShelfAssignment) {
    setCreating(false);
    setEditing(assignment);
    setDraft(productSitePublishingDraftFromAssignment(product, assignment, assignment.siteCode));
  }

  async function saveAssignment() {
    if (!activeSiteCode || saving || disabled) return;
    setSaving(true);
    try {
      const payload = productSitePublishingPayload(product, draft, { includeProductRef: !editing?.id, suggestion: publishingSuggestion });
      if (editing?.id) await siteProductAssignments.update(activeSiteCode, editing.id, payload);
      else await siteProductAssignments.create(activeSiteCode, payload);
      onNotice(editing?.id ? '官网展示配置已更新。' : '官网展示配置已新增。');
      onNotice(editing?.id ? '官网展示配置已更新；如果状态还是草稿，请点击“发布”后官网才会展示。' : '官网展示配置已保存为草稿；请点击卡片上的“发布”后官网才会展示。');
      setEditing(null);
      setCreating(false);
      await onChanged();
      setPublicReadbackVersion((version) => version + 1);
    } catch (error) {
      onNotice((error as Error)?.message || '保存官网展示配置失败。');
    } finally {
      setSaving(false);
    }
  }

  async function changeAssignmentStatus(assignment: WebsiteShelfAssignment, next: 'published' | 'hidden') {
    const siteCode = normalizeBrand(assignment.siteCode);
    if (!siteCode || !assignment.id || saving || disabled) return;
    setSaving(true);
    try {
      if (next === 'published') await siteProductAssignments.publish(siteCode, assignment.id);
      else await siteProductAssignments.hide(siteCode, assignment.id);
      onNotice(next === 'published' ? '已发布到官网。' : '已从官网隐藏。');
      await onChanged();
      setPublicReadbackVersion((version) => version + 1);
    } catch (error) {
      onNotice((error as Error)?.message || '官网上下架操作失败。');
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(assignment: WebsiteShelfAssignment) {
    const siteCode = normalizeBrand(assignment.siteCode);
    if (!siteCode || !assignment.id || saving || disabled) return;
    if (typeof window !== 'undefined' && !window.confirm(`确认移除 ${displayBrand(siteCode)} 的官网挂载配置？`)) return;
    setSaving(true);
    try {
      await siteProductAssignments.archive(siteCode, assignment.id);
      onNotice('官网挂载配置已移除。');
      if (editing?.id === assignment.id) {
        setEditing(null);
        setCreating(false);
      }
      await onChanged();
      setPublicReadbackVersion((version) => version + 1);
    } catch (error) {
      onNotice((error as Error)?.message || '移除官网挂载配置失败。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <p style={{ margin: 0, color: 'var(--t-secondary)', fontSize: 12 }}>
          一个产品可以挂载到多个官网；每个官网独立维护目录、slug、排序、推荐和展示文案。
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={startCreate} disabled={disabled || saving || brandOptions.every((option) => configuredSites.has(normalizeBrand(option.value)))}>
          <Plus size={13} />
          添加官网
        </button>
      </div>

      {liveAssignments.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 10 }}>
          {liveAssignments.map((assignment) => {
            const assignmentMeta = objectOrEmpty(assignment.siteMeta);
            const categoryMeta = objectOrEmpty(assignmentMeta.siteProductCategory);
            const assignmentCategoryPath = text(assignmentMeta.websiteCategoryPath || categoryMeta.path || assignment.websiteCategory);
            const visibleReason = assignment.status === 'published'
              ? '保存后已发布，官网会展示。'
              : assignment.status === 'hidden'
                ? '当前已隐藏，官网不会展示；点击发布后才展示。'
                : '当前为草稿，官网不会展示；点击发布后才展示。';
            return (
            <div key={assignment.id} className="inset" style={{ padding: 12, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <strong>{displayBrand(normalizeBrand(assignment.siteCode))}</strong>
                <StatusPill tone={websitePublishingStatusMeta(assignment).tone}>{websitePublishingStatusMeta(assignment).label}</StatusPill>
              </div>
              <div style={{ display: 'grid', gap: 4, color: 'var(--t-secondary)', fontSize: 12 }}>
                <span>目录：{assignmentCategoryPath || '未选择'}</span>
                <span>slug：{text(assignment.publicSlug) || productSitePublishingDefaults(product, assignment.siteCode).publicSlug}</span>
                <span>排序：{nonNegativeInt(assignment.displayOrder)} {assignment.isFeatured ? ' / 推荐' : ''}</span>
                <ProductPublicProjectionReadback
                  product={product}
                  siteCode={assignment.siteCode || productBrandSite}
                  productTenantId={assignment.productTenantId || productTenantId}
                  publicSlug={assignment.publicSlug}
                  expectedCategoryPath={assignmentCategoryPath}
                  status={assignment.status}
                  refreshVersion={publicReadbackVersion}
                />
                <span style={{ color: assignment.status === 'published' ? 'var(--success)' : 'var(--t-tertiary)' }}>{visibleReason}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(assignment)} disabled={disabled || saving}>配置</button>
                {canPublish && assignment.status !== 'published' ? (
                  <button type="button" className="btn btn-brand btn-sm" onClick={() => changeAssignmentStatus(assignment, 'published')} disabled={disabled || saving}>发布</button>
                ) : null}
                {canPublish && assignment.status === 'published' ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeAssignmentStatus(assignment, 'hidden')} disabled={disabled || saving}>隐藏</button>
                ) : null}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeAssignment(assignment)} disabled={disabled || saving}>移除</button>
              </div>
            </div>
          );})}
        </div>
      ) : (
        <div className="inset" style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 13 }}>
          当前产品还没有官网挂载配置。先点“添加官网”，选择官网目录后保存为草稿，再决定是否发布。
        </div>
      )}

      {showEditor ? (
        <div className="inset" style={{ padding: 14, display: 'grid', gap: 12, borderColor: 'var(--brand-300)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <strong>{editing ? '编辑官网展示配置' : '新增官网展示配置'}</strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(null); setCreating(false); }} disabled={saving}>收起</button>
          </div>
          <div className="inset" style={{ padding: 12, display: 'grid', gap: 8, background: 'var(--surface-subtle, #f8fafc)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>产品库 → 官网展示映射</strong>
              <span className={websiteCategoryOverridden || seriesOverridden ? 'badge badge-info' : 'badge badge-grey'}>
                {websiteCategoryOverridden || seriesOverridden ? '人工覆盖' : suggestionLoading ? '匹配中' : suggestedWebsiteCategory ? '跟随产品库' : '需要手动选择'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 8 }}>
              <MappingCheckItem
                label="产品库分类"
                value={text(publishingSuggestion?.productCategory?.pathLabel) || text(product.categoryPath || product.category)}
                tone={text(publishingSuggestion?.productCategory?.pathLabel || product.categoryPath || product.category) ? 'success' : 'warning'}
                note="默认映射会参考一级与末级分类"
              />
              <MappingCheckItem
                label="系统建议"
                value={suggestionLoading ? '匹配中...' : suggestedWebsiteCategoryPath || '未找到映射'}
                tone={suggestedWebsiteCategoryPath ? 'success' : suggestionLoading ? 'info' : 'warning'}
                note={suggestedWebsiteCategoryPath ? '可一键恢复自动映射' : '需要手动选择官网目录'}
              />
              <MappingCheckItem
                label="当前保存"
                value={currentWebsiteCategoryPath || '未选择'}
                tone={draft.siteProductCategoryId ? (websiteCategoryOverridden ? 'info' : 'success') : 'warning'}
                note={websiteCategoryOverridden ? '人工覆盖' : suggestedWebsiteCategoryId && draft.siteProductCategoryId ? '跟随默认' : '保存会要求选择目录'}
              />
              <MappingCheckItem
                label="展示判断"
                value={draft.siteProductCategoryId ? '目录有效' : '未选择官网目录'}
                tone={draft.siteProductCategoryId ? 'success' : 'warning'}
                note={editing?.status === 'published' ? '已发布后官网可见' : '保存为草稿后仍需发布'}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className={websiteCategoryMappingMode === 'auto' ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'}
                disabled={saving || disabled || suggestionLoading || !suggestedWebsiteCategoryId}
                onClick={applyAutoWebsiteCategory}
              >
                自动映射
              </button>
              <span className={websiteCategoryMappingMode === 'manual' ? 'badge badge-info' : 'badge badge-grey'}>手动选择可覆盖</span>
              <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>默认跟随产品库分类；下方选择其他官网目录后按人工映射保存。</span>
            </div>
          </div>
          <ProductPublicProjectionReadback
            product={product}
            siteCode={activeSiteCode}
            productTenantId={productTenantId}
            publicSlug={draft.publicSlug || editing?.publicSlug || defaults.publicSlug}
            expectedCategoryPath={currentWebsiteCategoryPath}
            status={editing?.status || null}
            refreshVersion={publicReadbackVersion}
            variant="panel"
          />
          <div className="product-edit-field-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">官网</span>
              <select className="input" value={draft.siteCode} disabled={Boolean(editing) || saving || disabled} onChange={(event) => setDraft(productSitePublishingDraftFromAssignment(product, undefined, event.target.value))}>
                {brandOptions.map((option) => (
                  <option key={option.value} value={option.value} disabled={!editing && configuredSites.has(normalizeBrand(option.value))}>{option.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">官网目录 <span className={websiteCategoryMappingMode === 'manual' ? 'badge badge-info' : 'badge badge-grey'}>{websiteCategoryMappingMode === 'manual' ? '手动映射' : '自动映射'}</span></span>
              <select className="input" value={draft.siteProductCategoryId} disabled={saving || disabled || categoryLoading} onChange={(event) => applyWebsiteCategory(event.target.value)}>
                <option value="">{categoryLoading ? '目录加载中...' : '请选择官网目录'}</option>
                {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>默认用系统建议目录；需要特殊陈列时在这里手动选择官网目录。</span>
              {categoryError ? <span style={{ color: 'var(--warning)', fontSize: 12 }}>官网目录加载失败，请先检查目录管理。</span> : null}
              {!categoryError && !categoryLoading && !categoryOptions.length ? <span style={{ color: 'var(--warning)', fontSize: 12 }}>当前官网还没有后台目录树，请先到官网目录管理维护。</span> : null}
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">官网系列</span>
              <input className="input" value={draft.series} disabled={saving || disabled} placeholder={suggestedSeries || '未维护官网系列'} onChange={(event) => setDraft((current) => ({ ...current, series: event.target.value }))} />
              <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>{suggestedSeries ? '默认跟随产品库系列；改写后按人工覆盖保存。' : '产品库尚未维护系列，可先留空。'}</span>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">URL slug <OverrideHint value={draft.publicSlug} fallback={defaults.publicSlug} /></span>
              <input className="input" value={draft.publicSlug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" disabled={saving || disabled} onChange={(event) => setDraft((current) => ({ ...current, publicSlug: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">官网标题 <OverrideHint value={draft.siteTitle} fallback={defaults.siteTitle} /></span>
              <input className="input" value={draft.siteTitle} disabled={saving || disabled} onChange={(event) => setDraft((current) => ({ ...current, siteTitle: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">排序</span>
              <input className="input" type="number" min="0" max="999999" value={draft.displayOrder} disabled={saving || disabled} onChange={(event) => setDraft((current) => ({ ...current, displayOrder: event.target.value }))} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">推荐</span>
              <span className="toggle-row" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 38 }}>
                <input type="checkbox" checked={draft.isFeatured} disabled={saving || disabled} onChange={(event) => setDraft((current) => ({ ...current, isFeatured: event.target.checked }))} />
                <span>在该官网推荐展示</span>
              </span>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">官网标签 <OverrideHint value={draft.tags} fallback={defaults.tags} /></span>
              <input className="input" value={draft.tags} disabled={saving || disabled} placeholder="新品, 推荐" onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} />
            </label>
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">官网摘要/卖点 <OverrideHint value={draft.siteSummary} fallback={defaults.siteSummary} /></span>
            <textarea className="input" rows={3} value={draft.siteSummary} disabled={saving || disabled} onChange={(event) => setDraft((current) => ({ ...current, siteSummary: event.target.value }))} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled={saving || disabled} onClick={() => setDraft((current) => ({
              ...productSitePublishingDraftFromAssignment(product, editing || undefined, activeSiteCode),
              siteProductCategoryId: suggestedWebsiteCategoryId || current.siteProductCategoryId,
              websiteCategory: suggestedWebsiteCategory || current.websiteCategory,
              websiteCategoryPath: suggestedWebsiteCategoryPath || current.websiteCategoryPath,
              series: suggestedSeries || current.series,
            }))}>恢复默认映射</button>
            <button type="button" className="btn btn-brand btn-sm" disabled={saving || disabled} onClick={saveAssignment}>{saving ? '保存中...' : '保存官网配置'}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OfficialProductDetailEditor({
  value,
  onChange,
  entityId,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  entityId: string;
  disabled?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastValueRef = useRef(value);
  const [uploading, setUploading] = useState(false);
  const { alertFloating, promptFloating, floatingDialog } = useFloatingDialog();

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (lastValueRef.current !== value) {
      editor.innerHTML = value || '';
      lastValueRef.current = value;
    }
    void hydrateOfficialDetailEditorImages(editor);
  }, [value]);

  function commit() {
    const next = serializeOfficialDetailEditorHtml(editorRef.current);
    lastValueRef.current = next;
    onChange(next);
  }

  function run(command: string, commandValue?: string) {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    commit();
  }

  function insertHtml(html: string) {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    commit();
  }

  async function addLink() {
    const href = await promptFloating({
      title: '插入链接',
      message: '请输入链接地址',
      placeholder: 'https://',
      confirmLabel: '插入',
    });
    if (!href) return;
    const nextHref = href.trim();
    if (!nextHref) return;
    run('createLink', nextHref);
  }

  function addTable() {
    insertHtml('<table><tbody><tr><th>参数</th><th>说明</th></tr><tr><td>型号</td><td></td></tr></tbody></table>');
  }

  async function uploadImages(files: FileList | null) {
    const selected = Array.from(files || []);
    if (!selected.length || disabled || uploading) return;
    const invalid = selected.find((file) => !/^image\/(png|jpe?g|webp)$/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name));
    if (invalid) {
      await alertFloating({ title: '图片格式不支持', message: '仅支持 png、jpg、jpeg、webp 格式的详情图片。' });
      return;
    }
    setUploading(true);
    try {
      for (const file of selected) {
        const dataBase64 = await readBrowserFileBase64(file);
        const artifact = await fileArtifacts.uploadBase64({
          entityType: 'product-official-detail-image',
          entityId: entityId || 'product-detail',
          filename: file.name,
          mimeType: file.type || 'image/jpeg',
          dataBase64,
        });
        const artifactId = text((artifact as any)?.id || (artifact as any)?.artifactId);
        const url = text((artifact as any)?.contentUrl) || artifactContentUrl(artifactId);
        if (!url) throw new Error('图片上传未返回可访问地址。');
        const dataUrl = `data:${file.type || 'image/jpeg'};base64,${dataBase64}`;
        insertHtml(`<img src="${escapeProductDetailHtml(dataUrl)}" ${PRODUCT_DETAIL_ARTIFACT_SRC_ATTR}="${escapeProductDetailHtml(productDetailPersistentImageSrc(url))}" alt="${escapeProductDetailHtml(file.name)}" loading="lazy">`);
      }
    } catch (e) {
      await alertFloating({ title: '详情图片上传失败', message: (e as Error)?.message || '详情图片上传失败。' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="official-product-detail-editor">
      <div className="official-product-detail-editor-toolbar" aria-label="官网产品详情格式工具栏">
        <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => run('formatBlock', 'h2')} title="标题" aria-label="标题" disabled={disabled}>
          <Heading2 size={13} />
        </button>
        <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => run('bold')} title="加粗" aria-label="加粗" disabled={disabled}>
          <Bold size={13} />
        </button>
        <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => run('italic')} title="斜体" aria-label="斜体" disabled={disabled}>
          <Italic size={13} />
        </button>
        <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => run('insertUnorderedList')} title="项目列表" aria-label="项目列表" disabled={disabled}>
          <List size={13} />
        </button>
        <button type="button" className="btn btn-outline btn-sm icon-only" onClick={() => run('insertOrderedList')} title="编号列表" aria-label="编号列表" disabled={disabled}>
          <ListOrdered size={13} />
        </button>
        <button type="button" className="btn btn-outline btn-sm icon-only" onClick={addTable} title="插入参数表" aria-label="插入参数表" disabled={disabled}>
          <Table2 size={13} />
        </button>
        <button type="button" className="btn btn-outline btn-sm icon-only" onClick={addLink} title="插入链接" aria-label="插入链接" disabled={disabled}>
          <Link size={13} />
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()} disabled={disabled || uploading}>
          <Image size={13} />
          {uploading ? '上传中' : '详情图'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          multiple
          style={{ display: 'none' }}
          onChange={(event) => uploadImages(event.target.files)}
        />
      </div>
      <div
        ref={editorRef}
        className="official-product-detail-editor-body"
        contentEditable={!disabled}
        role="textbox"
        aria-label="官网产品详情富文本编辑器"
        data-placeholder="编辑官网产品详情，可插入宽度 750px 的长图、参数表、标题、段落和链接。"
        suppressContentEditableWarning
        onInput={commit}
        onBlur={commit}
        onPaste={(event) => {
          event.preventDefault();
          const html = event.clipboardData.getData('text/html');
          const plain = event.clipboardData.getData('text/plain');
          insertHtml(html ? sanitizeOfficialProductDetailHtml(html) : escapeProductDetailHtml(plain).replace(/\n/g, '<br>'));
        }}
        dangerouslySetInnerHTML={{ __html: value || '' }}
      />
      <p style={{ margin: 0, color: 'var(--t-tertiary)', fontSize: 12 }}>
        建议上传宽度 750px 的详情图片，高度不限；官网移动端会等比例缩放。
      </p>
      {floatingDialog}
      <style jsx>{`
        .official-product-detail-editor {
          display: grid;
          gap: 8px;
          min-width: 0;
        }
        .official-product-detail-editor-toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          padding: 8px;
          border: 1px solid var(--border);
          border-radius: 8px 8px 0 0;
          background: var(--surface-2);
        }
        .official-product-detail-editor-body {
          min-height: 260px;
          max-height: 680px;
          overflow: auto;
          padding: 14px;
          border: 1px solid var(--border);
          border-top: 0;
          border-radius: 0 0 8px 8px;
          background: #fff;
          color: var(--t-primary);
          line-height: 1.68;
          outline: none;
        }
        .official-product-detail-editor-body:empty::before {
          content: attr(data-placeholder);
          color: var(--t-tertiary);
        }
        .official-product-detail-editor-body :global(img) {
          display: block;
          width: 100%;
          max-width: 750px;
          height: auto;
          margin: 12px auto;
        }
        .official-product-detail-editor-body :global(table) {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 13px;
        }
        .official-product-detail-editor-body :global(th),
        .official-product-detail-editor-body :global(td) {
          border: 1px solid var(--border);
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
        }
        .official-product-detail-editor-body :global(h2),
        .official-product-detail-editor-body :global(h3),
        .official-product-detail-editor-body :global(h4),
        .official-product-detail-editor-body :global(p),
        .official-product-detail-editor-body :global(ul),
        .official-product-detail-editor-body :global(ol) {
          margin: 0 0 10px;
        }
        :global(.product-floating-dialog-backdrop) {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 34px 20px;
          background: rgba(15, 23, 42, 0.12);
        }
        :global(.product-floating-dialog) {
          width: min(448px, calc(100vw - 32px));
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          background: var(--surface-1);
          box-shadow: var(--sh-lg);
        }
        :global(.product-floating-dialog.is-danger) {
          border-color: rgba(200, 32, 44, .28);
        }
        :global(.product-floating-dialog header),
        :global(.product-floating-dialog footer) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 18px;
        }
        :global(.product-floating-dialog header) {
          border-bottom: 1px solid var(--border);
        }
        :global(.product-floating-dialog h2) {
          margin: 2px 0 0;
          color: var(--t-primary);
          font-size: 16px;
          font-weight: 900;
        }
        :global(.product-floating-dialog-body) {
          display: grid;
          gap: 14px;
          padding: 18px;
        }
        :global(.product-floating-dialog-body p) {
          margin: 0;
          color: var(--t-secondary);
          font-size: 14px;
          line-height: 1.7;
        }
        :global(.product-floating-dialog footer) {
          justify-content: flex-end;
          border-top: 1px solid var(--border);
          background: var(--surface-2);
        }
      `}</style>
    </div>
  );
}

function MetaBlock({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div style={{ minWidth: 0, display: 'grid', alignContent: 'center', gap: compact ? 3 : 4 }}>
      <p className="t-label" style={compact ? { fontSize: 11 } : undefined}>
        {label}
      </p>
      <p
        style={{
          margin: 0,
          color: 'var(--t-primary)',
          fontSize: compact ? 12 : 13,
          lineHeight: 1.35,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: compact ? 'nowrap' : 'normal',
          overflowWrap: compact ? undefined : 'anywhere',
        }}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function ProductCatalogImagePreview({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className="product-catalog-image-preview"
        title={src ? '图片加载失败' : '暂无产品图片'}
        style={{
          width: 44,
          height: 38,
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)',
          background: 'var(--surface-2)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--t-tertiary)',
        }}
      >
        <Package size={16} />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="product-catalog-image-preview"
        onClick={() => setPreviewOpen(true)}
        title="点击查看大图"
        style={{
          width: 44,
          height: 38,
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-sm)',
          background: 'var(--surface-2)',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          padding: 0,
          cursor: 'zoom-in',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </button>
      {previewOpen && <ProductCatalogImageLightbox src={src} alt={alt} onClose={() => setPreviewOpen(false)} />}
    </>
  );
}

function ProductCatalogImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        padding: 24,
        background: 'rgba(0, 0, 0, 0.72)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onClose}
        aria-label="关闭图片预览"
        style={{
          position: 'fixed',
          top: 18,
          right: 18,
          color: '#fff',
          background: 'rgba(255, 255, 255, 0.12)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
        }}
      >
        <X size={16} />
        关闭
      </button>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          maxWidth: 'min(920px, 92vw)',
          maxHeight: '86vh',
          padding: 12,
          borderRadius: 'var(--r-xl)',
          background: '#fff',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.32)',
        }}
      >
        {failed ? (
          <div style={{ width: 520, maxWidth: '80vw', padding: 32, color: 'var(--t-secondary)', textAlign: 'center' }}>
            图片加载失败
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            onError={() => setFailed(true)}
            style={{ maxWidth: 'calc(92vw - 48px)', maxHeight: 'calc(86vh - 24px)', objectFit: 'contain', display: 'block' }}
          />
        )}
      </div>
    </div>
  );
}

function ProductManualPdfUploader({
  manualPdfs,
  disabled,
  onChange,
}: {
  manualPdfs: ProductManualPdfDraft[];
  disabled: boolean;
  onChange: (manualPdfs: ProductManualPdfDraft[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function addFiles(files: FileList | null) {
    const selected = Array.from(files || []).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (!selected.length) return;
    onChange([
      ...manualPdfs,
      ...selected.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name,
        mimeType: file.type || 'application/pdf',
        previewUrl: URL.createObjectURL(file),
        saved: false,
      })),
    ]);
  }

  function removeManual(id: string) {
    const target = manualPdfs.find((manual) => manual.id === id);
    if (target?.file && target.previewUrl.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl);
    onChange(manualPdfs.filter((manual) => manual.id !== id));
  }

  return (
    <div className="product-manual-pdf-uploader">
      <div className="product-manual-pdf-upload-row">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <UploadPdfIcon />
          选择文件
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(event) => {
            addFiles(event.target.files);
            event.currentTarget.value = '';
          }}
        />
        <div className="product-manual-pdf-inline-list">
          {manualPdfs.length ? (
            manualPdfs.map((manual, index) => (
              <ProductManualPdfItem
                key={manual.id}
                manual={manual}
                index={index}
                disabled={disabled}
                onRemove={() => removeManual(manual.id)}
              />
            ))
          ) : (
            <span className="product-manual-pdf-empty">未选择文件</span>
          )}
        </div>
      </div>
      <style jsx>{`
        .product-manual-pdf-uploader {
          display: grid;
          gap: 8px;
        }
        .product-manual-pdf-upload-row {
          min-height: 42px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-1);
        }
        .product-manual-pdf-inline-list {
          min-width: 0;
          flex: 1 1 auto;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .product-manual-pdf-empty {
          color: var(--t-secondary);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function ProductManualPdfItem({
  manual,
  index,
  disabled,
  onRemove,
}: {
  manual: ProductManualPdfDraft;
  index: number;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="product-manual-pdf-chip">
      <strong>{index + 1}. {manual.name}</strong>
      <a className="btn btn-brand btn-sm" href={manual.previewUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={13} />
        预览
      </a>
      <button
        type="button"
        className="product-manual-pdf-remove"
        onClick={onRemove}
        disabled={disabled}
        title="移除"
        aria-label={`移除 ${manual.name}`}
      >
        <X size={12} />
      </button>
      <style jsx>{`
        .product-manual-pdf-chip {
          position: relative;
          min-width: 0;
          max-width: 100%;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 26px 8px 12px;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          background: var(--surface-2);
        }
        .product-manual-pdf-chip strong {
          min-width: 0;
          max-width: min(420px, 50vw);
          overflow: hidden;
          color: var(--t-primary);
          font-size: 13px;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .product-manual-pdf-remove {
          position: absolute;
          top: 3px;
          right: 3px;
          width: 18px;
          height: 18px;
          display: inline-grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--t-tertiary);
          cursor: pointer;
        }
        .product-manual-pdf-remove:hover:not(:disabled) {
          background: rgba(200, 32, 44, 0.1);
          color: var(--brand);
        }
        .product-manual-pdf-remove:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
      `}</style>
    </div>
  );
}

function UploadPdfIcon() {
  return <FileText size={13} />;
}

function EmptyCatalogState({
  type = 'empty',
  title,
  description,
  onReset,
}: {
  type?: 'empty' | 'error';
  title: string;
  description: string;
  onReset: () => void;
}) {
  return (
    <WorkbenchTableState
      type={type}
      title={title}
      description={description}
      action={
        <button type="button" className="btn btn-outline btn-sm" onClick={onReset}>
          清空筛选
        </button>
      }
    />
  );
}
function ProductGrid({
  products: items,
  onReset,
}: {
  products: NormalizedProduct[];
  onReset: () => void;
}) {
  if (!items.length) {
    return (
      <div
        className="card-elevated"
        style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--t-secondary)' }}
      >
        <p style={{ fontSize: 14, fontWeight: 600 }}>当前筛选下暂无产品</p>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ marginTop: 12 }}
          onClick={onReset}
        >
          查看全部产品
        </button>
      </div>
    );
  }

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 14,
      }}
    >
      {items.map((product) => {
        const stock = STOCK[product.stock];
        return (
          <article key={product.id} className="card-elevated" style={{ padding: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span className="pill-neutral">{product.brand}</span>
                  {product.isNew && <span className="pill-brand">新品</span>}
                </div>
                <h2
                  style={{
                    marginTop: 10,
                    color: 'var(--t-primary)',
                    fontSize: 16,
                    lineHeight: 1.35,
                    fontWeight: 700,
                  }}
                >
                  {product.name}
                </h2>
              </div>
              <span className={`badge ${stock.className}`} style={{ flexShrink: 0 }}>
                {stock.label}
              </span>
            </div>

            <div
              style={{
                marginTop: 8,
                minHeight: 56,
                color: 'var(--t-secondary)',
                fontSize: 12,
                lineHeight: 1.55,
              }}
            >
              <p>{product.model || '标准型号'}</p>
              <p>{product.spec || '参数待同步'}</p>
            </div>

            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid var(--border)',
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
                  指导价 {fmt(product.marketPrice)}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    color: 'var(--brand)',
                    fontSize: 22,
                    lineHeight: 1.1,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt(product.dealerPrice)}
                </div>
              </div>
              <span
                style={{
                  color: 'var(--success)',
                  background: 'var(--success-bg)',
                  border: '1px solid rgba(120,157,74,0.22)',
                  borderRadius: 'var(--r-lg)',
                  padding: '4px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                毛利 {pct(product.marginRate)}
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ProductMaterialsView({ products: items }: { products: NormalizedProduct[] }) {
  const rows = items.map((product) => {
    const raw = product.raw || {};
    const assetRefs = Array.isArray(raw.assetRefs) ? raw.assetRefs : [];
    const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
    const positioning = raw.positioning && typeof raw.positioning === 'object' ? raw.positioning : {};
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
        <h2 className="t-headline" style={{ marginTop: 4 }}>产品资料管理</h2>
        <p style={{ marginTop: 6, color: 'var(--t-secondary)', fontSize: 13 }}>
          管理每个产品编码的图片素材、定位资料和官网展示基础信息。
        </p>
      </div>
      <div className="g4" style={{ gap: 12, padding: 16 }}>
        <Metric label="已挂素材" value={`${withAssets}/${items.length}`} hint="assetRefs 或旧主图" />
        <Metric label="主图就绪" value={`${withMainImage}/${items.length}`} hint="官网卡片可展示" />
        <Metric label="定位资料" value={`${withPositioning}/${items.length}`} hint="人群/场景/卖点" />
        <Metric label="待补资料" value={String(Math.max(0, items.length - withMainImage))} hint="优先补主图与摘要" />
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
                  <div style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>{row.product.model}</div>
                </td>
                <td>{row.product.brand}</td>
                <td>{row.assetCount} 个素材</td>
                <td><span className={row.hasMainImage ? 'badge badge-success' : 'badge badge-warning'}>{row.hasMainImage ? '已就绪' : '待补充'}</span></td>
                <td><span className={row.hasPositioning ? 'badge badge-success' : 'badge badge-warning'}>{row.hasPositioning ? '已填写' : '待填写'}</span></td>
                <td><span className={row.hasSeoBase ? 'badge badge-success' : 'badge badge-warning'}>{row.hasSeoBase ? '可生成' : '待完善'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </WorkbenchTableShell>
    </section>
  );
}

function ProductCategoryManagerView() {
  const [brandCode, setBrandCode] = useState<ProductBrand>('rheem');
  const { data, error, isLoading } = useSWR(
    ['/api/v2/brand-product-categories', brandCode],
    async () => {
      try {
        const result = await brandProductCategories.list({ brandCode });
        return { tree: normalizeProductCategoryTree(result), apiUnavailable: false };
      } catch (e) {
        const status = Number((e as Error & { status?: number })?.status || 0);
        if (status === 404 || status === 405 || status === 501) {
          return { tree: [], apiUnavailable: true };
        }
        throw e;
      }
    },
    { revalidateOnFocus: false }
  );
  const tree = data?.tree || [];
  const flat = useMemo(() => flattenCategoryTree(tree), [tree]);
  const activeCount = flat.filter((item) => item.status !== 'inactive').length;
  const levelCounts = [1, 2, 3].map((level) => flat.filter((item) => item.level === level).length);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="card-elevated" style={{ padding: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <p className="t-label">Product Category Manager</p>
            <h2 className="t-headline" style={{ marginTop: 4 }}>
              产品分类
            </h2>
            <p style={{ marginTop: 6, color: 'var(--t-secondary)', fontSize: 13, overflowWrap: 'anywhere' }}>
              按品牌查看独立分类树。本页仅提供管理入口和树形展示，新增、编辑、停用、删除会在后续 CRUD issue 中接入。
            </p>
          </div>
          <span
            className={
              error
                ? 'badge badge-warning'
                : data?.apiUnavailable
                  ? 'badge badge-grey'
                  : isLoading
                    ? 'badge badge-grey'
                    : 'badge badge-success'
            }
            title={error ? String((error as Error)?.message || error) : undefined}
            style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}
          >
            {error
              ? '分类加载失败'
              : data?.apiUnavailable
                ? '分类 API 未接入'
                : isLoading
                  ? '分类加载中'
                  : '分类已同步'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <span style={{ color: 'var(--t-secondary)', fontSize: 12, fontWeight: 600, marginRight: 2 }}>
            品牌
          </span>
          {DEFAULT_CREATE_BRAND_OPTIONS.map((item) => (
            <CategoryChip
              key={item.value}
              active={brandCode === item.value}
              onClick={() => setBrandCode(item.value)}
            >
              {item.label}
            </CategoryChip>
          ))}
        </div>
      </section>

      <section className="g4" style={{ gap: 12 }}>
        <Metric label="一级分类" value={String(levelCounts[0])} hint="品牌顶层菜单" />
        <Metric label="二级分类" value={String(levelCounts[1])} hint="系统或菜单分组" />
        <Metric label="三级分类" value={String(levelCounts[2])} hint="可选细分层级" />
        <Metric label="启用分类" value={String(activeCount)} hint="当前可用于后续绑定" />
      </section>

      <section className="card-elevated" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 18, borderBottom: '1px solid var(--border)' }}>
          <p className="t-label">{displayBrand(brandCode)}</p>
          <h3 className="t-headline" style={{ marginTop: 4 }}>
            分类树
          </h3>
        </div>
        {isLoading ? (
          <WorkbenchTableState
            type="loading"
            title="正在加载分类树"
            description="正在读取当前品牌的一、二、三级产品分类。"
          />
        ) : error ? (
          <WorkbenchTableState
            type="error"
            title="分类树暂时不可用"
            description={String((error as Error)?.message || error)}
          />
        ) : data?.apiUnavailable ? (
          <WorkbenchTableState
            type="empty"
            title="分类 API 尚未接入"
            description="已预留产品分类页面、品牌切换和三级树区域；接口可用后会读取真实分类数据。"
          />
        ) : tree.length ? (
          <CategoryTreeSurface tree={tree} />
        ) : (
          <WorkbenchTableState
            type="empty"
            title="当前品牌暂无分类"
            description="分类树为空，后续可在 CRUD 能力接入后创建一级、二级和三级分类。"
          />
        )}
      </section>
    </div>
  );
}

function flattenCategoryTree(tree: ProductCategoryNode[]): ProductCategoryNode[] {
  return tree.flatMap((item) => [item, ...flattenCategoryTree(item.children)]);
}

function activeCategoryOptions(items: ProductCategoryNode[], selected?: ProductCategoryNode | null): ProductCategoryNode[] {
  const options = items.filter((item) => item.status !== 'inactive');
  if (selected && !options.some((item) => item.id === selected.id)) return [...options, selected];
  return options;
}

function categoryOptionLabel(item: ProductCategoryNode): string {
  return `${item.name || item.code}${item.status === 'inactive' ? '（已停用）' : ''}`;
}

function CategoryTreeSurface({ tree }: { tree: ProductCategoryNode[] }) {
  return (
    <div style={{ display: 'grid', gap: 10, padding: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 1.1fr) minmax(160px, 1fr) minmax(160px, 1fr)',
          gap: 10,
          color: 'var(--t-tertiary)',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <span>Level 1 · 一级</span>
        <span>Level 2 · 二级</span>
        <span>Level 3 · 三级</span>
      </div>
      {tree.map((node) => (
        <CategoryTreeRow key={node.id} node={node} />
      ))}
    </div>
  );
}

function CategoryTreeRow({ node }: { node: ProductCategoryNode }) {
  const secondLevel = node.children.length ? node.children : [];
  return (
    <div
      className="inset"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 1.1fr) minmax(160px, 1fr) minmax(160px, 1fr)',
        gap: 10,
        alignItems: 'stretch',
      }}
    >
      <CategoryNodeCard node={node} />
      <div style={{ display: 'grid', gap: 8 }}>
        {secondLevel.length ? (
          secondLevel.map((child) => <CategoryNodeCard key={child.id} node={child} />)
        ) : (
          <CategoryLevelPlaceholder label="未设置二级分类" />
        )}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {secondLevel.some((child) => child.children.length) ? (
          secondLevel.flatMap((child) =>
            child.children.map((grandchild) => (
              <CategoryNodeCard key={grandchild.id} node={grandchild} parentName={child.name} />
            ))
          )
        ) : (
          <CategoryLevelPlaceholder label="未设置三级分类" />
        )}
      </div>
    </div>
  );
}

function CategoryNodeCard({ node, parentName }: { node: ProductCategoryNode; parentName?: string }) {
  return (
    <div
      style={{
        minWidth: 0,
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        background: '#FFFFFF',
        padding: '10px 12px',
        boxShadow: 'var(--sh-xs)',
      }}
    >
      {parentName ? (
        <p style={{ color: 'var(--t-tertiary)', fontSize: 11, overflowWrap: 'anywhere' }}>{parentName}</p>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: 13 }}>{node.name || node.code}</strong>
        <StatusPill tone={node.status === 'inactive' ? 'warning' : 'success'}>
          {node.status === 'inactive' ? '停用' : '启用'}
        </StatusPill>
        <StatusPill tone={node.showOnWebsite ? 'info' : 'neutral'}>
          {node.showOnWebsite ? '允许官网映射' : '不参与官网映射'}
        </StatusPill>
      </div>
      <p style={{ marginTop: 5, color: 'var(--t-tertiary)', fontSize: 11, overflowWrap: 'anywhere' }}>
        {node.code || '未设置编码'} · 排序 {node.sortOrder}
      </p>
    </div>
  );
}

function CategoryLevelPlaceholder({ label }: { label: string }) {
  return (
    <div
      style={{
        minHeight: 60,
        border: '1px dashed var(--border-2)',
        borderRadius: 'var(--r-lg)',
        color: 'var(--t-tertiary)',
        background: 'var(--surface-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        fontSize: 12,
        textAlign: 'center',
      }}
    >
      {label}
    </div>
  );
}

export function ProductCategoryManagerCrudView({
  canCreate,
  canUpdate,
  canDelete,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const canWrite = canCreate || canUpdate || canDelete;
  const [brandCode] = useState<ProductBrand>('common');
  const [siteCode, setSiteCode] = useState<ProductBrand>('everhot');
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<'edit' | 'create'>('edit');
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ProductCategoryDraft>(emptyCategoryDraft());
  const [usage, setUsage] = useState<ProductCategoryUsage | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'base' | 'website'>('base');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [childrenByParent, setChildrenByParent] = useState<Record<string, ProductCategoryNode[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<Record<string, boolean>>({});
  const { confirmFloating, floatingDialog } = useFloatingDialog();
  const activeSiteCode = siteCode;
  const activeBrandLabel = displayBrand(siteCode);
  const { data, error, isLoading, mutate } = useSWR(
    ['/api/v2/brand-product-categories', brandCode, 'all', 'crud'],
    async () => {
      const result = await brandProductCategories.list({ brandCode, metrics: 'false' });
      return { tree: normalizeProductCategoryTree(result) };
    },
    { revalidateOnFocus: false },
  );
  const {
    data: websiteCategoryData,
    error: websiteCategoryError,
    isLoading: websiteCategoryLoading,
    mutate: mutateWebsiteCategories,
  } = useSWR<SiteProductCategoryResponse>(
    activeCategoryTab === 'website' ? ['/api/v2/brand-sites', activeSiteCode, 'product-categories'] : null,
    async () => siteProductCategories.list(activeSiteCode) as Promise<SiteProductCategoryResponse>,
    { revalidateOnFocus: false },
  );
  const tree = data?.tree || [];
  const allCategoryRows = useMemo(() => flattenCategoryTree(tree), [tree]);
  const flat = useMemo(
    () => flattenLazyCategoryRows(tree, expandedIds, childrenByParent),
    [childrenByParent, expandedIds, tree],
  );
  const selected = flat.find((item) => item.id === selectedId) || null;
  const createParent = createParentId ? flat.find((item) => item.id === createParentId) || null : null;
  const createLevel = createParent ? createParent.level + 1 : 1;
  const activeCount = allCategoryRows.filter((item) => item.status !== 'inactive').length;
  const loadedCount = allCategoryRows.length;

  useEffect(() => {
    setSelectedId('');
    setMode('edit');
    setCreateParentId(null);
    setEditorOpen(false);
    setDraft(emptyCategoryDraft());
    setUsage(null);
    setNotice('');
    setActionError('');
    setExpandedIds(new Set());
    setChildrenByParent({});
    setLoadingChildren({});
  }, [brandCode]);

  useEffect(() => {
    if (mode === 'edit' && selected) setDraft(categoryDraftFromNode(selected));
  }, [mode, selected?.id]);

  useEffect(() => {
    let cancelled = false;
    setUsage(null);
    if (!editorOpen || !selected || mode !== 'edit') return () => { cancelled = true; };
    brandProductCategories.usage(selected.id)
      .then((result) => {
        if (!cancelled) setUsage({
          boundProductCount: Number(result?.boundProductCount || 0),
          childCategoryCount: Number(result?.childCategoryCount || 0),
        });
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      });
    return () => { cancelled = true; };
  }, [editorOpen, mode, selected?.id]);

  function selectCategory(node: ProductCategoryNode) {
    setSelectedId(node.id);
    setMode('edit');
    setCreateParentId(null);
    setEditorOpen(true);
    setDraft(categoryDraftFromNode(node));
    setNotice('');
    setActionError('');
  }

  async function loadChildren(parent: ProductCategoryNode, force = false) {
    if (!force && childrenByParent[parent.id]) return;
    setLoadingChildren((current) => ({ ...current, [parent.id]: true }));
    try {
      const result = await brandProductCategories.list({ brandCode, parentId: parent.id, metrics: 'false' });
      const rows = normalizeProductCategoryTree(result);
      setChildrenByParent((current) => ({ ...current, [parent.id]: rows }));
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setLoadingChildren((current) => ({ ...current, [parent.id]: false }));
    }
  }

  async function refreshVisibleCategoryRows(target: ProductCategoryNode | null) {
    await mutate();
    if (!target?.parentId) return;
    const parent = flat.find((item) => item.id === target.parentId);
    if (parent) await loadChildren(parent, true);
  }

  async function toggleExpand(node: ProductCategoryNode) {
    const hasEmbeddedChildren = node.children.length > 0;
    if (!node.hasChildren && !node.childCategoryCount && !hasEmbeddedChildren) return;
    const next = new Set(expandedIds);
    if (next.has(node.id)) {
      next.delete(node.id);
      setExpandedIds(next);
      return;
    }
    next.add(node.id);
    setExpandedIds(next);
    if (!hasEmbeddedChildren) await loadChildren(node);
  }

  function startCreate(parent: ProductCategoryNode | null) {
    if (false) {
      setActionError('产品目录最多支持三级，不能新增四级分类。');
      return;
    }
    setMode('create');
    setCreateParentId(parent?.id || null);
    setEditorOpen(true);
    setDraft(emptyCategoryDraft(
      nextCategorySortOrder(parent),
      internalCategoryCode(parent?.code || 'cat'),
    ));
    setNotice('');
    setActionError('');
  }

  function nextCategorySortOrder(parent: ProductCategoryNode | null): number {
    if (!parent) return tree.length;
    return childrenByParent[parent.id]?.length ?? parent.childCategoryCount ?? 0;
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setActionError('');
    try {
      const payload = categoryDraftPayload(draft);
      if (mode === 'create') {
        const saved = await brandProductCategories.create({
          ...payload,
          brandCode,
          parentId: createParentId,
        });
        setSelectedId(text(saved?.id));
        setMode('edit');
        setCreateParentId(null);
        setEditorOpen(false);
        if (createParentId && createParent) {
          setExpandedIds((current) => new Set([...current, createParentId]));
          await loadChildren(createParent, true);
        }
        setNotice('分类已创建。');
      } else if (selected) {
        const saved = await brandProductCategories.update(selected.id, payload);
        setSelectedId(text(saved?.id || selected.id));
        setEditorOpen(false);
        setNotice('分类已保存。');
      }
      await refreshVisibleCategoryRows(mode === 'edit' ? selected : null);
    } catch (e) {
      const message = errorMessage(e);
      setActionError(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategoryStatus() {
    if (!selected) return;
    const nextStatus = selected.status === 'inactive' ? 'active' : 'inactive';
    setSaving(true);
    setNotice('');
    setActionError('');
    try {
      let boundProductCount = usage?.boundProductCount;
      if (nextStatus === 'inactive') {
        if (boundProductCount === undefined) {
          const guard = await brandProductCategories.usage(selected.id);
          boundProductCount = Number(guard?.boundProductCount || 0);
          setUsage({ boundProductCount, childCategoryCount: usage?.childCategoryCount });
        }
        if (boundProductCount > 0) {
          const confirmed = await confirmFloating({
            title: '停用分类',
            message: `当前分类已绑定 ${boundProductCount} 个产品。停用后这些产品仍会保留绑定，但该分类不会作为启用目录使用。确认停用吗？`,
            confirmLabel: '停用',
            tone: 'danger',
          });
          if (!confirmed) return;
        }
      }
      await brandProductCategories.update(selected.id, { status: nextStatus });
      setNotice(nextStatus === 'inactive' ? '分类已停用。' : '分类已启用。');
      await refreshVisibleCategoryRows(selected);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(target: ProductCategoryNode | null = selected) {
    if (!target) return;
    setSaving(true);
    setNotice('');
    setActionError('');
    try {
      const childCategoryCount = target.children.length || Number(usage?.childCategoryCount || target.childCategoryCount || 0);
      if (childCategoryCount > 0) {
        const message = `不能删除：当前分类下面还有 ${childCategoryCount} 个下级分类。请先删除下级分类。`;
        setActionError(message);
        return;
      }
      const guard = await brandProductCategories.usage(target.id);
      const boundProductCount = Number(guard?.boundProductCount || guard?.directProductCount || 0);
      const latestChildCategoryCount = Number(guard?.childCategoryCount || 0);
      const descendantProductCount = Number(guard?.descendantProductCount || guard?.descendantBoundProductCount || 0);
      setUsage({ boundProductCount, childCategoryCount: latestChildCategoryCount });
      if (latestChildCategoryCount > 0) {
        const message = `不能删除：当前分类下面还有 ${latestChildCategoryCount} 个下级分类。请先删除下级分类。`;
        setActionError(message);
        return;
      }
      if (boundProductCount > 0 || descendantProductCount > 0) {
        const message = `不能删除：当前分类已绑定 ${boundProductCount} 个产品。请先迁移或清空产品分类。`;
        setActionError(message);
        return;
      }
      const confirmed = await confirmFloating({
        title: '删除分类',
        message: `确认删除分类“${target.name || target.code}”？`,
        confirmLabel: '删除',
        tone: 'danger',
      });
      if (!confirmed) return;
      await brandProductCategories.remove(target.id);
      setSelectedId('');
      setMode('edit');
      setEditorOpen(false);
      setNotice('分类已删除。');
      await mutate();
      if (target.parentId) {
        setChildrenByParent((current) => {
          const next = { ...current };
          next[target.parentId!] = (next[target.parentId!] || []).filter((item) => item.id !== target.id);
          return next;
        });
      }
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="card-elevated" style={{ padding: 18, borderRadius: 'var(--r-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <p className="t-label">基础资料 / 产品分类</p>
            <h2 className="t-headline" style={{ marginTop: 4 }}>公共产品分类与官网目录管理</h2>
            <p style={{ marginTop: 6, color: 'var(--t-secondary)', fontSize: 13, overflowWrap: 'anywhere' }}>
              这里维护的是公共产品库的事实分类，用于产品录入、导入、筛选和经销商 API 输出；不是官网栏目。
              官网目录用于给产品库提供官网栏目选项；产品归属、URL、推荐、官网文案和图片都在产品库维护。
            </p>
          </div>
          <span className={error ? 'badge badge-warning' : isLoading ? 'badge badge-grey' : 'badge badge-success'}>
            {error ? '加载失败' : isLoading ? '同步中' : '已同步'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <span style={{ color: 'var(--t-secondary)', fontSize: 12, fontWeight: 600, marginRight: 2 }}>当前基座</span>
          <span className="badge badge-info">公共产品库</span>
          <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>所有品牌产品录入、导入、筛选共用这一套分类。</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
            gap: 10,
            marginTop: 14,
          }}
        >
          <div className="inset" style={{ padding: 12 }}>
            <strong style={{ display: 'block', fontSize: 13 }}>先建分类，再录产品</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--t-secondary)', fontSize: 12 }}>产品录入页会直接读取这里的分类树，运营人员不用手工重复输入分类名称。</p>
          </div>
          <div className="inset" style={{ padding: 12 }}>
            <strong style={{ display: 'block', fontSize: 13 }}>停用不破坏历史数据</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--t-secondary)', fontSize: 12 }}>分类停用后，历史产品仍保留绑定；新产品录入时不再推荐使用。</p>
          </div>
          <div className="inset" style={{ padding: 12 }}>
            <strong style={{ display: 'block', fontSize: 13 }}>官网目录只搭骨架</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--t-secondary)', fontSize: 12 }}>这里只维护官网目录树；产品选择哪个官网目录，回到产品库或上架配置中完成。</p>
          </div>
        </div>
      </section>

      <section
        className="card-elevated"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 16px',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <div>
          <p className="t-label">当前产品基座分类</p>
          <strong style={{ display: 'block', marginTop: 3 }}>公共产品库</strong>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <CategoryCountPill label="已加载" value={loadedCount} />
          <CategoryCountPill label="根节点" value={tree.length} />
          <CategoryCountPill label="启用" value={activeCount} tone="success" />
        </div>
      </section>

      <section className="card-elevated" style={{ padding: 14, borderRadius: 'var(--r-lg)' }}>
        <div role="tablist" aria-label="产品分类管理范围" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategoryTab === 'base'}
            className={activeCategoryTab === 'base' ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'}
            onClick={() => setActiveCategoryTab('base')}
          >
            产品基座分类
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategoryTab === 'website'}
            className={activeCategoryTab === 'website' ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'}
            onClick={() => setActiveCategoryTab('website')}
          >
            官网目录管理
          </button>
        </div>
        <p style={{ margin: '10px 0 0', color: 'var(--t-secondary)', fontSize: 12, overflowWrap: 'anywhere' }}>
          产品基座分类是全产品库统一事实分类；官网目录管理只维护每个官网的栏目树，作为产品库发布配置的可选目录。
        </p>
      </section>

      {notice ? <span className="badge badge-success" style={{ justifySelf: 'start' }}>{notice}</span> : null}
      {actionError ? <span className="badge badge-warning" style={{ justifySelf: 'start', overflowWrap: 'anywhere' }}>{actionError}</span> : null}

      <section style={{ display: 'grid', gap: 16, alignItems: 'start' }}>
        {editorOpen ? (
          <div
            role="presentation"
            onClick={() => {
              if (!saving) {
                setEditorOpen(false);
                setMode('edit');
                setCreateParentId(null);
                setDraft(selected ? categoryDraftFromNode(selected) : emptyCategoryDraft());
                setActionError('');
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              display: 'grid',
              alignItems: 'center',
              justifyItems: 'center',
              padding: 24,
              background: 'rgba(15, 23, 42, 0.28)',
              overflow: 'auto',
            }}
          >
          <div role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} style={{ width: 'min(100%, 640px)' }}>
            <CategoryCrudEditor
              mode={mode}
              brandCode={brandCode}
              selected={selected}
              createParent={createParent}
              createLevel={createLevel}
              draft={draft}
              usage={usage}
              actionError={actionError}
              saving={saving}
              canWrite={canWrite}
              onDraft={setDraft}
              onSave={saveCategory}
              onToggleStatus={toggleCategoryStatus}
              onDelete={deleteCategory}
              onClose={() => {
                setEditorOpen(false);
                setMode('edit');
                setCreateParentId(null);
                setDraft(selected ? categoryDraftFromNode(selected) : emptyCategoryDraft());
                setActionError('');
              }}
            />
          </div>
          </div>
        ) : null}

        {activeCategoryTab === 'base' ? (
        <div className="card-elevated" style={{ overflow: 'hidden', borderRadius: 'var(--r-lg)', width: '100%', justifySelf: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 18, borderBottom: '1px solid var(--border)' }}>
            <div>
              <p className="t-label">{displayBrand(brandCode)}</p>
              <h3 className="t-headline" style={{ marginTop: 4 }}>产品基座分类树</h3>
            </div>
            {canCreate && (
              <button type="button" className="btn btn-brand btn-sm" onClick={() => startCreate(null)} disabled={saving || isLoading}>
                <Plus size={14} />
                新增根分类
              </button>
            )}
          </div>
          {isLoading ? (
            <WorkbenchTableState type="loading" title="正在加载产品基座分类" description="正在读取公共产品库的一、二、三级分类。" />
          ) : error ? (
            <WorkbenchTableState type="error" title="产品基座分类暂时不可用" description={String((error as Error)?.message || error)} />
          ) : tree.length ? (
            <CategoryCrudTreePanel
              rows={flat}
              selectedId={selected?.id || ''}
              expandedIds={expandedIds}
              loadingChildren={loadingChildren}
              saving={saving}
              canWrite={canWrite}
              onToggleExpand={toggleExpand}
              onSelect={selectCategory}
              onAddChild={startCreate}
              onDelete={deleteCategory}
            />
          ) : (
            <WorkbenchTableState
              type="empty"
              title="公共产品库还没有产品基座分类"
              description="先创建一级分类，再在一级下维护二级系统，三级分类可按需补充。"
              action={canCreate ? (
                <button type="button" className="btn btn-brand btn-sm" onClick={() => startCreate(null)} disabled={!canWrite || saving}>
                  <Plus size={14} />
                  新增根分类
                </button>
              ) : undefined}
            />
          )}
        </div>
        ) : (
        <SiteProductCategoryCrudPanel
          siteCode={activeSiteCode}
          brandLabel={activeBrandLabel}
          onSiteCodeChange={setSiteCode}
          data={websiteCategoryData}
          loading={websiteCategoryLoading}
          error={websiteCategoryError}
          canWrite={canWrite}
          onChanged={mutateWebsiteCategories}
        />
        )}

      </section>
      {floatingDialog}
    </div>
  );
}

function SiteProductCategoryCrudPanel({
  siteCode,
  brandLabel,
  onSiteCodeChange,
  data,
  loading,
  error,
  canWrite,
  onChanged,
}: {
  siteCode: ProductBrand;
  brandLabel: string;
  onSiteCodeChange: (siteCode: ProductBrand) => void;
  data?: SiteProductCategoryResponse;
  loading: boolean;
  error: unknown;
  canWrite: boolean;
  onChanged: () => Promise<SiteProductCategoryResponse | undefined>;
}) {
  const [editing, setEditing] = useState<SiteProductCategoryRow | null>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('edit');
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    parentId: '',
    sortOrder: '0',
    isVisible: true,
    status: 'active',
    description: '',
  });
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [expandedInitializedSite, setExpandedInitializedSite] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const rows = data?.items || [];
  const websiteTree = useMemo(() => buildSiteProductCategoryTree(rows), [rows]);
  const flatWebsiteRows = useMemo(
    () => flattenSiteProductCategoryTree(websiteTree, expandedPaths),
    [expandedPaths, websiteTree],
  );
  const allWebsiteRows = useMemo(() => flattenAllSiteProductCategoryRows(websiteTree), [websiteTree]);
  const blockedParentIds = useMemo(() => {
    if (!editing?.id) return new Set<string>();
    const blocked = new Set<string>([editing.id]);
    const visit = (items: SiteProductCategoryTreeNode[]) => {
      items.forEach((item) => {
        if (blocked.has(item.parentId || '')) {
          blocked.add(item.id);
        }
        if (item.children.length) visit(item.children);
      });
    };
    visit(websiteTree);
    return blocked;
  }, [editing?.id, websiteTree]);
  const parentOptions = useMemo(() => allWebsiteRows.filter((item) => !blockedParentIds.has(item.id)), [allWebsiteRows, blockedParentIds]);
  const editingTitle = mode === 'create'
    ? (createParentId ? '新增下级目录' : '新增一级目录')
    : editing?.websiteCategory || '选择一个官网目录';

  useEffect(() => {
    setEditing(null);
    setMode('edit');
    setCreateParentId(null);
    setDraft({
      name: '',
      parentId: '',
      sortOrder: '0',
      isVisible: true,
      status: 'active',
      description: '',
    });
    setExpandedPaths(new Set());
    setExpandedInitializedSite('');
    setNotice('');
    setActionError('');
  }, [siteCode]);

  useEffect(() => {
    if (expandedInitializedSite === siteCode || !websiteTree.length) return;
    setExpandedPaths(new Set(websiteTree.map((item) => item.path)));
    setExpandedInitializedSite(siteCode);
  }, [expandedInitializedSite, siteCode, websiteTree]);

  function toggleWebsiteNode(node: SiteProductCategoryTreeNode) {
    if (!node.children.length) return;
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(node.path)) next.delete(node.path);
      else next.add(node.path);
      return next;
    });
  }

  function startEdit(row: SiteProductCategoryRow) {
    setEditing(row);
    setMode('edit');
    setCreateParentId(null);
    setDraft({
      name: row.name || row.websiteCategory,
      parentId: row.parentId || '',
      sortOrder: String(row.sortOrder ?? row.displayOrder ?? 0),
      isVisible: row.isVisible !== false,
      status: row.status === 'inactive' ? 'inactive' : 'active',
      description: row.description || '',
    });
    setNotice('');
    setActionError('');
  }

  function startCreate(parent?: SiteProductCategoryTreeNode | null) {
    setEditing(null);
    setMode('create');
    setCreateParentId(parent?.id || null);
    setDraft({
      name: '',
      parentId: parent?.id || '',
      sortOrder: String(parent?.children?.length || rows.length),
      isVisible: true,
      status: 'active',
      description: '',
    });
    setNotice('');
    setActionError('');
  }

  async function importEverhot() {
    setSaving(true);
    setNotice('');
    setActionError('');
    try {
      const result = await siteProductCategories.importEverhot(siteCode) as any;
      await onChanged();
      setNotice(`已导入/更新 ${Number(result?.importedCount || 0)} 个恒热官网目录来源产品，跳过 ${Number(result?.skippedCount || 0)} 个。`);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setActionError('');
    try {
      const payload: Record<string, unknown> = {
        name: draft.name,
        parentId: draft.parentId || null,
        sortOrder: nonNegativeInt(draft.sortOrder),
        isVisible: draft.isVisible,
        status: draft.status,
        description: draft.description || null,
      };
      const result = mode === 'create'
        ? await siteProductCategories.create(siteCode, payload) as any
        : editing?.id
          ? await siteProductCategories.updateById(siteCode, editing.id, payload) as any
          : await siteProductCategories.update(siteCode, { fromCategory: editing?.websiteCategory, toCategory: draft.name }) as any;
      await onChanged();
      setNotice(mode === 'create' ? '官网目录已创建。' : '官网目录已保存。');
      setEditing(null);
      setMode('edit');
      setCreateParentId(null);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function clearCategory() {
    if (!editing) return;
    const childCount = Number((editing as any).children?.length || 0);
    if (childCount > 0) {
      setActionError(`不能删除“${editing.websiteCategory}”：请先处理 ${childCount} 个下级目录。`);
      return;
    }
    if (Number(editing.productCount || 0) > 0) {
      setActionError(`不能在目录页删除“${editing.websiteCategory}”：已有 ${Number(editing.productCount || 0)} 个产品引用该目录，请先到产品库调整产品官网目录。`);
      return;
    }
    const confirmed = window.confirm(`确认删除目录“${editing.websiteCategory}”？`);
    if (!confirmed) return;
    setSaving(true);
    setNotice('');
    setActionError('');
    try {
      const result = editing.id
        ? await siteProductCategories.removeById(siteCode, editing.id) as any
        : await siteProductCategories.clear(siteCode, editing.websiteCategory) as any;
      await onChanged();
      void result;
      setNotice('官网目录已删除。');
      setEditing(null);
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-elevated" style={{ padding: 18, borderRadius: 'var(--r-lg)', width: '100%', justifySelf: 'stretch' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <p className="t-label">官网目录管理 / {brandLabel}</p>
          <h3 className="t-headline" style={{ marginTop: 4 }}>官网产品目录树</h3>
          <p style={{ marginTop: 8, color: 'var(--t-secondary)', fontSize: 13, overflowWrap: 'anywhere' }}>
            这里只维护官网前台产品目录骨架。产品归属、URL、编码、推荐、官网售价、官网文案和图片，请回到产品库维护。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => startCreate(null)} disabled={!canWrite || saving}>
            <Plus size={14} />
            新增一级目录
          </button>
          <button type="button" className="btn btn-brand btn-sm" onClick={importEverhot} disabled={!canWrite || saving || siteCode !== 'everhot'} title={siteCode === 'everhot' ? '从恒热旧官网产品数据生成初始化目录' : '当前只接入了恒热旧官网目录导入'}>
            <RefreshCw size={14} />
            {siteCode === 'everhot' ? '导入恒热旧官网目录' : '旧官网导入待接入'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <span style={{ color: 'var(--t-secondary)', fontSize: 12, fontWeight: 700 }}>官网</span>
        {DEFAULT_CREATE_BRAND_OPTIONS.map((item) => (
          <CategoryChip key={item.value} active={siteCode === item.value} onClick={() => onSiteCodeChange(item.value)}>
            {item.label.replace(' ', '官网 ')}
          </CategoryChip>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <CategoryCountPill label="目录数" value={rows.length} />
        <CategoryCountPill label="一级目录" value={websiteTree.length} />
        <CategoryCountPill label="启用" value={rows.filter((row) => row.status !== 'inactive').length} tone="success" />
      </div>

      {notice ? <span className="badge badge-success" style={{ display: 'inline-flex', marginTop: 12 }}>{notice}</span> : null}
      {actionError ? <span className="badge badge-warning" style={{ display: 'inline-flex', marginTop: 12, overflowWrap: 'anywhere' }}>{actionError}</span> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(min(100%, 520px), 1.12fr) minmax(min(100%, 360px), 0.88fr)',
          gap: 14,
          alignItems: 'start',
          marginTop: 14,
        }}
      >
        <div className="inset" style={{ padding: 12, borderRadius: 'var(--r-lg)', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div>
              <p className="t-label">分类树</p>
              <strong style={{ display: 'block', marginTop: 3 }}>{brandLabel} 产品目录</strong>
            </div>
            <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>点击“编辑”在右侧维护</span>
          </div>
          {loading ? (
            <WorkbenchTableState type="loading" title="正在加载官网目录" description="正在读取数据库中的站点产品目录树。" />
          ) : error ? (
            <WorkbenchTableState type="error" title="官网目录暂时不可用" description={errorMessage(error)} />
          ) : rows.length ? (
            <SiteProductCategoryTreePanel
              rows={flatWebsiteRows}
              expandedPaths={expandedPaths}
              selectedId={editing?.id || ''}
              saving={saving}
              canWrite={canWrite}
              onToggle={toggleWebsiteNode}
              onEdit={startEdit}
              onAddChild={startCreate}
            />
          ) : (
            <WorkbenchTableState
              type="empty"
              title="还没有官网目录"
              description={siteCode === 'everhot'
                ? '可以先导入恒热旧官网目录，也可以手工新增一级目录。'
                : '当前官网还没有产品目录。可以先手工新增一级目录，后续产品库会读取这里的目录选项。'}
              action={canWrite ? (
                <button type="button" className="btn btn-brand btn-sm" onClick={() => startCreate(null)} disabled={saving}>
                  <Plus size={14} />
                  新增一级目录
                </button>
              ) : undefined}
            />
          )}
        </div>

        <aside className="card-elevated" style={{ padding: 14, borderRadius: 'var(--r-lg)', position: 'sticky', top: 12 }}>
          {editing || mode === 'create' ? (
            <form onSubmit={saveCategory} style={{ display: 'grid', gap: 12 }}>
              <div>
                <p className="t-label">{mode === 'create' ? '新增官网目录' : '编辑官网目录'}</p>
                <h4 className="t-headline" style={{ marginTop: 4, fontSize: 16 }}>{editingTitle}</h4>
                <p style={{ margin: '6px 0 0', color: 'var(--t-secondary)', fontSize: 12 }}>
                  这里只改目录名称、上下级、排序和启停。产品挂到哪个目录，请在产品库维护。
                </p>
              </div>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">目录名称 *</span>
                <input className="input" value={draft.name} required disabled={saving || !canWrite} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="如：家用热水" />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">上级目录</span>
                <select className="input" value={draft.parentId} disabled={saving || !canWrite} onChange={(event) => setDraft((current) => ({ ...current, parentId: event.target.value }))}>
                  <option value="">无，作为一级目录</option>
                  {parentOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {'　'.repeat(Math.max(0, category.level - 1))}{category.name || category.websiteCategory}
                    </option>
                  ))}
                </select>
                <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>选择“无”就是一级目录；选择某个目录后会成为它的下级目录。</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">排序</span>
                  <input className="input" type="number" min={0} value={draft.sortOrder} disabled={saving || !canWrite} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: event.target.value }))} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">状态</span>
                  <select className="input" value={draft.status} disabled={saving || !canWrite} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
                  <input type="checkbox" checked={draft.isVisible} disabled={saving || !canWrite} onChange={(event) => setDraft((current) => ({ ...current, isVisible: event.target.checked }))} />
                  <span style={{ fontSize: 13 }}>官网显示</span>
                </label>
              </div>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">运营说明</span>
                <textarea className="input" rows={3} value={draft.description} disabled={saving || !canWrite} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="给运营人员看的备注，可说明这个栏目放什么产品。" />
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-danger btn-sm" onClick={clearCategory} disabled={saving || !canWrite || mode === 'create'}>
                  <Archive size={14} />
                  删除目录
                </button>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(null); setMode('edit'); setCreateParentId(null); }} disabled={saving}>取消</button>
                  <button type="submit" className="btn btn-brand btn-sm" disabled={saving || !canWrite}>
                    <CheckCircle2 size={14} />
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <p className="t-label">操作区</p>
                <h4 className="t-headline" style={{ marginTop: 4, fontSize: 16 }}>先选择左侧分类</h4>
                <p style={{ margin: '6px 0 0', color: 'var(--t-secondary)', fontSize: 13 }}>
                  点击左侧“编辑”即可维护目录名称、上级目录、排序、启停和运营备注。产品归属、推荐和 URL 请到产品库维护。
                </p>
              </div>
              <button type="button" className="btn btn-brand btn-sm" onClick={() => startCreate(null)} disabled={!canWrite || saving}>
                <Plus size={14} />
                新增一级目录
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function flattenLazyCategoryRows(
  roots: ProductCategoryNode[],
  expandedIds: Set<string>,
  childrenByParent: Record<string, ProductCategoryNode[]>,
): ProductCategoryNode[] {
  const out: ProductCategoryNode[] = [];
  const visit = (items: ProductCategoryNode[]) => {
    items.forEach((item) => {
      out.push(item);
      if (expandedIds.has(item.id)) visit(childrenByParent[item.id] || item.children || []);
    });
  };
  visit(roots);
  return out;
}

function emptySiteCategoryRow(category: string): SiteProductCategoryRow {
  return {
    websiteCategory: category,
    menuGroups: [],
    assignmentIds: [],
    productCount: 0,
    publishedCount: 0,
    hiddenCount: 0,
    draftCount: 0,
    featuredCount: 0,
    displayOrder: 0,
  };
}

function splitWebsiteCategoryPath(value: string): string[] {
  return String(value || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildSiteProductCategoryTree(rows: SiteProductCategoryRow[]): SiteProductCategoryTreeNode[] {
  if (rows.some((row) => row.id)) {
    const byId = new Map<string, SiteProductCategoryTreeNode>();
    rows.forEach((row) => {
      const id = text(row.id || row.websiteCategory);
      if (!id) return;
      byId.set(id, {
        ...row,
        id,
        name: row.name || row.websiteCategory,
        path: id,
        level: Number(row.level || 1),
        children: [],
        sortOrder: Number(row.sortOrder ?? row.displayOrder ?? 0),
        displayOrder: Number(row.displayOrder ?? row.sortOrder ?? 0),
        menuGroups: row.menuGroups?.length ? row.menuGroups : row.menuGroup ? [row.menuGroup] : [],
      });
    });
    const roots: SiteProductCategoryTreeNode[] = [];
    byId.forEach((node) => {
      if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
      else roots.push(node);
    });
    const sortNodes = (items: SiteProductCategoryTreeNode[]) => {
      items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, 'zh-Hans-CN'));
      items.forEach((item) => sortNodes(item.children));
    };
    sortNodes(roots);
    return roots;
  }
  const root: SiteProductCategoryTreeNode[] = [];
  const byPath = new Map<string, SiteProductCategoryTreeNode>();
  for (const row of rows) {
    const parts = splitWebsiteCategoryPath(row.websiteCategory);
    const normalizedParts = parts.length ? parts : [row.websiteCategory || '未设置官网分类'];
    normalizedParts.forEach((part, index) => {
      const pathValue = normalizedParts.slice(0, index + 1).join(' / ');
      let node = byPath.get(pathValue);
      if (!node) {
        node = {
          ...emptySiteCategoryRow(pathValue),
          id: pathValue,
          name: part,
          path: pathValue,
          level: index + 1,
          children: [],
        };
        byPath.set(pathValue, node);
        if (index === 0) root.push(node);
        else byPath.get(normalizedParts.slice(0, index).join(' / '))?.children.push(node);
      }
      node.productCount += row.productCount;
      node.publishedCount += row.publishedCount;
      node.hiddenCount += row.hiddenCount;
      node.draftCount += row.draftCount;
      node.featuredCount += row.featuredCount;
      node.displayOrder = Math.min(node.displayOrder || row.displayOrder || 0, row.displayOrder || 0);
      row.menuGroups.forEach((group) => {
        if (group && !node.menuGroups.includes(group)) node.menuGroups.push(group);
      });
      if (index === normalizedParts.length - 1) {
        node.websiteCategory = row.websiteCategory;
        node.assignmentIds = row.assignmentIds;
        node.displayOrder = row.displayOrder;
      }
    });
  }
  const sortNodes = (items: SiteProductCategoryTreeNode[]) => {
    items.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'zh-Hans-CN'));
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(root);
  return root;
}

function flattenSiteProductCategoryTree(
  roots: SiteProductCategoryTreeNode[],
  expandedPaths: Set<string>,
): SiteProductCategoryTreeNode[] {
  const out: SiteProductCategoryTreeNode[] = [];
  const visit = (items: SiteProductCategoryTreeNode[]) => {
    items.forEach((item) => {
      out.push(item);
      if (expandedPaths.has(item.path)) visit(item.children);
    });
  };
  visit(roots);
  return out;
}

function flattenAllSiteProductCategoryRows(roots: SiteProductCategoryTreeNode[]): SiteProductCategoryTreeNode[] {
  const out: SiteProductCategoryTreeNode[] = [];
  const visit = (items: SiteProductCategoryTreeNode[]) => {
    items.forEach((item) => {
      out.push(item);
      if (item.children.length) visit(item.children);
    });
  };
  visit(roots);
  return out;
}

function SiteProductCategoryTreePanel({
  rows,
  expandedPaths,
  selectedId,
  saving,
  canWrite,
  onToggle,
  onEdit,
  onAddChild,
}: {
  rows: SiteProductCategoryTreeNode[];
  expandedPaths: Set<string>;
  selectedId: string;
  saving: boolean;
  canWrite: boolean;
  onToggle: (node: SiteProductCategoryTreeNode) => void;
  onEdit: (row: SiteProductCategoryRow) => void;
  onAddChild: (row: SiteProductCategoryTreeNode) => void;
}) {
  return (
    <div style={{ marginTop: 14, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: '#FFFFFF' }}>
      <div
        role="tree"
        aria-label="官网产品目录树"
        style={{ display: 'grid', gap: 2, minHeight: 120 }}
      >
        {rows.map((node, index) => {
          const expandable = node.children.length > 0;
          const expanded = expandedPaths.has(node.path);
          const editable = Boolean(node.id || node.websiteCategory);
          return (
            <div
              key={`${node.id || node.path}-${index}`}
              role="treeitem"
              aria-expanded={expandable ? expanded : undefined}
              aria-selected={selectedId === node.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(240px, 1fr) auto',
                alignItems: 'center',
                gap: 10,
                minHeight: 44,
                padding: '6px 8px',
                paddingLeft: 8 + Math.max(0, node.level - 1) * 24,
                borderRadius: 8,
                background: selectedId === node.id ? 'var(--brand-50)' : editable ? 'transparent' : 'var(--surface-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => onToggle(node)}
                  disabled={!expandable}
                  aria-label={expanded ? '收起官网分类' : '展开官网分类'}
                  style={{
                    width: 24,
                    height: 24,
                    border: 0,
                    padding: 0,
                    background: 'transparent',
                    color: expandable ? 'var(--t-secondary)' : 'var(--t-tertiary)',
                    cursor: expandable ? 'pointer' : 'default',
                    fontSize: 12,
                    lineHeight: '24px',
                    flex: '0 0 24px',
                  }}
                >
                  {expandable ? (expanded ? '▾' : '▸') : ''}
                </button>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 13, overflowWrap: 'anywhere', fontWeight: node.level === 1 ? 800 : 650 }}>{node.name}</strong>
                  <span style={{ display: 'block', marginTop: 2, color: 'var(--t-tertiary)', fontSize: 12 }}>
                    {node.level} 级目录 · 排序 {node.sortOrder ?? node.displayOrder ?? 0} · {node.status === 'inactive' ? '停用' : '启用'}{node.isVisible === false ? ' · 官网隐藏' : ''}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <StatusPill tone={node.status === 'inactive' ? 'warning' : 'success'}>
                  {node.status === 'inactive' ? '停用' : '启用'}
                </StatusPill>
                <StatusPill tone={node.isVisible === false ? 'neutral' : 'info'}>
                  {node.isVisible === false ? '官网隐藏' : '官网显示'}
                </StatusPill>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => onAddChild(node)}
                  disabled={saving || !canWrite || !node.id}
                >
                  <Plus size={14} />
                  新增
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => onEdit(node)}
                  disabled={saving || !canWrite || !editable}
                  title="编辑该官网分类"
                >
                  <Edit3 size={14} />
                  编辑
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryCrudTreePanel({
  rows,
  selectedId,
  expandedIds,
  loadingChildren,
  saving,
  canWrite,
  onToggleExpand,
  onSelect,
  onAddChild,
  onDelete,
}: {
  rows: ProductCategoryNode[];
  selectedId: string;
  expandedIds: Set<string>;
  loadingChildren: Record<string, boolean>;
  saving: boolean;
  canWrite: boolean;
  onToggleExpand: (node: ProductCategoryNode) => void;
  onSelect: (node: ProductCategoryNode) => void;
  onAddChild: (node: ProductCategoryNode) => void;
  onDelete: (node: ProductCategoryNode) => void;
}) {
  return (
    <div style={{ padding: 10 }}>
      <div
        role="tree"
        aria-label="产品基座分类树"
        style={{
          display: 'grid',
          alignContent: 'start',
          gap: 2,
          minHeight: 120,
          padding: '8px 8px',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: '#FFFFFF',
        }}
      >
        {rows.map((node) => {
          const expandable = node.hasChildren || node.childCategoryCount > 0 || node.children.length > 0;
          const expanded = expandedIds.has(node.id);
          const childCount = node.children.length || node.childCategoryCount;
          return (
            <div
              key={node.id}
              role="treeitem"
              aria-expanded={expandable ? expanded : undefined}
              aria-selected={selectedId === node.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(260px, 1fr) auto',
                alignItems: 'center',
                gap: 10,
                minHeight: 30,
                padding: '2px 8px',
                paddingLeft: 8 + Math.max(0, node.level - 1) * 22,
                borderRadius: 6,
                background: selectedId === node.id ? 'var(--brand-50)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => onToggleExpand(node)}
                  disabled={!expandable || loadingChildren[node.id]}
                  aria-label={expanded ? '收起分类' : '展开分类'}
                  title={expandable ? (expanded ? '收起下级目录' : '展开下级目录') : '暂无下级目录'}
                  style={{
                    width: 18,
                    height: 18,
                    border: 0,
                    padding: 0,
                    background: 'transparent',
                    color: expandable ? 'var(--t-secondary)' : 'var(--t-tertiary)',
                    cursor: expandable ? 'pointer' : 'default',
                    fontSize: 12,
                    lineHeight: '18px',
                    flex: '0 0 18px',
                  }}
                >
                  {loadingChildren[node.id] ? '...' : expandable ? (expanded ? '▾' : '▸') : ''}
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(node)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    color: 'var(--t-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ overflowWrap: 'anywhere', fontWeight: node.level === 1 ? 800 : 650, lineHeight: 1.25 }}>{node.name || node.code}</span>
                  <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>Level {node.level}</span>
                  <StatusPill tone={node.status === 'inactive' ? 'warning' : 'success'}>
                    {node.status === 'inactive' ? '停用' : '启用'}
                  </StatusPill>
                  <StatusPill tone={node.showOnWebsite ? 'info' : 'neutral'}>
                    {node.showOnWebsite ? '允许官网映射' : '不参与官网映射'}
                  </StatusPill>
                  <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>{node.code}</span>
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'nowrap' }}>
                <span style={{ color: 'var(--t-tertiary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  下级 {childCount} / 产品 {node.directProductCount}
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAddChild(node)} disabled={!canWrite || saving} style={{ flexShrink: 0 }}>
                  <Plus size={14} />
                  新增
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => onSelect(node)} disabled={saving} style={{ flexShrink: 0 }}>
                  <Edit3 size={14} />
                  修改
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(node)} disabled={!canWrite || saving} style={{ flexShrink: 0 }}>
                  <Archive size={14} />
                  删除
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryCrudTreeTable({
  rows,
  selectedId,
  expandedIds,
  loadingChildren,
  saving,
  canWrite,
  onToggleExpand,
  onSelect,
  onAddChild,
  onDelete,
}: {
  rows: ProductCategoryNode[];
  selectedId: string;
  expandedIds: Set<string>;
  loadingChildren: Record<string, boolean>;
  saving: boolean;
  canWrite: boolean;
  onToggleExpand: (node: ProductCategoryNode) => void;
  onSelect: (node: ProductCategoryNode) => void;
  onAddChild: (node: ProductCategoryNode) => void;
  onDelete: (node: ProductCategoryNode) => void;
}) {
  return (
    <WorkbenchTableShell>
      <table className="table" style={{ width: '100%', minWidth: 1360, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>分类名称</th>
            <th>备注</th>
            <th>编码</th>
            <th>排序</th>
            <th>状态</th>
            <th>下级目录及其产品</th>
            <th>直接产品</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((node) => {
            const expandable = node.hasChildren || node.childCategoryCount > 0;
            const expanded = expandedIds.has(node.id);
            return (
              <tr
                key={node.id}
                className={node.level > 1 ? 'category-tree-row category-tree-row--child' : 'category-tree-row'}
                style={{ background: selectedId === node.id ? 'var(--brand-50)' : undefined }}
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: Math.max(0, node.level - 1) * 18 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onToggleExpand(node)}
                      disabled={!expandable || loadingChildren[node.id]}
                      aria-label={expanded ? '收起分类' : '展开分类'}
                      title={expandable ? (expanded ? '收起下级目录' : '打开下级目录') : '暂无下级目录，可点击右侧新增'}
                      style={{
                        width: 30,
                        height: 30,
                        padding: 0,
                        flex: '0 0 30px',
                        border: expandable ? '1px solid var(--border)' : '1px solid transparent',
                        background: expandable ? '#FFFFFF' : 'transparent',
                        color: expandable ? 'var(--t-primary)' : 'var(--t-tertiary)',
                        transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease',
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      {loadingChildren[node.id] ? '...' : expandable ? (expanded ? '-' : '+') : '·'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(node)}
                      style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', color: 'var(--t-primary)', minWidth: 0 }}
                    >
                      <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{node.name || node.code}</strong>
                      <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>Level {node.level}</span>
                    </button>
                  </div>
                </td>
                <td style={{ color: node.description ? 'var(--t-secondary)' : 'var(--t-tertiary)', overflowWrap: 'anywhere' }}>
                  {node.description || '暂无备注'}
                </td>
                <td style={{ overflowWrap: 'anywhere' }}>{node.code}</td>
                <td>{node.sortOrder}</td>
                <td>
                  <StatusPill tone={node.status === 'inactive' ? 'warning' : 'success'}>
                    {node.status === 'inactive' ? '停用' : '启用'}
                  </StatusPill>
                  <div style={{ marginTop: 6 }}>
                    <StatusPill tone={node.showOnWebsite ? 'info' : 'neutral'}>
                      {node.showOnWebsite ? '允许官网映射' : '不参与官网映射'}
                    </StatusPill>
                  </div>
                </td>
                <td>{node.descendantProductCount}</td>
                <td>{node.directProductCount}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAddChild(node)} disabled={!canWrite || saving} style={{ flexShrink: 0 }}>
                      <Plus size={14} />
                      新增
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => onSelect(node)} disabled={saving} style={{ flexShrink: 0 }}>
                      <Edit3 size={14} />
                      修改
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(node)} disabled={!canWrite || saving} style={{ flexShrink: 0 }}>
                      <Archive size={14} />
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </WorkbenchTableShell>
  );
}

function CategoryCrudTree({
  tree,
  selectedId,
  saving,
  canWrite,
  onSelect,
  onAddChild,
}: {
  tree: ProductCategoryNode[];
  selectedId: string;
  saving: boolean;
  canWrite: boolean;
  onSelect: (node: ProductCategoryNode) => void;
  onAddChild: (node: ProductCategoryNode) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 10, padding: 16 }}>
      {tree.map((node) => (
        <CategoryCrudTreeRow
          key={node.id}
          node={node}
          selectedId={selectedId}
          saving={saving}
          canWrite={canWrite}
          onSelect={onSelect}
          onAddChild={onAddChild}
        />
      ))}
    </div>
  );
}

function CategoryCrudTreeRow({
  node,
  selectedId,
  saving,
  canWrite,
  onSelect,
  onAddChild,
}: {
  node: ProductCategoryNode;
  selectedId: string;
  saving: boolean;
  canWrite: boolean;
  onSelect: (node: ProductCategoryNode) => void;
  onAddChild: (node: ProductCategoryNode) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <CategoryCrudNodeCard
        node={node}
        active={selectedId === node.id}
        saving={saving}
        canWrite={canWrite}
        onSelect={() => onSelect(node)}
        onAddChild={() => onAddChild(node)}
      />
      {node.children.length ? (
        <div style={{ display: 'grid', gap: 8, paddingLeft: Math.min(node.level, 2) * 18, borderLeft: '1px solid var(--border)', marginLeft: 12 }}>
          {node.children.map((child) => (
            <CategoryCrudTreeRow
              key={child.id}
              node={child}
              selectedId={selectedId}
              saving={saving}
              canWrite={canWrite}
              onSelect={onSelect}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CategoryCrudNodeCard({
  node,
  active,
  saving,
  canWrite,
  onSelect,
  onAddChild,
}: {
  node: ProductCategoryNode;
  active: boolean;
  saving: boolean;
  canWrite: boolean;
  onSelect: () => void;
  onAddChild: () => void;
}) {
  const canAddChild = true;
  const levelLabel = `Level ${node.level}`;
  return (
    <div
      style={{
        minWidth: 0,
        border: active ? '1px solid var(--brand)' : '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        background: active ? 'var(--brand-50)' : '#FFFFFF',
        padding: node.level === 1 ? '12px 14px' : '10px 12px',
        boxShadow: active ? 'var(--sh-glow)' : 'var(--sh-xs)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" onClick={onSelect} style={{ border: 0, background: 'transparent', color: 'var(--t-primary)', textAlign: 'left', minWidth: 0, padding: 0, fontWeight: 700, overflowWrap: 'anywhere' }}>
          <span style={{ display: 'block', color: 'var(--t-tertiary)', fontSize: 11, marginBottom: 3 }}>{levelLabel}</span>
          <span style={{ display: 'block', fontSize: node.level === 1 ? 15 : 13 }}>{node.name || node.code}</span>
          <span style={{ display: 'block', marginTop: 3, color: 'var(--t-tertiary)', fontSize: 11 }}>
            {node.code || '未设置编码'} · 排序 {node.sortOrder}
          </span>
        </button>
        <StatusPill tone={node.status === 'inactive' ? 'warning' : 'success'}>
          {node.status === 'inactive' ? '停用' : '启用'}
        </StatusPill>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onSelect} disabled={saving}>
          <Edit3 size={14} />
          编辑
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAddChild} disabled={!canWrite || saving || !canAddChild}>
          <Plus size={14} />
          新增下级
        </button>
      </div>
    </div>
  );
}

function CategoryCrudEditor({
  mode,
  brandCode,
  selected,
  createParent,
  createLevel,
  draft,
  usage,
  actionError,
  saving,
  canWrite,
  onDraft,
  onSave,
  onToggleStatus,
  onDelete,
  onClose,
}: {
  mode: 'edit' | 'create';
  brandCode: string;
  selected: ProductCategoryNode | null;
  createParent: ProductCategoryNode | null;
  createLevel: number;
  draft: ProductCategoryDraft;
  usage: ProductCategoryUsage | null;
  actionError: string;
  saving: boolean;
  canWrite: boolean;
  onDraft: (draft: ProductCategoryDraft) => void;
  onSave: (event: FormEvent) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const title = mode === 'create'
    ? `新增 Level ${createLevel} 分类`
    : selected
      ? '编辑分类'
      : '选择分类';
  const subtitle = mode === 'create'
    ? createParent
      ? `上级：${createParent.name || createParent.code}`
      : `品牌：${displayBrand(brandCode)}`
    : selected
      ? `${selected.level === 1 ? '一级目录' : selected.level === 2 ? '二级系统' : '三级分类'} / ${selected.code}`
      : '从左侧选择一个分类，或先新增一级目录。';
  const disabled = !canWrite || saving || (mode === 'edit' && !selected);

  return (
    <section className="card-elevated" style={{ padding: 18, borderRadius: 'var(--r-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <p className="t-label">分类详情</p>
          <h3 className="t-headline" style={{ marginTop: 4 }}>{title}</h3>
          <p style={{ marginTop: 4, color: 'var(--t-secondary)', fontSize: 12, overflowWrap: 'anywhere' }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {mode === 'edit' && selected ? (
            <StatusPill tone={selected.status === 'inactive' ? 'warning' : 'success'}>
              {selected.status === 'inactive' ? '停用' : '启用'}
            </StatusPill>
          ) : null}
          {mode === 'edit' && selected ? (
            <StatusPill tone={draft.showOnWebsite ? 'info' : 'neutral'}>
              {draft.showOnWebsite ? '允许官网映射' : '不参与官网映射'}
            </StatusPill>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving} aria-label="关闭">
            <XCircle size={14} />
          </button>
        </div>
      </div>

      {!canWrite ? <p className="field-error" style={{ marginTop: 12 }}>当前账号不能维护产品分类。</p> : null}
      {actionError ? <p className="field-error" style={{ marginTop: 12 }}>{actionError}</p> : null}

      <form onSubmit={onSave} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">分类名称</span>
          <input className="input" placeholder="例如：家用、热水系统、空气能热水器" value={draft.nameCn} required disabled={disabled} onChange={(event) => onDraft({ ...draft, nameCn: event.target.value })} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">排序</span>
            <input className="input" type="number" min="0" max="999999" value={draft.sortOrder} required disabled={disabled} onChange={(event) => onDraft({ ...draft, sortOrder: event.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">状态</span>
            <select className="input" value={draft.status} disabled={disabled} onChange={(event) => onDraft({ ...draft, status: event.target.value === 'inactive' ? 'inactive' : 'active' })}>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface-2)',
          }}
        >
          <span>
            <span className="t-label" style={{ display: 'block' }}>允许官网映射</span>
            <span style={{ display: 'block', marginTop: 3, color: 'var(--t-secondary)', fontSize: 12 }}>
              关闭后，该基座分类不会作为官网分类映射来源；不会影响已录入产品，也不会触发产品自动发布。
            </span>
          </span>
          <input
            type="checkbox"
            checked={draft.showOnWebsite}
            disabled={disabled}
            onChange={(event) => onDraft({ ...draft, showOnWebsite: event.target.checked })}
            style={{ width: 18, height: 18, accentColor: 'var(--brand)', flexShrink: 0 }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">说明</span>
          <textarea className="textarea" value={draft.description} disabled={disabled} onChange={(event) => onDraft({ ...draft, description: event.target.value })} />
        </label>

        {mode === 'edit' && selected ? (
          <div className="inset" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>已绑定产品</span>
            <strong style={{ color: usage && usage.boundProductCount > 0 ? 'var(--warning)' : 'var(--t-primary)' }}>
              {usage ? usage.boundProductCount : '检查中...'}
            </strong>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
          {mode === 'create' ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}>取消</button>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onToggleStatus} disabled={disabled}>
                <XCircle size={14} />
                {selected?.status === 'inactive' ? '启用' : '停用'}
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={onDelete} disabled={disabled}>
                <Archive size={14} />
                删除
              </button>
            </div>
          )}
          <button type="submit" className="btn btn-brand btn-sm" disabled={disabled}>
            <CheckCircle2 size={14} />
            {saving ? '保存中...' : mode === 'create' ? '创建' : '保存'}
          </button>
        </div>
      </form>
    </section>
  );
}

function emptyCategoryDraft(sortOrder = 0, code = ''): ProductCategoryDraft {
  return {
    nameCn: '',
    code,
    slug: '',
    sortOrder: String(sortOrder),
    status: 'active',
    showOnWebsite: true,
    description: '',
  };
}

function categoryDraftFromNode(node: ProductCategoryNode): ProductCategoryDraft {
  return {
    nameCn: node.nameCn || node.name,
    code: node.code,
    slug: node.slug,
    sortOrder: String(node.sortOrder),
    status: node.status === 'inactive' ? 'inactive' : 'active',
    showOnWebsite: node.showOnWebsite,
    description: node.description,
  };
}

function categoryDraftPayload(draft: ProductCategoryDraft): Record<string, unknown> {
  const code = slug(draft.code) || internalCategoryCode();
  const sortOrder = nonNegativeInt(draft.sortOrder);
  if (!text(draft.nameCn)) throw new Error('Category name is required.');
  return {
    nameCn: text(draft.nameCn),
    code,
    slug: draft.slug ? slug(draft.slug) : null,
    sortOrder,
    status: draft.status,
    showOnWebsite: draft.showOnWebsite,
    description: text(draft.description) || null,
  };
}

function errorMessage(error: unknown): string {
  const anyError = error as Error & { details?: any };
  const message = anyError?.details?.message || anyError?.message || String(error);
  const normalized = Array.isArray(message) ? message.join('; ') : String(message);
  if (/Brand product categories support levels 1,\s*2,\s*and 3 only/i.test(normalized)) {
    return '产品分类已支持无限层级；当前服务仍返回旧的三级限制，请重启后端服务后再试。';
  }
  if (/Root categories must use level 1/i.test(normalized)) return '根分类层级必须为 1。';
  if (/Category level must be (\d+) for the selected parent/i.test(normalized)) {
    const expected = normalized.match(/Category level must be (\d+) for the selected parent/i)?.[1];
    return expected ? `当前上级分类要求新分类层级为 ${expected}。` : '分类层级与上级分类不匹配。';
  }
  if (/Parent category does not exist/i.test(normalized)) return '上级分类不存在或不属于当前品牌。';
  if (/Category code already exists/i.test(normalized)) return '同一品牌、同一上级下已存在相同编码的分类。';
  if (/code.*lowercase letters/i.test(normalized)) return '编码只能使用小写字母、数字和连字符。';
  if (/sortOrder must be an integer/i.test(normalized)) return '排序必须是 0 到 999999 之间的整数。';
  if (/Category name is required/i.test(normalized) || /nameCn is required/i.test(normalized)) return '请填写分类名称。';
  if (/Request failed/i.test(normalized)) return '请求失败，请稍后重试。';
  return normalized;
}

function ProductBaseView({
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
        <h2 className="t-headline" style={{ marginTop: 4 }}>产品目录底座</h2>
        <p style={{ marginTop: 6, color: 'var(--t-secondary)', fontSize: 13 }}>
          维护分类底座、系统方案包和产品身份键，供报价、官网和设计模块复用。
          <span style={{ color: 'var(--warning)' }}>（方案包为示例模板，接入 system-packs 后端后替换为真实方案；单价取自产品库真实价）</span>
        </p>
        <div className="g4" style={{ gap: 12, marginTop: 16 }}>
          <Metric label="分类数" value={String(CATEGORIES.length)} hint="目录筛选底座" />
          <Metric label="方案包" value={String(SYSTEM_PACKS.length)} hint="示例模板 · 待接 system-packs" />
          <Metric label="身份键覆盖" value={`${keyed}/${items.length}`} hint="productKey 去重基础" />
          <Metric label="可报价产品编码" value={String(items.filter((item) => item.marketPrice > 0).length)} hint="已有价格字段" />
        </div>
      </section>
      <section className="g2" style={{ gap: 16 }}>
        <div className="card-elevated" style={{ padding: 16 }}>
          <h3 className="t-headline">分类底座</h3>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {categoryRows.map((category) => (
              <div key={category.key} className="inset" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
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
                <p style={{ marginTop: 4, color: 'var(--t-secondary)', fontSize: 13 }}>{pack.desc}</p>
              </div>
              <span className="pill-neutral" style={{ alignSelf: 'flex-start' }} title="示例套餐：单价来自产品库真实价，套餐组合为示例模板；接入 system-packs 后替换为真实方案包">
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
                    <span style={{ color: 'var(--t-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
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
                <span style={{ color: 'var(--t-tertiary)', fontSize: 11 }}>组合让利 {pct(margin)}</span>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
