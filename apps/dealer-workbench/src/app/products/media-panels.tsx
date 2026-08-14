'use client';
// 图片/PDF 媒体簇（图片预览/灯箱/手册上传）
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



import { DEFAULT_CREATE_BRAND_OPTIONS, Metric, ProductBrand, ProductCategoryNode, ProductManualPdfDraft, SiteProductCategoryResponse, SiteProductCategoryRow, SiteProductCategoryTreeNode, displayBrand, nonNegativeInt, normalizeProductCategoryTree, slug, text, useFloatingDialog } from './products-shared';

export function ProductCatalogImagePreview({ src, alt }: { src: string; alt: string }) {
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
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </button>
      {previewOpen && (
        <ProductCatalogImageLightbox src={src} alt={alt} onClose={() => setPreviewOpen(false)} />
      )}
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
          <div
            style={{
              width: 520,
              maxWidth: '80vw',
              padding: 32,
              color: 'var(--t-secondary)',
              textAlign: 'center',
            }}
          >
            图片加载失败
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            onError={() => setFailed(true)}
            style={{
              maxWidth: 'calc(92vw - 48px)',
              maxHeight: 'calc(86vh - 24px)',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        )}
      </div>
    </div>
  );
}


export function ProductManualPdfUploader({
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
    const selected = Array.from(files || []).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
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
    if (target?.file && target.previewUrl.startsWith('blob:'))
      URL.revokeObjectURL(target.previewUrl);
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
      <strong>
        {index + 1}. {manual.name}
      </strong>
      <a
        className="btn btn-brand btn-sm"
        href={manual.previewUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
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

