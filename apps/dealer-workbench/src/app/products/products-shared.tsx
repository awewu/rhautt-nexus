'use client';
// 产品域共享类型/常量/小组件（page 与 category-manager 共用）
// 2026-08 从 products/page.tsx（12538 行）机械化拆出：逻辑零改动，只做搬迁。

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


export function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 30,
        padding: '5px 10px',
        borderRadius: 999,
        border:
          tone === 'success' ? '1px solid rgba(76, 175, 80, 0.28)' : '1px solid var(--border)',
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
  const color =
    tone === 'success'
      ? 'var(--success)'
      : tone === 'warning'
        ? 'var(--warning)'
        : tone === 'info'
          ? 'var(--brand-500, var(--brand))'
          : 'var(--t-secondary)';
  return (
    <div className="product-edit-check-item" style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <span className="t-label">{label}</span>
      <strong style={{ color, fontSize: 13, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
        {value || '未维护'}
      </strong>
      {note ? (
        <span style={{ color: 'var(--t-tertiary)', fontSize: 11, lineHeight: 1.35 }}>{note}</span>
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


