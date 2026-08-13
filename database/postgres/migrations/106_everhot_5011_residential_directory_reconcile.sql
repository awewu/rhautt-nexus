-- 106_everhot_5011_residential_directory_reconcile.sql
-- Reconcile old Everhot starter residential directories to the real 5011
-- residential navigation, preserving existing product assignments.

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
),
mapping AS (
  SELECT tenant_id, site_id, '热泵热水器' AS old_name, '空气能热水器' AS new_name
  FROM everhot_sites
  UNION ALL
  SELECT tenant_id, site_id, '燃气容积式热水器', '容积式燃气热水器'
  FROM everhot_sites
  UNION ALL
  SELECT tenant_id, site_id, '五恒恒温空调', '家用中央空调'
  FROM everhot_sites
  UNION ALL
  SELECT tenant_id, site_id, '储水式电热水器', '电热水器'
  FROM everhot_sites
  UNION ALL
  SELECT tenant_id, site_id, '新风除湿', '全热新风'
  FROM everhot_sites
  UNION ALL
  SELECT tenant_id, site_id, '净水软水水处理', '热水系统'
  FROM everhot_sites
  UNION ALL
  SELECT tenant_id, site_id, '智能控制', '采暖与制冷'
  FROM everhot_sites
)
UPDATE rhautt_nexus.site_product_assignments a
SET
  website_category = mapping.new_name,
  updated_at = now()
FROM mapping
WHERE a.tenant_id = mapping.tenant_id
  AND a.site_id = mapping.site_id
  AND a.deleted_at IS NULL
  AND a.website_category = mapping.old_name;

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
),
old_names AS (
  SELECT tenant_id, site_id, old_name
  FROM (
    SELECT tenant_id, site_id, '热泵热水器' AS old_name FROM everhot_sites
    UNION ALL SELECT tenant_id, site_id, '燃气容积式热水器' FROM everhot_sites
    UNION ALL SELECT tenant_id, site_id, '五恒恒温空调' FROM everhot_sites
    UNION ALL SELECT tenant_id, site_id, '储水式电热水器' FROM everhot_sites
    UNION ALL SELECT tenant_id, site_id, '新风除湿' FROM everhot_sites
    UNION ALL SELECT tenant_id, site_id, '净水软水水处理' FROM everhot_sites
    UNION ALL SELECT tenant_id, site_id, '智能控制' FROM everhot_sites
  ) rows
),
duplicate_second_levels AS (
  SELECT c.tenant_id, c.site_id, c.name AS old_name
  FROM rhautt_nexus.site_product_categories c
  JOIN everhot_sites s ON s.tenant_id = c.tenant_id AND s.site_id = c.site_id
  WHERE c.deleted_at IS NULL
    AND c.name IN ('采暖与制冷', '热水系统')
    AND c.code LIKE 'category-%'
)
UPDATE rhautt_nexus.site_product_categories c
SET
  status = 'inactive',
  deleted_at = coalesce(c.deleted_at, now()),
  updated_at = now(),
  description = coalesce(c.description, '') || CASE WHEN coalesce(c.description, '') = '' THEN '' ELSE E'\n' END || 'reconciled-to-5011-residential-navigation'
FROM (
  SELECT * FROM old_names
  UNION ALL
  SELECT * FROM duplicate_second_levels
) targets
WHERE c.tenant_id = targets.tenant_id
  AND c.site_id = targets.site_id
  AND c.name = targets.old_name
  AND c.deleted_at IS NULL
  AND (
    c.code LIKE 'category-%'
    OR c.name IN ('热泵热水器', '燃气容积式热水器', '五恒恒温空调', '储水式电热水器', '新风除湿', '净水软水水处理', '智能控制')
  );
