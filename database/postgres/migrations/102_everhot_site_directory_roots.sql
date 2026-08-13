-- 102_everhot_site_directory_roots.sql
-- Normalize the current Everhot starter website directory from a flat legacy list
-- into editable roots (家用 / 商用) plus second-level directories.
-- This is seed/data-shaping only: the UI and API still allow CRUD on every level.

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
),
root_seed AS (
  SELECT tenant_id, site_id, 'residential' AS code, '家用' AS name, 0 AS sort_order FROM everhot_sites
  UNION ALL
  SELECT tenant_id, site_id, 'commercial' AS code, '商用' AS name, 1 AS sort_order FROM everhot_sites
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
  code,
  name,
  code,
  NULL,
  sort_order,
  true,
  false,
  'active',
  'everhot-starter-directory-root'
FROM root_seed
ON CONFLICT DO NOTHING;

WITH roots AS (
  SELECT
    tenant_id,
    site_id,
    min(id::text) FILTER (WHERE name = '家用' AND parent_id IS NULL AND deleted_at IS NULL)::uuid AS residential_id,
    min(id::text) FILTER (WHERE name = '商用' AND parent_id IS NULL AND deleted_at IS NULL)::uuid AS commercial_id
  FROM rhautt_nexus.site_product_categories
  WHERE deleted_at IS NULL
  GROUP BY tenant_id, site_id
),
everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND deleted_at IS NULL
)
UPDATE rhautt_nexus.site_product_categories c
SET
  parent_id = CASE
    WHEN c.name ~ '(商用|中央热水|中央空调|全空气|工程|商办|酒店|学校|医院)' THEN roots.commercial_id
    ELSE roots.residential_id
  END,
  level = 2,
  sort_order = CASE
    WHEN c.name ~ '(壁挂炉)' THEN 10
    WHEN c.name ~ '(采暖|地暖)' THEN 20
    WHEN c.name ~ '(储水式|燃气容积式|热泵热水器|热水)' THEN 30
    WHEN c.name ~ '(净水|软水|水处理)' THEN 40
    WHEN c.name ~ '(五恒|空调|全空气)' THEN 50
    WHEN c.name ~ '(新风|除湿)' THEN 60
    WHEN c.name ~ '(智能|控制)' THEN 70
    ELSE c.sort_order
  END,
  updated_at = now()
FROM everhot_sites s
JOIN roots ON roots.tenant_id = s.tenant_id AND roots.site_id = s.site_id
WHERE c.tenant_id = s.tenant_id
  AND c.site_id = s.site_id
  AND c.deleted_at IS NULL
  AND c.parent_id IS NULL
  AND c.name NOT IN ('家用', '商用');
