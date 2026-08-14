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

