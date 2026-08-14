'use client';

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

import { ProductCategoryManagerCrudView, activeCategoryOptions } from './category-manager';
import { DEFAULT_CREATE_BRAND_OPTIONS, Metric, ProductBrand, ProductCategoryNode, SiteProductCategoryResponse, SiteProductCategoryRow, SiteProductCategoryTreeNode, buildSiteProductCategoryTree, displayBrand, flattenCategoryTree, nonNegativeInt, normalizeProductCategoryTree, slug, text, useFloatingDialog } from './products-shared';
import { OfficialProductDetailEditor, ProductSitePublishingPanel } from './site-publishing';
import { ProductCatalogImagePreview, ProductManualPdfUploader } from './media-panels';
import { MappingCheckItem, NormalizedProduct, PRODUCT_LIBRARY_TENANT_ID, ProductManualPdfDraft, WebsiteShelfAssignment, artifactContentUrl, normalizeBrand, objectOrEmpty, productBrandMeta, productCategoryBinding, productLibraryMeta, readBrowserFileBase64, sanitizeOfficialProductDetailHtml, splitBadges, tenantIdForProduct } from './products-shared';
import { applyCatalogCategoryQuery, catalogCategoryFilterOptions, productMatchesCatalogCategory } from './readiness';
import { ProductDataConsole } from './data-console';
import { ProductCatalogShell } from './catalog-shell';
import { ProductBaseView, ProductMaterialsView } from './misc-views';
import { CatalogCategoryFilter, PRODUCT_BASE_CATEGORY_BRAND, PRODUCT_DETAIL_LOCALE, ProductPilotSummary, ProductStock, assignmentKey, assignmentsForProduct, productDetailContentItems } from './products-shared';
type ProductModule = 'dashboard' | 'catalog' | 'materials' | 'base' | 'categories';
type BrandFilter = string;
type StatusFilter = 'all' | 'active' | 'inactive' | 'archived';
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

const DEFAULT_BRAND_OPTIONS: Array<{ value: BrandFilter; label: string }> = [
  { value: 'all', label: '全部品牌' },
  { value: 'rheem', label: '瑞美 Rheem' },
  { value: 'ruud', label: '瑞德 Ruud' },
  { value: 'everhot', label: '恒热 Everhot' },
];
const DEFAULT_PRODUCT_BRANDS: ProductBrand[] = ['rheem', 'ruud', 'everhot'];
const BRAND_PRODUCT_TENANTS: Record<string, string | undefined> = {
  rheem: process.env.NEXT_PUBLIC_RHEEM_TENANT_ID || '4aee0000-0000-4000-8000-000000000001',
  ruud: process.env.NEXT_PUBLIC_RUUD_TENANT_ID || '7aad0000-0000-4000-8000-000000000001',
  everhot: process.env.NEXT_PUBLIC_EVERHOT_TENANT_ID || 'e5e40000-0000-4000-8000-000000000001',
};
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部产品库状态' },
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '停用' },
  { value: 'archived', label: '已归档' },
];
const PRODUCT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
function normalizeModule(value: unknown): ProductModule {
  return value === 'catalog' || value === 'materials' || value === 'base' || value === 'categories'
    ? value
    : 'dashboard';
}

function normalizeCategory(value: unknown): CatKey {
  const raw = text(value);
  return raw ? (raw as CatKey) : 'heat_pump';
}

function brandOptionsFromSites(result: unknown): Array<{ value: ProductBrand; label: string }> {
  const rows = Array.isArray((result as any)?.items) ? (result as any).items : [];
  const options = rows
    .filter(
      (site: Record<string, any>) =>
        site.status === 'active' && !site.deletedAt && site.code !== 'rhautt-group'
    )
    .map((site: Record<string, any>) => ({
      value: normalizeBrand(site.code),
      label: `${site.nameCn || site.nameEn || site.code} ${site.nameEn || ''}`.trim(),
      sortOrder: Number(site.sortOrder || 0),
    }))
    .filter((site: { value: string }) => site.value)
    .sort(
      (left: { sortOrder: number }, right: { sortOrder: number }) =>
        left.sortOrder - right.sortOrder
    )
    .map(({ value, label }: { value: string; label: string }) => ({ value, label }));
  return options.length ? options : DEFAULT_CREATE_BRAND_OPTIONS;
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
    return String(left.name || left.model || left.sku).localeCompare(
      String(right.name || right.model || right.sku),
      'zh-CN'
    );
  });
}

function officialDetailFromContent(result: unknown): string {
  const item =
    productDetailContentItems(result).find((row) => row?.locale === PRODUCT_DETAIL_LOCALE) ||
    productDetailContentItems(result)[0];
  return text(item?.officialDetailHtml);
}

function assignmentItems(payload: unknown): WebsiteShelfAssignment[] {
  const data = (payload as any)?.data ?? payload;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function assignmentMatchesProduct(
  assignment: WebsiteShelfAssignment | undefined,
  product: NormalizedProduct
) {
  return Boolean(
    assignment &&
    !assignment.deletedAt &&
    assignment.productId === product.id &&
    assignment.productTenantId === tenantIdForProduct(product)
  );
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
      const key = text(
        item?.id ||
          item?._id ||
          `${item?.tenantId || ''}:${item?.sku || item?.model || item?.name || ''}`
      );
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
  const marketPrice = Number(
    item.marketPrice ?? item.listPrice ?? item.retailPrice ?? item.msrp ?? 0
  );
  const dealerPrice = Number(
    item.dealerPrice ?? item.costPrice ?? item.tradePrice ?? item.price ?? 0
  );
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
    marginRate: item.marketPrice
      ? ((item.marketPrice - item.dealerPrice) / item.marketPrice) * 100
      : 0,
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
    STATUS_OPTIONS.some((item) => item.value === requestedStatus) ? requestedStatus : 'active'
  );
  const [batchFilter, setBatchFilter] = useState(text(searchParams.get('batch')));
  const [pageSize, setPageSize] = useState(20);
  const [catalogPage, setCatalogPage] = useState(1);
  const [productPermissions, setProductPermissions] = useState<BrandProductPermissions>(
    EMPTY_BRAND_PRODUCT_PERMISSIONS
  );
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const { data: brandSiteData } = useSWR('/api/v2/brand-sites', () => brandSites.list(), {
    revalidateOnFocus: false,
  });
  const createBrandOptions = useMemo(() => brandOptionsFromSites(brandSiteData), [brandSiteData]);
  const brandOptions = useMemo(
    () => [DEFAULT_BRAND_OPTIONS[0], ...createBrandOptions],
    [createBrandOptions]
  );
  const supportedProductBrands = useMemo(
    () => createBrandOptions.map((option) => option.value).filter(Boolean),
    [createBrandOptions]
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
    return (supportedProductBrands.length ? supportedProductBrands : DEFAULT_PRODUCT_BRANDS).map(
      (brand) => ({
        ...query,
        brand,
        tenantId: PRODUCT_LIBRARY_TENANT_ID,
      })
    );
  };

  const catalogQueries = useMemo(
    () => makeCatalogQueries(statusFilter),
    [brandFilter, category, deferredKeyword, statusFilter, supportedProductBrands]
  );

  const {
    data: apiData,
    error,
    isLoading,
    mutate,
  } = useSWR(
    ['/api/v2/product-catalog/devices', catalogQueries],
    async () => {
      const responses = await Promise.all(catalogQueries.map((query) => products.list(query)));
      return responses.length === 1 ? responses[0] : mergeCatalogResponses(responses);
    },
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    let cancelled = false;
    auth
      .me()
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
    return getProductItems(apiData)
      .map(normalizeProduct)
      .filter((item) => item.id);
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
    categoryFilterBrands.length
      ? ['/api/v2/brand-product-categories/catalog-filter', categoryFilterBrands]
      : null,
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
    [
      '/api/v2/product-catalog/devices/status-counts',
      brandFilter,
      category,
      deferredKeyword,
      supportedProductBrands.join('|'),
    ],
    async () => {
      const entries = await Promise.all(
        STATUS_OPTIONS.map(async (status) => {
          const queries = makeCatalogQueries(status.value, '1');
          const responses = await Promise.all(queries.map((query) => products.list(query)));
          return [
            status.value,
            responses.reduce((sum, response) => sum + getProductTotal(response), 0),
          ] as const;
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
    catalogAssignmentBrands.length
      ? ['/api/v2/brand-sites/product-assignments', catalogAssignmentBrands]
      : null,
    async () => {
      const responses = await Promise.all(
        catalogAssignmentBrands.map((brand) =>
          siteProductAssignments
            .list(brand, { page: '1', pageSize: '500' })
            .then((result) =>
              assignmentItems(result).map((assignment) => ({
                ...assignment,
                siteCode: assignment.siteCode || brand,
              }))
            )
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
      return [
        product.sku,
        product.name,
        product.model,
        productBrandMeta(product).series,
        libraryMeta.sourceCategory,
        ...(Array.isArray(libraryMeta.reviewNotes) ? libraryMeta.reviewNotes : []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
    return sortProductsByStatusThenOrder(filtered);
  }, [batchFilter, brandFilter, category, deferredKeyword, liveProductList, statusFilter]);

  const pilotSummary = useMemo<ProductPilotSummary | null>(() => {
    const pilotProducts = visibleCatalogProducts.filter(
      (product) => productLibraryMeta(product).pilot === true
    );
    if (!pilotProducts.length) return null;
    const categories = new Set(
      pilotProducts
        .map((product) => text(productLibraryMeta(product).sourceCategory) || product.category)
        .filter(Boolean)
    );
    const websitePublished = pilotProducts.filter((product) => {
      return assignmentsForProduct(assignmentsByProductKey, product).some(
        (assignment) => assignment.status === 'published' && !assignment.deletedAt
      );
    }).length;
    return {
      products: pilotProducts.length,
      categories: categories.size,
      websitePublished,
      needsCompletion: pilotProducts.filter(
        (product) => productLibraryMeta(product).dataReadinessStatus === 'needs_completion'
      ).length,
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
          border-color: rgba(200, 32, 44, 0.28);
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
            radial-gradient(circle at 20% 12%, rgba(255, 255, 255, 0.28), transparent 32%),
            rgba(15, 23, 42, 0.54) !important;
        }
        .product-edit-modal {
          border-radius: 14px !important;
          border-color: rgba(15, 23, 42, 0.14) !important;
          background: #f8fafc !important;
          box-shadow:
            0 28px 72px rgba(15, 23, 42, 0.24),
            0 2px 8px rgba(15, 23, 42, 0.08) !important;
        }
        .product-edit-modal-head {
          padding: 18px 22px !important;
          background: linear-gradient(180deg, #ffffff 0%, #fbfcfd 100%);
          border-bottom-color: rgba(15, 23, 42, 0.1) !important;
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
          border-top-color: rgba(15, 23, 42, 0.1) !important;
          background: rgba(255, 255, 255, 0.94) !important;
          backdrop-filter: blur(12px);
        }
        .product-edit-section {
          gap: 14px !important;
          padding: 16px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          scroll-margin-top: 12px;
        }
        .product-edit-section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.07);
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
          border-color: rgba(15, 23, 42, 0.16);
          border-radius: 7px;
          background: #fff;
          box-shadow: 0 1px 1px rgba(15, 23, 42, 0.03);
        }
        .product-edit-modal textarea.input {
          min-height: 108px;
          line-height: 1.55;
        }
        .product-edit-modal .input:focus {
          border-color: rgba(200, 32, 44, 0.45);
          box-shadow: 0 0 0 3px rgba(200, 32, 44, 0.1);
        }
        .product-edit-modal .input:disabled,
        .product-edit-modal .input[readonly] {
          background: #f3f5f7;
          color: var(--t-secondary);
          box-shadow: none;
        }
        .product-edit-modal .inset {
          border-color: rgba(15, 23, 42, 0.09);
          border-radius: 8px;
          background: #f6f8fa;
        }
        .product-edit-media-panel {
          padding: 12px;
          border: 1px solid rgba(15, 23, 42, 0.09);
          border-radius: 10px;
          background: #f8fafc;
        }
        .product-edit-media-thumb {
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 9px;
          background:
            linear-gradient(45deg, rgba(15, 23, 42, 0.04) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(15, 23, 42, 0.04) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(15, 23, 42, 0.04) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(15, 23, 42, 0.04) 75%), #fff;
          background-position:
            0 0,
            0 8px,
            8px -8px,
            -8px 0;
          background-size: 16px 16px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }
        .product-edit-check-item {
          padding: 12px;
          border: 1px solid rgba(15, 23, 42, 0.09);
          border-radius: 8px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76);
        }
        .product-edit-progress {
          display: grid;
          grid-template-columns: minmax(220px, 270px) minmax(0, 1fr);
          gap: 14px;
          align-items: stretch;
          padding: 14px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 10px;
          background: linear-gradient(135deg, #ffffff 0%, #f7f9fb 54%, #fff7f8 100%);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .product-edit-progress__summary {
          display: grid;
          align-content: space-between;
          gap: 10px;
          min-width: 0;
          padding: 12px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
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
          background: rgba(15, 23, 42, 0.08);
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
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.86);
          color: var(--t-secondary);
          cursor: pointer;
          text-align: left;
          appearance: none;
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease,
            transform 150ms ease,
            background-color 150ms ease;
        }
        .product-edit-progress__item:hover {
          border-color: rgba(200, 32, 44, 0.28);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
          transform: translateY(-1px);
        }
        .product-edit-progress__item:focus-visible {
          outline: 3px solid rgba(200, 32, 44, 0.16);
          outline-offset: 2px;
        }
        .product-edit-progress__item:active {
          transform: translateY(0);
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
        }
        .product-edit-progress__item.is-ready {
          border-color: rgba(34, 197, 94, 0.22);
          background: rgba(240, 253, 244, 0.72);
        }
        .product-edit-progress__item.is-todo,
        .product-edit-progress__item.is-blocked {
          border-color: rgba(245, 158, 11, 0.24);
          background: rgba(255, 251, 235, 0.72);
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
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
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
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 8px;
          background: #fff;
          color: var(--t-secondary);
          cursor: pointer;
          text-align: left;
          appearance: none;
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease,
            transform 150ms ease;
        }
        .product-readiness-checklist__item:hover {
          border-color: rgba(15, 23, 42, 0.18);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.07);
          transform: translateY(-1px);
        }
        .product-readiness-checklist__item:focus-visible {
          outline: 3px solid rgba(200, 32, 44, 0.16);
          outline-offset: 2px;
        }
        .product-readiness-checklist__item.is-success {
          border-color: rgba(34, 197, 94, 0.22);
          background: rgba(240, 253, 244, 0.72);
        }
        .product-readiness-checklist__item.is-warning {
          border-color: rgba(245, 158, 11, 0.28);
          background: rgba(255, 251, 235, 0.78);
        }
        .product-readiness-checklist__item.is-info {
          border-color: rgba(59, 130, 246, 0.18);
          background: rgba(239, 246, 255, 0.72);
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
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: rgba(255, 255, 255, 0.72);
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
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.55fr);
          gap: 18px;
          padding: 22px;
          border: 1px solid rgba(15, 23, 42, 0.12);
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
          color: rgba(255, 255, 255, 0.72);
          font-size: 13px;
          line-height: 1.5;
        }
        .product-data-console-hero .t-label {
          color: rgba(255, 255, 255, 0.68);
        }
        .product-data-console-hero__verdict {
          display: grid;
          gap: 8px;
          align-content: center;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: var(--r-md);
          background: rgba(255, 255, 255, 0.08);
        }
        .product-data-console-hero__verdict strong {
          color: #fff;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 900;
        }
        .product-data-console-hero__verdict small {
          color: rgba(255, 255, 255, 0.7);
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
          grid-template-columns: minmax(0, 1.3fr) minmax(360px, 0.75fr);
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
          grid-template-columns: 48px minmax(0, 1.4fr) minmax(190px, 0.7fr) auto;
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
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 10px;
          background: #ffffff;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.04),
            0 10px 30px rgba(15, 23, 42, 0.04);
        }
        .product-catalog-commandbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.09);
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
          border-bottom: 1px solid rgba(15, 23, 42, 0.09);
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
          border-right: 1px solid rgba(15, 23, 42, 0.08);
          border-bottom: 2px solid transparent;
          border-radius: 0;
          background: transparent;
          color: var(--t-secondary);
          text-align: left;
          cursor: pointer;
          transition:
            background 0.16s ease,
            border-color 0.16s ease;
        }
        .product-catalog-workqueue button:first-child {
          border-left: 1px solid rgba(15, 23, 42, 0.08);
        }
        .product-catalog-workqueue button:hover,
        .product-catalog-workqueue button:focus-visible {
          border-bottom-color: rgba(200, 32, 44, 0.35);
          background: #fbfcfd;
          outline: none;
        }
        .product-catalog-workqueue button.is-active {
          border-bottom-color: var(--brand);
          background: rgba(200, 32, 44, 0.045);
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
          border-bottom: 1px solid rgba(15, 23, 42, 0.09);
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
                      {statusFilterCounts
                        ? `${item.label} (${statusFilterCounts[item.value] ?? 0})`
                        : item.label}
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
                  <span
                    className="badge badge-info"
                    style={{ display: 'inline-flex', gap: 6, alignItems: 'center', maxWidth: 260 }}
                  >
                    <span
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      试导入批次：{batchFilter}
                    </span>
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
