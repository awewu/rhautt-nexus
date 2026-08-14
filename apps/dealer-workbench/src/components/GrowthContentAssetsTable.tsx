'use client';

/**
 * 内容工厂素材管理（2026-08 全页 UX 重构三期 · WorkspaceKit 化）。
 * 仅重构 JSX 渲染层：40 处内联样式清零，静态布局全走 Tailwind（v4 + shadcn token），
 * 外层卡壳换 WorkspaceSection；hooks/事件/上传逻辑保持不变。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Edit3,
  Eye,
  FileImage,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { WorkspaceSection } from '@/components/WorkspaceKit';
import { fileArtifacts, growthContentAssets } from '../lib/api';

type ContentAsset = {
  id: string;
  title: string;
  assetType: string;
  brandSlug: string | null;
  channel: string | null;
  summary: string | null;
  tags: string[];
  fileArtifactId: string | null;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  fileFormat: string | null;
  usageScene: string | null;
  status: string;
  usageCount: number;
  updatedAt: string;
  archivedAt: string | null;
};

const ASSET_TYPES = ['封面图', '正文配图', '产品图', '案例图', '品牌VI', '短视频'];

const EMPTY_FORM = {
  title: '',
  assetType: '封面图',
  brandSlug: 'Rheem',
  channel: '公众号',
  usageScene: '文案发布',
  summary: '',
  tags: '',
  fileArtifactId: '',
  fileUrl: '',
  fileFormat: '',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;]+;base64,/, ''));
    reader.onerror = () => reject(reader.error || new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

function fileFormat(file: File) {
  return (file.name.split('.').pop() || file.type || 'file').toUpperCase();
}

function contentAssetPreviewUrl(item: ContentAsset) {
  const url = String(item.thumbnailUrl || item.fileUrl || '').trim();
  if (url) return url;
  const artifactId = String(item.fileArtifactId || '').trim();
  return artifactId ? `/api/v2/file-artifact/${encodeURIComponent(artifactId)}/content` : '';
}

function toPayload(form: typeof EMPTY_FORM) {
  return {
    ...form,
    tags: form.tags
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export default function GrowthContentAssetsTable() {
  const [items, setItems] = useState<ContentAsset[]>([]);
  const [assetTypes, setAssetTypes] = useState(ASSET_TYPES);
  const [keyword, setKeyword] = useState('');
  const [assetType, setAssetType] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewItem, setPreviewItem] = useState<ContentAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const next: Record<string, string> = {
      pageSize: '100',
      sortBy: 'updatedAt',
      sortOrder: 'DESC',
    };
    if (keyword.trim()) next.keyword = keyword.trim();
    if (assetType !== 'all') next.assetType = assetType;
    if (includeArchived) next.includeArchived = 'true';
    return next;
  }, [assetType, includeArchived, keyword]);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await growthContentAssets.list(query);
      setItems(Array.isArray(result?.items) ? result.items : []);
      const nextTypes = Array.isArray(result?.assetTypes) ? result.assetTypes : [];
      setAssetTypes(Array.from(new Set([...ASSET_TYPES, ...nextTypes.filter(Boolean)])));
    } catch (loadError) {
      setError((loadError as Error).message || '素材加载失败');
    } finally {
      setBusy(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  function patchForm(patch: Partial<typeof EMPTY_FORM>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function resetForm() {
    setEditingId('');
    setForm(EMPTY_FORM);
    setSelectedFile(null);
  }

  function edit(item: ContentAsset) {
    setEditingId(item.id);
    setSelectedFile(null);
    setForm({
      title: item.title || '',
      assetType: item.assetType || '封面图',
      brandSlug: item.brandSlug || '',
      channel: item.channel || '',
      usageScene: item.usageScene || '',
      summary: item.summary || '',
      tags: (item.tags || []).join(', '),
      fileArtifactId: item.fileArtifactId || '',
      fileUrl: item.fileUrl || '',
      fileFormat: item.fileFormat || '',
    });
  }

  async function save() {
    if (!form.title.trim()) return setError('请填写素材名称');
    if (!form.assetType.trim()) return setError('请选择素材类型');
    setBusy(true);
    setError('');
    try {
      let payload = toPayload(form);
      if (selectedFile) {
        const artifact = await fileArtifacts.uploadBase64({
          entityType: 'growth_content_asset',
          entityId: editingId || 'pending',
          filename: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          dataBase64: await readFileBase64(selectedFile),
        });
        payload = {
          ...payload,
          fileArtifactId: String(artifact?.id || ''),
          fileUrl: String(artifact?.contentUrl || ''),
          fileFormat: form.fileFormat || fileFormat(selectedFile),
        };
      }
      if (editingId) {
        await growthContentAssets.update(editingId, payload);
        setMessage('素材已更新');
      } else {
        await growthContentAssets.create(payload);
        setMessage('素材已新增');
      }
      resetForm();
      await load();
    } catch (saveError) {
      setError((saveError as Error).message || '素材保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    setBusy(true);
    setError('');
    try {
      await growthContentAssets.archive(id);
      setMessage('素材已归档');
      await load();
    } catch (archiveError) {
      setError((archiveError as Error).message || '素材归档失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceSection
      icon={<FileImage size={16} />}
      title="文案素材库"
      aside={
        <button className="btn btn-outline btn-sm" onClick={load} disabled={busy}>
          <RefreshCw size={13} />
          刷新
        </button>
      }
    >
      <div className="grid gap-4">
        <div>
          <p className="t-label">内容工厂素材管理</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            管理文案、公众号审核和发布时使用的封面图、正文配图、产品图、案例图等数字素材。
          </p>
        </div>

        <div className="inset grid gap-3">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
            <label className="grid gap-1.5">
              <span className="t-label">素材名称</span>
              <input
                className="input"
                value={form.title}
                onChange={(event) => patchForm({ title: event.target.value })}
                placeholder="例如 公众号封面图"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="t-label">素材类型</span>
              <input
                className="input"
                list="content-asset-types"
                value={form.assetType}
                onChange={(event) => patchForm({ assetType: event.target.value })}
              />
              <datalist id="content-asset-types">
                {assetTypes.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="grid gap-1.5">
              <span className="t-label">品牌</span>
              <input
                className="input"
                value={form.brandSlug}
                onChange={(event) => patchForm({ brandSlug: event.target.value })}
                placeholder="Rheem / Ruud / Everhot"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="t-label">渠道</span>
              <input
                className="input"
                value={form.channel}
                onChange={(event) => patchForm({ channel: event.target.value })}
                placeholder="公众号 / 小红书 / 官网"
              />
            </label>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5">
            <input
              className="input"
              value={form.usageScene}
              onChange={(event) => patchForm({ usageScene: event.target.value })}
              placeholder="使用场景，例如 文案封面"
            />
            <input
              className="input"
              value={form.tags}
              onChange={(event) => patchForm({ tags: event.target.value })}
              placeholder="标签，用逗号分隔"
            />
            <label className="input flex cursor-pointer items-center gap-2 overflow-hidden">
              <input
                type="file"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                className="hidden"
              />
              <Upload size={14} />
              <span className="truncate">
                {selectedFile?.name ||
                  (form.fileArtifactId ? '已上传文件，可重新选择' : '选择上传文件')}
              </span>
            </label>
          </div>
          <textarea
            className="input"
            rows={2}
            value={form.summary}
            onChange={(event) => patchForm({ summary: event.target.value })}
            placeholder="备注说明"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-brand btn-sm" onClick={save} disabled={busy}>
              {editingId ? <Edit3 size={14} /> : <Plus size={14} />}
              {editingId ? '保存修改' : '新增素材'}
            </button>
            {editingId && (
              <button className="btn btn-outline btn-sm" onClick={resetForm} disabled={busy}>
                取消编辑
              </button>
            )}
            {message && <span className="badge badge-success">{message}</span>}
            {error && <span className="badge badge-warning">{error}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Search size={16} className="text-muted-foreground/70" />
          <input
            className="input w-60"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索素材名称或备注"
          />
          <select
            className="input w-40"
            value={assetType}
            onChange={(event) => setAssetType(event.target.value)}
          >
            <option value="all">全部类型</option>
            {assetTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />
            查看已归档
          </label>
        </div>

        <div className="table-shell">
          <table className="table">
            <thead>
              <tr>
                <th>图片</th>
                <th>素材名称</th>
                <th>类型</th>
                <th>品牌</th>
                <th>渠道</th>
                <th>场景</th>
                <th>格式</th>
                <th>使用</th>
                <th>更新</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {contentAssetPreviewUrl(item) ? (
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        title="点击查看图片"
                        className="grid size-11 cursor-pointer place-items-center overflow-hidden rounded border bg-secondary p-0"
                      >
                        <img
                          src={contentAssetPreviewUrl(item)}
                          alt={item.title}
                          className="block size-full object-cover"
                        />
                      </button>
                    ) : (
                      <div
                        title="暂无图片"
                        className="grid size-11 place-items-center rounded border bg-secondary text-muted-foreground/70"
                      >
                        <FileImage size={18} />
                      </div>
                    )}
                  </td>
                  <td>
                    {contentAssetPreviewUrl(item) ? (
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="cursor-pointer appearance-none border-0 bg-transparent p-0 text-left text-inherit"
                        title="点击查看素材图片"
                      >
                        <strong className="underline underline-offset-3">{item.title}</strong>
                      </button>
                    ) : (
                      <strong>{item.title}</strong>
                    )}
                    {item.summary ? (
                      <div className="text-xs text-muted-foreground/70">{item.summary}</div>
                    ) : null}
                  </td>
                  <td>
                    <span className="badge badge-info">{item.assetType}</span>
                  </td>
                  <td>{item.brandSlug || '-'}</td>
                  <td>{item.channel || '-'}</td>
                  <td>{item.usageScene || '-'}</td>
                  <td>{item.fileFormat || '-'}</td>
                  <td className="tabular-nums">{item.usageCount || 0}</td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td>
                    {item.archivedAt ? (
                      <span className="badge badge-grey">已归档</span>
                    ) : (
                      <span className="badge badge-success">可用</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {contentAssetPreviewUrl(item) && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setPreviewItem(item)}
                          disabled={busy}
                        >
                          <Eye size={13} />
                          预览
                        </button>
                      )}
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => edit(item)}
                        disabled={busy}
                      >
                        <Edit3 size={13} />
                        编辑
                      </button>
                      {!item.archivedAt && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => archive(item.id)}
                          disabled={busy}
                        >
                          <Archive size={13} />
                          归档
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!busy && !items.length ? (
                <tr>
                  <td colSpan={11} className="p-7 text-center text-muted-foreground">
                    <FileImage size={18} className="mr-2 inline align-middle text-primary" />
                    暂无素材
                  </td>
                </tr>
              ) : null}
              {busy ? (
                <tr>
                  <td colSpan={11} className="p-7 text-center">
                    <Loader2 size={18} className="inline animate-spin align-middle text-primary" />
                    <span className="ml-2">加载中</span>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {previewItem ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="素材图片预览"
            onClick={() => setPreviewItem(null)}
            className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/70 p-6"
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="grid max-h-[88vh] w-[min(920px,96vw)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-background shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b px-3.5 py-3">
                <div className="min-w-0">
                  <strong className="block truncate">{previewItem.title}</strong>
                  <span className="text-xs text-muted-foreground">
                    {previewItem.fileFormat || previewItem.assetType || 'image'}
                  </span>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPreviewItem(null)}
                  aria-label="关闭预览"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid max-h-[calc(88vh-58px)] min-h-65 place-items-center overflow-auto bg-secondary p-4">
                <img
                  src={contentAssetPreviewUrl(previewItem)}
                  alt={previewItem.title}
                  className="max-h-[calc(88vh-96px)] max-w-full rounded-md object-contain"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </WorkspaceSection>
  );
}
