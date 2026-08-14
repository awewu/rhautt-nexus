'use client';

/**
 * AgenticGEO 自主闭环（2026-08 全页 UX 重构 · WorkspaceKit 化）。
 * 重排：左 2/3 = ①选策略 + ②生成草稿（主产出区）；右 1/3 = ③受治理动作提案 + ④lift 验证。
 * 原版全宽单列三卡叠放留白大、24 处内联样式，分区色签改用 Tailwind 语义色。
 */
import { useState } from 'react';
import { Zap, FileText, ShieldCheck } from 'lucide-react';
import { PageHeader, useToast } from '@rhautt/ui';
import { WorkspaceSection, EmptyState, Pill } from '@/components/WorkspaceKit';
import { agenticGeo } from '../../lib/api';

const ZONE_CLASS: Record<string, string> = {
  green: 'text-emerald-600',
  yellow: 'text-amber-500',
  red: 'text-red-600',
};

export default function AgenticGeoPage() {
  const { toast } = useToast();
  const [topic, setTopic] = useState('');
  const [kind, setKind] = useState('faq');
  const [plan, setPlan] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function runPlan() {
    setBusy(true);
    try {
      setPlan(await agenticGeo.plan({ topic, kind, factRefs: [] }));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function approve(actionId: string) {
    try {
      const r = await agenticGeo.approve(actionId, { topic });
      toast(
        r.ok ? `动作 ${actionId} 已核准执行` : `仍被拦：${(r.blocked?.reasons || []).join(';')}`,
        r.ok ? 'success' : 'info'
      );
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        title="AgenticGEO · 自主闭环"
        subtitle="选策略→生成草稿→受治理动作提案(green自动/yellow代行需核准/red人工)→lift 验证 · 推理收口 Tandem 治理网关 · 无事实源不出对外内容、无 lift 不宣称有效（基座4）"
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-[220px]"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="主题（如 燃气热水器 能效）"
            />
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label="内容类型"
            >
              <option value="faq">FAQ</option>
              <option value="comparison">对比</option>
              <option value="topic">主题页</option>
            </select>
            <button className="btn btn-brand" disabled={busy} onClick={runPlan}>
              <Zap size={15} />
              {busy ? '生成中…' : '生成计划'}
            </button>
          </div>
        }
      />

      {!plan ? (
        <EmptyState
          icon={<Zap size={28} />}
          title="输入主题并「生成计划」"
          hint="AgenticGEO 将产出受治理的选策略 / 草稿 / 分区动作提案。"
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {/* ── 左 2/3：策略 + 草稿主产出区 ─────────────────────── */}
          <div className="grid gap-4 lg:col-span-2">
            <WorkspaceSection icon={<ShieldCheck size={16} />} title="① 选策略（自进化）">
              <div className="flex flex-wrap gap-1.5">
                {(plan.strategies || []).map((s: string) => (
                  <Pill key={s}>{s}</Pill>
                ))}
              </div>
            </WorkspaceSection>

            <WorkspaceSection
              icon={<FileText size={16} />}
              title={`② 生成草稿 ${plan.draft?.factGrounded ? '' : '（⚠️ 无事实源，仅内部草稿）'}`}
            >
              <pre className="max-h-56 overflow-auto text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {plan.draft?.text || '(空)'}
              </pre>
              <div className="mt-2 text-xs text-muted-foreground/80">
                provider: {plan.draft?.provider} · 合规打标:{' '}
                {(plan.draft?.complianceFlags || []).join(', ') || '无'}
              </div>
            </WorkspaceSection>
          </div>

          {/* ── 右 1/3：治理提案 + lift 验证 ───────────────────── */}
          <div className="grid gap-4">
            <WorkspaceSection
              icon={<ShieldCheck size={16} />}
              title={`③ 受治理动作提案（${(plan.proposals || []).length}）`}
            >
              {(plan.proposals || []).length === 0 ? (
                <p className="text-xs text-muted-foreground/80">暂无注册的受治理动作。</p>
              ) : (
                <div className="grid gap-1.5">
                  {(plan.proposals || []).map((p: any) => (
                    <div
                      key={p.checkId}
                      className="flex items-center justify-between gap-2 border-t py-2 first:border-t-0 first:pt-0"
                    >
                      <span className="min-w-0 text-[13px]">
                        <span
                          className={`font-bold ${ZONE_CLASS[p.zone] || 'text-muted-foreground/80'}`}
                        >
                          [{p.zone}]
                        </span>{' '}
                        {p.label} — {p.ok ? '已执行' : (p.blocked?.reasons || []).join(';')}
                      </span>
                      {p.needsApproval && (
                        <button
                          className="btn btn-outline btn-sm shrink-0"
                          onClick={() => approve(p.actionId)}
                        >
                          核准
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </WorkspaceSection>

            <WorkspaceSection title="④ lift 验证">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {plan.lift?.note || '—'}
              </p>
            </WorkspaceSection>
          </div>
        </div>
      )}
    </div>
  );
}
