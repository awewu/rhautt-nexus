'use client';
// 产品域共享类型/常量/小组件（page 与 category-manager 共用）
// 2026-08 从 products/page.tsx（12538 行）机械化拆出：逻辑零改动，只做搬迁。
// 2026-08 全页 UX 重构三期 · WorkspaceKit 化

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

export type ProductBrand = string;

export type FloatingDialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

export type FloatingPromptOptions = FloatingDialogOptions & {
  defaultValue?: string;
  placeholder?: string;
};

export type FloatingDialogState =
  | (FloatingDialogOptions & { kind: 'alert'; resolve: () => void })
  | (FloatingDialogOptions & { kind: 'confirm'; resolve: (value: boolean) => void })
  | (FloatingPromptOptions & { kind: 'prompt'; resolve: (value: string | null) => void });


export function useFloatingDialog() {
  const [dialog, setDialog] = useState<FloatingDialogState | null>(null);

  const alertFloating = (options: FloatingDialogOptions) =>
    new Promise<void>((resolve) => {
      setDialog({
        kind: 'alert',
        title: options.title || '系统提示',
        message: options.message,
        confirmLabel: options.confirmLabel || '知道了',
        tone: options.tone || 'default',
        resolve,
      });
    });

  const confirmFloating = (options: FloatingDialogOptions) =>
    new Promise<boolean>((resolve) => {
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

  const promptFloating = (options: FloatingPromptOptions) =>
    new Promise<string | null>((resolve) => {
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


export function FloatingDialog({
  dialog,
  onClose,
}: {
  dialog: FloatingDialogState;
  onClose: (value: boolean | string | null) => void;
}) {
  const [inputValue, setInputValue] = useState(
    dialog.kind === 'prompt' ? dialog.defaultValue || '' : ''
  );
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
    <div
      className="product-floating-dialog-backdrop"
      role="presentation"
      onMouseDown={() => onClose(cancelValue)}
    >
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
          <button
            type="button"
            className="btn btn-outline btn-sm icon-only"
            onClick={() => onClose(cancelValue)}
            aria-label="关闭弹框"
          >
            <X size={15} />
          </button>
        </header>
        <div className="product-floating-dialog-body">
          <p>{dialog.message}</p>
          {dialog.kind === 'prompt' && (
            <input
              ref={inputRef}
              className="input"
              value={inputValue}
              placeholder={dialog.placeholder}
              onChange={(event) => setInputValue(event.target.value)}
            />
          )}
        </div>
        <footer>
          {dialog.kind !== 'alert' && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onClose(cancelValue)}
            >
              {dialog.cancelLabel || '取消'}
            </button>
          )}
          <button
            type="submit"
            className={`btn btn-sm ${dialog.tone === 'danger' ? 'btn-danger' : 'btn-brand'}`}
          >
            {dialog.confirmLabel || '确定'}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
}

export type ProductCategoryNode = {
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

export type ProductCategoryDraft = {
  nameCn: string;
  code: string;
  slug: string;
  sortOrder: string;
  status: 'active' | 'inactive';
  showOnWebsite: boolean;
  description: string;
};

export type ProductCategoryUsage = {
  boundProductCount: number;
  childCategoryCount?: number;
};

export type SiteProductCategoryRow = {
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

export type SiteProductCategoryResponse = {
  siteCode: string;
  total: number;
  productCount: number;
  items: SiteProductCategoryRow[];
};

export type SiteProductCategoryTreeNode = SiteProductCategoryRow & {
  id: string;
  name: string;
  path: string;
  level: number;
  children: SiteProductCategoryTreeNode[];
};

export const DEFAULT_CREATE_BRAND_OPTIONS: Array<{ value: ProductBrand; label: string }> = [
  { value: 'rheem', label: '瑞美 Rheem' },
  { value: 'ruud', label: '瑞德 Ruud' },
  { value: 'everhot', label: '恒热 Everhot' },
];

export function displayBrand(value: string): string {
  if (value === 'common') return '公共产品库';
  if (value === 'rheem') return '瑞美 Rheem';
  if (value === 'ruud') return '瑞德 Ruud';
  if (value === 'everhot') return '恒热 Everhot';
  return value || '未绑定';
}


export function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}


export function productCategoryItems(result: unknown): Record<string, any>[] {
  if (Array.isArray(result)) return result as Record<string, any>[];
  if (Array.isArray((result as any)?.items)) return (result as any).items;
  if (Array.isArray((result as any)?.categories)) return (result as any).categories;
  if (Array.isArray((result as any)?.tree)) return flattenRawCategoryItems((result as any).tree);
  return [];
}


export function flattenRawCategoryItems(items: Record<string, any>[]): Record<string, any>[] {
  return items.flatMap((item) => [
    item,
    ...flattenRawCategoryItems(Array.isArray(item.children) ? item.children : []),
  ]);
}


export function normalizeProductCategoryTree(result: unknown): ProductCategoryNode[] {
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
        hasChildren: Boolean(
          item.hasChildren || (Array.isArray(item.children) && item.children.length)
        ),
        childCategoryCount: Number(item.childCategoryCount || 0),
        directProductCount: Number(item.directProductCount || item.exactBoundProductCount || 0),
        descendantProductCount: Number(
          item.descendantProductCount || item.descendantBoundProductCount || 0
        ),
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
    items.sort(
      (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
    );
    items.forEach((item) => sortTree(item.children));
    return items;
  };
  return sortTree(roots);
}


export function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}


export function internalCategoryCode(prefix = 'cat'): string {
  return `${prefix}-${Date.now().toString(36)}`.replace(/[^a-z0-9-]+/g, '-');
}


export function nonNegativeInt(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}


export function CategoryChip({
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
      className={
        active
          ? 'pill-brand min-h-7 border-[var(--brand-100)]! font-bold!'
          : 'pill-neutral min-h-7 border-border! font-medium!'
      }
    >
      {children}
    </button>
  );
}


export function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card-elevated px-[18px]! py-4!">
      <div className="t-label">{label}</div>
      <div className="mt-1.5 text-[28px] leading-[1.1] font-bold text-[var(--t-strong)] tabular-nums">
        {value}
      </div>
      <p className="mt-1 text-xs text-[var(--t-tertiary)]">{hint}</p>
    </div>
  );
}


export function CategoryCountPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success';
}) {
  return (
    <span
      className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 py-[5px] text-xs font-bold whitespace-nowrap ${
        tone === 'success'
          ? 'border-[rgba(76,175,80,0.28)] bg-[rgba(76,175,80,0.08)] text-success'
          : 'border-border bg-secondary text-muted-foreground'
      }`}
    >
      {label}
      <strong className="text-sm text-foreground">{value}</strong>
    </span>
  );
}


export function emptyCategoryDraft(sortOrder = 0, code = ''): ProductCategoryDraft {
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


export function categoryDraftFromNode(node: ProductCategoryNode): ProductCategoryDraft {
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


export function categoryDraftPayload(draft: ProductCategoryDraft): Record<string, unknown> {
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


export function errorMessage(error: unknown): string {
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
  if (/Category code already exists/i.test(normalized))
    return '同一品牌、同一上级下已存在相同编码的分类。';
  if (/code.*lowercase letters/i.test(normalized)) return '编码只能使用小写字母、数字和连字符。';
  if (/sortOrder must be an integer/i.test(normalized))
    return '排序必须是 0 到 999999 之间的整数。';
  if (/Category name is required/i.test(normalized) || /nameCn is required/i.test(normalized))
    return '请填写分类名称。';
  if (/Request failed/i.test(normalized)) return '请求失败，请稍后重试。';
  return normalized;
}


// ── 第二刀追加（站点发布/媒体簇共享）──
export type AssignmentStatus = 'draft' | 'published' | 'hidden';

export type WebsiteShelfAssignment = {
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

export type ProductManualPdfDraft = {
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

export type NormalizedProduct = Product & {
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

export type SitePublishingSuggestion = {
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

export type SiteProductCategorySelectOption = {
  value: string;
  label: string;
  name: string;
  path: string;
  code?: string;
};


export const PRODUCT_LIBRARY_TENANT_ID =
  process.env.NEXT_PUBLIC_PRODUCT_LIBRARY_TENANT_ID ||
  process.env.NEXT_PUBLIC_RHAUTT_COMFORT_TENANT_ID ||
  process.env.NEXT_PUBLIC_EVERHOT_TENANT_ID ||
  'e5e40000-0000-4000-8000-000000000001';

export const PRODUCT_DETAIL_ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'STRONG',
  'B',
  'EM',
  'I',
  'UL',
  'OL',
  'LI',
  'A',
  'IMG',
  'H2',
  'H3',
  'H4',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TH',
  'TD',
]);


export function normalizeBrand(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}


export function escapeProductDetailHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


export function productDetailPlainText(value: string) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


export function sanitizeOfficialProductDetailHtml(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (typeof document === 'undefined') {
    return escapeProductDetailHtml(raw)
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
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


export function publicSiteProductItems(payload: unknown): Record<string, any>[] {
  const data = (payload as any)?.data ?? payload;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}


export function websitePublishingStatusMeta(assignment: WebsiteShelfAssignment) {
  if (assignment.deletedAt) return { label: '已移除', tone: 'neutral' as const };
  if (assignment.status === 'published')
    return { label: '已发布，官网可见', tone: 'success' as const };
  if (assignment.status === 'hidden')
    return { label: '已隐藏，官网不可见', tone: 'warning' as const };
  return { label: '草稿，未发布到官网', tone: 'neutral' as const };
}


export function MappingCheckItem({
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
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'info'
          ? 'text-[var(--brand-500,var(--brand))]'
          : 'text-muted-foreground';
  return (
    <div className="product-edit-check-item grid min-w-0 gap-1">
      <span className="t-label">{label}</span>
      <strong className={`${toneClass} text-[13px] leading-[1.35] [overflow-wrap:anywhere]`}>
        {value || '未维护'}
      </strong>
      {note ? (
        <span className="text-[11px] leading-[1.35] text-[var(--t-tertiary)]">{note}</span>
      ) : null}
    </div>
  );
}


export function tenantIdForProduct(product: NormalizedProduct): string {
  return text(product.raw?.tenantId);
}


export function productBrandMeta(product: NormalizedProduct): Record<string, any> {
  const meta = objectOrEmpty(product.raw?.meta);
  return objectOrEmpty(meta[normalizeBrand(product.brand)]);
}


export function productLibraryMeta(product: NormalizedProduct): Record<string, any> {
  return objectOrEmpty(objectOrEmpty(product.raw?.meta).productLibrary);
}


export function productCategoryBinding(product: NormalizedProduct): {
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
    primaryCategoryId: text(
      raw.primaryCategoryId ||
        brandMeta.primaryCategoryId ||
        meta.primaryCategoryId ||
        categoryMeta.primaryCategoryId
    ),
    categoryLevel1Id: text(
      raw.categoryLevel1Id ||
        brandMeta.categoryLevel1Id ||
        meta.categoryLevel1Id ||
        categoryMeta.categoryLevel1Id
    ),
    categoryLevel2Id: text(
      raw.categoryLevel2Id ||
        brandMeta.categoryLevel2Id ||
        meta.categoryLevel2Id ||
        categoryMeta.categoryLevel2Id
    ),
    categoryLevel3Id: text(
      raw.categoryLevel3Id ||
        brandMeta.categoryLevel3Id ||
        meta.categoryLevel3Id ||
        categoryMeta.categoryLevel3Id
    ),
  };
}


export function splitBadges(value: string): string[] {
  return value
    .split(/[,，\n]/g)
    .map(text)
    .filter(Boolean);
}


export function artifactContentUrl(artifactId: unknown): string {
  const id = text(artifactId);
  return id ? `/api/v2/file-artifact/${encodeURIComponent(id)}/content` : '';
}


export const PRODUCT_DETAIL_ARTIFACT_SRC_ATTR = 'data-product-artifact-src';

export const PRODUCT_DETAIL_ARTIFACT_STATUS_ATTR = 'data-product-artifact-status';

export const FILE_ARTIFACT_CONTENT_SRC_RE =
  /(?:https?:\/\/[^"'<>\s]+)?(\/api\/v2\/file-artifact\/([0-9a-fA-F-]{36})\/content)(?:[?#][^"'<>\s]*)?/i;

export const PUBLIC_PRODUCT_IMAGE_SRC_RE =
  /(?:https?:\/\/[^"'<>\s]+)?\/api\/v2\/brand\/[^"'<>\s]+\/products\/[^"'<>\s]+\/images\/([0-9a-fA-F-]{36})(?:[?#][^"'<>\s]*)?/i;


export function productDetailImageArtifactId(src: unknown): string {
  const raw = text(src);
  return text(
    raw.match(FILE_ARTIFACT_CONTENT_SRC_RE)?.[2] || raw.match(PUBLIC_PRODUCT_IMAGE_SRC_RE)?.[1]
  );
}


export function productDetailPersistentImageSrc(src: unknown): string {
  const raw = text(src);
  const artifactPath = raw.match(FILE_ARTIFACT_CONTENT_SRC_RE)?.[1];
  return artifactPath || raw;
}


export function productDetailImageDataUrl(artifact: any): string {
  const mimeType = text(artifact?.mimeType) || 'image/png';
  const dataBase64 = text(artifact?.dataBase64);
  return dataBase64 && mimeType.toLowerCase().startsWith('image/')
    ? `data:${mimeType};base64,${dataBase64}`
    : '';
}


export async function hydrateOfficialDetailEditorImages(editor: HTMLDivElement) {
  const images = Array.from(editor.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(
    images.map(async (image) => {
      const originalSrc =
        image.getAttribute(PRODUCT_DETAIL_ARTIFACT_SRC_ATTR) || image.getAttribute('src') || '';
      const artifactId = productDetailImageArtifactId(originalSrc);
      if (!artifactId || image.getAttribute('src')?.startsWith('data:')) return;
      image.setAttribute(
        PRODUCT_DETAIL_ARTIFACT_SRC_ATTR,
        productDetailPersistentImageSrc(originalSrc)
      );
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
    })
  );
}


export function serializeOfficialDetailEditorHtml(editor: HTMLDivElement | null): string {
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


export function readBrowserFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;]+;base64,/, ''));
    reader.onerror = () => reject(reader.error || new Error('File read failed.'));
    reader.readAsDataURL(file);
  });
}


export function objectOrEmpty(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}


export type ProductSitePublishingDraft = {
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


export function productSitePublishingDefaults(
  product: NormalizedProduct,
  siteCode = normalizeBrand(product.brand)
): ProductSitePublishingDraft {
  const siteMeta = objectOrEmpty(objectOrEmpty(product.raw?.meta)[siteCode]);
  const brandMeta = Object.keys(siteMeta).length ? siteMeta : productBrandMeta(product);
  const libraryMeta = productLibraryMeta(product);
  const firstSellingPoint = Array.isArray(libraryMeta.sellingPoints)
    ? text(libraryMeta.sellingPoints[0])
    : '';
  const baseSlug =
    text(brandMeta.slug) || text(product.sku) || text(product.model) || text(product.id);
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


export function productSitePublishingDraftFromAssignment(
  product: NormalizedProduct,
  assignment?: WebsiteShelfAssignment,
  siteCode?: string
): ProductSitePublishingDraft {
  const defaults = productSitePublishingDefaults(
    product,
    siteCode || assignment?.siteCode || normalizeBrand(product.brand)
  );
  const meta = objectOrEmpty(assignment?.siteMeta);
  const metaCategory = objectOrEmpty(meta.siteProductCategory);
  return {
    ...defaults,
    siteCode: assignment?.siteCode || defaults.siteCode,
    publicSlug: text(assignment?.publicSlug) || defaults.publicSlug,
    siteProductCategoryId: text(assignment?.siteProductCategoryId || metaCategory.id),
    websiteCategory: text(assignment?.websiteCategory) || defaults.websiteCategory,
    websiteCategoryPath: text(
      meta.websiteCategoryPath || metaCategory.path || assignment?.websiteCategory
    ),
    displayOrder: String(nonNegativeInt(assignment?.displayOrder ?? defaults.displayOrder)),
    isFeatured: Boolean(assignment?.isFeatured),
    siteTitle: text(assignment?.siteTitle) || defaults.siteTitle,
    siteSummary: text(assignment?.siteSummary) || defaults.siteSummary,
    tags: Array.isArray(meta.tags) ? meta.tags.map(text).filter(Boolean).join(', ') : defaults.tags,
    series: text(meta.series) || defaults.series,
  };
}


export function productSitePublishingPayload(
  product: NormalizedProduct,
  draft: ProductSitePublishingDraft,
  options: { includeProductRef?: boolean; suggestion?: SitePublishingSuggestion | null } = {}
): Record<string, unknown> {
  const publicSlug = slug(draft.publicSlug);
  const siteProductCategoryId = text(draft.siteProductCategoryId);
  const suggestedCategoryId = text(options.suggestion?.suggestedWebsiteCategory?.id);
  const suggestedCategory = text(options.suggestion?.suggestedWebsiteCategory?.name);
  const suggestedCategoryPath = text(
    options.suggestion?.suggestedWebsiteCategory?.path ||
      options.suggestion?.suggestedWebsiteCategory?.name
  );
  const suggestedSeries = text(options.suggestion?.suggestedSeries?.value);
  if (!publicSlug) throw new Error('请填写官网 URL slug。');
  if (!siteProductCategoryId) throw new Error('请选择官网目录。');
  return {
    ...(options.includeProductRef === false
      ? {}
      : {
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
      websiteCategorySource:
        suggestedCategoryId && siteProductCategoryId !== suggestedCategoryId
          ? 'manual'
          : options.suggestion?.suggestedWebsiteCategory?.matchReason || 'manual',
      productCategoryBinding:
        options.suggestion?.productCategory || productCategoryBinding(product),
      defaultSeries: suggestedSeries || null,
      seriesSource:
        suggestedSeries && text(draft.series) !== suggestedSeries
          ? 'manual'
          : options.suggestion?.suggestedSeries?.source || 'manual',
    },
  };
}


export function siteCategorySelectOptions(
  rows: SiteProductCategoryRow[]
): SiteProductCategorySelectOption[] {
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


export function publicProjectionPath(product: Record<string, any> | null): string {
  if (!product) return '';
  return text(
    product.websiteCategoryPath ||
      objectOrEmpty(product.siteMeta).websiteCategoryPath ||
      product.websiteCategory
  );
}


export function buildSiteProductCategoryTree(
  rows: SiteProductCategoryRow[]
): SiteProductCategoryTreeNode[] {
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
      items.sort(
        (a, b) =>
          (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, 'zh-Hans-CN')
      );
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
      node.displayOrder = Math.min(
        node.displayOrder || row.displayOrder || 0,
        row.displayOrder || 0
      );
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
    items.sort(
      (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'zh-Hans-CN')
    );
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(root);
  return root;
}



export function splitWebsiteCategoryPath(value: string): string[] {
  return String(value || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}



export function emptySiteCategoryRow(category: string): SiteProductCategoryRow {
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



// ── 第三刀追加 ──
export type ProductStock = Product['stock'];

export type CatalogCategoryFilter = 'all' | string;

export type WebsiteShelfTransition = 'publishing' | 'hiding';

export type CreateProductDraft = {
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

export type ProductPendingImageDraft = {
  file: File;
  previewUrl: string;
};

export type EditProductDraft = {
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

export type RowActionState = {
  dirty: boolean;
  saving: boolean;
  savingAction?: 'save' | 'status' | 'archive';
  success: string;
  error: string;
};

export type ProductPilotSummary = {
  products: number;
  categories: number;
  websitePublished: number;
  needsCompletion: number;
};

export const CATEGORY_KEYS = new Set<string>(CATEGORIES.map((category) => category.key));

export const PRODUCT_BASE_CATEGORY_BRAND = 'common';

export const STOCK: Record<ProductStock, { label: string; className: string; tone: string }> = {
  in: { label: '现货', className: 'badge-success', tone: 'var(--success)' },
  low: { label: '低库存', className: 'badge-warning', tone: 'var(--warning)' },
  order: { label: '需订货', className: 'badge-danger', tone: 'var(--danger)' },
};

export const PRODUCT_DETAIL_LOCALE = 'zh-CN';

export const fmt = (value: number) => `￥${Math.round(value || 0).toLocaleString('zh-CN')}`;

export const pct = (value: number) => `${Math.round(value || 0)}%`;


export function productCategoryNodeValue(node: ProductCategoryNode | null | undefined): string {
  return text(node?.code || node?.slug || node?.nameCn || node?.name || node?.id);
}


export function productCategoryDisplayLabel(value: unknown, tree: ProductCategoryNode[] = []): string {
  const raw = text(value);
  if (!raw) return '';
  const flat = flattenCategoryTree(tree);
  const matched = flat.find((node) =>
    [node.id, node.code, node.slug, node.nameCn, node.name, node.nameEn].some(
      (item) => text(item) === raw
    )
  );
  if (matched) return categoryOptionLabel(matched);
  const builtin = CATEGORIES.find((category) => category.key === raw);
  return builtin?.label || raw;
}


export function statusLabel(status: string): string {
  if (status === 'active') return '启用';
  if (status === 'inactive') return '停用';
  if (status === 'archived') return '已归档';
  return status || '未知';
}


export function statusTone(status: string): 'success' | 'warning' | 'neutral' | 'info' {
  if (status === 'active') return 'success';
  if (status === 'inactive') return 'warning';
  if (status === 'archived') return 'neutral';
  return 'info';
}


export function productDetailContentItems(result: unknown): Array<Record<string, any>> {
  const payload = (result as any)?.data ?? result;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}


export function productContentItem(result: unknown): Record<string, any> {
  return (
    productDetailContentItems(result).find((row) => row?.locale === PRODUCT_DETAIL_LOCALE) ||
    productDetailContentItems(result)[0] ||
    {}
  );
}


export function featureBenefitLines(value: unknown): string {
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


export function highlightMetricLines(value: unknown): string {
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


export function faqLines(value: unknown): string {
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


export function contentDraftPatchFromResult(result: unknown): Partial<EditProductDraft> {
  const item = productContentItem(result);
  const marketing = objectOrEmpty(item.marketing);
  const patch: Partial<EditProductDraft> = {};
  if ('officialDetailHtml' in item) patch.officialDetailHtml = text(item.officialDetailHtml);
  if ('series' in marketing) patch.series = text(marketing.series);
  if ('headline' in marketing) patch.tagline = text(marketing.headline);
  if ('subhead' in marketing) patch.publicSummary = text(marketing.subhead);
  if ('officialEnglishName' in marketing)
    patch.officialEnglishName = text(marketing.officialEnglishName);
  if ('badges' in marketing)
    patch.badges = Array.isArray(marketing.badges)
      ? marketing.badges.map(text).filter(Boolean).join(', ')
      : '';
  if ('certs' in marketing)
    patch.complianceCertificates = Array.isArray(marketing.certs)
      ? marketing.certs.map(text).filter(Boolean).join('\n')
      : '';
  if ('features' in marketing || 'featureBenefits' in marketing)
    patch.featureBenefits = featureBenefitLines(marketing.features || marketing.featureBenefits);
  if ('highlights' in marketing)
    patch.highlightMetrics = highlightMetricLines(marketing.highlights);
  if ('faq' in marketing) patch.faqs = faqLines(marketing.faq);
  return patch;
}


export function assignmentKey(productId: string, tenantId: string): string {
  return `${tenantId || '-'}:${productId}`;
}


export function assignmentsForProduct(
  map: Map<string, WebsiteShelfAssignment[]>,
  product: NormalizedProduct
): WebsiteShelfAssignment[] {
  const byTenant = map.get(assignmentKey(product.id, tenantIdForProduct(product))) || [];
  const byProduct = map.get(product.id) || [];
  const seen = new Set<string>();
  return [...byTenant, ...byProduct].filter((assignment) => {
    const key =
      assignment.id ||
      `${assignment.siteCode || ''}:${assignment.productTenantId || ''}:${assignment.productId || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return !assignment.deletedAt;
  });
}


export function activeWebsiteAssignments(assignments: WebsiteShelfAssignment[]): WebsiteShelfAssignment[] {
  return assignments.filter(
    (assignment) => !assignment.deletedAt && assignment.status !== 'hidden'
  );
}


export function websiteShelfMeta(
  assignment?: WebsiteShelfAssignment,
  transition?: WebsiteShelfTransition
) {
  if (transition === 'publishing') return { label: '官网发布中', tone: 'info' as const };
  if (transition === 'hiding') return { label: '官网隐藏中', tone: 'warning' as const };
  if (!assignment) return { label: '未配置官网', tone: 'neutral' as const };
  if (assignment.deletedAt || assignment.status === 'hidden')
    return { label: '官网已隐藏', tone: 'warning' as const };
  if (assignment.status === 'published') return { label: '官网已发布', tone: 'success' as const };
  return { label: '草稿待发布', tone: 'neutral' as const };
}


export function websiteShelfSummary(assignments: WebsiteShelfAssignment[]) {
  const active = activeWebsiteAssignments(assignments);
  if (!active.length) return { label: '未配置官网', tone: 'neutral' as const };
  const published = active.filter((assignment) => assignment.status === 'published').length;
  if (active.length === 1) return websiteShelfMeta(active[0]);
  if (published === active.length)
    return { label: `已发布 ${active.length} 个官网`, tone: 'success' as const };
  if (published > 0)
    return { label: `部分发布 ${published}/${active.length}`, tone: 'info' as const };
  return { label: `待发布 ${active.length} 个官网`, tone: 'neutral' as const };
}


export function assignmentWebsiteCategoryPath(assignment: WebsiteShelfAssignment): string {
  const meta = objectOrEmpty(assignment.siteMeta);
  const categoryMeta = objectOrEmpty(meta.siteProductCategory);
  return text(meta.websiteCategoryPath || categoryMeta.path || assignment.websiteCategory);
}


export function preferredWebsiteAssignment(
  assignments: WebsiteShelfAssignment[],
  productBrand?: string
): WebsiteShelfAssignment | null {
  const active = activeWebsiteAssignments(assignments);
  const brand = normalizeBrand(productBrand);
  return (
    active.find(
      (assignment) =>
        assignment.status === 'published' && normalizeBrand(assignment.siteCode) === brand
    ) ||
    active.find((assignment) => assignment.status === 'published') ||
    active.find((assignment) => normalizeBrand(assignment.siteCode) === brand) ||
    active[0] ||
    null
  );
}


export function productReadinessSummary(product: NormalizedProduct) {
  const libraryMeta = productLibraryMeta(product);
  const dimensions = objectOrEmpty(libraryMeta.readinessDimensions);
  const entries = Object.entries(PRODUCT_READINESS_LABELS).map(([key, label]) => {
    const value = dimensions[key];
    const detail = typeof value === 'string' ? { status: value } : objectOrEmpty(value);
    return { key, label, status: text(detail.status) || 'incomplete', note: text(detail.note) };
  });
  const ready = entries.filter(
    (item) => item.status === 'ready' || item.status === 'not_applicable'
  ).length;
  return {
    status: text(libraryMeta.dataReadinessStatus),
    ready,
    total: entries.length,
    details: entries
      .map(
        (item) =>
          `${item.label}：${item.status === 'ready' ? '就绪' : item.status === 'not_applicable' ? '不适用' : '待补全'}${item.note ? `（${item.note}）` : ''}`
      )
      .join('\n'),
  };
}


export function productPublishRequiredReadiness(product: NormalizedProduct): {
  ready: boolean;
  missing: string[];
} {
  const categoryBinding = productCategoryBinding(product);
  const content = productContentItem(
    product.raw?.publicContent || product.raw?.content || product.raw
  );
  const marketing = objectOrEmpty(content.marketing || product.raw?.marketing);
  const brandMeta = productBrandMeta(product);
  const libraryMeta = productLibraryMeta(product);
  const positioning = objectOrEmpty(product.raw?.positioning);
  const features = marketing.features || marketing.featureBenefits;
  const hasFeatureCopy = Array.isArray(features)
    ? features.length > 0
    : Boolean(
        text(features || marketing.sellingPoints) ||
        (Array.isArray(positioning.sellingPoints) && positioning.sellingPoints.length > 0) ||
        (Array.isArray(libraryMeta.sellingPoints) && libraryMeta.sellingPoints.length > 0)
      );
  const hasSummary = Boolean(
    text(
      marketing.subhead ||
        marketing.summary ||
        marketing.description ||
        product.raw?.publicSummary ||
        brandMeta.tagline ||
        product.spec
    )
  );
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


export function optionalNonNegativeNumber(value: unknown): number | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}


export function nullableNonNegativeNumber(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}


export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n|[;；]/g)
    .map(text)
    .filter(Boolean);
}


export function parseKeyValueLines(value: string): Array<{ k: string; v: string }> {
  return splitLines(value).map((line) => {
    const parts = line.split(/[:：=]/);
    const k = text(parts.shift());
    const v = text(parts.join(':'));
    return k && v ? { k, v } : { k: line, v: '' };
  });
}


export function keyValueLines(value: unknown): string {
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


export function productUpdatePayload(
  product: NormalizedProduct,
  draft: EditProductDraft,
  status?: 'active' | 'inactive'
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


export function productStatusPayload(
  product: NormalizedProduct,
  status: 'active' | 'inactive'
): Record<string, unknown> {
  const tenantId = tenantIdForProduct(product);
  return { status, ...(tenantId ? { tenantId } : {}) };
}


export function productImageSrc(product: NormalizedProduct): string {
  return productMainImageSrc(product);
}


export function productAssetUrl(ref: Record<string, any>): string {
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


export function isImageAsset(ref: Record<string, any>) {
  const role = text(ref.role).toLowerCase();
  const mimeType = text(ref.mimeType || ref.type).toLowerCase();
  const name = text(ref.filename || ref.name || ref.url || ref.src).toLowerCase();
  return (
    role === 'main' ||
    role === 'card' ||
    role === 'image' ||
    mimeType.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|avif)(?:$|\?)/i.test(name)
  );
}


export function isManualPdfAsset(ref: Record<string, any>) {
  const role = text(ref.role).toLowerCase();
  const mimeType = text(ref.mimeType || ref.type).toLowerCase();
  const name = text(ref.filename || ref.name || ref.url || ref.src).toLowerCase();
  return (
    role === 'doc' ||
    role === 'manual' ||
    role === 'pdf' ||
    mimeType === 'application/pdf' ||
    /\.pdf(?:$|\?)/i.test(name)
  );
}


export function productMainImageSrc(product: NormalizedProduct): string {
  const raw = objectOrEmpty(product.raw);
  const meta = objectOrEmpty(raw.meta);
  const brandMeta = productBrandMeta(product);
  const assetRefs = Array.isArray(raw.assetRefs) ? raw.assetRefs : [];
  const imageRef = assetRefs.find((item: Record<string, any>) => isImageAsset(item)) || {};
  return text(
    productAssetUrl(imageRef) ||
      artifactContentUrl(
        meta.imageArtifactId || brandMeta.imageArtifactId || raw.imageArtifactId
      ) ||
      brandMeta.image ||
      brandMeta.imageUrl ||
      meta.imageUrl ||
      meta.mainImageUrl ||
      raw.imageUrl ||
      raw.image
  );
}


export function savedProductManualPdfs(product: NormalizedProduct): ProductManualPdfDraft[] {
  const raw = objectOrEmpty(product.raw);
  const assetRefs = Array.isArray(raw.assetRefs) ? raw.assetRefs : [];
  return assetRefs
    .filter((ref: Record<string, any>) => isManualPdfAsset(ref))
    .sort(
      (left: Record<string, any>, right: Record<string, any>) =>
        Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
    )
    .map((ref: Record<string, any>, index: number) => {
      const artifactId = text(ref.artifactId || ref.id);
      const name =
        text(ref.filename || ref.name || ref.originalName) || `产品说明 ${index + 1}.pdf`;
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


export async function uploadProductMainImageRef(
  mainImage: ProductPendingImageDraft | null,
  entityId: string
) {
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
    url:
      text((artifact as any)?.contentUrl) ||
      `/api/v2/file-artifact/${encodeURIComponent(artifactId)}/content`,
  };
}


export async function uploadProductManualPdfRefs(manualPdfs: ProductManualPdfDraft[], sku: string) {
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
        url:
          text((artifact as any)?.contentUrl) ||
          `/api/v2/file-artifact/${encodeURIComponent(artifactId)}/content`,
      };
    })
  ).then((refs) => refs.filter(Boolean));
}


export function productPublicContentPayload(
  product: NormalizedProduct | null,
  draft: Pick<
    CreateProductDraft,
    | 'name'
    | 'currency'
    | 'series'
    | 'tagline'
    | 'publicSummary'
    | 'officialEnglishName'
    | 'badges'
    | 'technicalSpecs'
    | 'sellingPoints'
    | 'featureBenefits'
    | 'highlightMetrics'
    | 'faqs'
    | 'complianceCertificates'
    | 'officialDetailHtml'
  >
) {
  const specs = parseKeyValueLines(draft.technicalSpecs);
  const featureBenefits = parseKeyValueLines(draft.featureBenefits || draft.sellingPoints).map(
    (item) => ({
      title: item.k,
      desc: item.v,
    })
  );
  const highlights = parseKeyValueLines(draft.highlightMetrics).map((item) => ({
    label: item.k,
    value: item.v,
  }));
  const faq = parseKeyValueLines(draft.faqs)
    .map((item) => ({
      q: item.k,
      a: item.v,
    }))
    .filter((item) => item.q && item.a);
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


export function productPublicContentSignature(value: unknown): string {
  const item = productContentItem(value);
  return JSON.stringify({
    officialDetailHtml: text(item.officialDetailHtml),
    marketing: objectOrEmpty(item.marketing),
  });
}


export async function saveProductPublicContent(
  productId: string,
  tenantId: string,
  product: NormalizedProduct | null,
  draft: Pick<
    CreateProductDraft,
    | 'name'
    | 'currency'
    | 'series'
    | 'tagline'
    | 'publicSummary'
    | 'officialEnglishName'
    | 'badges'
    | 'technicalSpecs'
    | 'sellingPoints'
    | 'featureBenefits'
    | 'highlightMetrics'
    | 'faqs'
    | 'complianceCertificates'
    | 'officialDetailHtml'
  >
) {
  await products.upsertContent(productId, {
    ...(tenantId ? { tenantId } : {}),
    ...productPublicContentPayload(product, draft),
  });
}


export function createCategorySelection(draft: CreateProductDraft, tree: ProductCategoryNode[]) {
  const flat = flattenCategoryTree(tree);
  const level1 = flat.find((item) => item.id === draft.categoryLevel1Id) || null;
  const level2 = flat.find((item) => item.id === draft.categoryLevel2Id) || null;
  const level3 = flat.find((item) => item.id === draft.categoryLevel3Id) || null;
  const leaf = level3 || level2 || level1;
  const path = [level1, level2, level3]
    .filter(Boolean)
    .map((item) => item?.name || item?.code)
    .join(' / ');
  return { level1, level2, level3, leaf, path };
}


export function createProductPayload(
  draft: CreateProductDraft,
  categoryTree: ProductCategoryNode[],
  brandOverride?: ProductBrand,
  options: { includeCategoryBinding?: boolean } = {}
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
    ...(includeCategoryBinding
      ? {
          primaryCategoryId,
          categoryLevel1Id,
          categoryLevel2Id,
          categoryLevel3Id: categoryLevel3Id || null,
          categoryPath: categorySelection.path,
        }
      : {}),
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
        ...(includeCategoryBinding
          ? {
              primaryCategoryId,
              categoryLevel1Id,
              categoryLevel2Id,
              categoryLevel3Id: categoryLevel3Id || null,
            }
          : {}),
        series: text(draft.series),
        tagline: text(draft.tagline),
        en: text(draft.officialEnglishName),
        badges: splitBadges(draft.badges),
      },
    },
  };
}


export function isProductModelExistsError(error: unknown): boolean {
  const details = (error as any)?.details;
  return Number((error as any)?.status) === 409 && details?.code === 'PRODUCT_MODEL_EXISTS';
}


export function productModelExistsMessage(error: unknown): string {
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


export type ProductLibraryCompletenessDraft = Pick<
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


export function flattenCategoryTree(tree: ProductCategoryNode[]): ProductCategoryNode[] {
  return tree.flatMap((item) => [item, ...flattenCategoryTree(item.children)]);
}



export function categoryOptionLabel(item: ProductCategoryNode): string {
  return `${item.name || item.code}${item.status === 'inactive' ? '（已停用）' : ''}`;
}



export const PRODUCT_READINESS_LABELS: Record<string, string> = {
  identity: '身份',
  taxonomy: '分类',
  sku: 'SKU',
  technical: '技术',
  compliance: '合规',
  content: '内容',
  assets: '素材',
  market: '市场',
};


