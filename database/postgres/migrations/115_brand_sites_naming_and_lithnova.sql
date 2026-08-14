-- 115 · 品牌官网主数据更正：术语锁命名 + 补 Lithnova 站 + dev URL 对齐实际端口
--
-- 用户在工作台品牌官网 tab 上点名质疑，逐项核实出 095 种子的三处错误：
-- ① rhautt-group name_cn 为「瑞合舒适」——术语锁（AGENTS.md/brand-registry）规定
--    Rhautt Comfort 中文为「瑞合瑞德」（全称 瑞合瑞德暖通科技集团），「瑞合舒适」不在
--    任何权威命名里，属种子杜撰；
-- ② Lithnova 站缺席：apps/lithnova-cn 应用真实存在（brand-registry name_cn 瓦瑞节能、
--    域名 lithnova.com.cn），但主数据没有行 → 品牌官网管理台管不到它；
-- ③ dev URL 与各站 package.json 实际端口不符：rheem 实为 5014（种子写 5012）、
--    ruud 实为 5015（种子写 5013）。lithnova 实际 5013。
SET search_path TO rhautt_nexus, public;

-- ① 命名更正（幂等）
UPDATE rhautt_nexus.tenant_brand_sites
   SET name_cn = '瑞合瑞德', updated_at = now()
 WHERE code = 'rhautt-group' AND name_cn = '瑞合舒适';

-- ③ dev URL 对齐实际端口（幂等）
UPDATE rhautt_nexus.tenant_brand_sites
   SET development_url = 'http://localhost:5014', updated_at = now()
 WHERE code = 'rheem' AND development_url = 'http://localhost:5012';
UPDATE rhautt_nexus.tenant_brand_sites
   SET development_url = 'http://localhost:5015', updated_at = now()
 WHERE code = 'ruud' AND development_url = 'http://localhost:5013';

-- ② 补 Lithnova 行（幂等；命名/域名取自 brand-registry，端口取自 apps/lithnova-cn/package.json）
WITH site_tenants AS (
  SELECT id AS tenant_id FROM rhautt_nexus.tenants WHERE code = 'DEFAULT' AND status = 'active'
)
INSERT INTO rhautt_nexus.tenant_brand_sites (
  tenant_id, code, name_cn, name_en, app_key, delivery_type,
  development_url, production_url, sort_order, status, site_note,
  child_brand_codes, deleted_by, deleted_at, created_at, updated_at
)
SELECT
  site_tenants.tenant_id, 'lithnova', '瓦瑞节能', 'Lithnova', 'lithnova-cn', 'self_hosted',
  'http://localhost:5013', 'https://www.lithnova.com.cn', 40, 'active',
  'Lithnova energy-storage brand site (板块一 · 独立设备品牌孵化).',
  '[]'::jsonb, NULL, NULL, now(), now()
FROM site_tenants
WHERE NOT EXISTS (
  SELECT 1 FROM rhautt_nexus.tenant_brand_sites t
   WHERE t.tenant_id = site_tenants.tenant_id AND t.code = 'lithnova'
);
