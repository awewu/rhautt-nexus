'use client';

/**
 * 营销战略路线图（2026-08 全页 UX 重构 · WorkspaceKit 化）。
 * 重排：上部 lg:grid-cols-3 = 左 2/3 关键路径打法 + 右 1/3（里程碑/品牌定位/使命愿景）；
 * 下部全宽路线图矩阵（泳道 × 两阶段），消灭 35 处内联样式。
 */

import { Fragment } from 'react';
import { PageHeader } from '@rhautt/ui';
import { Target, Flag, Rocket, Route } from 'lucide-react';
import { WorkspaceSection, Pill } from '@/components/WorkspaceKit';

const POSITIONING = [
  { brand: 'RHEEM · EVERHOT', pos: '大户型选恒热 · 商用级大水量' },
  { brand: 'RUUD 瑞德', pos: '北美健康空调 · 商用采暖' },
];
const PLAYS = [
  {
    t: 'B 端驱动，专业立身',
    d: '强化瑞德宜居家与网点建设；数字化 + 产品内容营销，构建自媒体及 KOL 矩阵，垂直分类关键影响者推广，渠道战略合作，奠定专业口碑。',
  },
  { t: '价值锚定', d: '超长质保，树立高端价值标杆。' },
  {
    t: '差异化破局，精准制胜',
    d: '聚焦大宅 / 酒店 / 餐饮 / 康养；打造技术工程师赋能体系；通过混动热水器应用推广，驱动大宅机电渠道破局，构建专业赛道「隐形冠军」。',
  },
  { t: '专业切入', d: '设计院 / 行业 / 给排水等意见领袖，打造 B 端专业认知。' },
];
const CATEGORIES = ['商用热水', '中央热水', '采暖', '空调'];
const LANES = [
  {
    lane: '产品 / 渠道',
    phase1: [
      '战略市场：核心市场标杆，「产品出样·服务标准·营销动作」三统一',
      '渠道策略：自有渠道建设 100 家，开拓氟机/水机渠道热水分销',
      '传播策略：内容聚焦产品卖点与品牌传承，影响者精准渗透',
      '能力建设：技术服务组织专业能力，认证工程师覆盖核心市场',
    ],
    phase2: [
      '产品进化：空调/采暖/热水/能源管理智能联动，构建「QUANTUM 智能舒适生态系统」',
      '品牌升级：将 RUUD 瑞德宜居家 打造为「高端全屋舒适系统」的代名词',
    ],
  },
  {
    lane: '营销策略',
    phase1: [
      '战略市场：引进酒店高质量经销商，品牌入库 TOP50 酒店集团',
      '渠道策略：大宅机电 / 集采渠道深度开发',
      '样板打造：大宅热水切入，构建可复制的商业渠道模型',
      '能力建设：技术服务专项组织，技术选型标准，工程交付能力',
    ],
    phase2: [
      '产品进化：推动可持续战略，70% 冷凝化 · 70% 热泵化 · 70% 智能化',
      '品牌升级：大宅渠道突破，复制至酒店 / 餐饮 / 科技住宅',
    ],
  },
];
const CREED = [
  {
    k: '使命',
    v: '以「创新高效低碳技术 + 数智化服务」为核，为每一个空间赋予更舒适、高效、可持续的生活环境',
  },
  { k: '愿景', v: '成为受人尊重的水和空气产品及解决方案可持续发展的引领者' },
  { k: '价值观', v: '客户满意 ┃ 股东满意 ┃ 社会满意 ┃ 员工满意' },
];

export default function StrategyRoadmapPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="营销战略路线图 · Rhautt Group"
        subtitle="品牌定位 · 关键路径 · 2026–2030 里程碑 —— 全员对齐方向(源自品牌涡轮&营销战略路线图)"
      />

      <div className="mb-4 grid items-start gap-4 lg:grid-cols-3">
        {/* ── 左 2/3：关键路径打法主区 ─────────────────────────────── */}
        <WorkspaceSection
          icon={<Route size={16} />}
          title="关键路径 · 战略打法"
          className="lg:col-span-2"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {PLAYS.map((p, i) => (
              <div key={p.t} className="rounded-lg border bg-secondary/40 p-3.5">
                <div className="text-[13px] font-bold">
                  <span className="text-primary tabular-nums">{i + 1}.</span> {p.t}
                </div>
                <p className="m-0 mt-1.5 text-xs leading-6 text-muted-foreground">{p.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Pill key={c}>{c}</Pill>
            ))}
          </div>
        </WorkspaceSection>

        {/* ── 右 1/3：里程碑 / 定位 / 使命愿景 ─────────────────────── */}
        <div className="grid gap-4">
          <WorkspaceSection icon={<Flag size={16} className="text-primary" />} title="里程碑目标">
            <div className="rounded-lg border bg-secondary/60 px-4 py-4 text-center">
              <div className="text-[26px] leading-none font-extrabold text-primary tabular-nums">
                2030 · 销售额 5 亿
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                成为受人尊重的热水解决方案可持续发展的引领者
              </div>
            </div>
          </WorkspaceSection>

          <WorkspaceSection icon={<Target size={16} />} title="品牌定位">
            <div className="grid gap-2.5">
              {POSITIONING.map((p) => (
                <div key={p.brand} className="border-l-2 border-primary pl-3">
                  <div className="text-[13px] font-bold text-primary">{p.brand}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{p.pos}</div>
                </div>
              ))}
            </div>
          </WorkspaceSection>

          <WorkspaceSection icon={<Flag size={16} />} title="使命 · 愿景 · 价值观">
            <div className="grid gap-2.5">
              {CREED.map((c) => (
                <div key={c.k} className="text-xs leading-6 text-muted-foreground">
                  <strong className="mr-2 text-primary">{c.k}</strong>
                  {c.v}
                </div>
              ))}
            </div>
          </WorkspaceSection>
        </div>
      </div>

      {/* ── 全宽：路线图矩阵（两泳道 × 两阶段） ─────────────────────── */}
      <WorkspaceSection icon={<Rocket size={16} />} title="路线图 · 两阶段推进">
        <div className="grid items-stretch gap-3 md:grid-cols-[120px_1fr_1fr]">
          <div className="hidden md:block" />
          <div className="py-1.5 text-center text-[13px] font-bold text-primary tabular-nums">
            2026–2028 · 聚焦突破，打造样板
          </div>
          <div className="py-1.5 text-center text-[13px] font-bold text-primary tabular-nums">
            2029–2030 · 生态构建，品牌引领
          </div>
          {LANES.map((l) => (
            <Fragment key={l.lane}>
              <div className="flex items-center text-[13px] font-bold">{l.lane}</div>
              <div className="rounded-lg border p-3.5">
                <ul className="m-0 list-disc pl-4 text-xs leading-6 text-muted-foreground">
                  {l.phase1.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border bg-secondary/60 p-3.5">
                <ul className="m-0 list-disc pl-4 text-xs leading-6 text-muted-foreground">
                  {l.phase2.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            </Fragment>
          ))}
        </div>
      </WorkspaceSection>
    </div>
  );
}
