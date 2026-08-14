'use client';

/** 2026-08 全页 UX 重构三期 · WorkspaceKit 化：渲染层去内联样式（统计格走 MiniStat，静态布局全走 Tailwind）。 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Radio, RefreshCw, Search } from 'lucide-react';
import { MiniStat } from '@/components/StatCard';
import { growthOpinion } from '../lib/api';

type Connector = {
  source: string;
  label: string;
  status: 'ready' | 'not-configured';
  requiresCredential: boolean;
};

type Mention = {
  id: string;
  source: string;
  content: string;
  url?: string | null;
  sentiment: 'positive' | 'negative' | 'neutral';
  intent: string;
  severity: string;
  entities?: string[];
  capturedAt: string;
};

type Alert = {
  id: string;
  severity: string;
  status: 'open' | 'ack' | 'resolved';
  playbookDraft?: string | null;
  createdAt: string;
};

const sentimentLabel: Record<string, string> = {
  positive: '正向',
  negative: '负向',
  neutral: '中性',
};

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function badgeClass(kind: string) {
  if (kind === 'ready' || kind === 'positive' || kind === 'resolved') return 'badge badge-success';
  if (kind === 'negative' || kind === 'P0' || kind === 'P1' || kind === 'open')
    return 'badge badge-danger';
  if (kind === 'ack') return 'badge badge-warning';
  return 'badge badge-info';
}

export default function GrowthSentimentWorkspace() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [manualForm, setManualForm] = useState({
    source: 'manual',
    content: '',
    url: '',
    entities: 'Rheem, Rhautt Comfort',
  });
  const [pullForm, setPullForm] = useState({
    source: 'news',
    query: 'Rheem 热水器',
    limit: 10,
  });

  const metrics = useMemo(() => {
    const total = mentions.length;
    const negative = mentions.filter((item) => item.sentiment === 'negative').length;
    const openAlerts = alerts.filter((item) => item.status !== 'resolved').length;
    const ready = connectors.filter((item) => item.status === 'ready').length;
    return { total, negative, openAlerts, ready };
  }, [alerts, connectors, mentions]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [connectorData, mentionData, alertData] = await Promise.all([
        growthOpinion.connectors(),
        growthOpinion.mentions(),
        growthOpinion.alerts(),
      ]);
      setConnectors(connectorData?.connectors || []);
      setMentions(mentionData?.items || []);
      setAlerts(alertData?.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '舆情数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitManual() {
    if (!manualForm.content.trim()) {
      setError('请先填写舆情内容');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await growthOpinion.ingest({
        source: manualForm.source,
        content: manualForm.content.trim(),
        url: manualForm.url.trim() || undefined,
        entities: splitCsv(manualForm.entities),
      });
      setManualForm((current) => ({ ...current, content: '', url: '' }));
      setMessage('已录入并完成分级');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '舆情录入失败');
    } finally {
      setBusy(false);
    }
  }

  async function pullFromSource() {
    if (!pullForm.query.trim()) {
      setError('请先填写拉取关键词');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await growthOpinion.pull({
        source: pullForm.source,
        query: pullForm.query.trim(),
        limit: pullForm.limit,
      });
      setMessage(`已拉取 ${result?.pulled || 0} 条，入库 ${result?.ingested || 0} 条`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '舆情拉取失败');
    } finally {
      setBusy(false);
    }
  }

  async function updateAlert(id: string, status: 'open' | 'ack' | 'resolved') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await growthOpinion.updateAlertStatus(id, status);
      setMessage('告警状态已更新');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '告警状态更新失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-elevated grid gap-4 p-4.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-label">E1 舆情雷达</p>
          <h2 className="t-headline mt-1">公开声量与危机预警</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            先接人工录入与新闻 RSS，外部社媒源按凭证逐步接入。
          </p>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          刷新
        </button>
      </div>

      {(error || message) && (
        <div className={error ? 'alert alert-danger' : 'alert alert-success'}>
          {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {error || message}
        </div>
      )}

      <div className="g4 gap-3">
        <Metric label="入库舆情" value={String(metrics.total)} />
        <Metric label="负向条目" value={String(metrics.negative)} />
        <Metric label="未解决告警" value={String(metrics.openAlerts)} />
        <Metric label="就绪来源" value={String(metrics.ready)} />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
        <div className="inset grid gap-2.5">
          <span className="t-label">人工录入</span>
          <input
            className="input"
            value={manualForm.source}
            onChange={(event) => setManualForm({ ...manualForm, source: event.target.value })}
            placeholder="source"
          />
          <textarea
            className="input"
            value={manualForm.content}
            onChange={(event) => setManualForm({ ...manualForm, content: event.target.value })}
            rows={4}
            placeholder="粘贴公开评论、投诉、问答或客服摘录"
          />
          <input
            className="input"
            value={manualForm.url}
            onChange={(event) => setManualForm({ ...manualForm, url: event.target.value })}
            placeholder="原文链接，可选"
          />
          <input
            className="input"
            value={manualForm.entities}
            onChange={(event) => setManualForm({ ...manualForm, entities: event.target.value })}
            placeholder="实体，逗号分隔"
          />
          <button className="btn btn-brand" onClick={() => void submitManual()} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Radio size={15} />}
            录入并分级
          </button>
        </div>

        <div className="inset grid gap-2.5">
          <span className="t-label">来源拉取</span>
          <select
            className="input"
            value={pullForm.source}
            onChange={(event) => setPullForm({ ...pullForm, source: event.target.value })}
          >
            {connectors.map((item) => (
              <option key={item.source} value={item.source}>
                {item.label} · {item.status === 'ready' ? '就绪' : '待配置'}
              </option>
            ))}
          </select>
          <input
            className="input"
            value={pullForm.query}
            onChange={(event) => setPullForm({ ...pullForm, query: event.target.value })}
            placeholder="关键词"
          />
          <input
            className="input"
            type="number"
            min={1}
            max={50}
            value={pullForm.limit}
            onChange={(event) =>
              setPullForm({ ...pullForm, limit: Number(event.target.value) || 10 })
            }
          />
          <button className="btn btn-outline" onClick={() => void pullFromSource()} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Search size={15} />}
            拉取公开源
          </button>
          <div className="flex flex-wrap gap-1.5">
            {connectors.map((item) => (
              <span key={item.source} className={badgeClass(item.status)}>
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="table-shell">
        <table className="table">
          <thead>
            <tr>
              <th>来源</th>
              <th>内容</th>
              <th>情绪</th>
              <th>意图</th>
              <th>级别</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {mentions.map((item) => (
              <tr key={item.id}>
                <td className="font-bold">{item.source}</td>
                <td>{item.content}</td>
                <td>
                  <span className={badgeClass(item.sentiment)}>
                    {sentimentLabel[item.sentiment] || item.sentiment}
                  </span>
                </td>
                <td>{item.intent}</td>
                <td>
                  <span className={badgeClass(item.severity)}>{item.severity}</span>
                </td>
                <td>{fmtDate(item.capturedAt)}</td>
              </tr>
            ))}
            {!mentions.length && (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground/70">
                  暂无舆情，先录入或拉取新闻 RSS。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-shell">
        <table className="table">
          <thead>
            <tr>
              <th>级别</th>
              <th>状态</th>
              <th>话术草稿</th>
              <th>时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className={badgeClass(item.severity)}>{item.severity}</span>
                </td>
                <td>
                  <span className={badgeClass(item.status)}>{item.status}</span>
                </td>
                <td>{item.playbookDraft || '-'}</td>
                <td>{fmtDate(item.createdAt)}</td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => void updateAlert(item.id, 'ack')}
                      disabled={busy || item.status === 'resolved'}
                    >
                      认领
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => void updateAlert(item.id, 'resolved')}
                      disabled={busy || item.status === 'resolved'}
                    >
                      解决
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!alerts.length && (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground/70">
                  暂无危机告警。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <MiniStat label={label} value={value} accent />;
}
