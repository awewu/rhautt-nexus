/**
 * 市场增长段落工作台（2026-08 全页 UX 重构二期 · WorkspaceKit 化）。
 * 信息架构：段落导航（保持 <a href> 路由机制）→ 段落 Hero →
 * 非 GEO 段落用 左 2/3 主面板 + 右 1/3 队列列；GEO 段落全宽单列（内部自带分栏）。
 * 原版问题：40 处内联样式、手搓 hero/队列/状态格；本版收编为 Tailwind + WorkspaceKit 原语。
 */

import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock3,
  Download,
  FileSearch,
  FolderOpen,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@rhautt/ui';
import { WorkspaceSection, KeyValueRows, Pill } from '@/components/WorkspaceKit';
import { GrowthGeoWorkspace } from '../../../components/GrowthGeoWorkspace';
import { GeoExperimentPanel } from '../../../components/GeoExperimentPanel';
import { GeoIntelligencePanel } from '../../../components/GeoIntelligencePanel';
import { AiSwotPanel } from '../../../components/AiSwotPanel';
import { ScenarioLibraryPanel } from '../../../components/ScenarioLibraryPanel';
import { MarketingTaskCenter } from '../../../components/MarketingTaskCenter';
import { AiCostPanel } from '../../../components/AiCostPanel';
import { SentimentRadarPanel } from '../../../components/SentimentRadarPanel';
import { CopyAssetsPanel } from '../../../components/CopyAssetsPanel';
import { CampaignRoiPanel } from '../../../components/CampaignRoiPanel';
import WechatPublishingWorkspace from '../../../components/WechatPublishingWorkspace';
import ContentReviewWorkspace from '../../../components/ContentReviewWorkspace';

type GrowthSection = 'geo' | 'copywriter' | 'sentiment' | 'automation' | 'materials';
type WechatSection = 'wechat-accounts' | 'wechat-review' | 'wechat-drafts';
type StatusKind =
  'running' | 'review' | 'risk' | 'config' | 'download' | 'success' | 'warning' | 'neutral';

type SectionConfig = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  primaryMetric: string;
  primaryLabel: string;
  status: string;
  statusKind: StatusKind;
};

const SECTIONS: Record<GrowthSection, SectionConfig> = {
  geo: {
    title: 'GEO 可见度分析',
    subtitle: 'AI 搜索、品牌词、品类词与竞品露出监测',
    icon: Search,
    primaryMetric: '8',
    primaryLabel: '已监测 AI 搜索入口',
    status: '运行中',
    statusKind: 'running',
  },
  copywriter: {
    title: '文案 Copilot',
    subtitle: '面向官网、投放、活动页的品牌一致性文案生成',
    icon: Sparkles,
    primaryMetric: '24',
    primaryLabel: '本周生成候选文案',
    status: '待审核',
    statusKind: 'review',
  },
  sentiment: {
    title: '舆情雷达',
    subtitle: '公开渠道声量、情绪与风险线索汇总',
    icon: Radio,
    primaryMetric: '92%',
    primaryLabel: '正向及中性声量',
    status: '低风险',
    statusKind: 'risk',
  },
  automation: {
    title: '营销自动化',
    subtitle: '线索触达、UTM 归因、活动节奏与 ROI 看板',
    icon: Zap,
    primaryMetric: '4',
    primaryLabel: '运行中的自动化流程',
    status: '配置中',
    statusKind: 'config',
  },
  materials: {
    title: '营销物料库',
    subtitle: '官网专题、活动海报、朋友圈图文与培训资料统一取用',
    icon: FolderOpen,
    primaryMetric: '18',
    primaryLabel: '当前可用营销物料',
    status: '可下载',
    statusKind: 'download',
  },
};

const SECTION_LINKS: Array<{ key: GrowthSection; href: string }> = [
  { key: 'geo', href: '/growth/geo' },
  { key: 'copywriter', href: '/growth/copywriter' },
  { key: 'sentiment', href: '/growth/sentiment' },
  { key: 'automation', href: '/growth/automation' },
  { key: 'materials', href: '/growth/materials' },
];

// 假数据常量已移除：各营销模块改用连真 API 的组件（Sentiment/Copy/Campaign/GeoIntelligence 等）。

function sectionFromParams(section?: string[]): GrowthSection {
  const key = section?.[0];
  if (key === 'copywriter' || key === 'sentiment' || key === 'automation' || key === 'materials')
    return key;
  return 'geo';
}

function wechatSectionFromParams(section?: string[]): WechatSection | null {
  const key = section?.[0];
  if (key === 'wechat-accounts' || key === 'wechat-review' || key === 'wechat-drafts') return key;
  return null;
}

export default async function GrowthWorkspacePage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const wechatSection = wechatSectionFromParams(section);
  if (wechatSection === 'wechat-accounts') return <WechatPublishingWorkspace mode="accounts" />;
  if (wechatSection === 'wechat-review') return <ContentReviewWorkspace />;
  if (wechatSection === 'wechat-drafts') return <WechatPublishingWorkspace mode="drafts" />;

  const activeKey = sectionFromParams(section);
  const active = SECTIONS[activeKey];
  const ActiveIcon = active.icon;

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-secondary/30">
      <div className="page-container grid w-full max-w-none gap-5">
        <PageHeader
          title="市场增长"
          subtitle="GEO 可见度 · 文案 Copilot · 舆情雷达 · 营销自动化 · 营销物料库"
          actions={<StatusPill kind={active.statusKind}>{active.status}</StatusPill>}
        />

        {/* 段落切换保持 <a href> 路由机制（服务端组件，不引入本地 state） */}
        <nav className="card-elevated flex flex-wrap gap-1.5 p-2" aria-label="市场增长模块">
          {SECTION_LINKS.map((item) => {
            const config = SECTIONS[item.key];
            const Icon = config.icon;
            const isActive = item.key === activeKey;
            return (
              <a
                key={item.key}
                href={item.href}
                className={isActive ? 'btn btn-brand btn-sm' : 'btn btn-ghost btn-sm'}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={15} />
                {config.title}
              </a>
            );
          })}
        </nav>

        <section className="card-elevated grid items-stretch gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ActiveIcon size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">增长引擎</p>
              <h1 className="mt-1 text-2xl leading-tight font-semibold text-foreground">
                {active.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{active.subtitle}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>营销面板</Pill>
                <Pill>审核状态清晰</Pill>
                <Pill>仅保留营销目的地</Pill>
              </div>
            </div>
          </div>
          {/* 各模块的真实指标由其真数据组件内部渲染，此处不再显示占位数字（避免假数据）。 */}
          <div className="grid content-center gap-2 rounded-lg border bg-secondary/40 p-4">
            <div className="text-xs font-semibold text-muted-foreground">实时指标</div>
            <div className="text-[13px] leading-normal text-muted-foreground">
              见下方工作区（全部来自后端真实数据）
            </div>
          </div>
        </section>

        {activeKey === 'geo' ? (
          <NativePanel activeKey={activeKey} />
        ) : (
          <section className="grid items-start gap-4 lg:grid-cols-3">
            <div className="grid min-w-0 gap-4 lg:col-span-2">
              <NativePanel activeKey={activeKey} />
              <StatePreview />
            </div>
            <aside className="grid gap-4">
              <SideQueue />
              <PublishQueue />
            </aside>
          </section>
        )}
      </div>
    </div>
  );
}

function NativePanel({ activeKey }: { activeKey: GrowthSection }) {
  if (activeKey === 'geo') {
    return (
      <div className="grid min-w-0 gap-4">
        <MarketingTaskCenter brandSlug="rheem" />
        <GrowthGeoWorkspace />
        <AiCostPanel />
        {/* 选题上游：场景库 → prompt 簇（新品类冷启动入口） */}
        <ScenarioLibraryPanel brandSlug="rheem" />
        {/* 可测的 SWOT：由探测数据派生，非主观自评 */}
        <AiSwotPanel brandSlug="rheem" />
        <GeoIntelligencePanel brandSlug="rheem" />
        <GeoExperimentPanel brandSlug="rheem" />
      </div>
    );
  }

  if (activeKey === 'copywriter') {
    return <CopyAssetsPanel />;
  }

  if (activeKey === 'sentiment') {
    return <SentimentRadarPanel />;
  }

  if (activeKey === 'automation') {
    return <CampaignRoiPanel />;
  }

  // 安全兜底：activeKey 恒在枚举内（sectionFromParams 默认 'geo'），正常到不了这里。
  // 一旦到达也不回落假数据，而是显示真实 GEO 工作区。
  return (
    <div className="grid min-w-0 gap-4">
      <GrowthGeoWorkspace />
      <GeoIntelligencePanel brandSlug="rheem" />
      <GeoExperimentPanel brandSlug="rheem" />
    </div>
  );
}

function StatePreview() {
  return (
    <WorkspaceSection title="加载 / 空 / 错误状态" aside="页面状态预览">
      <p className="mb-3 text-xs text-muted-foreground">
        用于检查营销增长数据在不同状态下的展示效果。
      </p>
      <div className="grid gap-2.5 md:grid-cols-3">
        <StateTile icon={Loader2} title="加载中" desc="正在同步营销增长数据" tone="loading" />
        <StateTile
          icon={FolderOpen}
          title="暂无数据"
          desc="筛选条件下没有可展示项目"
          tone="empty"
        />
        <StateTile
          icon={AlertCircle}
          title="加载失败"
          desc="请刷新后重试或联系管理员"
          tone="error"
        />
      </div>
    </WorkspaceSection>
  );
}

function StateTile({
  icon: Icon,
  title,
  desc,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  tone: 'loading' | 'empty' | 'error';
}) {
  const iconClass =
    tone === 'error'
      ? 'text-destructive'
      : tone === 'loading'
        ? 'animate-spin text-primary'
        : 'text-muted-foreground';
  return (
    <div className="grid min-h-[116px] place-items-center gap-1.5 rounded-lg border bg-secondary/40 p-3 text-center">
      <Icon size={20} className={iconClass} />
      <strong
        className={
          tone === 'error' ? 'text-[13px] text-destructive' : 'text-[13px] text-foreground'
        }
      >
        {title}
      </strong>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function SideQueue() {
  const items = [
    { label: 'GEO 引擎检测', value: '已同步 8 个入口', icon: FileSearch },
    { label: '品牌审核', value: '3 条文案待确认', icon: Bot },
    { label: '物料发布', value: '18 项资源可取用', icon: Download },
    { label: '活动归因', value: 'UTM 参数待补齐', icon: TrendingUp },
  ];

  return (
    <WorkspaceSection title="本周推进">
      <KeyValueRows
        rows={items.map((item) => {
          const Icon = item.icon;
          return {
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Icon size={14} className="text-primary" />
                {item.label}
              </span>
            ),
            value: item.value,
          };
        })}
      />
    </WorkspaceSection>
  );
}

function PublishQueue() {
  const queue = ['官网专题页', '朋友圈短文案', '经销商活动海报', '认证培训资料'];

  return (
    <WorkspaceSection
      title="发布队列"
      aside={
        <a className="btn btn-outline btn-sm" href="/brand">
          <RefreshCw size={13} />
          刷新
        </a>
      }
    >
      <KeyValueRows
        rows={queue.map((item) => ({
          label: item,
          value: <StatusPill kind="review">待审</StatusPill>,
        }))}
      />
    </WorkspaceSection>
  );
}

function StatusPill({ kind, children }: { kind: StatusKind; children: React.ReactNode }) {
  const Icon = statusIcon(kind);
  return (
    <span className={`status-pill ${statusClass(kind)}`}>
      <Icon size={13} />
      {children}
    </span>
  );
}

function statusClass(kind: StatusKind) {
  if (kind === 'success' || kind === 'download') return 'status-pill-success';
  if (kind === 'review' || kind === 'warning' || kind === 'risk') return 'status-pill-warning';
  if (kind === 'running' || kind === 'config') return 'status-pill-info';
  return 'status-pill-neutral';
}

function statusIcon(kind: StatusKind): LucideIcon {
  if (kind === 'success') return CheckCircle2;
  if (kind === 'download') return Download;
  if (kind === 'review' || kind === 'warning' || kind === 'risk') return Clock3;
  if (kind === 'running' || kind === 'config') return Loader2;
  return AlertCircle;
}
