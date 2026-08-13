'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Flag,
  Filter,
  Link2,
  Loader2,
  PenTool,
  Rocket,
  ShieldCheck,
  Target,
  UploadCloud,
  UserRound,
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
  author?: string | null;
  reviewer?: string | null;
  updatedAt?: string | null;
  source?: {
    type?: string | null;
    label?: string | null;
    sourceRef?: string | null;
  };
  factGate?: {
    status?: string;
    reason?: string;
    verifiedCount?: number;
    totalCount?: number;
  };
  latestPublishTask?: PublishTask | null;
  openPublishTask?: PublishTask | null;
  nextAction?: {
    key?: string;
    label?: string;
    tone?: string;
  };
  aging?: {
    daysInCurrentStatus?: number | null;
    overdue?: boolean;
  };
  retrospective?: {
    done?: boolean;
    evidenceUrl?: string | null;
    evidenceNote?: string | null;
    needsGeoRetest?: boolean;
  };
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
  updatedAt?: string | null;
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
  if (row.factGate?.status) return row.factGate.status === 'passed';
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

function contentSource(row: ContentRow) {
  return row.source?.label || row.sourceLabel || ({
    geo_gap: 'GEO 缺口',
    geo_experiment: 'GEO 实验',
    product_fact: '产品事实发布',
    dealer_question: '经销商问题',
    sentiment: '舆情问题',
    campaign: '活动 Campaign',
    copywriter: '文案 Copilot',
    manual: '人工 Brief',
  } as Record<string, string>)[row.sourceType || ''] || '人工 Brief';
}

function nextActionLabel(row: ContentRow) {
  if (row.nextAction?.label) return row.nextAction.label;
  if (!factGatePassed(row) && row.status !== 'published') return '补事实源';
  if (row.status === 'draft') return '提交审核';
  if (row.status === 'rejected') return '修改后重提';
  if (row.status === 'approved') return row.openPublishTask ? '回填发布凭证' : '创建发布任务';
  if (row.status === 'published') return '查看复盘';
  return '查看内容';
}

function targetSummary(row: ContentRow) {
  if (row.source?.type === 'geo_experiment' || row.sourceType === 'geo_experiment' || row.sourceType === 'geo_gap') return '提升 AI 可见度与高意向线索';
  if (row.sourceType === 'dealer_question') return '支撑经销商答疑与成交转化';
  if (row.sourceType === 'product_fact') return '发布产品事实与权威口径';
  if (row.sourceType === 'sentiment') return '回应舆情问题与认知偏差';
  if (row.sourceType === 'campaign') return '支撑活动触达与转化';
  return '沉淀可发布、可追责的品牌内容';
}

function currentOwner(row: ContentRow, task?: PublishTask | null) {
  return task?.owner || row.reviewer || row.author || '未指定';
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
  const [briefOpen, setBriefOpen] = useState(false);
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
      setBriefOpen(false);
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
    setBriefOpen(false);
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
    setBriefOpen(false);
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
    setBriefOpen(false);
    setEvidenceTarget(task);
    setPublishTarget(null);
    setFactTarget(null);
    setEditTarget(null);
    setEvidenceForm({ evidenceUrl: task.evidenceUrl || '', evidenceNote: task.evidenceNote || '' });
  }

  function openEditor(row: ContentRow) {
    setBriefOpen(false);
    setEditTarget(row);
    setFactTarget(null);
    setPublishTarget(null);
    setEvidenceTarget(null);
    setEditForm({ title: row.title || '', kind: row.kind || 'article', channel: row.channel || '', body: row.body || '' });
  }

  function closeEditor() {
    setEditTarget(null);
  }

  function closeBrief() {
    setBriefOpen(false);
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

  function handleNextAction(row: ContentRow, openTask?: PublishTask | null) {
    const action = row.nextAction?.key;
    if (action === 'bindFacts') {
      openFactBinder(row);
      return;
    }
    if (action === 'submitReview') {
      act(() => content.submit(row.id), '已送审');
      return;
    }
    if (action === 'editRework') {
      openEditor(row);
      return;
    }
    if (action === 'fillEvidence' && openTask) {
      openEvidence(openTask);
      return;
    }
    if (action === 'createPublishTask') {
      openPublishTask(row);
      return;
    }
    if (row.status === 'published' && row.latestPublishTask) {
      openEvidence(row.latestPublishTask);
      return;
    }
    openEditor(row);
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
    const retro = rows.filter((item) => item.status === 'published' && !item.retrospective?.done).length;
    const readyToPublish = rows.filter((item) => item.status === 'approved' && factGatePassed(item) && !item.openPublishTask).length;
    return { draft, review, approved, rejected, published, blocked, publishTasksOpen, retro, readyToPublish };
  }, [rows, publishTasks]);

  const pipelineStages = [
    { key: 'draft', label: '待补 Brief', value: stats.draft, hint: '补全正文、渠道与事实源', icon: ClipboardList, status: 'draft', tone: 'neutral' },
    { key: 'facts', label: '事实源阻塞', value: stats.blocked, hint: '未校验不得发布', icon: ShieldCheck, status: '', tone: 'warning' },
    { key: 'review', label: '待审核', value: stats.review, hint: '等待核准或驳回', icon: CheckCircle2, status: 'in_review', tone: 'info' },
    { key: 'publishable', label: '可发任务', value: stats.readyToPublish, hint: '已核准，可创建发布任务', icon: Rocket, status: 'approved', tone: 'success' },
    { key: 'retro', label: '待复盘', value: stats.retro, hint: '补公开 URL、GEO 复测或线索回流', icon: BarChart3, status: 'published', tone: 'brand' },
  ];

  const sourceItems: FactSource[] = Array.isArray(factSources.data?.items) ? factSources.data.items : [];
  const urgentRows = rows
    .filter((item) => item.status !== 'published' && (!factGatePassed(item) || item.aging?.overdue || item.status === 'rejected' || (item.status === 'approved' && !item.openPublishTask)))
    .slice(0, 4);

  return (
    <div className="page-container content-factory-page">
      <PageHeader
        title="内容生产工作台"
        subtitle="处理 Brief、事实源、审核、发布任务与发布凭证；无已校验事实源不得对外发布"
      />

      <section className="card-elevated content-factory-workbench">
        <div className="content-factory-hero">
          <div>
            <p className="t-label">执行队列</p>
            <h2 className="t-headline" style={{ marginTop: 4 }}>今天要处理什么</h2>
            <p>每条内容都要带来源、目标、事实源和下一步动作；发布完成后回填凭证，才能进入复盘。</p>
          </div>
          <div className="content-factory-metrics" aria-label="内容工厂关键指标">
            <span><strong>{rows.length}</strong> 在库内容</span>
            <span><strong>{stats.blocked}</strong> 事实源阻塞</span>
            <span><strong>{stats.publishTasksOpen}</strong> 发布执行中</span>
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
                  const openTask = c.openPublishTask || rowTasks.find((task) => task.status !== 'published' && task.status !== 'cancelled');
                  const latestTask = c.latestPublishTask || rowTasks[0];
                  return (
                    <article key={c.id} className="content-factory-item">
                      <div className="content-factory-item__body">
                        <div className="content-factory-item__title">
                          <FileText size={16} />
                          <strong>{c.title}</strong>
                          <span className={`content-factory-next content-factory-next--${c.nextAction?.tone || 'neutral'}`}>
                            <Flag size={12} />{nextActionLabel(c)}
                          </span>
                        </div>
                        <div className="content-factory-item__why">
                          <span><Target size={13} />来源：{contentSource(c)}</span>
                          <span><BarChart3 size={13} />目标：{targetSummary(c)}</span>
                        </div>
                        <div className="content-factory-item__meta">
                          <span>{KIND_OPTIONS.find(([value]) => value === c.kind)?.[1] || c.kind}</span>
                          <span>{c.channel}</span>
                          <span className={gatePassed ? 'is-ok' : 'is-blocked'}>
                            {gatePassed ? `${c.factGate?.verifiedCount ?? verifiedFacts} 个已校验事实源` : c.factGate?.reason || '缺事实源/未校验'}
                          </span>
                          {latestTask ? (
                            <span className={latestTask.status === 'published' ? 'is-ok' : 'is-blocked'}>{taskLabel(latestTask)}</span>
                          ) : null}
                          <span><UserRound size={12} />{currentOwner(c, openTask)}</span>
                          {c.aging?.daysInCurrentStatus != null ? (
                            <span className={c.aging.overdue ? 'is-blocked' : ''}><Clock3 size={12} />停留 {c.aging.daysInCurrentStatus} 天</span>
                          ) : null}
                          {c.retrospective?.needsGeoRetest ? <span className="is-blocked">待 GEO 复测</span> : null}
                        </div>
                        {c.status === 'rejected' && rejectionSummary(c) ? (
                          <div className="content-factory-item__note">{rejectionSummary(c)}</div>
                        ) : null}
                      </div>
                      <div className="content-factory-item__actions">
                        {statusPill(c.status)}
                        <button
                          className={c.nextAction?.tone === 'danger' ? 'btn btn-warning btn-sm' : c.nextAction?.tone === 'success' ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'}
                          onClick={() => handleNextAction(c, openTask)}
                        >
                          <Flag size={13} />{nextActionLabel(c)}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => openEditor(c)}>
                          <PenTool size={13} />编辑
                        </button>
                        <button className={gatePassed ? 'btn btn-outline btn-sm' : 'btn btn-warning btn-sm'} onClick={() => openFactBinder(c)}>
                          <Link2 size={13} />事实源
                        </button>
                        {c.status === 'draft' || c.status === 'rejected' ? (
                          <button className="btn btn-outline btn-sm" onClick={() => act(() => content.submit(c.id), '已送审')} disabled={!gatePassed}>
                            提交审核
                          </button>
                        ) : null}
                        {c.status === 'in_review' ? (
                          <span className="status-pill status-pill-info">审核角色处理中</span>
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
            <div className="content-factory-create content-factory-command">
              <div className="content-factory-sectionhead">
                <div>
                  <p className="t-label"><AlertCircle size={13} />{'\u5f85\u5904\u7406\u63d0\u9192'}</p>
                  <h3>{'\u4f18\u5148\u5904\u7406\u963b\u585e\u9879'}</h3>
                </div>
              </div>
              <div className="content-factory-command-list">
                {urgentRows.length ? urgentRows.map((item) => (
                  <button key={item.id} type="button" onClick={() => handleNextAction(item, item.openPublishTask || null)}>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{contentSource(item)} {'\u00b7'} {item.factGate?.reason || nextActionLabel(item)}</small>
                    </span>
                    <span>{nextActionLabel(item)}</span>
                  </button>
                )) : (
                  <div className="content-factory-fact-empty">{'\u6682\u65e0\u660e\u663e\u963b\u585e\u3002\u53ef\u4ee5\u65b0\u5efa brief\uff0c\u6216\u4ece\u6587\u6848 Copilot \u9001\u5165\u8349\u7a3f\u3002'}</div>
                )}
              </div>
            </div>

            <div className="content-factory-create content-factory-quickstart">
              <div className="content-factory-sectionhead">
                <div>
                  <p className="t-label"><PenTool size={13} />{'\u65b0\u5efa Brief'}</p>
                  <h3>{'\u8fdb\u5165\u5185\u5bb9\u6d41\u6c34\u7ebf'}</h3>
                </div>
              </div>
              <p>{'\u7528\u4e8e\u8865\u5145\u4eba\u5de5\u9009\u9898\u3001\u6d3b\u52a8\u8bf4\u660e\u6216\u6e20\u9053 brief\u3002\u521b\u5efa\u540e\u8fdb\u5165\u4e3b\u5217\u8868\uff0c\u518d\u7ed1\u5b9a\u4e8b\u5b9e\u6e90\u4e0e\u5ba1\u6838\u3002'}</p>
              <button className="btn btn-brand" type="button" onClick={() => setBriefOpen(true)}>
                <PenTool size={14} />{'\u65b0\u5efa\u5185\u5bb9 Brief'}
              </button>
            </div>

            <div className="content-factory-gate">
              <span><Rocket size={15} />{'\u53d1\u5e03\u4efb\u52a1'}</span>
              <strong>{publishTasks.length ? `${publishTasks.length} \u4e2a\u4efb\u52a1` : '\u6682\u65e0\u53d1\u5e03\u4efb\u52a1'}</strong>
              <div className="content-factory-selected-refs">
                {publishTasks.slice(0, 5).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => task.status === 'published' ? undefined : openEvidence(task)}
                    title={task.status === 'published' ? '\u5df2\u56de\u586b\u53d1\u5e03\u51ed\u8bc1' : '\u53d1\u5e03\u5b8c\u6210\u540e\u56de\u586b\u51ed\u8bc1'}
                  >
                    {taskLabel(task)}
                  </button>
                ))}
                {!publishTasks.length ? <span>{'\u6838\u51c6\u5185\u5bb9\u521b\u5efa\u53d1\u5e03\u4efb\u52a1\u540e\u4f1a\u51fa\u73b0\u5728\u8fd9\u91cc\u3002'}</span> : null}
              </div>
            </div>

            <div className="content-factory-gate">
              <span><AlertCircle size={15} />{'\u53d1\u5e03\u95e8\u7981'}</span>
              <strong>{'\u65e0\u5df2\u6821\u9a8c\u4e8b\u5b9e\u6e90\u4e0d\u5f97\u5bf9\u5916\u53d1\u5e03'}</strong>
              <p>{'\u5185\u5bb9\u5fc5\u987b\u5148\u9009\u62e9\u4ea7\u54c1\u4e8b\u5b9e\u3001\u5356\u70b9\u8bc1\u636e\u6216\u8d44\u6599\u51ed\u8bc1\uff0c\u5e76\u7531\u540e\u7aef\u6821\u9a8c\u5199\u5165\u540e\uff0c\u624d\u80fd\u521b\u5efa\u53d1\u5e03\u4efb\u52a1\uff1b\u53d1\u5e03\u5b8c\u6210\u5e76\u56de\u586b\u51ed\u8bc1\u540e\u624d\u7b97\u5df2\u53d1\u5e03\u3002'}</p>
            </div>
          </aside>
        </div>


      {briefOpen && (
        <div className="content-factory-modal" onClick={closeBrief}>
          <div className="content-factory-dialog content-factory-dialog--md" role="dialog" aria-modal="true" aria-labelledby="content-brief-title" onClick={(event) => event.stopPropagation()}>
            <div className="content-factory-dialog__head">
              <div><p className="t-label"><PenTool size={13} />{'\u65b0\u5efa Brief'}</p><h3 id="content-brief-title">{'\u8fdb\u5165\u5185\u5bb9\u6d41\u6c34\u7ebf'}</h3></div>
              <button className="btn btn-ghost btn-sm icon-only" onClick={closeBrief} aria-label={'\u5173\u95ed\u65b0\u5efa Brief'}><X size={16} /></button>
            </div>
            <div className="content-factory-dialog__body">
              <label className="content-factory-field">
                <span>内容标题</span>
                <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="例如：空气能热水器选型答疑" />
              </label>
              <div className="content-factory-formgrid content-factory-formgrid--modal">
                <label className="content-factory-field">
                  <span>内容类型</span>
                  <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                    {KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="content-factory-field">
                  <span>目标渠道</span>
                  <input className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} placeholder="geo / wechat / website" />
                </label>
              </div>
              <label className="content-factory-field">
                <span>Brief / 正文</span>
                <textarea className="textarea content-factory-dialog__textarea" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="写清楚选题背景、目标人群、要回答的问题和必须使用的事实。" />
              </label>
              <label className="content-factory-field">
                <span>事实源 ID（可选）</span>
                <input className="input" value={f.factRefs} onChange={(e) => setF({ ...f, factRefs: e.target.value })} placeholder="多个 ID 用英文逗号分隔" />
              </label>
            </div>
            <div className="content-factory-dialog__foot">
              <span>{'\u521b\u5efa\u540e\u4f1a\u8fdb\u5165\u4e3b\u5217\u8868\uff0c\u518d\u7ed1\u5b9a\u4e8b\u5b9e\u6e90\u4e0e\u5ba1\u6838\u3002'}</span>
              <div><button className="btn btn-ghost btn-sm" onClick={closeBrief}>{'\u53d6\u6d88'}</button><button className="btn btn-brand btn-sm" onClick={create}><PenTool size={14} />{'\u65b0\u5efa\u8349\u7a3f'}</button></div>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="content-factory-modal" onClick={closeEditor}>
          <div className="content-factory-dialog content-factory-dialog--lg" role="dialog" aria-modal="true" aria-labelledby="content-edit-title" onClick={(event) => event.stopPropagation()}>
            <div className="content-factory-dialog__head">
              <div><p className="t-label"><PenTool size={13} />{'\u5185\u5bb9\u7f16\u8f91\u5de5\u4f5c\u53f0'}</p><h3 id="content-edit-title">{editTarget.title}</h3></div>
              <button className="btn btn-ghost btn-sm icon-only" onClick={closeEditor} aria-label="关闭内容编辑"><X size={16} /></button>
            </div>
            <div className="content-factory-dialog__body content-factory-dialog__body--editor">
              {editTarget.status === 'rejected' && rejectionSummary(editTarget) ? <div className="content-factory-review-note"><strong>驳回意见</strong><p>{rejectionSummary(editTarget)}</p></div> : null}
              <label className="content-factory-field">
                <span>内容标题</span>
                <input className="input" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="标题" />
              </label>
              <div className="content-factory-formgrid content-factory-formgrid--modal">
                <label className="content-factory-field">
                  <span>内容类型</span>
                  <select className="input" value={editForm.kind} onChange={(e) => setEditForm({ ...editForm, kind: e.target.value })}>
                    {KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="content-factory-field">
                  <span>目标渠道</span>
                  <input className="input" value={editForm.channel} onChange={(e) => setEditForm({ ...editForm, channel: e.target.value })} placeholder="渠道" />
                </label>
              </div>
              <label className="content-factory-field">
                <span>正文 / Brief</span>
                <textarea className="textarea content-factory-dialog__textarea content-factory-dialog__textarea--lg" value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} placeholder="正文 / brief" />
              </label>
            </div>
            <div className="content-factory-dialog__foot">
              <span>{editTarget.status === 'rejected' ? '保存后内容回到草稿，可重新提交审核。' : '保存后会更新内容草稿，不会直接对外发布。'}</span>
              <div><button className="btn btn-ghost btn-sm" onClick={closeEditor}>{'\u53d6\u6d88'}</button><button className="btn btn-brand btn-sm" onClick={saveContentEdit} disabled={editSaving}>{editSaving ? <Loader2 size={14} className="animate-spin" /> : <PenTool size={14} />}{'\u4fdd\u5b58\u4fee\u6539'}</button></div>
            </div>
          </div>
        </div>
      )}

      {publishTarget && (
        <div className="content-factory-modal" onClick={closePublishTask}>
          <div className="content-factory-dialog content-factory-dialog--md" role="dialog" aria-modal="true" aria-labelledby="content-publish-title" onClick={(event) => event.stopPropagation()}>
            <div className="content-factory-dialog__head">
              <div><p className="t-label"><Rocket size={13} />{'\u521b\u5efa\u53d1\u5e03\u4efb\u52a1'}</p><h3 id="content-publish-title">{publishTarget.title}</h3></div>
              <button className="btn btn-ghost btn-sm icon-only" onClick={closePublishTask} aria-label="关闭发布任务"><X size={16} /></button>
            </div>
            <div className="content-factory-dialog__body">
              <label className="content-factory-field">
                <span>发布渠道</span>
                <select className="input" value={publishForm.channel} onChange={(e) => setPublishForm({ ...publishForm, channel: e.target.value })}>{PUBLISH_CHANNEL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="content-factory-field">
                <span>发布位置 / 账号</span>
                <input className="input" value={publishForm.targetName} onChange={(e) => setPublishForm({ ...publishForm, targetName: e.target.value })} placeholder="例如：Rheem 官网新闻、官方公众号" />
              </label>
              <div className="content-factory-formgrid content-factory-formgrid--modal">
                <label className="content-factory-field">
                  <span>执行方式</span>
                  <select className="input" value={publishForm.publishMode} onChange={(e) => setPublishForm({ ...publishForm, publishMode: e.target.value })}><option value="manual">人工发布</option><option value="auto">系统自动发布</option></select>
                </label>
                <label className="content-factory-field">
                  <span>负责人</span>
                  <input className="input" value={publishForm.owner} onChange={(e) => setPublishForm({ ...publishForm, owner: e.target.value })} placeholder="负责人" />
                </label>
              </div>
              <label className="content-factory-field">
                <span>计划发布时间</span>
                <input className="input" type="datetime-local" value={publishForm.scheduledAt} onChange={(e) => setPublishForm({ ...publishForm, scheduledAt: e.target.value })} />
              </label>
            </div>
            <div className="content-factory-dialog__foot"><span>{'\u5ba1\u6838\u901a\u8fc7\u4e0d\u7b49\u4e8e\u5df2\u53d1\u5e03\uff1b\u6267\u884c\u6e20\u9053\u53d1\u5e03\u540e\u9700\u56de\u586b\u51ed\u8bc1\u3002'}</span><div><button className="btn btn-ghost btn-sm" onClick={closePublishTask}>{'\u53d6\u6d88'}</button><button className="btn btn-brand btn-sm" onClick={createPublishTask} disabled={publishSaving}>{publishSaving ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}{'\u521b\u5efa\u53d1\u5e03\u4efb\u52a1'}</button></div></div>
          </div>
        </div>
      )}

      {evidenceTarget && (
        <div className="content-factory-modal" onClick={() => setEvidenceTarget(null)}>
          <div className="content-factory-dialog content-factory-dialog--md" role="dialog" aria-modal="true" aria-labelledby="content-evidence-title" onClick={(event) => event.stopPropagation()}>
            <div className="content-factory-dialog__head"><div><p className="t-label"><CheckCircle2 size={13} />{'\u56de\u586b\u53d1\u5e03\u51ed\u8bc1'}</p><h3 id="content-evidence-title">{evidenceTarget.targetName || evidenceTarget.channel}</h3></div><button className="btn btn-ghost btn-sm icon-only" onClick={() => setEvidenceTarget(null)} aria-label="关闭发布凭证"><X size={16} /></button></div>
            <div className="content-factory-dialog__body">
              <label className="content-factory-field">
                <span>发布链接</span>
                <input className="input" value={evidenceForm.evidenceUrl} onChange={(e) => setEvidenceForm({ ...evidenceForm, evidenceUrl: e.target.value })} placeholder="https://..." />
              </label>
              <label className="content-factory-field">
                <span>发布凭证说明</span>
                <textarea className="textarea content-factory-dialog__textarea" value={evidenceForm.evidenceNote} onChange={(e) => setEvidenceForm({ ...evidenceForm, evidenceNote: e.target.value })} placeholder="例如：已发布到公众号草稿箱并推送，或已同步到官网新闻栏目。" />
              </label>
            </div>
            <div className="content-factory-dialog__foot"><span>{'\u56de\u586b\u540e\u5185\u5bb9\u624d\u7b97\u8fdb\u5165\u5df2\u53d1\u5e03\u3002'}</span><div><button className="btn btn-ghost btn-sm" onClick={() => setEvidenceTarget(null)}>{'\u53d6\u6d88'}</button><button className="btn btn-brand btn-sm" onClick={completePublishTask} disabled={publishSaving || (!evidenceForm.evidenceUrl.trim() && !evidenceForm.evidenceNote.trim())}>{publishSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{'\u786e\u8ba4\u5df2\u53d1\u5e03'}</button></div></div>
          </div>
        </div>
      )}

      {factTarget && (
        <div className="content-factory-modal" onClick={closeFactBinder}>
          <div className="content-factory-dialog content-factory-dialog--lg" role="dialog" aria-modal="true" aria-labelledby="content-fact-title" onClick={(event) => event.stopPropagation()}>
            <div className="content-factory-dialog__head"><div><p className="t-label"><ShieldCheck size={13} />{'\u4e8b\u5b9e\u6e90\u7ed1\u5b9a'}</p><h3 id="content-fact-title">{factTarget.title}</h3></div><button className="btn btn-ghost btn-sm icon-only" onClick={closeFactBinder} aria-label="关闭事实源绑定"><X size={16} /></button></div>
            <div className="content-factory-dialog__body content-factory-dialog__body--facts">
              <label className="content-factory-field">
                <span>检索事实源</span>
                <input className="input" value={factQuery} onChange={(e) => setFactQuery(e.target.value)} placeholder="搜索产品、SKU、卖点或证据" />
              </label>
              <div className="content-factory-fact-list content-factory-fact-list--modal" aria-label="可选事实源">
                {factSources.isLoading ? <div className="content-factory-fact-empty"><Loader2 size={16} className="animate-spin" />加载事实源</div> : sourceItems.length ? sourceItems.map((source) => { const checked = selectedRefs.some((ref) => refKey(ref) === refKey(source)); return <button key={refKey(source)} type="button" className={`content-factory-fact-option ${checked ? 'is-selected' : ''}`} onClick={() => toggleFactSource(source)} title={source.verified ? undefined : '可先绑定，但发布前仍需通过后端事实校验'}><span><strong>{source.label}</strong><small>{source.category || source.type}{source.description ? ` · ${source.description}` : ''}</small></span><span className={source.verified ? 'status-pill status-pill-success' : 'status-pill status-pill-warning'}>{source.verified ? '已校验' : '待校验'}</span></button>; }) : <div className="content-factory-fact-empty">暂无匹配事实源。可以换关键词搜索，或直接上传一份资料作为凭证。</div>}
              </div>
              <div className="content-factory-upload-ref"><label className="btn btn-outline btn-sm" htmlFor="content-factory-evidence-upload">{evidenceUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}{evidenceUploading ? '上传中' : '上传资料凭证'}</label><input id="content-factory-evidence-upload" type="file" disabled={evidenceUploading} onChange={(event) => { const file = event.target.files?.[0] || null; event.currentTarget.value = ''; uploadEvidenceFile(file); }} /><span>支持产品手册、认证文件、参数表、活动说明等资料。上传后系统自动保存为事实源。</span></div>
              <div className="content-factory-selected-refs">{selectedRefs.map((ref) => <button key={refKey(ref)} type="button" onClick={() => setSelectedRefs((current) => current.filter((item) => refKey(item) !== refKey(ref)))}>{sourceLabel(ref)} <X size={12} /></button>)}{!selectedRefs.length ? <span>尚未选择事实源</span> : null}</div>
            </div>
            <div className="content-factory-dialog__foot"><span>{'\u65e0\u5df2\u6821\u9a8c\u4e8b\u5b9e\u6e90\u4e0d\u5f97\u521b\u5efa\u53d1\u5e03\u4efb\u52a1\u3002'}</span><div><button className="btn btn-ghost btn-sm" onClick={closeFactBinder}>{'\u53d6\u6d88'}</button><button className="btn btn-brand btn-sm" onClick={saveFactRefs} disabled={factSaving || !selectedRefs.length}>{factSaving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}{'\u4fdd\u5b58\u5e76\u6821\u9a8c\u4e8b\u5b9e\u6e90'}</button></div></div>
          </div>
        </div>
      )}
      </section>
    </div>
  );
}
