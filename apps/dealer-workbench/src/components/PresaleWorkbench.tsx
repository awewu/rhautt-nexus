'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Cpu,
  FileText,
  Loader2,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import { presale } from '../lib/api';

/**
 * L4 售前专业度工作台：AI 问诊 → 选型计算(合规闸) → 报价。
 * 这是"技术支持止于售前"的门面（宪章 §1.2）。全部连真后端：
 *   diagnosis/painpoints/detect · design/projects + calc · quotation/generate
 * 合规闸如实展示：任一内核失败即 blocked，不放行不合格方案。
 */

interface CalcGate {
  blocked?: boolean;
  pass?: boolean;
  reason?: string | null;
}
interface CalcCoverage {
  expected?: number;
  computed?: number;
  failed?: string[];
}

export function PresaleWorkbench() {
  // 输入
  const [desc, setDesc] = useState('别墅三层，冬天冷夏天潮，想要全屋恒温恒湿舒适系统');
  const [city, setCity] = useState('上海');
  const [area, setArea] = useState(300);

  // 三步结果
  const [painpoints, setPainpoints] = useState<any | null>(null);
  const [gate, setGate] = useState<CalcGate | null>(null);
  const [coverage, setCoverage] = useState<CalcCoverage | null>(null);
  const [quote, setQuote] = useState<any | null>(null);

  const [step, setStep] = useState(0); // 0 未开始 1问诊 2选型 3报价
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAll() {
    setBusy(true);
    setError(null);
    setPainpoints(null);
    setGate(null);
    setCoverage(null);
    setQuote(null);
    try {
      // ① 问诊
      setStep(1);
      const p = await presale.detectPainpoints({ description: desc, area, city });
      setPainpoints(p?.data || p);

      // ② 选型：建项目 + 合规闸计算
      setStep(2);
      const proj = await presale.createProject({ name: `售前-${city}-${area}m²`, city, area });
      const pid = (proj as any).id || (proj as any).data?.id;
      const rooms = [
        { name: '客厅', area: Math.round(area * 0.2) },
        { name: '主卧', area: Math.round(area * 0.12) },
        { name: '次卧', area: Math.round(area * 0.1) },
      ];
      const calc: any = await presale.calc(pid, { area, city, rooms });
      setGate(calc.gate || calc.data?.gate || null);
      setCoverage(calc.coverage || calc.data?.coverage || null);

      // ③ 报价（仅在合规闸通过时才出，体现"不合规不报价"）
      setStep(3);
      const passed = (calc.gate || calc.data?.gate)?.pass;
      if (passed) {
        const q = await presale.generateQuote({
          area,
          city,
          systems: ['heating', 'freshAir', 'airConditioning'],
        });
        setQuote(q?.data || q);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '售前流程执行失败');
    } finally {
      setBusy(false);
    }
  }

  const gatePass = gate?.pass === true;

  return (
    <section className="card-elevated grid gap-4 p-4.5">
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">L4 客户赋能 · 售前专业度</p>
          <h2 className="workbench-section-header__title">AI 问诊 → 选型计算 → 报价</h2>
          <p className="workbench-section-header__description">
            一条售前闭环：识别客户痛点、跑暖通内核选型（含合规闸）、生成报价。合规闸不通过则不出报价。
          </p>
        </div>
      </div>

      {/* 输入 */}
      <div className="inset grid gap-3 p-4">
        <label className="grid gap-1.5">
          <span className="t-label">客户需求描述</span>
          <textarea
            className="input resize-y"
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2.5">
          <label className="grid gap-1.5">
            <span className="t-label">城市</span>
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <span className="t-label">面积 (m²)</span>
            <input
              className="input"
              type="number"
              value={area}
              onChange={(e) => setArea(Number(e.target.value) || 0)}
            />
          </label>
          <button className="btn btn-brand" onClick={runAll} disabled={busy || !desc.trim()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Stethoscope size={14} />}
            跑售前闭环
          </button>
        </div>
      </div>

      {error ? (
        <div className="inset text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      {/* 步骤时间线 */}
      <div className="grid grid-cols-3 gap-3">
        <StepCard
          n={1}
          icon={ClipboardList}
          title="AI 问诊"
          active={step >= 1}
          busy={busy && step === 1}
        >
          {painpoints ? (
            <div className="text-[12.5px] text-muted-foreground">
              自动识别 {(painpoints.autoDetected || []).length} 项 · 隐性{' '}
              {(painpoints.implicit || []).length} 项
              {(painpoints.autoDetected || []).length === 0 &&
              (painpoints.implicit || []).length === 0 ? (
                <div className="mt-1 text-muted-foreground/80">
                  （当前痛点库无匹配，需补充痛点规则）
                </div>
              ) : null}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/80">待执行</span>
          )}
        </StepCard>

        <StepCard
          n={2}
          icon={Cpu}
          title="选型计算 · 合规闸"
          active={step >= 2}
          busy={busy && step === 2}
        >
          {gate ? (
            <div className="text-[12.5px]">
              <div
                className={`flex items-center gap-1.5 font-bold ${gatePass ? 'text-success' : 'text-destructive'}`}
              >
                {gatePass ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {gatePass ? '合规通过' : '已阻断'}
              </div>
              <div className="mt-1 text-muted-foreground">
                内核覆盖 {coverage?.computed}/{coverage?.expected}
                {coverage?.failed?.length ? ` · 失败: ${coverage.failed.join(',')}` : ''}
              </div>
              {gate.reason ? (
                <div className="mt-0.5 text-destructive">{gate.reason}</div>
              ) : null}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/80">待执行</span>
          )}
        </StepCard>

        <StepCard n={3} icon={FileText} title="报价" active={step >= 3} busy={busy && step === 3}>
          {quote ? (
            <div className="text-[12.5px] text-muted-foreground">
              报价单 {quote.quoteId ? '#' + String(quote.quoteId).slice(0, 8) : ''} 已生成
              {quote.summary ? (
                <div className="mt-1">
                  {typeof quote.summary === 'string'
                    ? quote.summary.slice(0, 80)
                    : JSON.stringify(quote.summary).slice(0, 80)}
                </div>
              ) : null}
            </div>
          ) : step >= 3 && !gatePass ? (
            <span className="text-xs text-warning">
              合规闸未通过，不出报价（专业度红线）
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/80">待执行</span>
          )}
        </StepCard>
      </div>
    </section>
  );
}

function StepCard({
  n,
  icon: Icon,
  title,
  active,
  busy,
  children,
}: {
  n: number;
  icon: any;
  title: string;
  active: boolean;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`inset grid gap-2 border-l-[3px] p-3.5 ${active ? 'border-l-primary' : 'border-l-transparent opacity-55'}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`grid h-[22px] w-[22px] place-items-center rounded-full text-xs font-bold text-white ${active ? 'bg-primary' : 'bg-muted-foreground/40'}`}
        >
          {n}
        </div>
        <Icon size={15} className="text-primary" />
        <strong className="text-[13px] text-foreground">{title}</strong>
        {busy ? (
          <Loader2 size={13} className="ml-auto animate-spin text-primary" />
        ) : null}
      </div>
      {children}
    </div>
  );
}
