-- 114 · GEO 实验统计闸（因果链第五环「能验证」）
--
-- 动机：此前 lift 判定是 verify-baseline>0 即 improved——1 次探测对 1 次探测也敢下
-- "内容有效"的结论，噪声冒充证据会把内容策略引向随机方向。
--
-- 变更：
--  ① status 增加 'insufficient-data'（任一臂探测 <5 次时的诚实状态，拒绝下结论）；
--  ② lift_ci 存统计评估全量（Newcombe 95%CI/两臂 Wilson 区间/design:'before-after'），
--     便于前端展示区间与口径、事后复算。
-- 方法为教科书标准（Wilson/Newcombe），实现在
-- services/api/src/modules/growth/experiment-stats.ts，纯函数可复算。
SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.growth_geo_experiment
  DROP CONSTRAINT IF EXISTS growth_geo_experiment_status_check;
ALTER TABLE rhautt_nexus.growth_geo_experiment
  ADD CONSTRAINT growth_geo_experiment_status_check
  CHECK (status IN ('baseline','content-linked','verifying','improved','no-change','regressed','killed','insufficient-data'));

ALTER TABLE rhautt_nexus.growth_geo_experiment
  ADD COLUMN IF NOT EXISTS lift_ci jsonb NOT NULL DEFAULT '{}'::jsonb;
