/**
 * 市场增长段落路由（2026-08 三期 · 去冗余手术）。
 *
 * 本页曾有三层重复导航（侧栏/顶部 tabbar 都已覆盖这五个入口，页内又画了
 * 页头 + 模块 nav + 复读当前段名的装饰 hero）和一批写死的假数据
 * （hero 指标 8/24/92%、状态签「运行中/低风险」、「本周推进」「发布队列」，
 * 还有一个开发用的状态预览面板）。用户点名「越搞越乱 为什么弄了两层」——
 * 全部砍掉：本页只做段解析 + 渲染真数据工作区，导航职责归还侧栏与 tabbar。
 */

import { GrowthGeoWorkspace } from '../../../components/GrowthGeoWorkspace';
import { GeoExperimentPanel } from '../../../components/GeoExperimentPanel';
import { GeoIntelligencePanel } from '../../../components/GeoIntelligencePanel';
import { AiSwotPanel } from '../../../components/AiSwotPanel';
import { ScenarioLibraryPanel } from '../../../components/ScenarioLibraryPanel';
import { MarketingTaskCenter } from '../../../components/MarketingTaskCenter';
import { AiCostPanel } from '../../../components/AiCostPanel';
import { SentimentRadarPanel } from '../../../components/SentimentRadarPanel';
import { CampaignRoiPanel } from '../../../components/CampaignRoiPanel';
import WechatPublishingWorkspace from '../../../components/WechatPublishingWorkspace';
import ContentReviewWorkspace from '../../../components/ContentReviewWorkspace';

type GrowthSection = 'geo' | 'copywriter' | 'sentiment' | 'automation' | 'materials';
type WechatSection = 'wechat-accounts' | 'wechat-review' | 'wechat-drafts';

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

  return (
    <div className="page-container grid w-full max-w-none gap-4">
      {activeKey === 'geo' && (
        <>
          <MarketingTaskCenter brandSlug="rheem" />
          <GrowthGeoWorkspace />
          <AiCostPanel />
          {/* 选题上游：场景库 → prompt 簇（新品类冷启动入口） */}
          <ScenarioLibraryPanel brandSlug="rheem" />
          {/* 可测的 SWOT：由探测数据派生，非主观自评 */}
          <AiSwotPanel brandSlug="rheem" />
          <GeoIntelligencePanel brandSlug="rheem" />
          <GeoExperimentPanel brandSlug="rheem" />
        </>
      )}
      {/* copywriter/materials/content-assets/prompts 有专属路由页，不经此 catch-all */}
      {activeKey === 'sentiment' && <SentimentRadarPanel />}
      {activeKey === 'automation' && <CampaignRoiPanel />}
    </div>
  );
}
