-- 101_seed_common_product_categories.sql
-- Common product-library taxonomy used by all brands.

WITH seed_roots(code, name_cn, slug, sort_order) AS (
  VALUES
    ('residential', '家用', 'residential', 10),
    ('commercial', '商用', 'commercial', 20)
),
inserted_roots AS (
  INSERT INTO rhautt_nexus.brand_product_categories (
    brand_code, parent_id, level, code, name_cn, slug, sort_order, status, show_on_website, description
  )
  SELECT 'common', NULL::uuid, 1, code, name_cn, slug, sort_order, 'active', true, 'common-product-library-taxonomy'
  FROM seed_roots
  ON CONFLICT DO NOTHING
  RETURNING id, code
),
roots AS (
  SELECT id, code FROM inserted_roots
  UNION ALL
  SELECT id, code
  FROM rhautt_nexus.brand_product_categories
  WHERE brand_code = 'common'
    AND parent_id IS NULL
    AND deleted_at IS NULL
),
seed_children(parent_code, code, name_cn, slug, sort_order) AS (
  VALUES
    ('residential', 'hot-water', '热水系统', 'hot-water', 10),
    ('residential', 'heating', '采暖系统', 'heating', 20),
    ('residential', 'air-comfort', '空气舒适系统', 'air-comfort', 30),
    ('residential', 'water-treatment', '净水软水系统', 'water-treatment', 40),
    ('residential', 'smart-control', '智能控制系统', 'smart-control', 50),
    ('commercial', 'commercial-hot-water', '商用热水系统', 'commercial-hot-water', 10),
    ('commercial', 'commercial-heat-pump', '商用热泵系统', 'commercial-heat-pump', 20),
    ('commercial', 'commercial-hvac', '商用暖通系统', 'commercial-hvac', 30),
    ('commercial', 'commercial-control', '商用智控系统', 'commercial-control', 40)
)
INSERT INTO rhautt_nexus.brand_product_categories (
  brand_code, parent_id, level, code, name_cn, slug, sort_order, status, show_on_website, description
)
SELECT 'common', r.id, 2, c.code, c.name_cn, c.slug, c.sort_order, 'active', true, 'common-product-library-taxonomy'
FROM seed_children c
JOIN roots r ON r.code = c.parent_code
ON CONFLICT DO NOTHING;
