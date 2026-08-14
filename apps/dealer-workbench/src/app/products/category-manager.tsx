'use client';
// 品类管理簇（管理视图/树/CRUD 面板/编辑器）
// 2026-08 从 products/page.tsx（12538 行）机械化拆出：逻辑零改动，只做搬迁。
// 2026-08 全页 UX 重构三期 · WorkspaceKit 化：渲染层去内联样式，静态布局全 Tailwind；
// 仅保留树形缩进等动态计算值为合法内联例外（逐处注释）。

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

import { CategoryChip, CategoryCountPill, DEFAULT_CREATE_BRAND_OPTIONS, FloatingDialog, FloatingDialogOptions, FloatingDialogState, FloatingPromptOptions, Metric, ProductBrand, ProductCategoryDraft, ProductCategoryNode, ProductCategoryUsage, SiteProductCategoryResponse, SiteProductCategoryRow, SiteProductCategoryTreeNode, buildSiteProductCategoryTree, categoryDraftFromNode, categoryDraftPayload, displayBrand, emptyCategoryDraft, errorMessage, flattenCategoryTree, flattenRawCategoryItems, internalCategoryCode, nonNegativeInt, normalizeProductCategoryTree, productCategoryItems, slug, text, useFloatingDialog } from './products-shared';

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
    <div className="grid gap-4">
      <section className="card-elevated p-4.5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-[1_1_320px]">
            <p className="t-label">Product Category Manager</p>
            <h2 className="t-headline mt-1">
              产品分类
            </h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
              按品牌查看独立分类树。本页仅提供管理入口和树形展示，新增、编辑、停用、删除会在后续
              CRUD issue 中接入。
            </p>
          </div>
          <span
            className={`${
              error
                ? 'badge badge-warning'
                : data?.apiUnavailable
                  ? 'badge badge-grey'
                  : isLoading
                    ? 'badge badge-grey'
                    : 'badge badge-success'
            } max-w-full [overflow-wrap:anywhere]`}
            title={error ? String((error as Error)?.message || error) : undefined}
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-0.5 text-xs font-semibold text-muted-foreground">
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

      <section className="g4 gap-3">
        <Metric label="一级分类" value={String(levelCounts[0])} hint="品牌顶层菜单" />
        <Metric label="二级分类" value={String(levelCounts[1])} hint="系统或菜单分组" />
        <Metric label="三级分类" value={String(levelCounts[2])} hint="可选细分层级" />
        <Metric label="启用分类" value={String(activeCount)} hint="当前可用于后续绑定" />
      </section>

      <section className="card-elevated overflow-hidden">
        <div className="border-b p-4.5">
          <p className="t-label">{displayBrand(brandCode)}</p>
          <h3 className="t-headline mt-1">
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


export function activeCategoryOptions(
  items: ProductCategoryNode[],
  selected?: ProductCategoryNode | null
): ProductCategoryNode[] {
  const options = items.filter((item) => item.status !== 'inactive');
  if (selected && !options.some((item) => item.id === selected.id)) return [...options, selected];
  return options;
}


function CategoryTreeSurface({ tree }: { tree: ProductCategoryNode[] }) {
  return (
    <div className="grid gap-2.5 p-4">
      <div className="grid grid-cols-[minmax(180px,1.1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-2.5 text-xs font-bold text-muted-foreground/70">
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
    <div className="inset grid grid-cols-[minmax(180px,1.1fr)_minmax(160px,1fr)_minmax(160px,1fr)] items-stretch gap-2.5">
      <CategoryNodeCard node={node} />
      <div className="grid gap-2">
        {secondLevel.length ? (
          secondLevel.map((child) => <CategoryNodeCard key={child.id} node={child} />)
        ) : (
          <CategoryLevelPlaceholder label="未设置二级分类" />
        )}
      </div>
      <div className="grid gap-2">
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


function CategoryNodeCard({
  node,
  parentName,
}: {
  node: ProductCategoryNode;
  parentName?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-background px-3 py-2.5 shadow-xs">
      {parentName ? (
        <p className="text-[11px] text-muted-foreground/70 [overflow-wrap:anywhere]">
          {parentName}
        </p>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <strong className="min-w-0 text-[13px] [overflow-wrap:anywhere]">
          {node.name || node.code}
        </strong>
        <StatusPill tone={node.status === 'inactive' ? 'warning' : 'success'}>
          {node.status === 'inactive' ? '停用' : '启用'}
        </StatusPill>
        <StatusPill tone={node.showOnWebsite ? 'info' : 'neutral'}>
          {node.showOnWebsite ? '允许官网映射' : '不参与官网映射'}
        </StatusPill>
      </div>
      <p className="mt-[5px] text-[11px] text-muted-foreground/70 tabular-nums [overflow-wrap:anywhere]">
        {node.code || '未设置编码'} · 排序 {node.sortOrder}
      </p>
    </div>
  );
}


function CategoryLevelPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60px] items-center justify-center rounded-lg border border-dashed bg-secondary p-2.5 text-center text-xs text-muted-foreground/70">
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
  const [childrenByParent, setChildrenByParent] = useState<Record<string, ProductCategoryNode[]>>(
    {}
  );
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
    { revalidateOnFocus: false }
  );
  const {
    data: websiteCategoryData,
    error: websiteCategoryError,
    isLoading: websiteCategoryLoading,
    mutate: mutateWebsiteCategories,
  } = useSWR<SiteProductCategoryResponse>(
    activeCategoryTab === 'website'
      ? ['/api/v2/brand-sites', activeSiteCode, 'product-categories']
      : null,
    async () => siteProductCategories.list(activeSiteCode) as Promise<SiteProductCategoryResponse>,
    { revalidateOnFocus: false }
  );
  const tree = data?.tree || [];
  const allCategoryRows = useMemo(() => flattenCategoryTree(tree), [tree]);
  const flat = useMemo(
    () => flattenLazyCategoryRows(tree, expandedIds, childrenByParent),
    [childrenByParent, expandedIds, tree]
  );
  const selected = flat.find((item) => item.id === selectedId) || null;
  const createParent = createParentId
    ? flat.find((item) => item.id === createParentId) || null
    : null;
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
    if (!editorOpen || !selected || mode !== 'edit')
      return () => {
        cancelled = true;
      };
    brandProductCategories
      .usage(selected.id)
      .then((result) => {
        if (!cancelled)
          setUsage({
            boundProductCount: Number(result?.boundProductCount || 0),
            childCategoryCount: Number(result?.childCategoryCount || 0),
          });
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      });
    return () => {
      cancelled = true;
    };
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
      const result = await brandProductCategories.list({
        brandCode,
        parentId: parent.id,
        metrics: 'false',
      });
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
    setDraft(
      emptyCategoryDraft(nextCategorySortOrder(parent), internalCategoryCode(parent?.code || 'cat'))
    );
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
      const childCategoryCount =
        target.children.length ||
        Number(usage?.childCategoryCount || target.childCategoryCount || 0);
      if (childCategoryCount > 0) {
        const message = `不能删除：当前分类下面还有 ${childCategoryCount} 个下级分类。请先删除下级分类。`;
        setActionError(message);
        return;
      }
      const guard = await brandProductCategories.usage(target.id);
      const boundProductCount = Number(guard?.boundProductCount || guard?.directProductCount || 0);
      const latestChildCategoryCount = Number(guard?.childCategoryCount || 0);
      const descendantProductCount = Number(
        guard?.descendantProductCount || guard?.descendantBoundProductCount || 0
      );
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
          next[target.parentId!] = (next[target.parentId!] || []).filter(
            (item) => item.id !== target.id
          );
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
    <div className="grid gap-4">
      <section className="card-elevated rounded-lg p-4.5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-[1_1_320px]">
            <p className="t-label">基础资料 / 产品分类</p>
            <h2 className="t-headline mt-1">
              公共产品分类与官网目录管理
            </h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
              这里维护的是公共产品库的事实分类，用于产品录入、导入、筛选和经销商 API
              输出；不是官网栏目。
              官网目录用于给产品库提供官网栏目选项；产品归属、URL、推荐、官网文案和图片都在产品库维护。
            </p>
          </div>
          <span
            className={
              error ? 'badge badge-warning' : isLoading ? 'badge badge-grey' : 'badge badge-success'
            }
          >
            {error ? '加载失败' : isLoading ? '同步中' : '已同步'}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-0.5 text-xs font-semibold text-muted-foreground">
            当前基座
          </span>
          <span className="badge badge-info">公共产品库</span>
          <span className="text-xs text-muted-foreground/70">
            所有品牌产品录入、导入、筛选共用这一套分类。
          </span>
        </div>
        <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5">
          <div className="inset p-3">
            <strong className="block text-[13px]">先建分类，再录产品</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              产品录入页会直接读取这里的分类树，运营人员不用手工重复输入分类名称。
            </p>
          </div>
          <div className="inset p-3">
            <strong className="block text-[13px]">停用不破坏历史数据</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              分类停用后，历史产品仍保留绑定；新产品录入时不再推荐使用。
            </p>
          </div>
          <div className="inset p-3">
            <strong className="block text-[13px]">官网目录只搭骨架</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              这里只维护官网目录树；产品选择哪个官网目录，回到产品库或上架配置中完成。
            </p>
          </div>
        </div>
      </section>

      <section className="card-elevated flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3">
        <div>
          <p className="t-label">当前产品基座分类</p>
          <strong className="mt-[3px] block">公共产品库</strong>
        </div>
        <div className="flex flex-wrap gap-2">
          <CategoryCountPill label="已加载" value={loadedCount} />
          <CategoryCountPill label="根节点" value={tree.length} />
          <CategoryCountPill label="启用" value={activeCount} tone="success" />
        </div>
      </section>

      <section className="card-elevated rounded-lg p-3.5">
        <div role="tablist" aria-label="产品分类管理范围" className="flex flex-wrap gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategoryTab === 'base'}
            className={
              activeCategoryTab === 'base' ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'
            }
            onClick={() => setActiveCategoryTab('base')}
          >
            产品基座分类
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategoryTab === 'website'}
            className={
              activeCategoryTab === 'website' ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'
            }
            onClick={() => setActiveCategoryTab('website')}
          >
            官网目录管理
          </button>
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          产品基座分类是全产品库统一事实分类；官网目录管理只维护每个官网的栏目树，作为产品库发布配置的可选目录。
        </p>
      </section>

      {notice ? (
        <span className="badge badge-success justify-self-start">
          {notice}
        </span>
      ) : null}
      {actionError ? (
        <span className="badge badge-warning justify-self-start [overflow-wrap:anywhere]">
          {actionError}
        </span>
      ) : null}

      <section className="grid items-start gap-4">
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
            className="fixed inset-0 z-[80] grid items-center justify-items-center overflow-auto bg-[rgba(15,23,42,0.28)] p-6"
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-[640px]"
            >
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
          <div className="card-elevated w-full justify-self-stretch overflow-hidden rounded-lg">
            <div className="flex items-center justify-between gap-3 border-b p-4.5">
              <div>
                <p className="t-label">{displayBrand(brandCode)}</p>
                <h3 className="t-headline mt-1">
                  产品基座分类树
                </h3>
              </div>
              {canCreate && (
                <button
                  type="button"
                  className="btn btn-brand btn-sm"
                  onClick={() => startCreate(null)}
                  disabled={saving || isLoading}
                >
                  <Plus size={14} />
                  新增根分类
                </button>
              )}
            </div>
            {isLoading ? (
              <WorkbenchTableState
                type="loading"
                title="正在加载产品基座分类"
                description="正在读取公共产品库的一、二、三级分类。"
              />
            ) : error ? (
              <WorkbenchTableState
                type="error"
                title="产品基座分类暂时不可用"
                description={String((error as Error)?.message || error)}
              />
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
                action={
                  canCreate ? (
                    <button
                      type="button"
                      className="btn btn-brand btn-sm"
                      onClick={() => startCreate(null)}
                      disabled={!canWrite || saving}
                    >
                      <Plus size={14} />
                      新增根分类
                    </button>
                  ) : undefined
                }
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
    [expandedPaths, websiteTree]
  );
  const allWebsiteRows = useMemo(
    () => flattenAllSiteProductCategoryRows(websiteTree),
    [websiteTree]
  );
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
  const parentOptions = useMemo(
    () => allWebsiteRows.filter((item) => !blockedParentIds.has(item.id)),
    [allWebsiteRows, blockedParentIds]
  );
  const editingTitle =
    mode === 'create'
      ? createParentId
        ? '新增下级目录'
        : '新增一级目录'
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
      const result = (await siteProductCategories.importEverhot(siteCode)) as any;
      await onChanged();
      setNotice(
        `已导入/更新 ${Number(result?.importedCount || 0)} 个恒热官网目录来源产品，跳过 ${Number(result?.skippedCount || 0)} 个。`
      );
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
      const result =
        mode === 'create'
          ? ((await siteProductCategories.create(siteCode, payload)) as any)
          : editing?.id
            ? ((await siteProductCategories.updateById(siteCode, editing.id, payload)) as any)
            : ((await siteProductCategories.update(siteCode, {
                fromCategory: editing?.websiteCategory,
                toCategory: draft.name,
              })) as any);
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
      setActionError(
        `不能在目录页删除“${editing.websiteCategory}”：已有 ${Number(editing.productCount || 0)} 个产品引用该目录，请先到产品库调整产品官网目录。`
      );
      return;
    }
    const confirmed = window.confirm(`确认删除目录“${editing.websiteCategory}”？`);
    if (!confirmed) return;
    setSaving(true);
    setNotice('');
    setActionError('');
    try {
      const result = editing.id
        ? ((await siteProductCategories.removeById(siteCode, editing.id)) as any)
        : ((await siteProductCategories.clear(siteCode, editing.websiteCategory)) as any);
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
    <div className="card-elevated w-full justify-self-stretch rounded-lg p-4.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-[1_1_320px]">
          <p className="t-label">官网目录管理 / {brandLabel}</p>
          <h3 className="t-headline mt-1">
            官网产品目录树
          </h3>
          <p className="mt-2 text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
            这里只维护官网前台产品目录骨架。产品归属、URL、编码、推荐、官网售价、官网文案和图片，请回到产品库维护。
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => startCreate(null)}
            disabled={!canWrite || saving}
          >
            <Plus size={14} />
            新增一级目录
          </button>
          <button
            type="button"
            className="btn btn-brand btn-sm"
            onClick={importEverhot}
            disabled={!canWrite || saving || siteCode !== 'everhot'}
            title={
              siteCode === 'everhot'
                ? '从恒热旧官网产品数据生成初始化目录'
                : '当前只接入了恒热旧官网目录导入'
            }
          >
            <RefreshCw size={14} />
            {siteCode === 'everhot' ? '导入恒热旧官网目录' : '旧官网导入待接入'}
          </button>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-muted-foreground">官网</span>
        {DEFAULT_CREATE_BRAND_OPTIONS.map((item) => (
          <CategoryChip
            key={item.value}
            active={siteCode === item.value}
            onClick={() => onSiteCodeChange(item.value)}
          >
            {item.label.replace(' ', '官网 ')}
          </CategoryChip>
        ))}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2">
        <CategoryCountPill label="目录数" value={rows.length} />
        <CategoryCountPill label="一级目录" value={websiteTree.length} />
        <CategoryCountPill
          label="启用"
          value={rows.filter((row) => row.status !== 'inactive').length}
          tone="success"
        />
      </div>

      {notice ? (
        <span className="badge badge-success mt-3 inline-flex">
          {notice}
        </span>
      ) : null}
      {actionError ? (
        <span className="badge badge-warning mt-3 inline-flex [overflow-wrap:anywhere]">
          {actionError}
        </span>
      ) : null}

      <div className="mt-3.5 grid grid-cols-[minmax(min(100%,520px),1.12fr)_minmax(min(100%,360px),0.88fr)] items-start gap-3.5">
        <div className="inset rounded-lg bg-background p-3">
          <div className="mb-2.5 flex items-center justify-between gap-2.5">
            <div>
              <p className="t-label">分类树</p>
              <strong className="mt-[3px] block">{brandLabel} 产品目录</strong>
            </div>
            <span className="text-xs text-muted-foreground/70">点击“编辑”在右侧维护</span>
          </div>
          {loading ? (
            <WorkbenchTableState
              type="loading"
              title="正在加载官网目录"
              description="正在读取数据库中的站点产品目录树。"
            />
          ) : error ? (
            <WorkbenchTableState
              type="error"
              title="官网目录暂时不可用"
              description={errorMessage(error)}
            />
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
              description={
                siteCode === 'everhot'
                  ? '可以先导入恒热旧官网目录，也可以手工新增一级目录。'
                  : '当前官网还没有产品目录。可以先手工新增一级目录，后续产品库会读取这里的目录选项。'
              }
              action={
                canWrite ? (
                  <button
                    type="button"
                    className="btn btn-brand btn-sm"
                    onClick={() => startCreate(null)}
                    disabled={saving}
                  >
                    <Plus size={14} />
                    新增一级目录
                  </button>
                ) : undefined
              }
            />
          )}
        </div>

        <aside className="card-elevated sticky top-3 rounded-lg p-3.5">
          {editing || mode === 'create' ? (
            <form onSubmit={saveCategory} className="grid gap-3">
              <div>
                <p className="t-label">{mode === 'create' ? '新增官网目录' : '编辑官网目录'}</p>
                <h4 className="t-headline mt-1 text-base">
                  {editingTitle}
                </h4>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  这里只改目录名称、上下级、排序和启停。产品挂到哪个目录，请在产品库维护。
                </p>
              </div>
              <label className="grid gap-1.5">
                <span className="t-label">目录名称 *</span>
                <input
                  className="input"
                  value={draft.name}
                  required
                  disabled={saving || !canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="如：家用热水"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="t-label">上级目录</span>
                <select
                  className="input"
                  value={draft.parentId}
                  disabled={saving || !canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, parentId: event.target.value }))
                  }
                >
                  <option value="">无，作为一级目录</option>
                  {parentOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {'　'.repeat(Math.max(0, category.level - 1))}
                      {category.name || category.websiteCategory}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground/70">
                  选择“无”就是一级目录；选择某个目录后会成为它的下级目录。
                </span>
              </label>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-2.5">
                <label className="grid gap-1.5">
                  <span className="t-label">排序</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={draft.sortOrder}
                    disabled={saving || !canWrite}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="t-label">状态</span>
                  <select
                    className="input"
                    value={draft.status}
                    disabled={saving || !canWrite}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.isVisible}
                    disabled={saving || !canWrite}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, isVisible: event.target.checked }))
                    }
                  />
                  <span className="text-[13px]">官网显示</span>
                </label>
              </div>
              <label className="grid gap-1.5">
                <span className="t-label">运营说明</span>
                <textarea
                  className="input"
                  rows={3}
                  value={draft.description}
                  disabled={saving || !canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="给运营人员看的备注，可说明这个栏目放什么产品。"
                />
              </label>
              <div className="flex flex-wrap justify-between gap-2.5">
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={clearCategory}
                  disabled={saving || !canWrite || mode === 'create'}
                >
                  <Archive size={14} />
                  删除目录
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditing(null);
                      setMode('edit');
                      setCreateParentId(null);
                    }}
                    disabled={saving}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="btn btn-brand btn-sm"
                    disabled={saving || !canWrite}
                  >
                    <CheckCircle2 size={14} />
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="grid gap-3">
              <div>
                <p className="t-label">操作区</p>
                <h4 className="t-headline mt-1 text-base">
                  先选择左侧分类
                </h4>
                <p className="mt-1.5 text-[13px] text-muted-foreground">
                  点击左侧“编辑”即可维护目录名称、上级目录、排序、启停和运营备注。产品归属、推荐和
                  URL 请到产品库维护。
                </p>
              </div>
              <button
                type="button"
                className="btn btn-brand btn-sm"
                onClick={() => startCreate(null)}
                disabled={!canWrite || saving}
              >
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
  childrenByParent: Record<string, ProductCategoryNode[]>
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


function flattenSiteProductCategoryTree(
  roots: SiteProductCategoryTreeNode[],
  expandedPaths: Set<string>
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


function flattenAllSiteProductCategoryRows(
  roots: SiteProductCategoryTreeNode[]
): SiteProductCategoryTreeNode[] {
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
    <div className="mt-3.5 rounded-lg border bg-background p-2.5">
      <div role="tree" aria-label="官网产品目录树" className="grid min-h-[120px] gap-0.5">
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
              className={`grid min-h-11 grid-cols-[minmax(240px,1fr)_auto] items-center gap-2.5 rounded-lg py-1.5 pr-2 ${
                selectedId === node.id
                  ? 'bg-primary/10'
                  : editable
                    ? 'bg-transparent'
                    : 'bg-secondary'
              }`}
              /* 树形缩进为动态计算值：合法内联例外 */
              style={{ paddingLeft: 8 + Math.max(0, node.level - 1) * 24 }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggle(node)}
                  disabled={!expandable}
                  aria-label={expanded ? '收起官网分类' : '展开官网分类'}
                  className={`h-6 w-6 flex-[0_0_24px] border-0 bg-transparent p-0 text-xs leading-6 ${
                    expandable
                      ? 'cursor-pointer text-muted-foreground'
                      : 'cursor-default text-muted-foreground/70'
                  }`}
                >
                  {expandable ? (expanded ? '▾' : '▸') : ''}
                </button>
                <div className="min-w-0">
                  <strong
                    className={`block text-[13px] [overflow-wrap:anywhere] ${
                      node.level === 1 ? 'font-extrabold' : 'font-semibold'
                    }`}
                  >
                    {node.name}
                  </strong>
                  <span className="mt-0.5 block text-xs text-muted-foreground/70 tabular-nums">
                    {node.level} 级目录 · 排序 {node.sortOrder ?? node.displayOrder ?? 0} ·{' '}
                    {node.status === 'inactive' ? '停用' : '启用'}
                    {node.isVisible === false ? ' · 官网隐藏' : ''}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
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
    <div className="p-2.5">
      <div
        role="tree"
        aria-label="产品基座分类树"
        className="grid min-h-[120px] content-start gap-0.5 rounded-lg border bg-background p-2"
      >
        {rows.map((node) => {
          const expandable =
            node.hasChildren || node.childCategoryCount > 0 || node.children.length > 0;
          const expanded = expandedIds.has(node.id);
          const childCount = node.children.length || node.childCategoryCount;
          return (
            <div
              key={node.id}
              role="treeitem"
              aria-expanded={expandable ? expanded : undefined}
              aria-selected={selectedId === node.id}
              className={`grid min-h-[30px] grid-cols-[minmax(260px,1fr)_auto] items-center gap-2.5 rounded-md py-0.5 pr-2 ${
                selectedId === node.id ? 'bg-primary/10' : 'bg-transparent'
              }`}
              /* 树形缩进为动态计算值：合法内联例外 */
              style={{ paddingLeft: 8 + Math.max(0, node.level - 1) * 22 }}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onToggleExpand(node)}
                  disabled={!expandable || loadingChildren[node.id]}
                  aria-label={expanded ? '收起分类' : '展开分类'}
                  title={expandable ? (expanded ? '收起下级目录' : '展开下级目录') : '暂无下级目录'}
                  className={`h-[18px] w-[18px] flex-[0_0_18px] border-0 bg-transparent p-0 text-xs leading-[18px] ${
                    expandable
                      ? 'cursor-pointer text-muted-foreground'
                      : 'cursor-default text-muted-foreground/70'
                  }`}
                >
                  {loadingChildren[node.id] ? '...' : expandable ? (expanded ? '▾' : '▸') : ''}
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(node)}
                  className="flex min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-foreground"
                >
                  <span
                    className={`leading-tight [overflow-wrap:anywhere] ${
                      node.level === 1 ? 'font-extrabold' : 'font-semibold'
                    }`}
                  >
                    {node.name || node.code}
                  </span>
                  <span className="text-xs text-muted-foreground/70">
                    Level {node.level}
                  </span>
                  <StatusPill tone={node.status === 'inactive' ? 'warning' : 'success'}>
                    {node.status === 'inactive' ? '停用' : '启用'}
                  </StatusPill>
                  <StatusPill tone={node.showOnWebsite ? 'info' : 'neutral'}>
                    {node.showOnWebsite ? '允许官网映射' : '不参与官网映射'}
                  </StatusPill>
                  <span className="text-xs text-muted-foreground/70">{node.code}</span>
                </button>
              </div>
              <div className="flex flex-nowrap items-center justify-end gap-2">
                <span className="text-xs whitespace-nowrap text-muted-foreground/70 tabular-nums">
                  下级 {childCount} / 产品 {node.directProductCount}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm shrink-0"
                  onClick={() => onAddChild(node)}
                  disabled={!canWrite || saving}
                >
                  <Plus size={14} />
                  新增
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm shrink-0"
                  onClick={() => onSelect(node)}
                  disabled={saving}
                >
                  <Edit3 size={14} />
                  修改
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm shrink-0"
                  onClick={() => onDelete(node)}
                  disabled={!canWrite || saving}
                >
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
      <table className="table w-full min-w-[1360px] table-fixed">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[6%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[18%]" />
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
                className={`${
                  node.level > 1
                    ? 'category-tree-row category-tree-row--child'
                    : 'category-tree-row'
                }${selectedId === node.id ? ' bg-primary/10' : ''}`}
              >
                <td>
                  <div
                    className="flex items-center gap-2"
                    /* 树形缩进为动态计算值：合法内联例外 */
                    style={{ paddingLeft: Math.max(0, node.level - 1) * 18 }}
                  >
                    <button
                      type="button"
                      className={`btn btn-ghost btn-sm h-[30px] w-[30px] flex-[0_0_30px] p-0 transition-[background,border-color,color,transform] duration-150 ease-out ${
                        expandable
                          ? 'border border-border bg-background text-foreground'
                          : 'border border-transparent bg-transparent text-muted-foreground/70'
                      } ${expanded ? 'rotate-180' : 'rotate-0'}`}
                      onClick={() => onToggleExpand(node)}
                      disabled={!expandable || loadingChildren[node.id]}
                      aria-label={expanded ? '收起分类' : '展开分类'}
                      title={
                        expandable
                          ? expanded
                            ? '收起下级目录'
                            : '打开下级目录'
                          : '暂无下级目录，可点击右侧新增'
                      }
                    >
                      {loadingChildren[node.id] ? '...' : expandable ? (expanded ? '-' : '+') : '·'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(node)}
                      className="min-w-0 border-0 bg-transparent p-0 text-left text-foreground"
                    >
                      <strong className="block [overflow-wrap:anywhere]">
                        {node.name || node.code}
                      </strong>
                      <span className="text-xs text-muted-foreground/70">
                        Level {node.level}
                      </span>
                    </button>
                  </div>
                </td>
                <td
                  className={`[overflow-wrap:anywhere] ${
                    node.description ? 'text-muted-foreground' : 'text-muted-foreground/70'
                  }`}
                >
                  {node.description || '暂无备注'}
                </td>
                <td className="[overflow-wrap:anywhere]">{node.code}</td>
                <td>{node.sortOrder}</td>
                <td>
                  <StatusPill tone={node.status === 'inactive' ? 'warning' : 'success'}>
                    {node.status === 'inactive' ? '停用' : '启用'}
                  </StatusPill>
                  <div className="mt-1.5">
                    <StatusPill tone={node.showOnWebsite ? 'info' : 'neutral'}>
                      {node.showOnWebsite ? '允许官网映射' : '不参与官网映射'}
                    </StatusPill>
                  </div>
                </td>
                <td>{node.descendantProductCount}</td>
                <td>{node.directProductCount}</td>
                <td>
                  <div className="flex flex-nowrap items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm shrink-0"
                      onClick={() => onAddChild(node)}
                      disabled={!canWrite || saving}
                    >
                      <Plus size={14} />
                      新增
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm shrink-0"
                      onClick={() => onSelect(node)}
                      disabled={saving}
                    >
                      <Edit3 size={14} />
                      修改
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm shrink-0"
                      onClick={() => onDelete(node)}
                      disabled={!canWrite || saving}
                    >
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
    <div className="grid gap-2.5 p-4">
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
    <div className="grid gap-2">
      <CategoryCrudNodeCard
        node={node}
        active={selectedId === node.id}
        saving={saving}
        canWrite={canWrite}
        onSelect={() => onSelect(node)}
        onAddChild={() => onAddChild(node)}
      />
      {node.children.length ? (
        <div
          className="ml-3 grid gap-2 border-l"
          /* 树形缩进为动态计算值：合法内联例外 */
          style={{ paddingLeft: Math.min(node.level, 2) * 18 }}
        >
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
      className={`min-w-0 rounded-md border ${
        active ? 'border-primary bg-primary/10 ring-4 ring-primary/15' : 'bg-background shadow-xs'
      } ${node.level === 1 ? 'px-3.5 py-3' : 'px-3 py-2.5'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 border-0 bg-transparent p-0 text-left font-bold text-foreground [overflow-wrap:anywhere]"
        >
          <span className="mb-[3px] block text-[11px] text-muted-foreground/70">
            {levelLabel}
          </span>
          <span className={`block ${node.level === 1 ? 'text-[15px]' : 'text-[13px]'}`}>
            {node.name || node.code}
          </span>
          <span className="mt-[3px] block text-[11px] text-muted-foreground/70 tabular-nums">
            {node.code || '未设置编码'} · 排序 {node.sortOrder}
          </span>
        </button>
        <StatusPill tone={node.status === 'inactive' ? 'warning' : 'success'}>
          {node.status === 'inactive' ? '停用' : '启用'}
        </StatusPill>
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onSelect}
          disabled={saving}
        >
          <Edit3 size={14} />
          编辑
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAddChild}
          disabled={!canWrite || saving || !canAddChild}
        >
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
  const title =
    mode === 'create' ? `新增 Level ${createLevel} 分类` : selected ? '编辑分类' : '选择分类';
  const subtitle =
    mode === 'create'
      ? createParent
        ? `上级：${createParent.name || createParent.code}`
        : `品牌：${displayBrand(brandCode)}`
      : selected
        ? `${selected.level === 1 ? '一级目录' : selected.level === 2 ? '二级系统' : '三级分类'} / ${selected.code}`
        : '从左侧选择一个分类，或先新增一级目录。';
  const disabled = !canWrite || saving || (mode === 'edit' && !selected);

  return (
    <section className="card-elevated rounded-lg p-4.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-label">分类详情</p>
          <h3 className="t-headline mt-1">
            {title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {subtitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={saving}
            aria-label="关闭"
          >
            <XCircle size={14} />
          </button>
        </div>
      </div>

      {!canWrite ? (
        <p className="field-error mt-3">
          当前账号不能维护产品分类。
        </p>
      ) : null}
      {actionError ? (
        <p className="field-error mt-3">
          {actionError}
        </p>
      ) : null}

      <form onSubmit={onSave} className="mt-4 grid gap-3">
        <label className="grid gap-1.5">
          <span className="t-label">分类名称</span>
          <input
            className="input"
            placeholder="例如：家用、热水系统、空气能热水器"
            value={draft.nameCn}
            required
            disabled={disabled}
            onChange={(event) => onDraft({ ...draft, nameCn: event.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5">
            <span className="t-label">排序</span>
            <input
              className="input"
              type="number"
              min="0"
              max="999999"
              value={draft.sortOrder}
              required
              disabled={disabled}
              onChange={(event) => onDraft({ ...draft, sortOrder: event.target.value })}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="t-label">状态</span>
            <select
              className="input"
              value={draft.status}
              disabled={disabled}
              onChange={(event) =>
                onDraft({
                  ...draft,
                  status: event.target.value === 'inactive' ? 'inactive' : 'active',
                })
              }
            >
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </label>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-md border bg-secondary px-3 py-2.5">
          <span>
            <span className="t-label block">
              允许官网映射
            </span>
            <span className="mt-[3px] block text-xs text-muted-foreground">
              关闭后，该基座分类不会作为官网分类映射来源；不会影响已录入产品，也不会触发产品自动发布。
            </span>
          </span>
          <input
            type="checkbox"
            checked={draft.showOnWebsite}
            disabled={disabled}
            onChange={(event) => onDraft({ ...draft, showOnWebsite: event.target.checked })}
            className="h-[18px] w-[18px] shrink-0 accent-primary"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="t-label">说明</span>
          <textarea
            className="textarea"
            value={draft.description}
            disabled={disabled}
            onChange={(event) => onDraft({ ...draft, description: event.target.value })}
          />
        </label>

        {mode === 'edit' && selected ? (
          <div className="inset flex flex-wrap justify-between gap-3">
            <span className="text-xs text-muted-foreground">已绑定产品</span>
            <strong
              className={`tabular-nums ${
                usage && usage.boundProductCount > 0 ? 'text-warning' : 'text-foreground'
              }`}
            >
              {usage ? usage.boundProductCount : '检查中...'}
            </strong>
          </div>
        ) : null}

        <div className="mt-1 flex flex-wrap justify-between gap-2.5">
          {mode === 'create' ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={saving}
            >
              取消
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onToggleStatus}
                disabled={disabled}
              >
                <XCircle size={14} />
                {selected?.status === 'inactive' ? '启用' : '停用'}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={onDelete}
                disabled={disabled}
              >
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

