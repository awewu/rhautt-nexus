'use client';

/**
 * 集团战略概览（2026-08 全页 UX 重构 · WorkspaceKit 化）。
 * 重排：左 2/3 = 关于我们 + 三大技术支柱（ProgressStat 化）+ 场景 Pill；
 * 右 1/3 = 品牌矩阵 + 使命/愿景/价值观，消灭全宽单列留白与 29 处内联样式。
 */

import { PageHeader } from '@rhautt/ui';
import { Flame, Wind, Droplet, Cpu, Building2, Compass, Landmark } from 'lucide-react';
import { WorkspaceSection, Pill } from '@/components/WorkspaceKit';

const BRANDS = [
  { code: 'Rheem', cn: '瑞美', desc: '美国百年供暖与热水领导者' },
  { code: 'RUUD', cn: '瑞德', desc: '北美健康空调 · 大宅舒适' },
  { code: 'EVERHOT', cn: '恒热', desc: '大户型热水 · 商用级大水量' },
  { code: 'RYSNOVA', cn: '瑞诺瓦', desc: '经销商赋能软件与数智化' },
];
const PILLARS = [
  { icon: <Flame size={18} />, v: '70%', k: '产品冷凝化', d: '高效冷凝技术迭代' },
  { icon: <Wind size={18} />, v: '70%', k: '产品热泵化', d: '低碳热泵节能' },
  { icon: <Cpu size={18} />, v: '70%', k: '智能控制', d: '搭载智能控制系统' },
];
const SCENES = [
  { icon: <Droplet size={16} />, t: '舒适热水采暖' },
  { icon: <Wind size={16} />, t: '健康空调' },
  { icon: <Droplet size={16} />, t: '全屋净水' },
  { icon: <Cpu size={16} />, t: '智能控制' },
];
const CREED = [
  {
    k: '我们的使命',
    v: '以创新高效的低碳技术与数智化服务为核心，为每一个空间赋予更舒适、高效、可持续的生活环境。',
  },
  { k: '我们的愿景', v: '成为受人尊重的水和空气产品及解决方案可持续发展的引领者。' },
  { k: '我们的价值观', v: '客户满意 ┃ 股东满意 ┃ 社会满意 ┃ 员工满意' },
];

export default function StrategyOverviewPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="集团战略概览 · 瑞合瑞德集团 Rhautt Group"
        subtitle="三十载辉煌历程 · 全球暖通舒适家居领导者 —— 战略方向对齐(源自品牌涡轮&营销战略路线图)"
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* ── 左 2/3：集团叙事 + 技术支柱主区 ─────────────────────── */}
        <div className="grid gap-4 lg:col-span-2">
          <WorkspaceSection icon={<Building2 size={16} />} title="关于我们">
            <p className="m-0 text-[13px] leading-7 text-muted-foreground">
              瑞合瑞德集团（Rhautt Group）前身为全球供暖与热水领域百年领导者——美国瑞美（Rheem）集团于
              1994 年在中国设立的独资公司。
              长期为家用、商用及工业领域提供高效稳定的热水、采暖、净水及空调系统解决方案，以卓越技术创新与产品可靠性享誉国际市场。
              我们打造覆盖<strong>舒适热水采暖 · 健康空调 · 全屋净水 · 智能控制</strong>
              的一站式全场景人居解决方案， 搭建从研发、智造、渠道销售到全周期运维的完整产业链闭环。
            </p>
          </WorkspaceSection>

          <WorkspaceSection
            icon={<Compass size={16} />}
            title="可持续发展三大技术支柱"
            aside="以低碳高效技术迭代驱动产业升级"
          >
            <div className="grid gap-3 md:grid-cols-3">
              {PILLARS.map((p) => (
                <div key={p.k} className="rounded-lg border bg-secondary/60 px-4 py-4 text-center">
                  <div className="mb-1.5 flex justify-center text-primary">{p.icon}</div>
                  <div className="text-[30px] leading-none font-extrabold text-primary tabular-nums">
                    {p.v}
                  </div>
                  <div className="mt-2 text-[13px] font-bold">{p.k}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{p.d}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {SCENES.map((s) => (
                <Pill key={s.t}>
                  <span className="inline-flex items-center gap-1.5">
                    {s.icon}
                    {s.t}
                  </span>
                </Pill>
              ))}
            </div>
          </WorkspaceSection>
        </div>

        {/* ── 右 1/3：品牌矩阵 + 使命愿景价值观 ────────────────────── */}
        <div className="grid gap-4">
          <WorkspaceSection icon={<Landmark size={16} />} title="品牌矩阵">
            <div className="grid gap-2">
              {BRANDS.map((b) => (
                <div key={b.code} className="rounded-lg border px-3.5 py-3">
                  <div className="text-[13px] font-bold text-primary">
                    {b.code} <span className="text-foreground">{b.cn}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{b.desc}</div>
                </div>
              ))}
            </div>
          </WorkspaceSection>

          <WorkspaceSection icon={<Compass size={16} />} title="使命 · 愿景 · 价值观">
            <div className="grid gap-3">
              {CREED.map((c) => (
                <div key={c.k} className="border-l-2 border-primary pl-3">
                  <div className="text-[13px] font-bold text-primary">{c.k}</div>
                  <p className="m-0 mt-1 text-xs leading-6 text-muted-foreground">{c.v}</p>
                </div>
              ))}
            </div>
          </WorkspaceSection>
        </div>
      </div>
    </div>
  );
}
