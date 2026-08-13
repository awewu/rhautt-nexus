-- 105_everhot_5011_residential_directory.sql
-- Seed Everhot 5011 residential website navigation into the existing editable
-- site_product_categories table.

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
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
  'residential',
  '家用',
  'residential',
  'residential',
  10,
  true,
  false,
  'active',
  '5011 Everhot official navigation root'
FROM everhot_sites
ON CONFLICT DO NOTHING;

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
),
residential_roots AS (
  SELECT c.tenant_id, c.site_id, c.id AS root_id
  FROM rhautt_nexus.site_product_categories c
  JOIN everhot_sites s ON s.tenant_id = c.tenant_id AND s.site_id = c.site_id
  WHERE c.deleted_at IS NULL
    AND c.parent_id IS NULL
    AND c.code = 'residential'
),
second_level_seed AS (
  SELECT tenant_id, site_id, root_id, 'heating-cooling' AS code, '采暖与制冷' AS name, 'heating-cooling' AS slug, 10 AS sort_order
  FROM residential_roots
  UNION ALL
  SELECT tenant_id, site_id, root_id, 'water-heating' AS code, '热水系统' AS name, 'water-heating' AS slug, 20 AS sort_order
  FROM residential_roots
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
  'residential',
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
residential_roots AS (
  SELECT c.tenant_id, c.site_id, c.id AS root_id
  FROM rhautt_nexus.site_product_categories c
  JOIN everhot_sites s ON s.tenant_id = c.tenant_id AND s.site_id = c.site_id
  WHERE c.deleted_at IS NULL
    AND c.parent_id IS NULL
    AND c.code = 'residential'
),
second_levels AS (
  SELECT c.tenant_id, c.site_id, c.id, c.code
  FROM rhautt_nexus.site_product_categories c
  JOIN residential_roots r ON r.tenant_id = c.tenant_id AND r.site_id = c.site_id AND r.root_id = c.parent_id
  WHERE c.deleted_at IS NULL
    AND c.code IN ('heating-cooling', 'water-heating')
),
third_level_seed AS (
  SELECT tenant_id, site_id, id AS parent_id, 'central-air-conditioning' AS code, '家用中央空调' AS name, 'air-conditioning' AS slug, 10 AS sort_order
  FROM second_levels WHERE code = 'heating-cooling'
  UNION ALL
  SELECT tenant_id, site_id, id, 'geothermal-system', '地暖系统', 'underfloor-heating', 20
  FROM second_levels WHERE code = 'heating-cooling'
  UNION ALL
  SELECT tenant_id, site_id, id, 'fresh-air', '全热新风', 'fresh-air', 30
  FROM second_levels WHERE code = 'heating-cooling'
  UNION ALL
  SELECT tenant_id, site_id, id, 'wall-hung-boiler', '燃气冷凝壁挂炉', 'wall-hung-boiler', 10
  FROM second_levels WHERE code = 'water-heating'
  UNION ALL
  SELECT tenant_id, site_id, id, 'zero-cold-water-gas-water-heater', '零冷水燃气热水器', 'zero-cold-water-gas-water-heater', 20
  FROM second_levels WHERE code = 'water-heating'
  UNION ALL
  SELECT tenant_id, site_id, id, 'air-source-water-heater', '空气能热水器', 'air-source-water-heater', 30
  FROM second_levels WHERE code = 'water-heating'
  UNION ALL
  SELECT tenant_id, site_id, id, 'storage-gas-water-heater', '容积式燃气热水器', 'storage-gas-water-heater', 40
  FROM second_levels WHERE code = 'water-heating'
  UNION ALL
  SELECT tenant_id, site_id, id, 'electric-water-heater', '电热水器', 'electric-water-heater', 50
  FROM second_levels WHERE code = 'water-heating'
  UNION ALL
  SELECT tenant_id, site_id, id, 'heating-hot-water-dual-supply', '采暖热水两联供', 'heating-hot-water-dual-supply', 60
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
  'residential',
  sort_order,
  true,
  false,
  'active',
  '5011 Everhot official navigation third level'
FROM third_level_seed
ON CONFLICT DO NOTHING;
