-- 107_everhot_site_category_base_mapping.sql
-- Bind Everhot 5011 website shelf categories to product-library base categories.
-- Product library remains the single product fact base; website categories are channel display taxonomy.

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
),
rename_orphan_assignments AS (
  UPDATE rhautt_nexus.site_product_assignments a
  SET website_category = '全热新风',
      updated_at = now()
  FROM everhot_sites s
  WHERE a.tenant_id = s.tenant_id
    AND a.site_id = s.site_id
    AND a.deleted_at IS NULL
    AND a.website_category = '全新新风'
  RETURNING a.id
)
UPDATE rhautt_nexus.site_product_categories c
SET status = 'inactive',
    deleted_at = coalesce(c.deleted_at, now()),
    updated_at = now(),
    description = concat_ws(E'\n', nullif(c.description, ''), 'reconciled-orphan-5011-everhot-category')
FROM everhot_sites s
WHERE c.tenant_id = s.tenant_id
  AND c.site_id = s.site_id
  AND c.deleted_at IS NULL
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM rhautt_nexus.site_product_categories p2
    WHERE p2.id = c.parent_id
      AND p2.tenant_id = c.tenant_id
      AND p2.site_id = c.site_id
      AND p2.deleted_at IS NULL
  );

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
),
base AS (
  SELECT child.*
  FROM rhautt_nexus.brand_product_categories child
  WHERE lower(child.brand_code) = 'everhot'
    AND child.deleted_at IS NULL
),
mapping(site_name, base_name, base_code) AS (
  VALUES
    ('家用', '家用', 'home'),
    ('商用', '商用', 'commercial'),
    ('热水系统', '热水系统', 'hot-water-system'),
    ('商用热水系统', '热水系统', 'hot-water-system'),
    ('家用中央空调', '家用中央空调', 'central-air-conditioning'),
    ('地暖系统', '地暖系统', 'floor-heating'),
    ('全热新风', '全热新风', 'total-heat-fresh-air'),
    ('燃气冷凝壁挂炉', '燃气冷凝壁挂炉', 'gas-condensing-wall-hung-boiler'),
    ('零冷水燃气热水器', '零冷水燃气热水器', 'zero-cold-water-gas-water-heater'),
    ('空气能热水器', '空气能热水器', 'air-source-water-heater'),
    ('容积式燃气热水器', '容积式燃气热水器', 'storage-gas-water-heater'),
    ('电热水器', '电热水器', 'electric-water-heater'),
    ('采暖热水两联供', '采暖热水两联供', 'heating-hot-water-combi')
),
resolved AS (
  SELECT DISTINCT ON (m.site_name)
    m.site_name,
    b.id AS base_category_id
  FROM mapping m
  JOIN base b
    ON b.name_cn = m.base_name
   AND b.code = m.base_code
  ORDER BY m.site_name, b.level DESC, b.sort_order ASC
)
UPDATE rhautt_nexus.site_product_categories c
SET mapped_base_category_id = r.base_category_id,
    updated_at = now(),
    description = concat_ws(E'\n', nullif(c.description, ''), 'mapped-to-product-library-category')
FROM everhot_sites s
JOIN resolved r ON true
WHERE c.tenant_id = s.tenant_id
  AND c.site_id = s.site_id
  AND c.deleted_at IS NULL
  AND r.site_name = c.name;
