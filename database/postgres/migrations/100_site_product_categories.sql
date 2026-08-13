-- 100_site_product_categories.sql
-- Website product shelf categories: site-specific frontend taxonomy, separate from common product-library categories.

CREATE TABLE IF NOT EXISTS rhautt_nexus.site_product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  site_id uuid NOT NULL REFERENCES rhautt_nexus.tenant_brand_sites(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES rhautt_nexus.site_product_categories(id),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  code text NOT NULL CHECK (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL,
  slug text CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  menu_group text,
  mapped_base_category_id uuid,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_visible boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  description text,
  created_by uuid REFERENCES rhautt_nexus.users(id),
  updated_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_product_categories_site_code_uidx
  ON rhautt_nexus.site_product_categories (
    tenant_id,
    site_id,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(code)
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS site_product_categories_tree_idx
  ON rhautt_nexus.site_product_categories (tenant_id, site_id, parent_id, sort_order, created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE rhautt_nexus.site_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.site_product_categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_product_categories_tenant_isolation ON rhautt_nexus.site_product_categories;
CREATE POLICY site_product_categories_tenant_isolation ON rhautt_nexus.site_product_categories
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

WITH assignment_categories AS (
  SELECT
    a.tenant_id,
    a.site_id,
    a.website_category AS name,
    lower(regexp_replace(regexp_replace(coalesce(a.website_category, 'category'), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) AS raw_code,
    min(a.menu_group) FILTER (WHERE a.menu_group IS NOT NULL AND a.menu_group <> '') AS menu_group,
    min(a.display_order) AS sort_order,
    bool_or(a.is_featured) AS is_featured
  FROM rhautt_nexus.site_product_assignments a
  WHERE a.deleted_at IS NULL
    AND coalesce(a.website_category, '') <> ''
  GROUP BY a.tenant_id, a.site_id, a.website_category
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
  CASE WHEN raw_code = '' THEN 'category-' || row_number() OVER (PARTITION BY tenant_id, site_id ORDER BY name)::text ELSE raw_code END,
  name,
  NULLIF(raw_code, ''),
  menu_group,
  coalesce(sort_order, 0),
  true,
  is_featured,
  'active',
  'backfilled-from-site-product-assignments'
FROM assignment_categories
ON CONFLICT DO NOTHING;
