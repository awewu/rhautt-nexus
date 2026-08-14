'use client';
import { ProductManualPdfUploader } from './media-panels';
import { OfficialProductDetailEditor } from './site-publishing';
// 建品簇（完备度字段/创建表单）
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

import { CreateProductDraft, DEFAULT_CREATE_BRAND_OPTIONS, PRODUCT_LIBRARY_TENANT_ID, ProductBrand, ProductCategoryNode, ProductLibraryCompletenessDraft, categoryOptionLabel, displayBrand, flattenCategoryTree, useFloatingDialog } from './products-shared';
import { activeCategoryOptions } from './category-manager';

export function ProductLibraryCompletenessFields({
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
      <div
        className="product-edit-field-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          gap: 12,
        }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">产品类型</span>
          <input
            className="input"
            value={draft.productType}
            disabled={disabled}
            onChange={(event) => onPatch({ productType: event.target.value })}
            placeholder="如：燃气热水器 / 热泵 / 采暖炉"
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">生命周期</span>
          <select
            className="input"
            value={draft.lifecycleStage}
            disabled={disabled}
            onChange={(event) => onPatch({ lifecycleStage: event.target.value })}
          >
            <option value="intro">导入 / 上新</option>
            <option value="growth">成长</option>
            <option value="mature">成熟</option>
            <option value="withdrawn">停售</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">制造商</span>
          <input
            className="input"
            value={draft.manufacturer}
            disabled={disabled}
            onChange={(event) => onPatch({ manufacturer: event.target.value })}
            placeholder="如：Rheem / Everhot"
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">产地</span>
          <input
            className="input"
            value={draft.countryOfOrigin}
            disabled={disabled}
            onChange={(event) => onPatch({ countryOfOrigin: event.target.value })}
            placeholder="中国"
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">适用市场</span>
          <input
            className="input"
            value={draft.marketCode}
            disabled={disabled}
            onChange={(event) => onPatch({ marketCode: event.target.value })}
            placeholder="CN"
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">上市日期</span>
          <input
            className="input"
            type="date"
            value={draft.launchDate}
            disabled={disabled}
            onChange={(event) => onPatch({ launchDate: event.target.value })}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">停售日期</span>
          <input
            className="input"
            type="date"
            value={draft.discontinueDate}
            disabled={disabled}
            onChange={(event) => onPatch({ discontinueDate: event.target.value })}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">销售单位</span>
          <input
            className="input"
            value={draft.salesUnit}
            disabled={disabled}
            onChange={(event) => onPatch({ salesUnit: event.target.value })}
            placeholder="台 / 套 / 件"
          />
        </label>
      </div>
      <div className="product-edit-subsection" style={{ display: 'grid', gap: 10 }}>
        <div className="product-edit-section-head" style={{ padding: 0, border: 0 }}>
          <h4 style={{ margin: 0, fontSize: 14 }}>基础尺寸与重量</h4>
          <span className="badge badge-grey">产品主表字段 · 尺寸 mm / 重量 kg</span>
        </div>
        <div
          className="product-edit-field-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
            gap: 12,
          }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">产品长 mm</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={draft.lengthMm}
              disabled={disabled}
              onChange={(event) => onPatch({ lengthMm: event.target.value })}
              placeholder="如：720"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">产品宽 mm</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={draft.widthMm}
              disabled={disabled}
              onChange={(event) => onPatch({ widthMm: event.target.value })}
              placeholder="如：450"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">产品高 mm</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={draft.heightMm}
              disabled={disabled}
              onChange={(event) => onPatch({ heightMm: event.target.value })}
              placeholder="如：260"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">净重 kg</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.001"
              value={draft.netWeightKg}
              disabled={disabled}
              onChange={(event) => onPatch({ netWeightKg: event.target.value })}
              placeholder="如：18.5"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">包装长 mm</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={draft.packageLengthMm}
              disabled={disabled}
              onChange={(event) => onPatch({ packageLengthMm: event.target.value })}
              placeholder="如：820"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">包装宽 mm</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={draft.packageWidthMm}
              disabled={disabled}
              onChange={(event) => onPatch({ packageWidthMm: event.target.value })}
              placeholder="如：520"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">包装高 mm</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={draft.packageHeightMm}
              disabled={disabled}
              onChange={(event) => onPatch({ packageHeightMm: event.target.value })}
              placeholder="如：360"
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">毛重 kg</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.001"
              value={draft.grossWeightKg}
              disabled={disabled}
              onChange={(event) => onPatch({ grossWeightKg: event.target.value })}
              placeholder="如：21"
            />
          </label>
        </div>
      </div>
      <div
        className="product-edit-field-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          gap: 12,
        }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">包装/配置说明</span>
          <input
            className="input"
            value={draft.packageSpec}
            disabled={disabled}
            onChange={(event) => onPatch({ packageSpec: event.target.value })}
            placeholder="如：整机+附件包"
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">SKU 配置差异</span>
          <input
            className="input"
            value={draft.configurationNotes}
            disabled={disabled}
            onChange={(event) => onPatch({ configurationNotes: event.target.value })}
            placeholder="如：不同容量/包装/销售配置"
          />
        </label>
      </div>
      <div
        className="product-edit-field-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 12,
        }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">技术参数</span>
          <textarea
            className="input"
            rows={5}
            value={draft.technicalSpecs}
            disabled={disabled}
            onChange={(event) => onPatch({ technicalSpecs: event.target.value })}
            placeholder={'一行一个，例如：\n容量: 16L\n能效等级: 一级\n燃气种类: 天然气'}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">产品卖点</span>
          <textarea
            className="input"
            rows={5}
            value={draft.sellingPoints}
            disabled={disabled}
            onChange={(event) => onPatch({ sellingPoints: event.target.value })}
            placeholder={'一行一个，例如：\n恒温控制\n低噪运行\n安全防护'}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">应用场景</span>
          <textarea
            className="input"
            rows={5}
            value={draft.applicationScenarios}
            disabled={disabled}
            onChange={(event) => onPatch({ applicationScenarios: event.target.value })}
            placeholder={'一行一个，例如：\n住宅热水\n公寓\n别墅'}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">安装条件</span>
          <textarea
            className="input"
            rows={5}
            value={draft.installationRequirement}
            disabled={disabled}
            onChange={(event) => onPatch({ installationRequirement: event.target.value })}
            placeholder="如：排烟、燃气压力、水压、电源、安装空间要求"
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">保修政策</span>
          <textarea
            className="input"
            rows={5}
            value={draft.warrantyPolicy}
            disabled={disabled}
            onChange={(event) => onPatch({ warrantyPolicy: event.target.value })}
            placeholder="如：整机保修年限、核心部件保修、适用条件"
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-label">合规/证书</span>
          <textarea
            className="input"
            rows={5}
            value={draft.complianceCertificates}
            disabled={disabled}
            onChange={(event) => onPatch({ complianceCertificates: event.target.value })}
            placeholder={'一行一个，例如：\nCCC 证书\n能效备案\n检测报告'}
          />
        </label>
      </div>
    </section>
  );
}


export function CreateProductForm({
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
  const selectedPath = [selectedLevel1, selectedLevel2, selectedLevel3]
    .filter(Boolean)
    .map((item) => item?.name || item?.code)
    .join(' / ');
  const selectedBrands = draft.brands.length ? draft.brands : draft.brand ? [draft.brand] : [];
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
            <span>
              {draft.brand
                ? `${displayBrand(draft.brand)} · ${selectedPath || '请选择产品分类'}`
                : '先选择品牌，再选择该品牌已有分类'}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm icon-only"
            onClick={onCancel}
            aria-label="关闭新增产品"
            disabled={submitting}
          >
            <X size={15} />
          </button>
        </header>

        <div
          className="product-edit-modal-body"
          style={{ overflow: 'auto', padding: 18, display: 'grid', gap: 14 }}
        >
          <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
            <div className="product-edit-section-head">
              <h3>基础信息</h3>
              <span className={tenantId ? 'badge badge-success' : 'badge badge-warning'}>
                {tenantId ? `tenantId: ${tenantId}` : '请选择品牌'}
              </span>
            </div>
            <div
              className="product-edit-field-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                gap: 12,
              }}
            >
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">品牌</span>
                <div
                  className="inset"
                  style={{ padding: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}
                >
                  {createBrandOptions.map((brand) => (
                    <label
                      key={brand.value}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
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
                <input
                  className="input"
                  value={draft.name}
                  required
                  onChange={(event) => patch({ name: event.target.value })}
                  placeholder="恒热燃气热水器 RGS-A"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">产品型号</span>
                <input
                  className="input"
                  value={draft.model}
                  required
                  onChange={(event) => patch({ model: event.target.value })}
                  placeholder="RGS-A"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">SKU / 物料编码</span>
                <input
                  className="input"
                  value={draft.materialCode}
                  required
                  onChange={(event) => patch({ materialCode: event.target.value })}
                  placeholder="10012345"
                />
              </label>
            </div>
          </section>

          <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
            <div className="product-edit-section-head">
              <h3>产品分类绑定</h3>
              <span className="badge badge-grey">来自当前品牌分类树</span>
            </div>
            {categoryLoading ? (
              <div
                className="inset"
                style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 13 }}
              >
                正在加载产品分类...
              </div>
            ) : categoryError ? (
              <div
                className="inset"
                role="alert"
                style={{ padding: 12, color: 'var(--danger)', fontSize: 13 }}
              >
                产品分类加载失败：{String((categoryError as Error)?.message || categoryError)}
              </div>
            ) : !draft.brand ? (
              <div
                className="inset"
                style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 13 }}
              >
                请选择品牌后加载该品牌分类。
              </div>
            ) : !categoryTree.length ? (
              <div
                className="inset"
                style={{ padding: 12, color: 'var(--t-secondary)', fontSize: 13 }}
              >
                当前品牌暂无分类，请先在“产品分类”中维护分类树。
              </div>
            ) : (
              <div
                className="product-edit-field-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                  gap: 12,
                }}
              >
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">一级分类</span>
                  <select
                    className="input"
                    value={draft.categoryLevel1Id}
                    required
                    onChange={(event) =>
                      patch({
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
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">二级分类</span>
                  <select
                    className="input"
                    value={draft.categoryLevel2Id}
                    required
                    disabled={!draft.categoryLevel1Id}
                    onChange={(event) =>
                      patch({ categoryLevel2Id: event.target.value, categoryLevel3Id: '' })
                    }
                  >
                    <option value="">请选择二级分类</option>
                    {level2Options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {categoryOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">三级分类（可选）</span>
                  <select
                    className="input"
                    value={draft.categoryLevel3Id}
                    disabled={!draft.categoryLevel2Id}
                    onChange={(event) => patch({ categoryLevel3Id: event.target.value })}
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
          </section>

          <ProductLibraryCompletenessFields draft={draft} disabled={submitting} onPatch={patch} />

          <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
            <div className="product-edit-section-head">
              <h3>价格信息</h3>
              <span className="badge badge-grey">目录价与官网展示价分开维护</span>
            </div>
            <div
              className="product-edit-field-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                gap: 12,
              }}
            >
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">产品库目录价</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.listPrice}
                  onChange={(event) => patch({ listPrice: event.target.value })}
                  placeholder="不填则为 0"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">经销商基准价</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.costPrice}
                  onChange={(event) => patch({ costPrice: event.target.value })}
                  placeholder="内部供货/结算参考价，不对官网展示"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">币种</span>
                <input
                  className="input"
                  value={draft.currency}
                  onChange={(event) => patch({ currency: event.target.value || 'CNY' })}
                  placeholder="CNY"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">官网价格展示方式</span>
                <select
                  className="input"
                  value={draft.websitePriceDisplayMode}
                  onChange={(event) => patch({ websitePriceDisplayMode: event.target.value })}
                >
                  <option value="not_shown">不展示价格</option>
                  <option value="show_price">显示官网参考价</option>
                  <option value="price_range">显示价格区间</option>
                  <option value="inquiry">面议</option>
                  <option value="contact_dealer">联系经销商</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">官网参考价</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.websitePrice}
                  disabled={draft.websitePriceDisplayMode !== 'show_price'}
                  onChange={(event) => patch({ websitePrice: event.target.value })}
                  placeholder="选择显示官网参考价时填写"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">官网最低价</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.websitePriceMin}
                  disabled={draft.websitePriceDisplayMode !== 'price_range'}
                  onChange={(event) => patch({ websitePriceMin: event.target.value })}
                  placeholder="价格区间最低价"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">官网最高价</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.websitePriceMax}
                  disabled={draft.websitePriceDisplayMode !== 'price_range'}
                  onChange={(event) => patch({ websitePriceMax: event.target.value })}
                  placeholder="价格区间最高价"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">活动价</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.promoPrice}
                  onChange={(event) => patch({ promoPrice: event.target.value })}
                  placeholder="可选"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">价格单位</span>
                <input
                  className="input"
                  value={draft.priceUnit}
                  onChange={(event) => patch({ priceUnit: event.target.value })}
                  placeholder="台 / 套 / 件"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">价格标签</span>
                <input
                  className="input"
                  value={draft.priceLabel}
                  onChange={(event) => patch({ priceLabel: event.target.value })}
                  placeholder="官网参考价 / 起售价"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">价格说明</span>
                <input
                  className="input"
                  value={draft.priceNote}
                  onChange={(event) => patch({ priceNote: event.target.value })}
                  placeholder="例如：最终成交价以经销商报价为准"
                />
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 22 }}>
                <input
                  type="checkbox"
                  checked={draft.taxIncluded}
                  onChange={(event) => patch({ taxIncluded: event.target.checked })}
                />
                <span className="t-label">价格含税</span>
              </label>
            </div>
          </section>

          <section className="product-edit-section" style={{ display: 'grid', gap: 12 }}>
            <div className="product-edit-section-head">
              <h3>官网元数据</h3>
            </div>
            <div
              className="product-edit-field-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                gap: 12,
              }}
            >
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">公开路径</span>
                <input
                  className="input"
                  value={draft.publicSlug}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(event) => patch({ publicSlug: event.target.value })}
                  placeholder="留空则按型号生成"
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">系列</span>
                <input
                  className="input"
                  value={draft.series}
                  onChange={(event) => patch({ series: event.target.value })}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">英文名</span>
                <input
                  className="input"
                  value={draft.officialEnglishName}
                  onChange={(event) => patch({ officialEnglishName: event.target.value })}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">排序</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.displayOrder}
                  onChange={(event) => patch({ displayOrder: event.target.value })}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">标语</span>
                <input
                  className="input"
                  value={draft.tagline}
                  onChange={(event) => patch({ tagline: event.target.value })}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span className="t-label">标签</span>
                <input
                  className="input"
                  value={draft.badges}
                  onChange={(event) => patch({ badges: event.target.value })}
                  placeholder="用逗号分隔"
                />
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '160px minmax(0, 1fr)',
                gap: 14,
                alignItems: 'start',
              }}
            >
              <div
                style={{
                  width: 146,
                  aspectRatio: '1 / 1',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--surface-2)',
                  display: 'grid',
                  placeItems: 'center',
                  overflow: 'hidden',
                }}
              >
                {draft.mainImage ? (
                  <img
                    src={draft.mainImage.previewUrl}
                    alt="产品主图预览"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Image size={28} style={{ color: 'var(--t-tertiary)' }} />
                )}
              </div>
              <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <p style={{ margin: 0, color: 'var(--t-secondary)', fontSize: 12 }}>
                  维护产品主图，保存后会进入产品库素材引用，并在产品库列表和品牌产品页面同步读取。
                </p>
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
          {error && (
            <span className="row-feedback error" role="alert">
              {error}
            </span>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onCancel}
            disabled={submitting}
          >
            <X size={13} />
            取消
          </button>
          <button
            type="submit"
            className="btn btn-brand btn-sm"
            disabled={submitting || categoryLoading}
          >
            <Plus size={14} />
            {submitting ? '创建中...' : '创建'}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
}

