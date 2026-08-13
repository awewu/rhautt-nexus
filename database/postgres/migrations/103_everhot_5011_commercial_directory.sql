-- 103_everhot_5011_commercial_directory.sql
-- Seed Everhot 5011 commercial website navigation into the existing editable
-- site_product_categories table. This keeps the official-site directory as DB
-- data, so the dealer workbench CRUD and public site consumption share one tree.

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
),
commercial_root_seed AS (
  SELECT tenant_id, site_id
  FROM everhot_sites
)
INSERT INTO rhautt_nexus.site_product_categories (
  tenant_id,
  site_id,
  parent_id,
  level,
  code,
  name,
  slug,
  menu_group,
  sort_order,
  is_visible,
  is_featured,
  status,
  description
)
SELECT
  tenant_id,
  site_id,
  NULL::uuid,
  1,
  'commercial',
  '商用',
  'commercial',
  'commercial',
  20,
  true,
  false,
  'active',
  '5011 Everhot official navigation root'
FROM commercial_root_seed
ON CONFLICT DO NOTHING;

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
),
commercial_roots AS (
  SELECT c.tenant_id, c.site_id, c.id AS root_id
  FROM rhautt_nexus.site_product_categories c
  JOIN everhot_sites s ON s.tenant_id = c.tenant_id AND s.site_id = c.site_id
  WHERE c.deleted_at IS NULL
    AND c.parent_id IS NULL
    AND c.code = 'commercial'
),
second_level_seed AS (
  SELECT tenant_id, site_id, root_id, 'heating-cooling' AS code, '商用采暖与制冷' AS name, 'heating-cooling' AS slug, 10 AS sort_order
  FROM commercial_roots
  UNION ALL
  SELECT tenant_id, site_id, root_id, 'water-heating' AS code, '商用热水系统' AS name, 'water-heating' AS slug, 20 AS sort_order
  FROM commercial_roots
)
INSERT INTO rhautt_nexus.site_product_categories (
  tenant_id,
  site_id,
  parent_id,
  level,
  code,
  name,
  slug,
  menu_group,
  sort_order,
  is_visible,
  is_featured,
  status,
  description
)
SELECT
  tenant_id,
  site_id,
  root_id,
  2,
  code,
  name,
  slug,
  'commercial',
  sort_order,
  true,
  false,
  'active',
  '5011 Everhot official navigation second level'
FROM second_level_seed
ON CONFLICT DO NOTHING;

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
),
commercial_roots AS (
  SELECT c.tenant_id, c.site_id, c.id AS root_id
  FROM rhautt_nexus.site_product_categories c
  JOIN everhot_sites s ON s.tenant_id = c.tenant_id AND s.site_id = c.site_id
  WHERE c.deleted_at IS NULL
    AND c.parent_id IS NULL
    AND c.code = 'commercial'
),
second_levels AS (
  SELECT c.tenant_id, c.site_id, c.id, c.code
  FROM rhautt_nexus.site_product_categories c
  JOIN commercial_roots r ON r.tenant_id = c.tenant_id AND r.site_id = c.site_id AND r.root_id = c.parent_id
  WHERE c.deleted_at IS NULL
    AND c.code IN ('heating-cooling', 'water-heating')
),
third_level_seed AS (
  SELECT tenant_id, site_id, id AS parent_id, 'air-source-heat-pump' AS code, '商用风冷热泵机组' AS name, 'air-source-heat-pump' AS slug, 10 AS sort_order
  FROM second_levels WHERE code = 'heating-cooling'
  UNION ALL
  SELECT tenant_id, site_id, id, 'modular-chiller', '商用中央空调（模块机）', 'modular-chiller', 20
  FROM second_levels WHERE code = 'heating-cooling'
  UNION ALL
  SELECT tenant_id, site_id, id, 'gas-boiler', '商用燃气采暖炉', 'gas-boiler', 30
  FROM second_levels WHERE code = 'heating-cooling'
  UNION ALL
  SELECT tenant_id, site_id, id, 'fresh-air', '商用新风机组', 'fresh-air', 40
  FROM second_levels WHERE code = 'heating-cooling'
  UNION ALL
  SELECT tenant_id, site_id, id, 'building-controls', '楼宇智能控制', 'building-controls', 50
  FROM second_levels WHERE code = 'heating-cooling'
  UNION ALL
  SELECT tenant_id, site_id, id, 'preventive-maintenance', '预防性维护服务', 'preventive-maintenance', 60
  FROM second_levels WHERE code = 'heating-cooling'
  UNION ALL
  SELECT tenant_id, site_id, id, 'high-capacity-gas-water-heater', '大功率燃气热水炉', 'high-capacity', 10
  FROM second_levels WHERE code = 'water-heating'
  UNION ALL
  SELECT tenant_id, site_id, id, 'commercial-air-source-water-heater', '商用空气能机组', 'air-source', 20
  FROM second_levels WHERE code = 'water-heating'
  UNION ALL
  SELECT tenant_id, site_id, id, 'storage-tank', '大容积储热水箱', 'storage-tank', 30
  FROM second_levels WHERE code = 'water-heating'
  UNION ALL
  SELECT tenant_id, site_id, id, 'central-hot-water-station', '楼宇集中热水站', 'central-station', 40
  FROM second_levels WHERE code = 'water-heating'
  UNION ALL
  SELECT tenant_id, site_id, id, 'backup-system', '串联备用系统', 'backup-system', 50
  FROM second_levels WHERE code = 'water-heating'
  UNION ALL
  SELECT tenant_id, site_id, id, 'remote-operations', '远程运维平台', 'remote-operations', 60
  FROM second_levels WHERE code = 'water-heating'
)
INSERT INTO rhautt_nexus.site_product_categories (
  tenant_id,
  site_id,
  parent_id,
  level,
  code,
  name,
  slug,
  menu_group,
  sort_order,
  is_visible,
  is_featured,
  status,
  description
)
SELECT
  tenant_id,
  site_id,
  parent_id,
  3,
  code,
  name,
  slug,
  'commercial',
  sort_order,
  true,
  false,
  'active',
  '5011 Everhot official navigation third level'
FROM third_level_seed
ON CONFLICT DO NOTHING;
