-- 108_site_product_assignment_category_id.sql
-- Store stable official-site directory references on product assignments.
-- website_category remains as a display/filter snapshot for existing public sites.

ALTER TABLE rhautt_nexus.site_product_assignments
  ADD COLUMN IF NOT EXISTS site_product_category_id uuid
    REFERENCES rhautt_nexus.site_product_categories(id);

CREATE INDEX IF NOT EXISTS site_product_assignments_category_idx
  ON rhautt_nexus.site_product_assignments (tenant_id, site_id, site_product_category_id)
  WHERE deleted_at IS NULL;

WITH category_matches AS (
  SELECT DISTINCT ON (a.id)
    a.id AS assignment_id,
    c.id AS category_id
  FROM rhautt_nexus.site_product_assignments a
  JOIN rhautt_nexus.site_product_categories c
    ON c.tenant_id = a.tenant_id
   AND c.site_id = a.site_id
   AND c.deleted_at IS NULL
   AND c.status = 'active'
   AND c.name = a.website_category
  WHERE a.deleted_at IS NULL
    AND a.site_product_category_id IS NULL
    AND coalesce(a.website_category, '') <> ''
  ORDER BY a.id, c.level DESC, c.sort_order ASC, c.created_at ASC
)
UPDATE rhautt_nexus.site_product_assignments a
SET site_product_category_id = category_matches.category_id,
    updated_at = now()
FROM category_matches
WHERE a.id = category_matches.assignment_id;
