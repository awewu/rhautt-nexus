'use client';
import { ProductCatalogImagePreview, ProductManualPdfUploader } from './media-panels';
import { OfficialProductDetailEditor, ProductSitePublishingPanel } from './site-publishing';
// 目录行与网格簇（行/空态/网格）
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

import { CATEGORY_KEYS, EditProductDraft, MappingCheckItem, NormalizedProduct, PRODUCT_BASE_CATEGORY_BRAND, ProductBrand, ProductCategoryNode, RowActionState, STOCK, WebsiteShelfAssignment, activeWebsiteAssignments, categoryOptionLabel, contentDraftPatchFromResult, displayBrand, flattenCategoryTree, fmt, isManualPdfAsset, normalizeProductCategoryTree, pct, productBrandMeta, productCategoryDisplayLabel, productCategoryNodeValue, productImageSrc, productLibraryMeta, productPublicContentPayload, productPublicContentSignature, productReadinessSummary, productStatusPayload, productUpdatePayload, sanitizeOfficialProductDetailHtml, saveProductPublicContent, slug, statusLabel, statusTone, tenantIdForProduct, text, uploadProductMainImageRef, uploadProductManualPdfRefs, useFloatingDialog } from './products-shared';
import { activeCategoryOptions } from './category-manager';
import { ProductEditProgressItem, ProductEditProgressStrip, ProductReadinessChecklistPanel, WebsiteShelfSummaryCell, buildProductEditChecklist, editDraftFromProduct, formatSaveChecklistFeedback } from './readiness';
import { ProductLibraryCompletenessFields } from './create-product';

export function ProductCatalogRow({
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
  const {
    data: categoryData,
    error: categoryError,
    isLoading: categoryLoading,
  } = useSWR(
    editing
      ? ['/api/v2/brand-product-categories', PRODUCT_BASE_CATEGORY_BRAND, 'product-edit']
      : null,
    async () => {
      const result = await brandProductCategories.list({ brandCode: PRODUCT_BASE_CATEGORY_BRAND });
      return { tree: normalizeProductCategoryTree(result) };
    },
    { revalidateOnFocus: false }
  );
  const {
    data: contentData,
    error: contentError,
    isLoading: contentLoading,
  } = useSWR(
    editing && product.id
      ? ['/api/v2/product-catalog/devices/content', product.id, tenantIdForProduct(product)]
      : null,
    async () =>
      products.listContent(
        product.id,
        tenantIdForProduct(product) ? { tenantId: tenantIdForProduct(product) } : undefined
      ),
    { revalidateOnFocus: false }
  );
  const productCategoryTree = categoryData?.tree || [];
  const productCategoryFlat = useMemo(
    () => flattenCategoryTree(productCategoryTree),
    [productCategoryTree]
  );
  const selectedLevel1 =
    productCategoryFlat.find((item) => item.id === draft.categoryLevel1Id) || null;
  const selectedLevel2 =
    productCategoryFlat.find((item) => item.id === draft.categoryLevel2Id) || null;
  const selectedLevel3 =
    productCategoryFlat.find((item) => item.id === draft.categoryLevel3Id) || null;
  const level2Children = selectedLevel1?.children || [];
  const level3Children = selectedLevel2?.children || [];
  const level1Options = activeCategoryOptions(productCategoryTree, selectedLevel1);
  const level2Options = activeCategoryOptions(level2Children, selectedLevel2);
  const level3Options = activeCategoryOptions(level3Children, selectedLevel3);
  const systemDisplayValue = productCategoryDisplayLabel(
    draft.system || draft.category,
    productCategoryTree
  );
  const inactiveCategoryBindings = [selectedLevel1, selectedLevel2, selectedLevel3].filter(
    (item): item is ProductCategoryNode => Boolean(item && item.status === 'inactive')
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
    const offset =
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      12;
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
    setRowState((state) => ({
      ...state,
      saving: true,
      savingAction: 'save',
      error: '',
      success: '',
    }));
    try {
      const mainImageRef = await uploadProductMainImageRef(
        draft.mainImage,
        product.sku || product.id
      );
      const manualPdfRefs = await uploadProductManualPdfRefs(
        draft.manualPdfs,
        product.sku || product.id
      );
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
        data: {
          items: [
            {
              officialDetailHtml: sanitizeOfficialProductDetailHtml(draft.officialDetailHtml),
              marketing: productPublicContentPayload(product, draft).marketing,
            },
          ],
        },
      });
      if (nextPublicContent !== previousPublicContent) {
        await saveProductPublicContent(product.id, tenantIdForProduct(product), product, draft);
      }
      if (draft.mainImage) URL.revokeObjectURL(draft.mainImage.previewUrl);
      draft.manualPdfs.forEach((manual) => {
        if (manual.file && manual.previewUrl.startsWith('blob:'))
          URL.revokeObjectURL(manual.previewUrl);
      });
      const saveFeedback = formatSaveChecklistFeedback(editChecklistItems, hasPublishedWebsite);
      setRowState({ dirty: false, saving: false, success: saveFeedback, error: '' });
      onNotice(saveFeedback);
      await onChanged();
    } catch (e) {
      const message = (e as Error)?.message || '保存产品失败。';
      setRowState((state) => ({
        ...state,
        saving: false,
        savingAction: undefined,
        error: message,
        success: '',
      }));
      onNotice(message);
    }
  }

  async function changeStatus(nextStatus: 'active' | 'inactive') {
    if (!canPublishProduct) return;
    setRowState((state) => ({
      ...state,
      saving: true,
      savingAction: 'status',
      error: '',
      success: '',
    }));
    try {
      await products.update(product.id, productStatusPayload(product, nextStatus));
      setRowState({
        dirty: false,
        saving: false,
        success: `状态已切换为${statusLabel(nextStatus)}。`,
        error: '',
      });
      onNotice(`状态已切换为${statusLabel(nextStatus)}：${product.sku || product.name}`);
      await onChanged();
    } catch (e) {
      const message = (e as Error)?.message || '状态切换失败。';
      setRowState((state) => ({
        ...state,
        saving: false,
        savingAction: undefined,
        error: message,
        success: '',
      }));
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
    setRowState((state) => ({
      ...state,
      saving: true,
      savingAction: 'archive',
      error: '',
      success: '',
    }));
    try {
      await products.archive(product.id, tenantIdForProduct(product) || undefined);
      setRowState({
        dirty: false,
        saving: false,
        success: '已归档，默认列表不再显示。',
        error: '',
      });
      onNotice(`已归档 ${product.sku || product.name}。`);
      await onChanged();
    } catch (e) {
      const message = (e as Error)?.message || '归档产品失败。';
      setRowState((state) => ({
        ...state,
        saving: false,
        savingAction: undefined,
        error: message,
        success: '',
      }));
      onNotice(message);
    }
  }

  const statusTarget = product.status === 'active' ? 'inactive' : 'active';
  const customCategory = draft.category && !CATEGORY_KEYS.has(draft.category);
  const brandMeta = productBrandMeta(product);
  const libraryMeta = productLibraryMeta(product);
  const readiness = productReadinessSummary(product);
  const reviewNotes = Array.isArray(libraryMeta.reviewNotes)
    ? libraryMeta.reviewNotes.map(text).filter(Boolean)
    : [];
  const websiteCategory = text(
    brandMeta.websiteCategory || brandMeta.websiteMenuCategory || brandMeta.cat
  );
  const imageSrc = productImageSrc(product);
  const rowBusyText =
    rowState.savingAction === 'save'
      ? '正在保存内容...'
      : rowState.savingAction === 'status'
        ? '正在切换状态...'
        : rowState.savingAction === 'archive'
          ? '正在归档...'
          : '';
  const activeAssignmentsInEdit = activeWebsiteAssignments(assignments);
  const hasPublishedWebsite = activeAssignmentsInEdit.some(
    (assignment) => assignment.status === 'published'
  );
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
      status:
        draft.name && draft.model && draft.categoryLevel1Id && draft.categoryLevel2Id
          ? 'ready'
          : 'blocked',
      detail: draft.categoryLevel2Id
        ? selectedProductCategoryPath || '分类已绑定'
        : '需补齐名称、型号和二级分类',
      targetId: `product-edit-section-master-${product.id}`,
    },
    {
      label: '官网展示文案',
      status:
        draft.series && draft.publicSummary && (draft.featureBenefits || draft.sellingPoints)
          ? 'ready'
          : 'todo',
      detail: draft.publicSummary ? '摘要与卖点已维护' : '需补官网摘要、卖点和系列',
      targetId: `product-edit-section-website-content-${product.id}`,
    },
    {
      label: '素材详情',
      status:
        (draft.mainImage || imageSrc) && (draft.officialDetailHtml || draft.manualPdfs.length)
          ? 'ready'
          : 'todo',
      detail:
        draft.mainImage || imageSrc ? '主图已准备，继续核对详情/PDF' : '至少需要主图和详情资料',
      targetId: `product-edit-section-assets-${product.id}`,
    },
    {
      label: '官网目录',
      status: activeAssignmentsInEdit.length ? 'ready' : 'blocked',
      detail: activeAssignmentsInEdit.length
        ? `已配置 ${activeAssignmentsInEdit.length} 个官网挂载`
        : '需要选择官网与展示目录',
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
  const editDialog =
    canUpdateProduct && editing && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="product-edit-backdrop fixed inset-0 z-[1000] grid place-items-center bg-[rgba(15,23,42,0.45)] p-6"
            role="presentation"
            onMouseDown={() => setEditing(false)}
          >
            <form
              className="product-edit-modal grid w-[min(1120px,100%)] max-h-[min(900px,calc(100vh-48px))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card shadow-[var(--sh-lg)]"
              onSubmit={saveEdit}
              onMouseDown={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`product-edit-title-${product.id}`}
            >
              <header
                className="product-edit-modal-head flex items-start justify-between gap-4 border-b p-[18px]"
              >
                <div>
                  <p className="t-label">编辑产品</p>
                  <h2 id={`product-edit-title-${product.id}`}>
                    {draft.name || product.name || '编辑产品'}
                  </h2>
                  <span>
                    {displayBrand(product.brand)} / {product.sku || product.model || product.id}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm icon-only"
                  onClick={() => setEditing(false)}
                  aria-label="关闭编辑产品"
                  disabled={rowState.saving}
                >
                  <X size={15} />
                </button>
              </header>

              <div
                ref={editBodyRef}
                className="product-edit-modal-body grid gap-3.5 overflow-auto p-[18px]"
              >
                <ProductEditProgressStrip
                  items={editProgressItems}
                  onNavigate={scrollToEditSection}
                />
                <ProductReadinessChecklistPanel
                  items={editChecklistItems}
                  onNavigate={scrollToEditSection}
                />

                <section
                  id={`product-edit-section-master-${product.id}`}
                  className="product-edit-section grid gap-3"
                >
                  <div className="product-edit-section-head">
                    <h3>1. 产品主数据</h3>
                    <span className="badge badge-grey">
                      产品库必填 · {displayBrand(product.brand)}
                    </span>
                  </div>
                  <div
                    className="product-edit-field-grid grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3"
                  >
                    <label className="grid gap-1.5">
                      <span className="t-label">品牌</span>
                      <input
                        className="input"
                        value={displayBrand(product.brand)}
                        disabled
                        readOnly
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">产品名称</span>
                      <input
                        className="input"
                        value={draft.name}
                        required
                        onChange={(event) => patchDraft({ name: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">型号</span>
                      <input
                        className="input"
                        value={draft.model}
                        required
                        onChange={(event) => patchDraft({ model: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">分类</span>
                      <select
                        className="input"
                        value={draft.category}
                        required
                        onChange={(event) => patchDraft({ category: event.target.value })}
                      >
                        {customCategory && (
                          <option value={draft.category}>
                            {productCategoryDisplayLabel(draft.category, productCategoryTree)}
                          </option>
                        )}
                        {CATEGORIES.map((category) => (
                          <option key={category.key} value={category.key}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">系统</span>
                      <input
                        className="input"
                        value={systemDisplayValue}
                        required
                        disabled
                        readOnly
                        title={draft.system}
                      />
                    </label>
                  </div>
                </section>

                <section
                  id={`product-edit-section-category-${product.id}`}
                  className="product-edit-section grid gap-3"
                >
                  <div className="product-edit-section-head">
                    <h3>产品分类绑定</h3>
                    <span className="badge badge-grey">来自产品库分类树，会驱动官网默认映射</span>
                  </div>
                  {categoryLoading ? (
                    <div
                      className="inset p-3 text-[13px] text-muted-foreground"
                    >
                      正在加载产品分类...
                    </div>
                  ) : categoryError ? (
                    <div
                      className="inset p-3 text-[13px] text-destructive"
                      role="alert"
                    >
                      产品分类加载失败：{String((categoryError as Error)?.message || categoryError)}
                    </div>
                  ) : !productCategoryTree.length ? (
                    <div
                      className="inset p-3 text-[13px] text-muted-foreground"
                    >
                      当前品牌暂无可绑定的产品分类。
                    </div>
                  ) : (
                    <div
                      className="product-edit-field-grid grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3"
                    >
                      <label className="grid gap-1.5">
                        <span className="t-label">一级分类</span>
                        <select
                          className="input"
                          value={draft.categoryLevel1Id}
                          required
                          onChange={(event) =>
                            patchDraft({
                              categoryLevel1Id: event.target.value,
                              categoryLevel2Id: '',
                              categoryLevel3Id: '',
                            })
                          }
                        >
                          <option value="">请选择一级分类</option>
                          {level1Options.map((item) => (
                            <option key={item.id} value={item.id}>
                              {categoryOptionLabel(item)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5">
                        <span className="t-label">二级分类</span>
                        <select
                          className="input"
                          value={draft.categoryLevel2Id}
                          required
                          disabled={!draft.categoryLevel1Id}
                          onChange={(event) => {
                            const selectedCategory =
                              level2Options.find((item) => item.id === event.target.value) || null;
                            const selectedValue = productCategoryNodeValue(selectedCategory);
                            patchDraft({
                              categoryLevel2Id: event.target.value,
                              categoryLevel3Id: '',
                              ...(selectedValue
                                ? { category: selectedValue, system: selectedValue }
                                : {}),
                            });
                          }}
                        >
                          <option value="">请选择二级分类</option>
                          {level2Options.map((item) => (
                            <option key={item.id} value={item.id}>
                              {categoryOptionLabel(item)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5">
                        <span className="t-label">三级分类（可选）</span>
                        <select
                          className="input"
                          value={draft.categoryLevel3Id}
                          disabled={!draft.categoryLevel2Id}
                          onChange={(event) => {
                            const selectedCategory =
                              level3Options.find((item) => item.id === event.target.value) ||
                              selectedLevel2;
                            const selectedValue = productCategoryNodeValue(selectedCategory);
                            patchDraft({
                              categoryLevel3Id: event.target.value,
                              ...(selectedValue
                                ? { category: selectedValue, system: selectedValue }
                                : {}),
                            });
                          }}
                        >
                          <option value="">不选择三级分类</option>
                          {level3Options.map((item) => (
                            <option key={item.id} value={item.id}>
                              {categoryOptionLabel(item)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  <p className="m-0 text-xs text-muted-foreground/70">
                    当前分类路径：
                    {selectedProductCategoryPath || product.categoryPath || '未完成绑定'}
                    。运营只需要选产品库真实分类，官网目录可自动映射，也可在下方人工覆盖。
                  </p>
                </section>

                <div id={`product-edit-section-library-${product.id}`}>
                  <ProductLibraryCompletenessFields
                    draft={draft}
                    disabled={rowState.saving}
                    onPatch={patchDraft}
                  />
                </div>

                <section className="product-edit-section grid gap-3">
                  <div className="product-edit-section-head">
                    <h3>产品库内部价格</h3>
                    {rowState.dirty && <span className="badge badge-warning">有未保存修改</span>}
                  </div>
                  <div
                    className="product-edit-field-grid grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3"
                  >
                    <label className="grid gap-1.5">
                      <span className="t-label">产品库目录价</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.listPrice}
                        disabled={rowState.saving}
                        onChange={(event) => patchDraft({ listPrice: event.target.value })}
                        placeholder="不填则为 0"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">经销商基准价</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.costPrice}
                        disabled={rowState.saving}
                        onChange={(event) => patchDraft({ costPrice: event.target.value })}
                        placeholder="内部供货/结算参考价，不对官网展示"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">币种</span>
                      <input
                        className="input"
                        value={draft.currency}
                        disabled={rowState.saving}
                        onChange={(event) => patchDraft({ currency: event.target.value || 'CNY' })}
                        placeholder="CNY"
                      />
                    </label>
                  </div>
                  <p className="m-0 text-xs text-muted-foreground/70">
                    经销商基准价属于产品库内部价，不会进入官网展示；具体到某个经销商的协议价后续应走价格表/报价模块。
                  </p>
                </section>

                <section
                  id={`product-edit-section-website-content-${product.id}`}
                  className="product-edit-section grid gap-3"
                >
                  <div className="product-edit-section-head">
                    <h3>2. 官网展示内容</h3>
                    <span className="badge badge-grey">保存产品库公共内容，供官网读取</span>
                  </div>
                  <div
                    className="inset grid gap-1 p-3 text-xs leading-normal text-muted-foreground"
                  >
                    <strong className="text-foreground">
                      运营填报重点：先确认官网标题/摘要/卖点，再确认价格展示方式，最后检查官网目录挂载。
                    </strong>
                    <span>
                      这些内容属于产品事实发布口径；保存产品后，官网挂载仍需要在下一块配置中保存/发布。
                    </span>
                  </div>
                  <div
                    className="product-edit-field-grid grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3"
                  >
                    <label className="grid gap-1.5">
                      <span className="t-label">公开路径 slug</span>
                      <input
                        className="input"
                        value={draft.publicSlug}
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        onChange={(event) => patchDraft({ publicSlug: event.target.value })}
                        placeholder="留空则按 SKU 生成"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">系列</span>
                      <input
                        className="input"
                        value={draft.series}
                        onChange={(event) => patchDraft({ series: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">英文名</span>
                      <input
                        className="input"
                        value={draft.officialEnglishName}
                        onChange={(event) =>
                          patchDraft({ officialEnglishName: event.target.value })
                        }
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">标语</span>
                      <input
                        className="input"
                        value={draft.tagline}
                        onChange={(event) => patchDraft({ tagline: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">官网摘要</span>
                      <input
                        className="input"
                        value={draft.publicSummary}
                        onChange={(event) => patchDraft({ publicSummary: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">标签</span>
                      <input
                        className="input"
                        value={draft.badges}
                        onChange={(event) => patchDraft({ badges: event.target.value })}
                        placeholder="新品, 高端"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">官网排序</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={draft.displayOrder}
                        onChange={(event) => patchDraft({ displayOrder: event.target.value })}
                      />
                    </label>
                  </div>
                  <div
                    className="product-edit-field-grid grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3"
                  >
                    <label className="grid gap-1.5">
                      <span className="t-label">官网价格展示方式</span>
                      <select
                        className="input"
                        value={draft.websitePriceDisplayMode}
                        onChange={(event) =>
                          patchDraft({ websitePriceDisplayMode: event.target.value })
                        }
                      >
                        <option value="not_shown">不展示价格</option>
                        <option value="show_price">显示官网参考价</option>
                        <option value="price_range">显示价格区间</option>
                        <option value="inquiry">面议</option>
                        <option value="contact_dealer">联系经销商</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">官网参考价</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.websitePrice}
                        disabled={draft.websitePriceDisplayMode !== 'show_price'}
                        onChange={(event) => patchDraft({ websitePrice: event.target.value })}
                        placeholder="选择显示官网参考价时填写"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">官网最低价</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.websitePriceMin}
                        disabled={draft.websitePriceDisplayMode !== 'price_range'}
                        onChange={(event) => patchDraft({ websitePriceMin: event.target.value })}
                        placeholder="价格区间最低价"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">官网最高价</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.websitePriceMax}
                        disabled={draft.websitePriceDisplayMode !== 'price_range'}
                        onChange={(event) => patchDraft({ websitePriceMax: event.target.value })}
                        placeholder="价格区间最高价"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">活动价</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.promoPrice}
                        onChange={(event) => patchDraft({ promoPrice: event.target.value })}
                        placeholder="可选"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">价格单位</span>
                      <input
                        className="input"
                        value={draft.priceUnit}
                        onChange={(event) => patchDraft({ priceUnit: event.target.value })}
                        placeholder="台 / 套 / 件"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">价格标签</span>
                      <input
                        className="input"
                        value={draft.priceLabel}
                        onChange={(event) => patchDraft({ priceLabel: event.target.value })}
                        placeholder="官网参考价 / 起售价"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">价格说明</span>
                      <input
                        className="input"
                        value={draft.priceNote}
                        onChange={(event) => patchDraft({ priceNote: event.target.value })}
                        placeholder="例如：最终成交价以经销商报价为准"
                      />
                    </label>
                    <label className="flex items-center gap-2 pt-[22px]">
                      <input
                        type="checkbox"
                        checked={draft.taxIncluded}
                        onChange={(event) => patchDraft({ taxIncluded: event.target.checked })}
                      />
                      <span className="t-label">价格含税</span>
                    </label>
                  </div>
                  <div
                    className="product-edit-field-grid grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3"
                  >
                    <label className="grid gap-1.5">
                      <span className="t-label">官网功能说明</span>
                      <textarea
                        className="input"
                        rows={4}
                        value={draft.featureBenefits}
                        onChange={(event) => patchDraft({ featureBenefits: event.target.value })}
                        placeholder={
                          '一行一个，例如：\n恒温控制: 出水温度更稳定\n低噪运行: 夜间使用更安静'
                        }
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">官网核心亮点</span>
                      <textarea
                        className="input"
                        rows={4}
                        value={draft.highlightMetrics}
                        onChange={(event) => patchDraft({ highlightMetrics: event.target.value })}
                        placeholder={'一行一个，例如：\n热效率: 95%\n适用面积: 80-180m2'}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="t-label">官网常见问题</span>
                      <textarea
                        className="input"
                        rows={4}
                        value={draft.faqs}
                        onChange={(event) => patchDraft({ faqs: event.target.value })}
                        placeholder={
                          '一行一个，例如：\n如何安装？: 由授权服务商安装\n质保多久？: 以官网政策为准'
                        }
                      />
                    </label>
                  </div>
                </section>

                <section
                  id={`product-edit-section-website-mapping-${product.id}`}
                  className="product-edit-section grid gap-3"
                >
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

                <section
                  id={`product-edit-section-assets-${product.id}`}
                  className="product-edit-section grid gap-3"
                >
                  <div className="product-edit-section-head">
                    <h3>3. 图片 / 素材</h3>
                    <span
                      className={
                        draft.mainImage || imageSrc ? 'badge badge-success' : 'badge badge-warning'
                      }
                    >
                      {draft.mainImage ? '已选择新主图' : imageSrc ? '已有主图' : '未上传图片'}
                    </span>
                  </div>
                  <div
                    className="product-edit-media-panel grid grid-cols-[160px_minmax(0,1fr)] items-start gap-3.5"
                  >
                    <div
                      className="product-edit-media-thumb grid aspect-square w-[146px] place-items-center overflow-hidden"
                    >
                      {draft.mainImage ? (
                        <img
                          src={draft.mainImage.previewUrl}
                          alt="新产品主图预览"
                          className="h-full w-full object-cover"
                        />
                      ) : imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={product.name || '产品主图'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Image size={28} className="text-muted-foreground/70" />
                      )}
                    </div>
                    <div className="grid min-w-0 content-start gap-2.5">
                      <p className="m-0 text-xs text-muted-foreground">
                        编辑产品库主图，保存后同步到产品库素材引用。
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <label className="btn btn-outline btn-sm">
                          <Image size={13} />
                          上传主图
                          <input
                            type="file"
                            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={(event) => {
                              selectEditMainImage(event.target.files?.[0] || null);
                              event.currentTarget.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={!draft.mainImage || rowState.saving}
                          onClick={() => {
                            if (draft.mainImage) URL.revokeObjectURL(draft.mainImage.previewUrl);
                            patchDraft({ mainImage: null });
                          }}
                        >
                          <X size={13} />
                          取消新图
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section
                  id={`product-edit-section-assets-detail-${product.id}`}
                  className="product-edit-section grid gap-3"
                >
                  <div className="product-edit-section-head">
                    <h3>产品公共详情 / 长图</h3>
                    <span className="badge badge-grey">750px 长图</span>
                  </div>
                  {contentLoading ? (
                    <div
                      className="inset p-3 text-[13px] text-muted-foreground"
                    >
                      正在加载官网产品详情...
                    </div>
                  ) : contentError ? (
                    <div
                      className="inset p-3 text-[13px] text-warning"
                      role="alert"
                    >
                      官网产品详情加载失败；基础信息仍可编辑保存。
                      {String((contentError as Error)?.message || contentError)}
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
                <section
                  id={`product-edit-section-manuals-${product.id}`}
                  className="product-edit-section grid gap-3"
                >
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

                <section
                  id={`product-edit-section-check-${product.id}`}
                  className="product-edit-section grid gap-3"
                >
                  <div className="product-edit-section-head">
                    <h3>4. 发布检查</h3>
                    <span
                      className={
                        hasPublishedWebsite ? 'badge badge-success' : 'badge badge-warning'
                      }
                    >
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
                  <div
                    className="product-edit-field-grid grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3"
                  >
                    {editProgressItems.map((item) => (
                      <MappingCheckItem
                        key={item.label}
                        label={item.label}
                        value={
                          item.status === 'ready'
                            ? '已就绪'
                            : item.status === 'blocked'
                              ? '需先处理'
                              : '建议补齐'
                        }
                        tone={
                          item.status === 'ready'
                            ? 'success'
                            : item.status === 'blocked'
                              ? 'warning'
                              : 'info'
                        }
                        note={item.detail}
                      />
                    ))}
                  </div>
                  <div
                    className={`inset p-3 text-[13px] leading-normal ${rowState.success ? 'text-success' : 'text-muted-foreground'}`}
                  >
                    {rowState.success || saveFeedbackPreview}
                  </div>
                  {rowState.error ? (
                    <div
                      className="inset p-3 text-[13px] text-destructive"
                      role="alert"
                    >
                      {rowState.error}
                    </div>
                  ) : null}
                </section>
              </div>

              <footer
                className="product-edit-modal-actions flex items-center justify-between gap-2 border-t bg-secondary p-[18px]"
              >
                <span className={rowState.dirty ? 'badge badge-warning' : 'badge badge-grey'}>
                  {rowState.dirty ? '有未保存修改' : '无未保存修改'}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setEditing(false)}
                    disabled={rowState.saving}
                  >
                    <X size={13} />
                    取消
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (draft.mainImage) URL.revokeObjectURL(draft.mainImage.previewUrl);
                      draft.manualPdfs.forEach((manual) => {
                        if (manual.file && manual.previewUrl.startsWith('blob:'))
                          URL.revokeObjectURL(manual.previewUrl);
                      });
                      setDraft(editDraftFromProduct(product));
                      setRowState({ dirty: false, saving: false, success: '', error: '' });
                    }}
                    disabled={rowState.saving}
                  >
                    重置内容
                  </button>
                  <button
                    type="submit"
                    className="btn btn-brand btn-sm"
                    disabled={rowState.saving || !rowState.dirty}
                  >
                    {rowState.saving ? '保存中...' : '保存内容'}
                  </button>
                </div>
              </footer>
            </form>
          </div>,
          document.body
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
          <div className="min-w-0 font-extrabold">
            {product.categoryPath || websiteCategory || product.category || '未分类'}
          </div>
        </td>
        <td>
          {libraryMeta.pilot === true ? (
            <div className="mb-1.5">
              <StatusPill tone="info">试导入</StatusPill>
            </div>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {rowState.dirty && <span className="badge badge-warning">有未保存修改</span>}
            {rowBusyText && <span className="badge badge-info">{rowBusyText}</span>}
          </div>
          <h3
            className="m-0 line-clamp-2 text-[15px] leading-[1.32] font-extrabold text-foreground"
            title={product.name}
          >
            {product.name}
          </h3>
        </td>
        <td>
          <div className="grid min-w-[150px] gap-[5px]">
            <span className="mono-cell" title="产品型号">
              {product.model || '待补齐'}
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              SKU · <span className="mono-cell">{product.sku || '待补齐'}</span>
            </span>
          </div>
        </td>
        <td>
          <span className="text-xs text-muted-foreground">
            {text(brandMeta.series || libraryMeta.series) || '待补齐'}
          </span>
        </td>
        <td>
          {readiness.status ? (
            <div className="grid min-w-[150px] gap-[5px]" title={readiness.details}>
              <StatusPill tone={readiness.status === 'needs_completion' ? 'warning' : 'success'}>
                {readiness.status === 'needs_completion' ? '待补全' : '资料就绪'}
              </StatusPill>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {readiness.ready} / {readiness.total} 个维度就绪
              </span>
              {reviewNotes.length ? (
                <span
                  className="text-[11px] leading-[1.35] text-warning"
                  title={reviewNotes.join('\n')}
                >
                  {reviewNotes[0]}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/70">未评估</span>
          )}
        </td>
        <td>
          <span className="pill-brand max-w-full truncate">
            {displayBrand(product.brand)}
          </span>
        </td>
        <td>
          <ProductCatalogImagePreview
            src={imageSrc}
            alt={product.name || product.model || '产品图片'}
          />
        </td>
        <td>
          <StatusPill tone={statusTone(product.status)}>{statusLabel(product.status)}</StatusPill>
        </td>
        <td>
          <WebsiteShelfSummaryCell assignments={assignments} productBrand={product.brand} />
        </td>
        {canUpdateProduct || canPublishProduct || canDeleteProduct ? (
          <td className="text-right">
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
                  {rowState.savingAction === 'status'
                    ? '处理中'
                    : statusTarget === 'active'
                      ? '启用'
                      : '停用'}
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
            <div className="flex flex-wrap gap-2">
              {rowState.success && (
                <span
                  className="badge badge-success whitespace-normal [overflow-wrap:anywhere]"
                  role="status"
                >
                  <CheckCircle2 size={13} />
                  {rowState.success}
                </span>
              )}
              {rowState.error && (
                <span
                  className="badge badge-warning whitespace-normal [overflow-wrap:anywhere]"
                  role="alert"
                >
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


export function EmptyCatalogState({
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
      <div className="card-elevated px-5 py-11 text-center text-muted-foreground">
        <p className="text-sm font-semibold">当前筛选下暂无产品</p>
        <button
          type="button"
          className="btn btn-outline btn-sm mt-3"
          onClick={onReset}
        >
          查看全部产品
        </button>
      </div>
    );
  }

  return (
    <section className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
      {items.map((product) => {
        const stock = STOCK[product.stock];
        return (
          <article key={product.id} className="card-elevated p-4">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="pill-neutral">{product.brand}</span>
                  {product.isNew && <span className="pill-brand">新品</span>}
                </div>
                <h2 className="mt-2.5 text-base leading-[1.35] font-bold text-foreground">
                  {product.name}
                </h2>
              </div>
              <span className={`badge ${stock.className} shrink-0`}>
                {stock.label}
              </span>
            </div>

            <div className="mt-2 min-h-14 text-xs leading-[1.55] text-muted-foreground">
              <p>{product.model || '标准型号'}</p>
              <p>{product.spec || '参数待同步'}</p>
            </div>

            <div className="mt-3.5 flex items-end justify-between gap-3 border-t pt-3.5">
              <div>
                <div className="text-[11px] text-muted-foreground/70 line-through tabular-nums">
                  指导价 {fmt(product.marketPrice)}
                </div>
                <div className="mt-0.5 text-[22px] leading-[1.1] font-bold text-primary tabular-nums">
                  {fmt(product.dealerPrice)}
                </div>
              </div>
              <span className="rounded-lg border border-success/25 bg-[var(--success-bg)] px-2 py-1 text-xs font-bold whitespace-nowrap text-success tabular-nums">
                毛利 {pct(product.marginRate)}
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

