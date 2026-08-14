-- 113 · 场景角色扩充规格侧 B2B（engineer=MEP/暖通设计工程师，contractor=机电总包/暖通承包商）
--
-- 动机（GEO 因果链第四环「问对问题」）：工程师/总包在"写进标书之前"问 AI 的
-- 规格段问题（COP/IPLV 核对、招标条款、BIM 族文件、ASHRAE 90.1、验收资料），
-- 赢了=进规格书=后端成交几乎锁定——商业价值高于 C 端泛问。此前场景库只有
-- C 端四角色，audience CHECK 约束会拒绝 B2B 播种。
SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.growth_scenario
  DROP CONSTRAINT IF EXISTS growth_scenario_audience_check;
ALTER TABLE rhautt_nexus.growth_scenario
  ADD CONSTRAINT growth_scenario_audience_check
  CHECK (audience IN ('owner','decorator','designer','installer','engineer','contractor'));
