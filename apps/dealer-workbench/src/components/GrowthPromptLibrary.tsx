'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Edit3,
  Library,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { growthCopy } from '../lib/api';

type EvidenceState = 'unverified' | 'promising' | 'proven' | 'negative' | 'inconclusive';

type PromptTemplate = {
  id: string;
  name: string;
  promptBody: string;
  brandSlug: string | null;
  category: string | null;
  channel: string | null;
  status: 'active' | 'archived';
  usageCount: number;
  verifiedCount: number;
  positiveCount: number;
  negativeCount: number;
  averageLift: number | string;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidenceState: EvidenceState;
};

type PromptForm = {
  name: string;
  promptBody: string;
  brandSlug: string;
  category: string;
  channel: string;
};

const EMPTY_FORM: PromptForm = {
  name: '',
  promptBody: '',
  brandSlug: '',
  category: '',
  channel: '',
};

const BRANDS = [
  { value: 'rheem', label: 'Rheem' },
  { value: 'ruud', label: 'Ruud' },
  { value: 'everhot', label: 'Everhot' },
];

const CHANNELS = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'douyin', label: '抖音' },
  { value: 'zhihu', label: '知乎' },
  { value: 'wechat', label: '微信公众号' },
  { value: 'seo', label: 'SEO' },
  { value: 'ad', label: '广告投放' },
  { value: 'geo-faq', label: 'GEO FAQ' },
  { value: 'geo-comparison', label: 'GEO 对比内容' },
  { value: 'geo-topic', label: 'GEO 专题内容' },
];

const EVIDENCE: Record<EvidenceState, { label: string; className: string }> = {
  unverified: { label: '待验证', className: 'badge badge-grey' },
  promising: { label: '初步有效', className: 'badge badge-info' },
  proven: { label: '已验证', className: 'badge badge-success' },
  negative: { label: '负向', className: 'badge badge-danger' },
  inconclusive: { label: '无明显变化', className: 'badge badge-warning' },
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function channelLabel(value?: string | null) {
  return CHANNELS.find((item) => item.value === value)?.label || value || '全部渠道';
}

function brandLabel(value?: string | null) {
  return BRANDS.find((item) => item.value === value)?.label || value || '全部品牌';
}

function toForm(item: PromptTemplate): PromptForm {
  return {
    name: item.name || '',
    promptBody: item.promptBody || '',
    brandSlug: item.brandSlug || '',
    category: item.category || '',
    channel: item.channel || '',
  };
}

export default function GrowthPromptLibrary() {
  const [items, setItems] = useState<PromptTemplate[]>([]);
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [keyword, setKeyword] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | EvidenceState>('all');
  const [form, setForm] = useState<PromptForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query: Record<string, string> = { status };
      if (brandFilter !== 'all') query.brandSlug = brandFilter;
      if (channelFilter !== 'all') query.channel = channelFilter;
      const result = await growthCopy.promptTemplates(query);
      setItems(Array.isArray(result?.items) ? result.items : []);
    } catch (loadError) {
      setError((loadError as Error).message || '提示词加载失败');
    } finally {
      setLoading(false);
    }
  }, [brandFilter, channelFilter, status]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleItems = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return items.filter((item) => {
      if (evidenceFilter !== 'all' && item.evidenceState !== evidenceFilter) return false;
      if (!needle) return true;
      return [item.name, item.promptBody, item.brandSlug, item.category, item.channel].some(
        (value) =>
          String(value || '')
            .toLowerCase()
            .includes(needle)
      );
    });
  }, [evidenceFilter, items, keyword]);

  const summary = useMemo(
    () =>
      items.reduce(
        (result, item) => ({
          usage: result.usage + Number(item.usageCount || 0),
          verified: result.verified + Number(item.verifiedCount || 0),
          positive: result.positive + Number(item.positiveCount || 0),
        }),
        { usage: 0, verified: 0, positive: 0 }
      ),
    [items]
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
    setError('');
    setMessage('');
  }

  function openEdit(item: PromptTemplate) {
    setEditing(item);
    setForm(toForm(item));
    setEditorOpen(true);
    setError('');
    setMessage('');
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function patchForm(patch: Partial<PromptForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function save() {
    if (!form.name.trim() || !form.promptBody.trim()) {
      setError('请填写提示词名称和正文');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        promptBody: form.promptBody.trim(),
        brandSlug: form.brandSlug || null,
        category: form.category.trim() || null,
        channel: form.channel || null,
      };
      if (editing) {
        await growthCopy.updatePromptTemplate(editing.id, payload);
        setMessage('提示词已更新，历史使用和 GEO 反馈保持关联');
      } else {
        await growthCopy.createPromptTemplate(payload);
        setMessage('提示词已创建，等待真实使用与 GEO 验证');
      }
      closeEditor();
      await load();
    } catch (saveError) {
      setError((saveError as Error).message || '提示词保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function changeArchiveState(item: PromptTemplate) {
    setActionId(item.id);
    setError('');
    try {
      if (item.status === 'archived') {
        await growthCopy.restorePromptTemplate(item.id);
        setMessage('提示词已恢复，原有使用记录和 GEO 反馈未改变');
      } else {
        await growthCopy.archivePromptTemplate(item.id);
        setMessage('提示词已归档');
      }
      if (editing?.id === item.id) closeEditor();
      await load();
    } catch (actionError) {
      setError((actionError as Error).message || '状态更新失败');
    } finally {
      setActionId('');
    }
  }

  const bodyLocked = Boolean(editing && (editing.usageCount > 0 || editing.verifiedCount > 0));

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      {message && (
        <div className="inset" role="status" style={{ color: 'var(--success)' }}>
          {message}
        </div>
      )}
      {error && (
        <div className="error-state" role="alert" style={{ justifyItems: 'start', padding: 14 }}>
          {error}
        </div>
      )}

      {editorOpen && (
        <div className="card-flat" style={{ display: 'grid', gap: 14 }}>
          <div className="workbench-section-header" style={{ marginBottom: 0 }}>
            <div>
              <p className="workbench-section-header__eyebrow">
                {editing ? '编辑模板' : '新建模板'}
              </p>
              <h2 className="workbench-section-header__title" style={{ fontSize: 17 }}>
                {editing ? editing.name : '创建提示词'}
              </h2>
            </div>
            <button
              className="btn btn-ghost btn-sm icon-only"
              onClick={closeEditor}
              aria-label="关闭编辑器"
              title="关闭"
            >
              <X size={17} />
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">名称</span>
              <input
                className="input"
                value={form.name}
                onChange={(event) => patchForm({ name: event.target.value })}
                maxLength={120}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">品牌</span>
              <select
                className="input"
                value={form.brandSlug}
                onChange={(event) => patchForm({ brandSlug: event.target.value })}
              >
                <option value="">全部品牌</option>
                {BRANDS.map((brand) => (
                  <option key={brand.value} value={brand.value}>
                    {brand.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">渠道</span>
              <select
                className="input"
                value={form.channel}
                onChange={(event) => patchForm({ channel: event.target.value })}
              >
                <option value="">全部渠道</option>
                {CHANNELS.map((channel) => (
                  <option key={channel.value} value={channel.value}>
                    {channel.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="t-label">品类</span>
              <input
                className="input"
                value={form.category}
                onChange={(event) => patchForm({ category: event.target.value })}
                placeholder="例如：空气源热泵"
              />
            </label>
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="t-label">提示词正文</span>
            <textarea
              className="textarea"
              rows={7}
              value={form.promptBody}
              onChange={(event) => patchForm({ promptBody: event.target.value })}
              disabled={bodyLocked}
            />
          </label>
          {bodyLocked && (
            <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>
              该版本已有使用或验证记录，正文已锁定；名称、品牌、渠道和品类仍可维护。
            </span>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={closeEditor}>
              取消
            </button>
            <button className="btn btn-brand btn-sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? '保存中' : '保存'}
            </button>
          </div>
        </div>
      )}

      <div className="toolbar">
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 180 }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: 11, top: 10, color: 'var(--t-tertiary)' }}
          />
          <input
            className="input"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索名称、正文或品类"
            style={{ paddingLeft: 34 }}
          />
        </div>
        <select
          className="input"
          value={brandFilter}
          onChange={(event) => setBrandFilter(event.target.value)}
          aria-label="品牌筛选"
          style={{ width: 140 }}
        >
          <option value="all">全部品牌</option>
          {BRANDS.map((brand) => (
            <option key={brand.value} value={brand.value}>
              {brand.label}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={channelFilter}
          onChange={(event) => setChannelFilter(event.target.value)}
          aria-label="渠道筛选"
          style={{ width: 160 }}
        >
          <option value="all">全部渠道</option>
          {CHANNELS.map((channel) => (
            <option key={channel.value} value={channel.value}>
              {channel.label}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={evidenceFilter}
          onChange={(event) => setEvidenceFilter(event.target.value as 'all' | EvidenceState)}
          aria-label="验证状态筛选"
          style={{ width: 140 }}
        >
          <option value="all">全部验证状态</option>
          {Object.entries(EVIDENCE).map(([value, config]) => (
            <option key={value} value={value}>
              {config.label}
            </option>
          ))}
        </select>
        <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
          <div
            style={{
              display: 'inline-flex',
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--r-lg)',
              overflow: 'hidden',
            }}
          >
            <button
              className={`btn btn-sm ${status === 'active' ? 'btn-brand' : 'btn-ghost'}`}
              onClick={() => setStatus('active')}
              style={{ borderRadius: 0, border: 0 }}
            >
              使用中
            </button>
            <button
              className={`btn btn-sm ${status === 'archived' ? 'btn-brand' : 'btn-ghost'}`}
              onClick={() => setStatus('archived')}
              style={{ borderRadius: 0, border: 0 }}
            >
              已归档
            </button>
          </div>
          <button
            className="btn btn-ghost btn-sm icon-only"
            onClick={load}
            disabled={loading}
            aria-label="刷新提示词"
            title="刷新"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-brand btn-sm" onClick={openCreate}>
            <Plus size={15} />
            新建提示词
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          color: 'var(--t-secondary)',
          fontSize: 12,
        }}
      >
        <span>
          <strong style={{ color: 'var(--t-primary)' }}>{visibleItems.length}</strong> 条模板
        </span>
        <span>
          累计复用 <strong style={{ color: 'var(--t-primary)' }}>{summary.usage}</strong> 次
        </span>
        <span>
          完成验证 <strong style={{ color: 'var(--t-primary)' }}>{summary.verified}</strong> 次
        </span>
        <span>
          正向反馈 <strong style={{ color: 'var(--success)' }}>{summary.positive}</strong> 次
        </span>
      </div>

      {loading && !items.length ? (
        <div className="loading-state">
          <Loader2 size={22} className="animate-spin" />
          <span className="loading-state-text">正在加载提示词</span>
        </div>
      ) : visibleItems.length ? (
        <div className="workbench-table-shell">
          <table className="table" style={{ minWidth: 1050 }}>
            <thead>
              <tr>
                <th>提示词</th>
                <th>适用范围</th>
                <th>效果证据</th>
                <th>复用</th>
                <th>GEO 反馈</th>
                <th>最近使用</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const evidence = EVIDENCE[item.evidenceState] || EVIDENCE.unverified;
                const lift = Number(item.averageLift || 0);
                return (
                  <tr key={item.id}>
                    <td style={{ maxWidth: 360 }}>
                      <div style={{ display: 'grid', gap: 5 }}>
                        <strong style={{ color: 'var(--t-primary)' }}>{item.name}</strong>
                        <span
                          title={item.promptBody}
                          style={{ color: 'var(--t-secondary)', lineHeight: 1.45 }}
                        >
                          {item.promptBody.length > 110
                            ? `${item.promptBody.slice(0, 110)}...`
                            : item.promptBody}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <span className="pill-neutral">{brandLabel(item.brandSlug)}</span>
                        <span className="pill-neutral">{channelLabel(item.channel)}</span>
                        {item.category && <span className="pill-neutral">{item.category}</span>}
                      </div>
                    </td>
                    <td>
                      <span className={evidence.className}>{evidence.label}</span>
                    </td>
                    <td>
                      <strong>{item.usageCount}</strong> 次
                    </td>
                    <td>
                      <div style={{ display: 'grid', gap: 3, whiteSpace: 'nowrap' }}>
                        <strong
                          style={{
                            color:
                              lift > 0
                                ? 'var(--success)'
                                : lift < 0
                                  ? 'var(--danger)'
                                  : 'var(--t-primary)',
                          }}
                        >
                          {lift > 0 ? '+' : ''}
                          {lift.toFixed(1)}pp
                        </strong>
                        <span style={{ color: 'var(--t-tertiary)', fontSize: 11 }}>
                          {item.verifiedCount} 次验证 · {item.positiveCount} 正向 ·{' '}
                          {item.negativeCount} 负向
                        </span>
                      </div>
                    </td>
                    <td>{formatDate(item.lastUsedAt || item.updatedAt)}</td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        {item.status === 'active' && (
                          <Link
                            className="btn btn-outline btn-sm"
                            href={`/growth/copywriter?promptTemplateId=${encodeURIComponent(item.id)}`}
                          >
                            <Sparkles size={14} />
                            用于生成文案
                          </Link>
                        )}
                        <button
                          className="btn btn-ghost btn-sm icon-only"
                          onClick={() => openEdit(item)}
                          title="编辑"
                          aria-label={`编辑提示词 ${item.name}`}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm icon-only"
                          onClick={() => changeArchiveState(item)}
                          disabled={actionId === item.id}
                          title={item.status === 'archived' ? '恢复' : '归档'}
                          aria-label={`${item.status === 'archived' ? '恢复' : '归档'}提示词 ${item.name}`}
                        >
                          {actionId === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : item.status === 'archived' ? (
                            <ArchiveRestore size={14} />
                          ) : (
                            <Archive size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <Library size={24} />
          <strong className="empty-state-title">没有匹配的提示词</strong>
          <span className="empty-state-text">调整筛选条件，或新建一个提示词模板。</span>
        </div>
      )}
    </section>
  );
}
