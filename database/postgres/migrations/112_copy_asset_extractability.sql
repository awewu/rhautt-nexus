-- 112 · 文案资产增加可抽取性评估（GEO 因果链第三环「能被抽取引用」的生成时守卫）
--
-- 动机：写得再对，形态不可抽取（铺垫冗长/无直接回答句/整墙不分段）AI 引擎也引不动。
-- 生成时用启发式形态检查（services/api/src/modules/growth/content-extractability.ts）
-- 产出 {score, passed, checks, hints, basis} 存于此列，供审核界面排序与提示。
--
-- 诚实边界：形态启发式，通过≠必被引用（还取决于站点权威度等外因）；**不阻断生成**，
-- 形态差的草稿仍落库，由审核人决定——守卫的职责是让问题可见，不是替人做编辑决定。
SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.growth_copy_asset
  ADD COLUMN IF NOT EXISTS extractability jsonb NOT NULL DEFAULT '{}'::jsonb;
