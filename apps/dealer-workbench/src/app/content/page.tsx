'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  Filter,
  Link2,
  Loader2,
  PenTool,
  Rocket,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { content, fileArtifacts } from '../../lib/api';
import { useListView, exportCsv } from '../../lib/useListView';
import ListToolbar from '../../components/ListToolbar';

type FactRef = {
  type?: string;
  id?: string;
  label?: string;
  verified?: boolean;
};

type FactSource = {
  type: string;
  id: string;
  label: string;
  description?: string;
  category?: string;
  verified?: boolean;
};

type ContentRow = {
  id: string;
  title: string;
  kind: string;
  channel: string;
  body?: string;
  status: string;
  factRefs?: FactRef[];
  sourceType?: string | null;
  sourceLabel?: string | null;
  reviewNote?: string | null;
  rejectionReason?: string | null;
};

type PublishTask = {
  id: string;
  contentId: string;
  channel: string;
  targetName?: string | null;
  publishMode?: string;
  status: string;
  owner?: string | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  evidenceUrl?: string | null;
  evidenceNote?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  in_review: '审核中',
  approved: '已核准',
  published: '已发布',
  rejected: '待修改',
};

const STATUS_TONE: Record<string, string> = {
  draft: 'neutral',
  in_review: 'info',
  approved: 'success',
  published: 'brand',
  rejected: 'danger',
};

const KIND_OPTIONS = [
  ['article', '文章'],
  ['faq', 'FAQ'],
  ['comparison', '对比'],
  ['topic', '主题'],
  ['social', '社媒'],
  ['landing', '落地页'],
];

const PUBLISH_CHANNEL_OPTIONS = [
  ['official_site', '集团官网 / 官网'],
  ['brand_site', '品牌站'],
  ['wechat', '公众号'],
  ['xiaohongshu', '小红书'],
  ['dealer_pack', '经销商物料包'],
];

const PUBLISH_TASK_LABEL: Record<string, string> = {
  queued: '等待自动发布',
  ready: '待执行',
  manual_required: '待人工发布',
  published: '已发布',
  failed: '发布失败',
  cancelled: '已取消',
};

const REJECTION_REASON_LABEL: Record<string, string> = {
  fact_missing: '事实源不足',
  claim_risk: '表达夸大',
  brand_voice: '品牌口径不一致',
  channel_fit: '渠道不适配',
  typo_format: '格式/错别字',
  other: '其他',
};

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

function refKey(ref: FactRef) {
  return `${ref.type || 'manual'}:${ref.id || ''}`;
}

function verifiedFactCount(row: ContentRow) {
  return (row.factRefs || []).filter((ref) => ref.id && ref.verified).length;
}

function factGatePassed(row: ContentRow) {
  return Boolean((row.factRefs || []).length) && (row.factRefs || []).every((ref) => ref.id && ref.verified);
}

function statusPill(status: string) {
  const tone = STATUS_TONE[status] || 'neutral';
  return <span className={`status-pill status-pill-${tone}`}>{STATUS_LABEL[status] || status}</span>;
}

function sourceLabel(source: FactSource | FactRef) {
  return source.label || source.id || '-';
}

function taskLabel(task?: PublishTask) {
  if (!task) return '';
  return `${PUBLISH_TASK_LABEL[task.status] || task.status} · ${task.targetName || task.channel}`;
}

function rejectionSummary(row: ContentRow) {
  if (!row.reviewNote) return '';
  const reason = REJECTION_REASON_LABEL[row.rejectionReason || ''] || '修改意见';
  return `${reason}：${row.reviewNote}`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

export default function ContentPage() {
  const { toast } = useToast();
  const list = useSWR('content:list', () => content.list());
  const [f, setF] = useState({ title: '', kind: 'article', channel: 'geo', body: '', factRefs: '' });
  const [factTarget, setFactTarget] = useState<ContentRow | null>(null);
  const [factQuery, setFactQuery] = useState('');
  const [selectedRefs, setSelectedRefs] = useState<FactRef[]>([]);
  const [factSaving, setFactSaving] = useState(false);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [publishTarget, setPublishTarget] = useState<ContentRow | null>(null);
  const [publishSaving, setPublishSaving] = useState(false);
  const [publishForm, setPublishForm] = useState({
    channel: 'official_site',
    targetName: '',
    publishMode: 'manual',
    owner: '',
    scheduledAt: '',
  });
  const [evidenceTarget, setEvidenceTarget] = useState<PublishTask | null>(null);
  const [evidenceForm, setEvidenceForm] = useState({ evidenceUrl: '', evidenceNote: '' });
  const [editTarget, setEditTarget] = useState<ContentRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', kind: 'article', channel: '', body: '' });

  const factSources = useSWR(
    factTarget ? ['content:fact-sources', factQuery] : null,
    () => content.factSources({ query: factQuery }),
  );
  const taskList = useSWR('content:publish-tasks', () => content.publishTasks());

  async function create() {
    if (!f.title.trim()) {
      toast('请填写标题', 'error');
      return;
    }
    try {
      const factRefs = f.factRefs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((id) => ({ type: 'manual', id }));
      await content.create({ title: f.title, kind: f.kind, channel: f.channel, body: f.body, factRefs });
      setF({ title: '', kind: 'article', channel: 'geo', body: '', factRefs: '' });
      toast('内容已创建为草稿', 'success');
      list.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function act(fn: () => Promise<any>, label: string) {
    try {
      await fn();
      toast(label, 'success');
      list.mutate();
      taskList.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  function openFactBinder(row: ContentRow) {
    setFactTarget(row);
    setPublishTarget(null);
    setEvidenceTarget(null);
    setEditTarget(null);
    setSelectedRefs(row.factRefs || []);
    setFactQuery('');
  }

  function closeFactBinder() {
    setFactTarget(null);
    setSelectedRefs([]);
  }

  function openPublishTask(row: ContentRow) {
    setPublishTarget(row);
    setFactTarget(null);
    setEvidenceTarget(null);
    setEditTarget(null);
    setPublishForm({
      channel: row.channel && row.channel !== 'geo' ? row.channel : 'official_site',
      targetName: '',
      publishMode: 'manual',
      owner: '',
      scheduledAt: '',
    });
  }

  function closePublishTask() {
    setPublishTarget(null);
  }

  async function createPublishTask() {
    if (!publishTarget) return;
    setPublishSaving(true);
    try {
      await content.createPublishTask(publishTarget.id, {
        channel: publishForm.channel,
        targetName: publishForm.targetName,
        publishMode: publishForm.publishMode,
        owner: publishForm.owner,
        scheduledAt: publishForm.scheduledAt || undefined,
      });
      toast('发布任务已创建，审核通过不等于已发布；请执行渠道发布后回填凭证', 'success');
      closePublishTask();
      taskList.mutate();
      list.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setPublishSaving(false);
    }
  }

  function openEvidence(task: PublishTask) {
    setEvidenceTarget(task);
    setPublishTarget(null);
    setFactTarget(null);
    setEditTarget(null);
    setEvidenceForm({ evidenceUrl: task.evidenceUrl || '', evidenceNote: task.evidenceNote || '' });
  }

  function openEditor(row: ContentRow) {
    setEditTarget(row);
    setFactTarget(null);
    setPublishTarget(null);
    setEvidenceTarget(null);
    setEditForm({ title: row.title || '', kind: row.kind || 'article', channel: row.channel || '', body: row.body || '' });
  }

  function closeEditor() {
    setEditTarget(null);
  }

  async function saveContentEdit() {
    if (!editTarget) return;
    if (!editForm.title.trim()) {
      toast('请填写标题', 'error');
      return;
    }
    setEditSaving(true);
    try {
      await content.update(editTarget.id, {
        title: editForm.title,
        kind: editForm.kind,
        channel: editForm.channel,
        body: editForm.body,
      });
      toast(editTarget.status === 'rejected' ? '修改已保存，内容回到草稿，可重新提交审核' : '内容已保存', 'success');
      closeEditor();
      list.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setEditSaving(false);
    }
  }

  async function completePublishTask() {
    if (!evidenceTarget) return;
    setPublishSaving(true);
    try {
      await content.completePublishTask(evidenceTarget.id, evidenceForm);
      toast('发布凭证已回填，内容进入已发布', 'success');
      setEvidenceTarget(null);
      taskList.mutate();
      list.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setPublishSaving(false);
    }
  }

  function toggleFactSource(source: FactSource) {
    const nextRef = { type: source.type, id: source.id, label: source.label };
    setSelectedRefs((current) => {
      const key = refKey(nextRef);
      if (current.some((ref) => refKey(ref) === key)) return current.filter((ref) => refKey(ref) !== key);
      return [...current, nextRef];
    });
  }

  async function uploadEvidenceFile(file: File | null) {
    if (!file || !factTarget) return;
    setEvidenceUploading(true);
    try {
      const artifact = await fileArtifacts.uploadBase64({
        entityType: 'content_fact_source',
        entityId: factTarget.id,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataBase64: await fileToBase64(file),
      });
      const id = String(artifact?.id || '');
      if (!id) throw new Error('资料上传成功但未返回文件记录');
      const nextRef = { type: 'manual', id, label: String(artifact?.originalName || file.name) };
      setSelectedRefs((current) => current.some((ref) => refKey(ref) === refKey(nextRef)) ? current : [...current, nextRef]);
      toast('资料已上传并加入待绑定列表', 'success');
      factSources.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setEvidenceUploading(false);
    }
  }

  async function saveFactRefs() {
    if (!factTarget) return;
    setFactSaving(true);
    try {
      const result = await content.bindFactRefs(
        factTarget.id,
        selectedRefs.map((ref) => ({ type: ref.type || 'manual', id: ref.id, label: ref.label })),
      );
      toast(result?.gate?.passed ? '事实源已绑定并通过校验' : '事实源已绑定，仍有待校验项', result?.gate?.passed ? 'success' : 'info');
      closeFactBinder();
      list.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setFactSaving(false);
    }
  }

  const rows: ContentRow[] = list.data?.contents || [];
  const publishTasks: PublishTask[] = Array.isArray(taskList.data?.tasks) ? taskList.data.tasks : [];
  const tasksByContent = useMemo(() => {
    const grouped = new Map<string, PublishTask[]>();
    for (const task of publishTasks) {
      const current = grouped.get(task.contentId) || [];
      current.push(task);
      grouped.set(task.contentId, current);
    }
    return grouped;
  }, [publishTasks]);
  const cv = useListView(rows, {
    searchFields: ['title', 'kind', 'channel'],
    filters: [
      { key: 'status', label: '状态', options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) },
      { key: 'kind', label: '类型', options: KIND_OPTIONS.map(([value, label]) => ({ value, label })) },
    ],
  });

  const stats = useMemo(() => {
    const draft = rows.filter((item) => item.status === 'draft').length;
    const review = rows.filter((item) => item.status === 'in_review').length;
    const approved = rows.filter((item) => item.status === 'approved').length;
    const rejected = rows.filter((item) => item.status === 'rejected').length;
    const published = rows.filter((item) => item.status === 'published').length;
    const blocked = rows.filter((item) => item.status !== 'published' && !factGatePassed(item)).length;
    const publishTasksOpen = publishTasks.filter((task) => task.status !== 'published' && task.status !== 'cancelled').length;
    return { draft, review, approved, rejected, published, blocked, publishTasksOpen };
  }, [rows, publishTasks]);

  const pipelineStages = [
    { key: 'draft', label: 'Brief / 草稿', value: stats.draft, hint: '等待补全内容与事实源', icon: ClipboardList, status: 'draft', tone: 'neutral' },
    { key: 'facts', label: '事实核验', value: stats.blocked, hint: '未校验不得发布', icon: ShieldCheck, status: '', tone: 'warning' },
    { key: 'review', label: '审核中', value: stats.review, hint: '等待核准或驳回', icon: CheckCircle2, status: 'in_review', tone: 'info' },
    { key: 'rework', label: '待修改', value: stats.rejected, hint: '按驳回意见修改后重提', icon: PenTool, status: 'rejected', tone: 'warning' },
    { key: 'publish', label: '发布任务', value: stats.publishTasksOpen, hint: '渠道执行或人工回填凭证', icon: Rocket, status: '', tone: 'success' },
  ];

  const sourceItems: FactSource[] = Array.isArray(factSources.data?.items) ? factSources.data.items : [];

  return (
    <div className="page-container content-factory-page">
      <PageHeader
        title="内容工厂"
        subtitle="Brief → 草稿 → 事实核验 → 审核 → 发布 → 复盘 · 无事实源引用不得对外发布"
      />

      <section className="card-elevated content-factory-workbench">
        <div className="content-factory-hero">
          <div>
            <p className="t-label">生产总控</p>
            <h2 className="t-headline" style={{ marginTop: 4 }}>内容流水线</h2>
            <p>把内容从 brief 推到发布，并把事实源门禁放在发布前，而不是发布后补救。</p>
          </div>
          <div className="content-factory-metrics" aria-label="内容工厂关键指标">
            <span><strong>{rows.length}</strong> 总内容</span>
            <span><strong>{stats.blocked}</strong> 缺事实源/未校验</span>
            <span><strong>{stats.approved}</strong> 待发布</span>
          </div>
        </div>

        <div className="content-factory-pipeline" aria-label="内容生产流水线">
          {pipelineStages.map((stage) => {
            const Icon = stage.icon;
            return (
              <button
                key={stage.key}
                type="button"
                className={`content-factory-stage content-factory-stage--${stage.tone}`}
                onClick={() => {
                  if (stage.status) cv.setFilter('status', stage.status);
                }}
              >
                <span className="content-factory-stage__icon"><Icon size={16} /></span>
                <span className="content-factory-stage__body">
                  <strong>{stage.label}</strong>
                  <span>{stage.hint}</span>
                </span>
                <span className="content-factory-stage__value">{stage.value}</span>
              </button>
            );
          })}
        </div>

        <div className="content-factory-layout">
          <div className="content-factory-main">
            <div className="content-factory-sectionhead">
              <div>
                <p className="t-label"><Filter size={13} />任务池</p>
                <h3>需要处理的内容</h3>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => exportCsv(cv.filtered, [
                  { key: 'title', label: '标题' },
                  { key: 'kind', label: '类型' },
                  { key: 'channel', label: '渠道' },
                  { key: 'status', label: '状态' },
                ], 'content')}
              >
                导出
              </button>
            </div>

            <ListToolbar
              q={cv.q}
              onSearch={cv.onSearch}
              searchPlaceholder="搜索标题 / 类型 / 渠道"
              filters={[
                { key: 'status', label: '状态', options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) },
                { key: 'kind', label: '类型', options: KIND_OPTIONS.map(([value, label]) => ({ value, label })) },
              ]}
              filterVals={cv.filterVals}
              onFilter={cv.setFilter}
              total={cv.total}
              page={cv.page}
              pageCount={cv.pageCount}
              onPage={cv.setPage}
              onExport={() => exportCsv(cv.filtered, [
                { key: 'title', label: '标题' },
                { key: 'kind', label: '类型' },
                { key: 'channel', label: '渠道' },
                { key: 'status', label: '状态' },
              ], 'content')}
            />

            <AsyncBoundary
              status={statusOf(list.isLoading, list.error, rows.length === 0)}
              errorMessage="内容加载失败，需要 API 与数据库可用"
              onRetry={() => list.mutate()}
              emptyTitle="暂无内容"
              emptyDescription="从右侧新建 brief，或从文案 Copilot 送入草稿。"
            >
              <div className="content-factory-list">
                {cv.pageRows.map((c: ContentRow) => {
                  const verifiedFacts = verifiedFactCount(c);
                  const gatePassed = factGatePassed(c);
                  const canPublish = c.status === 'approved' && gatePassed;
                  const rowTasks = tasksByContent.get(c.id) || [];
                  const openTask = rowTasks.find((task) => task.status !== 'published' && task.status !== 'cancelled');
                  const latestTask = rowTasks[0];
                  return (
                    <article key={c.id} className="content-factory-item">
                      <div className="content-factory-item__body">
                        <div className="content-factory-item__title">
                          <FileText size={16} />
                          <strong>{c.title}</strong>
                        </div>
                        <div className="content-factory-item__meta">
                          <span>{KIND_OPTIONS.find(([value]) => value === c.kind)?.[1] || c.kind}</span>
                          <span>{c.channel}</span>
                          <span className={gatePassed ? 'is-ok' : 'is-blocked'}>
                            {gatePassed ? `${verifiedFacts} 个已校验事实源` : '缺事实源/未校验'}
                          </span>
                          {latestTask ? (
                            <span className={latestTask.status === 'published' ? 'is-ok' : 'is-blocked'}>{taskLabel(latestTask)}</span>
                          ) : null}
                          {c.sourceLabel || c.sourceType ? <span>{c.sourceLabel || c.sourceType}</span> : null}
                        </div>
                        {c.status === 'rejected' && rejectionSummary(c) ? (
                          <div className="content-factory-item__note">{rejectionSummary(c)}</div>
                        ) : null}
                      </div>
                      <div className="content-factory-item__actions">
                        {statusPill(c.status)}
                        <button className="btn btn-outline btn-sm" onClick={() => openEditor(c)}>
                          <PenTool size={13} />{c.status === 'rejected' ? '修改内容' : '编辑'}
                        </button>
                        <button className={gatePassed ? 'btn btn-outline btn-sm' : 'btn btn-warning btn-sm'} onClick={() => openFactBinder(c)}>
                          <Link2 size={13} />{gatePassed ? '事实源' : '补事实源'}
                        </button>
                        {c.status === 'draft' || c.status === 'rejected' ? (
                          <button className="btn btn-outline btn-sm" onClick={() => act(() => content.submit(c.id), '已送审')}>
                            {c.status === 'rejected' ? '重新提交审核' : '提交审核'}
                          </button>
                        ) : null}
                        {c.status === 'in_review' ? (
                          <span className="status-pill status-pill-info">在内容审核中处理</span>
                        ) : null}
                        {c.status === 'approved' ? (
                          openTask ? (
                            <button className="btn btn-outline btn-sm" onClick={() => openEvidence(openTask)}>
                              回填发布凭证
                            </button>
                          ) : (
                            <button
                              className="btn btn-brand btn-sm"
                              disabled={!canPublish}
                              title={canPublish ? undefined : '创建发布任务前必须绑定并校验事实源'}
                              onClick={() => openPublishTask(c)}
                            >
                              创建发布任务
                            </button>
                          )
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </AsyncBoundary>
          </div>

          <aside className="content-factory-aside">
            {editTarget ? (
              <div className="content-factory-create content-factory-facts">
                <div className="content-factory-sectionhead">
                  <div>
                    <p className="t-label"><PenTool size={13} />修改内容</p>
                    <h3>{editTarget.title}</h3>
                  </div>
                  <button className="btn btn-ghost btn-sm icon-only" onClick={closeEditor} aria-label="关闭内容编辑">
                    <X size={16} />
                  </button>
                </div>
                {editTarget.status === 'rejected' && rejectionSummary(editTarget) ? (
                  <div className="content-factory-review-note">
                    <strong>驳回意见</strong>
                    <p>{rejectionSummary(editTarget)}</p>
                  </div>
                ) : null}
                <input className="input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="标题" />
                <div className="content-factory-formgrid">
                  <select className="input" value={editForm.kind} onChange={(e) => setEditForm({ ...editForm, kind: e.target.value })}>
                    {KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input className="input" value={editForm.channel} onChange={(e) => setEditForm({ ...editForm, channel: e.target.value })} placeholder="渠道" />
                </div>
                <textarea className="textarea" value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} placeholder="正文 / brief" />
                <button className="btn btn-brand" onClick={saveContentEdit} disabled={editSaving}>
                  {editSaving ? <Loader2 size={14} className="animate-spin" /> : <PenTool size={14} />}
                  保存修改
                </button>
              </div>
            ) : publishTarget ? (
              <div className="content-factory-create content-factory-facts">
                <div className="content-factory-sectionhead">
                  <div>
                    <p className="t-label"><Rocket size={13} />创建发布任务</p>
                    <h3>{publishTarget.title}</h3>
                  </div>
                  <button className="btn btn-ghost btn-sm icon-only" onClick={closePublishTask} aria-label="关闭发布任务">
                    <X size={16} />
                  </button>
                </div>

                <select
                  className="input"
                  value={publishForm.channel}
                  onChange={(e) => setPublishForm({ ...publishForm, channel: e.target.value })}
                >
                  {PUBLISH_CHANNEL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input
                  className="input"
                  value={publishForm.targetName}
                  onChange={(e) => setPublishForm({ ...publishForm, targetName: e.target.value })}
                  placeholder="发布位置 / 账号名称，例如 Rheem 官网新闻、官方公众号"
                />
                <div className="content-factory-formgrid">
                  <select
                    className="input"
                    value={publishForm.publishMode}
                    onChange={(e) => setPublishForm({ ...publishForm, publishMode: e.target.value })}
                  >
                    <option value="manual">人工发布</option>
                    <option value="auto">系统自动发布</option>
                  </select>
                  <input
                    className="input"
                    value={publishForm.owner}
                    onChange={(e) => setPublishForm({ ...publishForm, owner: e.target.value })}
                    placeholder="负责人"
                  />
                </div>
                <input
                  className="input"
                  type="datetime-local"
                  value={publishForm.scheduledAt}
                  onChange={(e) => setPublishForm({ ...publishForm, scheduledAt: e.target.value })}
                />
                <button className="btn btn-brand" onClick={createPublishTask} disabled={publishSaving}>
                  {publishSaving ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                  创建发布任务
                </button>
              </div>
            ) : evidenceTarget ? (
              <div className="content-factory-create content-factory-facts">
                <div className="content-factory-sectionhead">
                  <div>
                    <p className="t-label"><CheckCircle2 size={13} />回填发布凭证</p>
                    <h3>{evidenceTarget.targetName || evidenceTarget.channel}</h3>
                  </div>
                  <button className="btn btn-ghost btn-sm icon-only" onClick={() => setEvidenceTarget(null)} aria-label="关闭发布凭证">
                    <X size={16} />
                  </button>
                </div>
                <input
                  className="input"
                  value={evidenceForm.evidenceUrl}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, evidenceUrl: e.target.value })}
                  placeholder="发布链接"
                />
                <textarea
                  className="textarea"
                  value={evidenceForm.evidenceNote}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm, evidenceNote: e.target.value })}
                  placeholder="发布凭证说明，例如已发布到公众号草稿箱并推送"
                />
                <button className="btn btn-brand" onClick={completePublishTask} disabled={publishSaving || (!evidenceForm.evidenceUrl.trim() && !evidenceForm.evidenceNote.trim())}>
                  {publishSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  确认已发布
                </button>
              </div>
            ) : factTarget ? (
              <div className="content-factory-create content-factory-facts">
                <div className="content-factory-sectionhead">
                  <div>
                    <p className="t-label"><ShieldCheck size={13} />事实源绑定</p>
                    <h3>{factTarget.title}</h3>
                  </div>
                  <button className="btn btn-ghost btn-sm icon-only" onClick={closeFactBinder} aria-label="关闭事实源绑定">
                    <X size={16} />
                  </button>
                </div>

                <input className="input" value={factQuery} onChange={(e) => setFactQuery(e.target.value)} placeholder="搜索产品、SKU、卖点或证据" />

                <div className="content-factory-fact-list" aria-label="可选事实源">
                  {factSources.isLoading ? (
                    <div className="content-factory-fact-empty"><Loader2 size={16} className="animate-spin" />加载事实源</div>
                  ) : sourceItems.length ? sourceItems.map((source) => {
                    const checked = selectedRefs.some((ref) => refKey(ref) === refKey(source));
                    return (
                      <button
                        key={refKey(source)}
                        type="button"
                        className={`content-factory-fact-option ${checked ? 'is-selected' : ''}`}
                        onClick={() => toggleFactSource(source)}
                        title={source.verified ? undefined : '可先绑定，但发布前仍需通过后端事实校验'}
                      >
                        <span>
                          <strong>{source.label}</strong>
                          <small>{source.category || source.type}{source.description ? ` · ${source.description}` : ''}</small>
                        </span>
                        <span className={source.verified ? 'status-pill status-pill-success' : 'status-pill status-pill-warning'}>
                          {source.verified ? '已校验' : '待校验'}
                        </span>
                      </button>
                    );
                  }) : (
                    <div className="content-factory-fact-empty">暂无匹配事实源。可以换关键词搜索，或直接上传一份资料作为凭证。</div>
                  )}
                </div>

                <div className="content-factory-upload-ref">
                  <label className="btn btn-outline btn-sm" htmlFor="content-factory-evidence-upload">
                    {evidenceUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                    {evidenceUploading ? '上传中' : '上传资料凭证'}
                  </label>
                  <input
                    id="content-factory-evidence-upload"
                    type="file"
                    disabled={evidenceUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      event.currentTarget.value = '';
                      uploadEvidenceFile(file);
                    }}
                  />
                  <span>支持产品手册、认证文件、参数表、活动说明等资料。上传后系统自动保存为事实源。</span>
                </div>

                <div className="content-factory-selected-refs">
                  {selectedRefs.map((ref) => (
                    <button key={refKey(ref)} type="button" onClick={() => setSelectedRefs((current) => current.filter((item) => refKey(item) !== refKey(ref)))}>
                      {sourceLabel(ref)} <X size={12} />
                    </button>
                  ))}
                  {!selectedRefs.length ? <span>尚未选择事实源</span> : null}
                </div>

                <button className="btn btn-brand" onClick={saveFactRefs} disabled={factSaving || !selectedRefs.length}>
                  {factSaving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  保存并校验事实源
                </button>
              </div>
            ) : (
              <div className="content-factory-create">
                <div className="content-factory-sectionhead">
                  <div>
                    <p className="t-label"><PenTool size={13} />新建 Brief</p>
                    <h3>进入内容流水线</h3>
                  </div>
                </div>
                <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="标题" />
                <div className="content-factory-formgrid">
                  <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                    {KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} placeholder="渠道" />
                </div>
                <textarea className="textarea" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="正文 / brief" />
                <button className="btn btn-brand" onClick={create}>新建草稿</button>
              </div>
            )}

            <div className="content-factory-gate">
              <span><Rocket size={15} />发布任务</span>
              <strong>{publishTasks.length ? `${publishTasks.length} 个任务` : '暂无发布任务'}</strong>
              <div className="content-factory-selected-refs">
                {publishTasks.slice(0, 5).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => task.status === 'published' ? undefined : openEvidence(task)}
                    title={task.status === 'published' ? '已回填发布凭证' : '发布完成后回填凭证'}
                  >
                    {taskLabel(task)}
                  </button>
                ))}
                {!publishTasks.length ? <span>核准内容创建发布任务后会出现在这里。</span> : null}
              </div>
            </div>

            <div className="content-factory-gate">
              <span><AlertCircle size={15} />发布门禁</span>
              <strong>无已校验事实源不得对外发布</strong>
              <p>内容必须先选择产品事实、卖点证据或资料凭证，并由后端校验写入后，才能创建发布任务；发布完成并回填凭证后才算已发布。</p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
