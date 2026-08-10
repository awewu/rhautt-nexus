'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Edit3, FileImage, Loader2, Plus, RefreshCw, Search, Upload } from 'lucide-react';
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

function toPayload(form: typeof EMPTY_FORM) {
  return {
    ...form,
    tags: form.tags.split(',').map((item) => item.trim()).filter(Boolean),
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const next: Record<string, string> = { pageSize: '100', sortBy: 'updatedAt', sortOrder: 'DESC' };
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

  useEffect(() => { load(); }, [load]);

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
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <p className="t-label">内容工厂素材管理</p>
          <h2 className="t-headline" style={{ marginTop: 4 }}>文案素材库</h2>
          <p style={{ marginTop: 4, color: 'var(--t-secondary)', fontSize: 13 }}>
            管理文案、公众号审核和发布时使用的封面图、正文配图、产品图、案例图等数字素材。
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={busy}><RefreshCw size={13} />刷新</button>
      </div>

      <div className="inset" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}><span className="t-label">素材名称</span><input className="input" value={form.title} onChange={(event) => patchForm({ title: event.target.value })} placeholder="例如 公众号封面图" /></label>
          <label style={{ display: 'grid', gap: 6 }}><span className="t-label">素材类型</span><input className="input" list="content-asset-types" value={form.assetType} onChange={(event) => patchForm({ assetType: event.target.value })} /><datalist id="content-asset-types">{assetTypes.map((item) => <option key={item} value={item} />)}</datalist></label>
          <label style={{ display: 'grid', gap: 6 }}><span className="t-label">品牌</span><input className="input" value={form.brandSlug} onChange={(event) => patchForm({ brandSlug: event.target.value })} placeholder="Rheem / Ruud / Everhot" /></label>
          <label style={{ display: 'grid', gap: 6 }}><span className="t-label">渠道</span><input className="input" value={form.channel} onChange={(event) => patchForm({ channel: event.target.value })} placeholder="公众号 / 小红书 / 官网" /></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <input className="input" value={form.usageScene} onChange={(event) => patchForm({ usageScene: event.target.value })} placeholder="使用场景，例如 文案封面" />
          <input className="input" value={form.tags} onChange={(event) => patchForm({ tags: event.target.value })} placeholder="标签，用逗号分隔" />
          <label className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', overflow: 'hidden' }}>
            <input type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} style={{ display: 'none' }} />
            <Upload size={14} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile?.name || (form.fileArtifactId ? '已上传文件，可重新选择' : '选择上传文件')}</span>
          </label>
        </div>
        <textarea className="input" rows={2} value={form.summary} onChange={(event) => patchForm({ summary: event.target.value })} placeholder="备注说明" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-brand btn-sm" onClick={save} disabled={busy}>{editingId ? <Edit3 size={14} /> : <Plus size={14} />}{editingId ? '保存修改' : '新增素材'}</button>
          {editingId && <button className="btn btn-outline btn-sm" onClick={resetForm} disabled={busy}>取消编辑</button>}
          {message && <span className="badge badge-success">{message}</span>}
          {error && <span className="badge badge-warning">{error}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Search size={16} style={{ color: 'var(--t-tertiary)' }} />
        <input className="input" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索素材名称或备注" style={{ width: 240 }} />
        <select className="input" value={assetType} onChange={(event) => setAssetType(event.target.value)} style={{ width: 160 }}>
          <option value="all">全部类型</option>
          {assetTypes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--t-secondary)' }}>
          <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
          查看已归档
        </label>
      </div>

      <div className="table-shell">
        <table className="table">
          <thead><tr><th>素材名称</th><th>类型</th><th>品牌</th><th>渠道</th><th>场景</th><th>格式</th><th>使用</th><th>更新</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.title}</strong>{item.summary ? <div style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>{item.summary}</div> : null}</td>
                <td><span className="badge badge-info">{item.assetType}</span></td>
                <td>{item.brandSlug || '-'}</td>
                <td>{item.channel || '-'}</td>
                <td>{item.usageScene || '-'}</td>
                <td>{item.fileFormat || '-'}</td>
                <td>{item.usageCount || 0}</td>
                <td>{formatDate(item.updatedAt)}</td>
                <td>{item.archivedAt ? <span className="badge badge-grey">已归档</span> : <span className="badge badge-success">可用</span>}</td>
                <td><div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => edit(item)} disabled={busy}><Edit3 size={13} />编辑</button>
                  {!item.archivedAt && <button className="btn btn-outline btn-sm" onClick={() => archive(item.id)} disabled={busy}><Archive size={13} />归档</button>}
                </div></td>
              </tr>
            ))}
            {!busy && !items.length ? <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--t-secondary)', padding: 28 }}><FileImage size={18} style={{ color: 'var(--brand)', verticalAlign: 'middle', marginRight: 8 }} />暂无素材</td></tr> : null}
            {busy ? <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28 }}><Loader2 size={18} className="animate-spin" style={{ color: 'var(--brand)', verticalAlign: 'middle' }} /><span style={{ marginLeft: 8 }}>加载中</span></td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
