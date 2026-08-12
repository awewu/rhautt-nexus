-- 104_everhot_5011_commercial_directory_reconcile.sql
-- Reconcile old Everhot starter commercial directories to the real 5011
-- commercial navigation, preserving product assignments by moving them to the
-- matching official directory before hiding the old seed categories.

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
),
mapping AS (
  SELECT tenant_id, site_id, 'category-2' AS old_code, '中央热水' AS old_name, '商用热水系统' AS new_name
  FROM everhot_sites
  UNION ALL
  SELECT tenant_id, site_id, 'category-3' AS old_code, '中央空调全空气' AS old_name, '商用采暖与制冷' AS new_name
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
mapping AS (
  SELECT tenant_id, site_id, 'category-2' AS old_code
  FROM everhot_sites
  UNION ALL
  SELECT tenant_id, site_id, 'category-3' AS old_code
  FROM everhot_sites
)
UPDATE rhautt_nexus.site_product_categories c
SET
  status = 'inactive',
  deleted_at = coalesce(c.deleted_at, now()),
  updated_at = now(),
  description = coalesce(c.description, '') || CASE WHEN coalesce(c.description, '') = '' THEN '' ELSE E'\n' END || 'reconciled-to-5011-commercial-navigation'
FROM mapping
WHERE c.tenant_id = mapping.tenant_id
  AND c.site_id = mapping.site_id
  AND c.code = mapping.old_code
  AND c.deleted_at IS NULL;
