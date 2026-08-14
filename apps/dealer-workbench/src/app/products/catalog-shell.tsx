'use client';
// 产品目录外壳
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

import { CreateProductDraft, NormalizedProduct, PRODUCT_BASE_CATEGORY_BRAND, ProductBrand, ProductPilotSummary, WebsiteShelfAssignment, assignmentsForProduct, createProductPayload, displayBrand, isProductModelExistsError, normalizeBrand, normalizeProductCategoryTree, productModelExistsMessage, productStatusPayload, saveProductPublicContent, text, uploadProductMainImageRef, uploadProductManualPdfRefs, useFloatingDialog } from './products-shared';
import { emptyCreateDraft } from './readiness';
import { PRODUCT_CATALOG_WORK_FILTER_LABELS, ProductCatalogWorkFilter, ProductCatalogWorkQueue, productDataConsoleItems } from './data-console';
import { CreateProductForm } from './create-product';
import { EmptyCatalogState, ProductCatalogRow } from './catalog-grid';

export function ProductCatalogShell({
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
  const {
    data: createCategoryData,
    error: createCategoryError,
    isLoading: createCategoryLoading,
  } = useSWR(
    showCreate && createBrandCode
      ? ['/api/v2/brand-product-categories', PRODUCT_BASE_CATEGORY_BRAND, 'product-create']
      : null,
    async () => {
      const result = await brandProductCategories.list({ brandCode: PRODUCT_BASE_CATEGORY_BRAND });
      return { tree: normalizeProductCategoryTree(result) };
    },
    { revalidateOnFocus: false }
  );
  const createCategoryTree = createCategoryData?.tree || [];

  const showSelectionColumn = canPublishProduct;
  const showProductActionColumn = canUpdateProduct || canPublishProduct || canDeleteProduct;
  const productCatalogColSpan =
    9 + (showSelectionColumn ? 1 : 0) + (showProductActionColumn ? 1 : 0);
  const catalogWorkItems = useMemo(
    () => productDataConsoleItems(allProducts, assignmentByProductKey),
    [allProducts, assignmentByProductKey]
  );
  const workCounts = useMemo(
    () => ({
      all: catalogWorkItems.length,
      admission: catalogWorkItems.filter((item) => item.issues.includes('missingData')).length,
      directory: catalogWorkItems.filter((item) => item.issues.includes('missingDirectory')).length,
      publish: catalogWorkItems.filter((item) => item.issues.includes('pendingPublish')).length,
      review: catalogWorkItems.filter((item) => item.issues.includes('websiteRisk')).length,
      healthy: catalogWorkItems.filter((item) => !item.issues.length).length,
    }),
    [catalogWorkItems]
  );
  const visibleItems = useMemo(() => {
    if (workFilter === 'all') return items;
    const matchedIds = new Set(
      catalogWorkItems
        .filter((item) => {
          if (workFilter === 'admission') return item.issues.includes('missingData');
          if (workFilter === 'directory') return item.issues.includes('missingDirectory');
          if (workFilter === 'publish') return item.issues.includes('pendingPublish');
          if (workFilter === 'review') return item.issues.includes('websiteRisk');
          if (workFilter === 'healthy') return !item.issues.length;
          return true;
        })
        .map((item) => item.product.id)
    );
    return items.filter((product) => matchedIds.has(product.id));
  }, [catalogWorkItems, items, workFilter]);
  const visibleProductIds = useMemo(
    () => visibleItems.map((product) => product.id).filter(Boolean),
    [visibleItems]
  );
  const selectedItems = useMemo(() => {
    const selected = new Set(selectedProductIds);
    return visibleItems.filter((product) => selected.has(product.id));
  }, [selectedProductIds, visibleItems]);
  const allVisibleSelected =
    visibleProductIds.length > 0 &&
    visibleProductIds.every((id) => selectedProductIds.includes(id));
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
        writableItems.map((product) =>
          products.update(product.id, productStatusPayload(product, nextStatus))
        )
      );
      onNotice(
        `已批量${nextStatus === 'active' ? '启用' : '停用'} ${writableItems.length} 个产品库产品。`
      );
      setSelectedProductIds((current) =>
        current.filter((id) => !selectedItems.some((product) => product.id === id))
      );
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
      const selectedBrands = createDraft.brands.length
        ? createDraft.brands
        : createDraft.brand
          ? [createDraft.brand]
          : [];
      if (!selectedBrands.length) throw new Error('请选择至少一个产品品牌。');
      const primaryBrand = createDraft.brand || selectedBrands[0];
      const entityId = String(createDraft.materialCode || createDraft.model || createDraft.name);
      const mainImageRef = await uploadProductMainImageRef(createDraft.mainImage, entityId);
      const manualPdfRefs = await uploadProductManualPdfRefs(createDraft.manualPdfs, entityId);
      const assetRefs = [mainImageRef, ...manualPdfRefs].filter(Boolean);
      const createdRows: Array<{
        brand: ProductBrand;
        payload: Record<string, unknown>;
        created: unknown;
      }> = [];
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
          await saveProductPublicContent(
            createdId,
            text((payload as any).tenantId),
            null,
            createDraft
          );
        }
      }
      createDraft.manualPdfs.forEach((manual) => URL.revokeObjectURL(manual.previewUrl));
      if (createDraft.mainImage) URL.revokeObjectURL(createDraft.mainImage.previewUrl);
      setCreateDraft(emptyCreateDraft());
      setShowCreate(false);
      onNotice(
        `已创建/更新 ${createdRows.length} 个品牌的产品：${selectedBrands.map(displayBrand).join('、')}。`
      );
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
          onNotice(
            next === 'all'
              ? '已切换到全部产品。'
              : `已切换到${PRODUCT_CATALOG_WORK_FILTER_LABELS[next]}任务视图。`
          );
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
          <strong style={{ color: 'var(--t-primary)' }}>
            {pilotSummary.products} 个试导入产品
          </strong>
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
          {isLoading
            ? '正在加载真实产品...'
            : `当前视图显示 ${visibleItems.length} / ${items.length} 个，本次筛选共 ${total} 个产品`}
        </span>
        {actionNotice && <strong>{actionNotice}</strong>}
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
          title={
            workFilter === 'all'
              ? '当前筛选下没有真实产品'
              : `当前没有${PRODUCT_CATALOG_WORK_FILTER_LABELS[workFilter]}任务`
          }
          description={
            workFilter === 'all'
              ? '可以清空筛选重新查看，或在后续写入表单补齐后创建新产品。'
              : '这个任务视图下没有待处理产品，可以切回全部产品查看。'
          }
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
              <span style={{ fontSize: 12, fontWeight: 800 }}>
                已选 {selectedItems.length} 个产品库产品
              </span>
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
            <table
              className="table product-catalog-table"
              style={{ minWidth: showProductActionColumn ? 1560 : 1440 }}
            >
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
            onPrevious={
              isLoading || currentPage <= 1
                ? undefined
                : () => onPageChange(Math.max(currentPage - 1, 1))
            }
            onNext={
              isLoading || currentPage >= totalPages
                ? undefined
                : () => onPageChange(currentPage + 1)
            }
          />
        </WorkbenchTableShell>
      )}
      {floatingDialog}
    </section>
  );
}

