'use client';
// 站点发布簇（公开投影回读/站点上架面板/官方详情编辑器）
// 2026-08 从 products/page.tsx 机械化拆出：逻辑零改动，只做搬迁。
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



import { AssignmentStatus, DEFAULT_CREATE_BRAND_OPTIONS, MappingCheckItem, Metric, NormalizedProduct, PRODUCT_DETAIL_ARTIFACT_SRC_ATTR, PRODUCT_LIBRARY_TENANT_ID, ProductBrand, ProductCategoryNode, ProductSitePublishingDraft, SiteProductCategoryResponse, SiteProductCategoryRow, SiteProductCategoryTreeNode, SitePublishingSuggestion, WebsiteShelfAssignment, artifactContentUrl, displayBrand, escapeProductDetailHtml, hydrateOfficialDetailEditorImages, nonNegativeInt, normalizeBrand, normalizeProductCategoryTree, objectOrEmpty, productDetailPersistentImageSrc, productSitePublishingDefaults, productSitePublishingDraftFromAssignment, productSitePublishingPayload, publicProjectionPath, publicSiteProductItems, readBrowserFileBase64, sanitizeOfficialProductDetailHtml, serializeOfficialDetailEditorHtml, siteCategorySelectOptions, slug, tenantIdForProduct, text, useFloatingDialog, websitePublishingStatusMeta } from './products-shared';

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
      ? [
          '/api/v2/sites/products/public-projection',
          normalizedSiteCode,
          product.id,
          productTenantId,
          refreshVersion,
        ]
      : null,
    async () =>
      publicSiteProducts.list(normalizedSiteCode, {
        locale: 'zh-CN',
        productId: product.id,
        sku: text(product.sku) || undefined,
      }),
    { revalidateOnFocus: false }
  );
  const publicProduct = publicSiteProductItems(data)[0] || null;
  const publicCategoryPath = publicProjectionPath(publicProduct);
  const matches = Boolean(
    publicProduct && expectedCategoryPath && publicCategoryPath === expectedCategoryPath
  );
  const isPublished = status === 'published';
  const statusText = isLoading
    ? '校验中...'
    : error
      ? '读取失败'
      : publicProduct
        ? publicCategoryPath || '未返回目录'
        : isPublished
          ? '已发布但公开接口未找到'
          : '未发布或公开接口未找到';
  const toneClass =
    error || (isPublished && (!publicProduct || !matches))
      ? 'text-warning'
      : publicProduct
        ? 'text-success'
        : 'text-[var(--t-tertiary)]';
  const matchText = publicProduct ? (matches ? '一致' : '与后台保存不一致') : '';

  if (variant === 'panel') {
    return (
      <div className="inset grid gap-1 p-2.5! text-xs text-muted-foreground">
        <strong className="text-xs text-foreground">公开官网回读</strong>
        <span>后台准备保存目录：{expectedCategoryPath || '未选择'}</span>
        <span>公开接口当前目录：{statusText}</span>
        {publicProduct ? (
          <span>公开 URL slug：{text(publicProduct.slug || publicSlug) || '未返回'}</span>
        ) : null}
        <span className={toneClass}>
          {publicProduct
            ? matches
              ? '公开接口与后台目录一致'
              : '公开接口与后台目录不一致，保存/发布后请刷新校验'
            : statusText}
        </span>
      </div>
    );
  }

  return (
    <span>
      公开官网接口：{statusText}
      {matchText ? <span className={`${toneClass} ml-1.5`}>{matchText}</span> : null}
    </span>
  );
}


function OverrideHint({ value, fallback }: { value: string; fallback: string }) {
  const overridden = text(value) && text(value) !== text(fallback);
  return (
    <span className={overridden ? 'badge badge-info' : 'badge badge-grey'}>
      {overridden ? '官网覆盖' : '产品库默认'}
    </span>
  );
}


export function ProductSitePublishingPanel({
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
  const configuredSites = new Set(
    liveAssignments.map((assignment) => normalizeBrand(assignment.siteCode))
  );
  const productBrandSite = normalizeBrand(product.brand);
  const preferredSite = brandOptions.find(
    (option) =>
      normalizeBrand(option.value) === productBrandSite && !configuredSites.has(productBrandSite)
  );
  const firstAvailableSite =
    (
      preferredSite ||
      brandOptions.find((option) => !configuredSites.has(normalizeBrand(option.value))) ||
      brandOptions[0]
    )?.value || productBrandSite;
  const [editing, setEditing] = useState<WebsiteShelfAssignment | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<ProductSitePublishingDraft>(() =>
    productSitePublishingDraftFromAssignment(product, undefined, firstAvailableSite)
  );
  const [saving, setSaving] = useState(false);
  const [publicReadbackVersion, setPublicReadbackVersion] = useState(0);
  const activeSiteCode = normalizeBrand(draft.siteCode || editing?.siteCode || firstAvailableSite);
  const defaults = productSitePublishingDefaults(product, activeSiteCode);
  const {
    data: categoryData,
    isLoading: categoryLoading,
    error: categoryError,
  } = useSWR(
    activeSiteCode ? ['/api/v2/brand-sites/product-categories/select', activeSiteCode] : null,
    async () =>
      siteProductCategories.list(activeSiteCode, {
        selectable: true,
      }) as Promise<SiteProductCategoryResponse>,
    { revalidateOnFocus: false }
  );
  const categoryOptions = useMemo(
    () => siteCategorySelectOptions(categoryData?.items || []),
    [categoryData]
  );
  const categoryOptionById = useMemo(
    () => new Map(categoryOptions.map((option) => [option.value, option])),
    [categoryOptions]
  );
  const showEditor = Boolean(creating || editing);
  const productTenantId = tenantIdForProduct(product) || PRODUCT_LIBRARY_TENANT_ID;
  const { data: publishingSuggestion, isLoading: suggestionLoading } = useSWR(
    showEditor && activeSiteCode && product.id
      ? [
          '/api/v2/brand-sites/product-categories/suggestion',
          activeSiteCode,
          product.id,
          productTenantId,
        ]
      : null,
    async () =>
      siteProductCategories.suggestion(activeSiteCode, {
        productId: product.id,
        productTenantId,
      }) as Promise<SitePublishingSuggestion>,
    { revalidateOnFocus: false }
  );
  const selectedWebsiteCategory = categoryOptionById.get(text(draft.siteProductCategoryId));
  const suggestedWebsiteCategory = text(publishingSuggestion?.suggestedWebsiteCategory?.name);
  const suggestedWebsiteCategoryId = text(publishingSuggestion?.suggestedWebsiteCategory?.id);
  const suggestedWebsiteCategoryPath = text(
    publishingSuggestion?.suggestedWebsiteCategory?.path ||
      publishingSuggestion?.suggestedWebsiteCategory?.name
  );
  const suggestedSeries = text(publishingSuggestion?.suggestedSeries?.value);
  const currentWebsiteCategoryPath = text(
    selectedWebsiteCategory?.path || draft.websiteCategoryPath || draft.websiteCategory
  );
  const websiteCategoryOverridden = Boolean(
    suggestedWebsiteCategoryId &&
    text(draft.siteProductCategoryId) &&
    text(draft.siteProductCategoryId) !== suggestedWebsiteCategoryId
  );
  const websiteCategoryMappingMode =
    websiteCategoryOverridden || !suggestedWebsiteCategoryId ? 'manual' : 'auto';
  const seriesOverridden = Boolean(
    suggestedSeries && text(draft.series) && text(draft.series) !== suggestedSeries
  );

  useEffect(() => {
    if (!showEditor || !publishingSuggestion) return;
    const nextCategoryId = text(publishingSuggestion.suggestedWebsiteCategory?.id);
    const nextCategory = text(publishingSuggestion.suggestedWebsiteCategory?.name);
    const nextCategoryPath = text(
      publishingSuggestion.suggestedWebsiteCategory?.path || nextCategory
    );
    const nextSeries = text(publishingSuggestion.suggestedSeries?.value);
    setDraft((current) => ({
      ...current,
      siteProductCategoryId: text(current.siteProductCategoryId)
        ? current.siteProductCategoryId
        : nextCategoryId || current.siteProductCategoryId,
      websiteCategory: text(current.websiteCategory)
        ? current.websiteCategory
        : nextCategory || current.websiteCategory,
      websiteCategoryPath: text(current.websiteCategoryPath)
        ? current.websiteCategoryPath
        : nextCategoryPath || current.websiteCategoryPath,
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
    const siteCode =
      (
        preferredSite ||
        brandOptions.find((option) => !configuredSites.has(normalizeBrand(option.value))) ||
        brandOptions[0]
      )?.value || productBrandSite;
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
      const payload = productSitePublishingPayload(product, draft, {
        includeProductRef: !editing?.id,
        suggestion: publishingSuggestion,
      });
      if (editing?.id) await siteProductAssignments.update(activeSiteCode, editing.id, payload);
      else await siteProductAssignments.create(activeSiteCode, payload);
      onNotice(editing?.id ? '官网展示配置已更新。' : '官网展示配置已新增。');
      onNotice(
        editing?.id
          ? '官网展示配置已更新；如果状态还是草稿，请点击“发布”后官网才会展示。'
          : '官网展示配置已保存为草稿；请点击卡片上的“发布”后官网才会展示。'
      );
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

  async function changeAssignmentStatus(
    assignment: WebsiteShelfAssignment,
    next: 'published' | 'hidden'
  ) {
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
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`确认移除 ${displayBrand(siteCode)} 的官网挂载配置？`)
    )
      return;
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
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="m-0 text-xs text-muted-foreground">
          一个产品可以挂载到多个官网；每个官网独立维护目录、slug、排序、推荐和展示文案。
        </p>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={startCreate}
          disabled={
            disabled ||
            saving ||
            brandOptions.every((option) => configuredSites.has(normalizeBrand(option.value)))
          }
        >
          <Plus size={13} />
          添加官网
        </button>
      </div>

      {liveAssignments.length ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-2.5">
          {liveAssignments.map((assignment) => {
            const assignmentMeta = objectOrEmpty(assignment.siteMeta);
            const categoryMeta = objectOrEmpty(assignmentMeta.siteProductCategory);
            const assignmentCategoryPath = text(
              assignmentMeta.websiteCategoryPath || categoryMeta.path || assignment.websiteCategory
            );
            const visibleReason =
              assignment.status === 'published'
                ? '保存后已发布，官网会展示。'
                : assignment.status === 'hidden'
                  ? '当前已隐藏，官网不会展示；点击发布后才展示。'
                  : '当前为草稿，官网不会展示；点击发布后才展示。';
            return (
              <div key={assignment.id} className="inset grid gap-2 p-3!">
                <div className="flex items-center justify-between gap-2">
                  <strong>{displayBrand(normalizeBrand(assignment.siteCode))}</strong>
                  <StatusPill tone={websitePublishingStatusMeta(assignment).tone}>
                    {websitePublishingStatusMeta(assignment).label}
                  </StatusPill>
                </div>
                <div className="grid gap-1 text-xs text-muted-foreground">
                  <span>目录：{assignmentCategoryPath || '未选择'}</span>
                  <span>
                    slug：
                    {text(assignment.publicSlug) ||
                      productSitePublishingDefaults(product, assignment.siteCode).publicSlug}
                  </span>
                  <span>
                    排序：{nonNegativeInt(assignment.displayOrder)}{' '}
                    {assignment.isFeatured ? ' / 推荐' : ''}
                  </span>
                  <ProductPublicProjectionReadback
                    product={product}
                    siteCode={assignment.siteCode || productBrandSite}
                    productTenantId={assignment.productTenantId || productTenantId}
                    publicSlug={assignment.publicSlug}
                    expectedCategoryPath={assignmentCategoryPath}
                    status={assignment.status}
                    refreshVersion={publicReadbackVersion}
                  />
                  <span
                    className={
                      assignment.status === 'published'
                        ? 'text-success'
                        : 'text-[var(--t-tertiary)]'
                    }
                  >
                    {visibleReason}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => startEdit(assignment)}
                    disabled={disabled || saving}
                  >
                    配置
                  </button>
                  {canPublish && assignment.status !== 'published' ? (
                    <button
                      type="button"
                      className="btn btn-brand btn-sm"
                      onClick={() => changeAssignmentStatus(assignment, 'published')}
                      disabled={disabled || saving}
                    >
                      发布
                    </button>
                  ) : null}
                  {canPublish && assignment.status === 'published' ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => changeAssignmentStatus(assignment, 'hidden')}
                      disabled={disabled || saving}
                    >
                      隐藏
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeAssignment(assignment)}
                    disabled={disabled || saving}
                  >
                    移除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="inset p-3! text-[13px] text-muted-foreground">
          当前产品还没有官网挂载配置。先点“添加官网”，选择官网目录后保存为草稿，再决定是否发布。
        </div>
      )}

      {showEditor ? (
        <div className="inset grid gap-3 border-[var(--brand-300)]! p-3.5!">
          <div className="flex items-center justify-between gap-2">
            <strong>{editing ? '编辑官网展示配置' : '新增官网展示配置'}</strong>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
              disabled={saving}
            >
              收起
            </button>
          </div>
          <div className="inset grid gap-2 bg-[var(--surface-subtle,#f8fafc)]! p-3!">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-[13px]">产品库 → 官网展示映射</strong>
              <span
                className={
                  websiteCategoryOverridden || seriesOverridden
                    ? 'badge badge-info'
                    : 'badge badge-grey'
                }
              >
                {websiteCategoryOverridden || seriesOverridden
                  ? '人工覆盖'
                  : suggestionLoading
                    ? '匹配中'
                    : suggestedWebsiteCategory
                      ? '跟随产品库'
                      : '需要手动选择'}
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-2">
              <MappingCheckItem
                label="产品库分类"
                value={
                  text(publishingSuggestion?.productCategory?.pathLabel) ||
                  text(product.categoryPath || product.category)
                }
                tone={
                  text(
                    publishingSuggestion?.productCategory?.pathLabel ||
                      product.categoryPath ||
                      product.category
                  )
                    ? 'success'
                    : 'warning'
                }
                note="默认映射会参考一级与末级分类"
              />
              <MappingCheckItem
                label="系统建议"
                value={
                  suggestionLoading ? '匹配中...' : suggestedWebsiteCategoryPath || '未找到映射'
                }
                tone={
                  suggestedWebsiteCategoryPath ? 'success' : suggestionLoading ? 'info' : 'warning'
                }
                note={suggestedWebsiteCategoryPath ? '可一键恢复自动映射' : '需要手动选择官网目录'}
              />
              <MappingCheckItem
                label="当前保存"
                value={currentWebsiteCategoryPath || '未选择'}
                tone={
                  draft.siteProductCategoryId
                    ? websiteCategoryOverridden
                      ? 'info'
                      : 'success'
                    : 'warning'
                }
                note={
                  websiteCategoryOverridden
                    ? '人工覆盖'
                    : suggestedWebsiteCategoryId && draft.siteProductCategoryId
                      ? '跟随默认'
                      : '保存会要求选择目录'
                }
              />
              <MappingCheckItem
                label="展示判断"
                value={draft.siteProductCategoryId ? '目录有效' : '未选择官网目录'}
                tone={draft.siteProductCategoryId ? 'success' : 'warning'}
                note={editing?.status === 'published' ? '已发布后官网可见' : '保存为草稿后仍需发布'}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={
                  websiteCategoryMappingMode === 'auto'
                    ? 'btn btn-brand btn-sm'
                    : 'btn btn-outline btn-sm'
                }
                disabled={saving || disabled || suggestionLoading || !suggestedWebsiteCategoryId}
                onClick={applyAutoWebsiteCategory}
              >
                自动映射
              </button>
              <span
                className={
                  websiteCategoryMappingMode === 'manual' ? 'badge badge-info' : 'badge badge-grey'
                }
              >
                手动选择可覆盖
              </span>
              <span className="text-xs text-[var(--t-tertiary)]">
                默认跟随产品库分类；下方选择其他官网目录后按人工映射保存。
              </span>
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
          <div className="product-edit-field-grid grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
            <label className="grid gap-1.5">
              <span className="t-label">官网</span>
              <select
                className="input"
                value={draft.siteCode}
                disabled={Boolean(editing) || saving || disabled}
                onChange={(event) =>
                  setDraft(
                    productSitePublishingDraftFromAssignment(product, undefined, event.target.value)
                  )
                }
              >
                {brandOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={!editing && configuredSites.has(normalizeBrand(option.value))}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="t-label">
                官网目录{' '}
                <span
                  className={
                    websiteCategoryMappingMode === 'manual'
                      ? 'badge badge-info'
                      : 'badge badge-grey'
                  }
                >
                  {websiteCategoryMappingMode === 'manual' ? '手动映射' : '自动映射'}
                </span>
              </span>
              <select
                className="input"
                value={draft.siteProductCategoryId}
                disabled={saving || disabled || categoryLoading}
                onChange={(event) => applyWebsiteCategory(event.target.value)}
              >
                <option value="">{categoryLoading ? '目录加载中...' : '请选择官网目录'}</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[var(--t-tertiary)]">
                默认用系统建议目录；需要特殊陈列时在这里手动选择官网目录。
              </span>
              {categoryError ? (
                <span className="text-xs text-warning">官网目录加载失败，请先检查目录管理。</span>
              ) : null}
              {!categoryError && !categoryLoading && !categoryOptions.length ? (
                <span className="text-xs text-warning">
                  当前官网还没有后台目录树，请先到官网目录管理维护。
                </span>
              ) : null}
            </label>
            <label className="grid gap-1.5">
              <span className="t-label">官网系列</span>
              <input
                className="input"
                value={draft.series}
                disabled={saving || disabled}
                placeholder={suggestedSeries || '未维护官网系列'}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, series: event.target.value }))
                }
              />
              <span className="text-xs text-[var(--t-tertiary)]">
                {suggestedSeries
                  ? '默认跟随产品库系列；改写后按人工覆盖保存。'
                  : '产品库尚未维护系列，可先留空。'}
              </span>
            </label>
            <label className="grid gap-1.5">
              <span className="t-label">
                URL slug <OverrideHint value={draft.publicSlug} fallback={defaults.publicSlug} />
              </span>
              <input
                className="input"
                value={draft.publicSlug}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                disabled={saving || disabled}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, publicSlug: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-1.5">
              <span className="t-label">
                官网标题 <OverrideHint value={draft.siteTitle} fallback={defaults.siteTitle} />
              </span>
              <input
                className="input"
                value={draft.siteTitle}
                disabled={saving || disabled}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, siteTitle: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-1.5">
              <span className="t-label">排序</span>
              <input
                className="input"
                type="number"
                min="0"
                max="999999"
                value={draft.displayOrder}
                disabled={saving || disabled}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, displayOrder: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-1.5">
              <span className="t-label">推荐</span>
              <span className="toggle-row flex min-h-[38px] items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.isFeatured}
                  disabled={saving || disabled}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, isFeatured: event.target.checked }))
                  }
                />
                <span>在该官网推荐展示</span>
              </span>
            </label>
            <label className="grid gap-1.5">
              <span className="t-label">
                官网标签 <OverrideHint value={draft.tags} fallback={defaults.tags} />
              </span>
              <input
                className="input"
                value={draft.tags}
                disabled={saving || disabled}
                placeholder="新品, 推荐"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, tags: event.target.value }))
                }
              />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="t-label">
              官网摘要/卖点{' '}
              <OverrideHint value={draft.siteSummary} fallback={defaults.siteSummary} />
            </span>
            <textarea
              className="input"
              rows={3}
              value={draft.siteSummary}
              disabled={saving || disabled}
              onChange={(event) =>
                setDraft((current) => ({ ...current, siteSummary: event.target.value }))
              }
            />
          </label>
          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={saving || disabled}
              onClick={() =>
                setDraft((current) => ({
                  ...productSitePublishingDraftFromAssignment(
                    product,
                    editing || undefined,
                    activeSiteCode
                  ),
                  siteProductCategoryId:
                    suggestedWebsiteCategoryId || current.siteProductCategoryId,
                  websiteCategory: suggestedWebsiteCategory || current.websiteCategory,
                  websiteCategoryPath: suggestedWebsiteCategoryPath || current.websiteCategoryPath,
                  series: suggestedSeries || current.series,
                }))
              }
            >
              恢复默认映射
            </button>
            <button
              type="button"
              className="btn btn-brand btn-sm"
              disabled={saving || disabled}
              onClick={saveAssignment}
            >
              {saving ? '保存中...' : '保存官网配置'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}


export function OfficialProductDetailEditor({
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
    insertHtml(
      '<table><tbody><tr><th>参数</th><th>说明</th></tr><tr><td>型号</td><td></td></tr></tbody></table>'
    );
  }

  async function uploadImages(files: FileList | null) {
    const selected = Array.from(files || []);
    if (!selected.length || disabled || uploading) return;
    const invalid = selected.find(
      (file) =>
        !/^image\/(png|jpe?g|webp)$/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)
    );
    if (invalid) {
      await alertFloating({
        title: '图片格式不支持',
        message: '仅支持 png、jpg、jpeg、webp 格式的详情图片。',
      });
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
        insertHtml(
          `<img src="${escapeProductDetailHtml(dataUrl)}" ${PRODUCT_DETAIL_ARTIFACT_SRC_ATTR}="${escapeProductDetailHtml(productDetailPersistentImageSrc(url))}" alt="${escapeProductDetailHtml(file.name)}" loading="lazy">`
        );
      }
    } catch (e) {
      await alertFloating({
        title: '详情图片上传失败',
        message: (e as Error)?.message || '详情图片上传失败。',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="official-product-detail-editor">
      <div className="official-product-detail-editor-toolbar" aria-label="官网产品详情格式工具栏">
        <button
          type="button"
          className="btn btn-outline btn-sm icon-only"
          onClick={() => run('formatBlock', 'h2')}
          title="标题"
          aria-label="标题"
          disabled={disabled}
        >
          <Heading2 size={13} />
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm icon-only"
          onClick={() => run('bold')}
          title="加粗"
          aria-label="加粗"
          disabled={disabled}
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm icon-only"
          onClick={() => run('italic')}
          title="斜体"
          aria-label="斜体"
          disabled={disabled}
        >
          <Italic size={13} />
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm icon-only"
          onClick={() => run('insertUnorderedList')}
          title="项目列表"
          aria-label="项目列表"
          disabled={disabled}
        >
          <List size={13} />
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm icon-only"
          onClick={() => run('insertOrderedList')}
          title="编号列表"
          aria-label="编号列表"
          disabled={disabled}
        >
          <ListOrdered size={13} />
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm icon-only"
          onClick={addTable}
          title="插入参数表"
          aria-label="插入参数表"
          disabled={disabled}
        >
          <Table2 size={13} />
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm icon-only"
          onClick={addLink}
          title="插入链接"
          aria-label="插入链接"
          disabled={disabled}
        >
          <Link size={13} />
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <Image size={13} />
          {uploading ? '上传中' : '详情图'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          multiple
          className="hidden"
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
          insertHtml(
            html
              ? sanitizeOfficialProductDetailHtml(html)
              : escapeProductDetailHtml(plain).replace(/\n/g, '<br>')
          );
        }}
        dangerouslySetInnerHTML={{ __html: value || '' }}
      />
      <p className="m-0 text-xs text-[var(--t-tertiary)]">
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
          border-color: rgba(200, 32, 44, 0.28);
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


function MetaBlock({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={`grid min-w-0 content-center ${compact ? 'gap-[3px]' : 'gap-1'}`}>
      {/* .t-label 全局即 11px，compact 原内联 fontSize:11 为冗余覆盖，直接移除 */}
      <p className="t-label">{label}</p>
      <p
        className={`m-0 overflow-hidden leading-[1.35] text-ellipsis text-foreground ${
          compact
            ? 'text-xs whitespace-nowrap'
            : 'text-[13px] whitespace-normal [overflow-wrap:anywhere]'
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

