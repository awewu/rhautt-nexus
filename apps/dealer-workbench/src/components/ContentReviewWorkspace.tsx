'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { PageHeader, useToast } from '@rhautt/ui';
import { content } from '../lib/api';

type FactRef = {
  id?: string;
  label?: string;
  verified?: boolean;
};

type ContentReviewRow = {
  id: string;
  title: string;
  kind?: string;
  channel?: string;
  body?: string | null;
  status: string;
  factRefs?: FactRef[];
  sourceType?: string | null;
  sourceLabel?: string | null;
  reviewNote?: string | null;
  rejectionReason?: string | null;
};

const KIND_LABEL: Record<string, string> = {
  article: '文章',
  faq: 'FAQ',
  comparison: '对比',
  topic: '主题',
  social: '社媒',
  landing: '落地页',
};

const REJECTION_REASONS = [
  ['fact_missing', '事实源不足'],
  ['claim_risk', '表达夸大'],
  ['brand_voice', '品牌口径不一致'],
  ['channel_fit', '渠道不适配'],
  ['typo_format', '格式/错别字'],
  ['other', '其他'],
];

function factGatePassed(row: ContentReviewRow) {
  return (
    Boolean((row.factRefs || []).length) &&
    (row.factRefs || []).every((ref) => ref.id && ref.verified)
  );
}

function factSummary(row: ContentReviewRow) {
  const refs = row.factRefs || [];
  const verified = refs.filter((ref) => ref.id && ref.verified).length;
  if (!refs.length) return '未绑定事实源';
  if (verified === refs.length) return `${verified} 个事实源已校验`;
  return `${verified}/${refs.length} 个事实源已校验`;
}

export default function ContentReviewWorkspace() {
  const { toast } = useToast();
  const review = useSWR('content:review:list', () => content.list({ status: 'in_review' }));
  const rows: ContentReviewRow[] = Array.isArray(review.data?.contents) ? review.data.contents : [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectForm, setRejectForm] = useState({ rejectionReason: 'fact_missing', reviewNote: '' });
  const selected = rows.find((row) => row.id === selectedId) || rows[0] || null;

  useEffect(() => {
    if (!rows.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !rows.some((row) => row.id === selectedId)) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  async function decide(
    id: string,
    decision: 'approved' | 'rejected',
    data: Record<string, unknown> = {}
  ) {
    setReviewBusy(true);
    try {
      await content.decide(id, decision, data);
      toast(
        decision === 'approved'
          ? '已核准，回到内容工厂后可进入发布检查'
          : '已驳回，内容回到工厂处理',
        'success'
      );
      setRejectOpen(false);
      setRejectForm({ rejectionReason: 'fact_missing', reviewNote: '' });
      review.mutate();
    } catch (error) {
      toast((error as Error).message || '审核操作失败', 'error');
    } finally {
      setReviewBusy(false);
    }
  }

  function rejectSelected() {
    if (!selected) return;
    if (!rejectForm.reviewNote.trim()) {
      toast('驳回必须填写修改意见', 'error');
      return;
    }
    decide(selected.id, 'rejected', rejectForm);
  }

  return (
    <div className="page-container content-review-page">
      <PageHeader
        title="内容审核"
        subtitle="审核内容工厂提交的稿件；这里只做内部核准，不会直接对外发布"
      />

      <section className="card-elevated content-review-board">
        <div className="content-review-board__head">
          <div>
            <p className="t-label">待审核队列</p>
            <h2>来自内容工厂的送审稿</h2>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => review.mutate()}
            disabled={review.isLoading}
          >
            <RefreshCw size={14} className={review.isLoading ? 'animate-spin' : undefined} />
            刷新
          </button>
        </div>

        {review.error ? (
          <div className="content-review-empty is-error">
            <AlertCircle size={18} />
            内容审核队列加载失败：{(review.error as Error).message}
          </div>
        ) : null}

        {!review.error && review.isLoading ? (
          <div className="content-review-empty">正在加载待审核内容...</div>
        ) : null}

        {!review.error && !review.isLoading && !rows.length ? (
          <div className="content-review-empty">
            <CheckCircle2 size={18} />
            暂无待审核内容。内容工厂点击“提交审核”后会出现在这里。
          </div>
        ) : null}

        {rows.length ? (
          <div className="content-review-workspace">
            <div className="content-review-list">
              {rows.map((row) => {
                const factsOk = factGatePassed(row);
                const active = selected?.id === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    className={`content-review-item ${active ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedId(row.id);
                      setRejectOpen(false);
                    }}
                  >
                    <div className="content-review-item__main">
                      <div className="content-review-item__title">
                        <FileText size={16} />
                        <strong>{row.title}</strong>
                      </div>
                      <div className="content-review-item__meta">
                        <span>{KIND_LABEL[row.kind || ''] || row.kind || '内容'}</span>
                        <span>{row.channel || '未指定渠道'}</span>
                        <span className={factsOk ? 'is-ok' : 'is-warning'}>{factSummary(row)}</span>
                      </div>
                      {row.body ? <p>{row.body}</p> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {selected ? (
              <aside className="content-review-preview">
                <div className="content-review-preview__head">
                  <div>
                    <p className="t-label">
                      <Eye size={13} />
                      审核预览
                    </p>
                    <h3>{selected.title}</h3>
                  </div>
                  <span
                    className={
                      factGatePassed(selected)
                        ? 'status-pill status-pill-success'
                        : 'status-pill status-pill-warning'
                    }
                  >
                    {factSummary(selected)}
                  </span>
                </div>

                <div className="content-review-preview__meta">
                  <span>{KIND_LABEL[selected.kind || ''] || selected.kind || '内容'}</span>
                  <span>{selected.channel || '未指定渠道'}</span>
                  {selected.sourceLabel || selected.sourceType ? (
                    <span>来源：{selected.sourceLabel || selected.sourceType}</span>
                  ) : null}
                </div>

                <div className="content-review-preview__body">
                  {selected.body || '暂无正文内容'}
                </div>

                <div className="content-review-facts">
                  <strong>
                    <ShieldCheck size={14} />
                    事实源
                  </strong>
                  {(selected.factRefs || []).length ? (
                    selected.factRefs!.map((ref) => (
                      <span
                        key={`${ref.id}-${ref.label}`}
                        className={ref.verified ? 'is-ok' : 'is-warning'}
                      >
                        {ref.label || ref.id}
                        {ref.verified ? ' · 已校验' : ' · 待校验'}
                      </span>
                    ))
                  ) : (
                    <span className="is-warning">未绑定事实源</span>
                  )}
                </div>

                {rejectOpen ? (
                  <div className="content-review-decision">
                    <select
                      className="input"
                      value={rejectForm.rejectionReason}
                      onChange={(event) =>
                        setRejectForm({ ...rejectForm, rejectionReason: event.target.value })
                      }
                    >
                      {REJECTION_REASONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <textarea
                      className="textarea"
                      value={rejectForm.reviewNote}
                      onChange={(event) =>
                        setRejectForm({ ...rejectForm, reviewNote: event.target.value })
                      }
                      placeholder="写清楚需要怎么改，例如：缺少产品手册引用，请补充事实源后重新提交。"
                    />
                    <div className="content-review-item__actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setRejectOpen(false)}
                        disabled={reviewBusy}
                      >
                        取消
                      </button>
                      <button
                        className="btn btn-brand btn-sm"
                        onClick={rejectSelected}
                        disabled={reviewBusy || !rejectForm.reviewNote.trim()}
                      >
                        <XCircle size={14} />
                        驳回并退回修改
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="content-review-item__actions">
                    <button
                      className="btn btn-brand btn-sm"
                      onClick={() => decide(selected.id, 'approved')}
                      disabled={reviewBusy}
                    >
                      <CheckCircle2 size={14} />
                      核准
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setRejectOpen(true)}
                      disabled={reviewBusy}
                    >
                      <XCircle size={14} />
                      驳回
                    </button>
                  </div>
                )}
              </aside>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
