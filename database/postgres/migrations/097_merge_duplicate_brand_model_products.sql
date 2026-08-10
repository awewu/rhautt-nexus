-- Rhautt Nexus - Migration 097
-- Merge duplicate products that share tenant_id + brand_code + normalized_model.
--
-- Product architecture decision:
-- - brand_code + normalized_model is the product identity.
-- - sku/material codes are configurations under a product.
-- - Historical duplicates are archived after their SKUs are moved to the chosen keeper.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.product_merge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  brand_code text NOT NULL,
  normalized_model text NOT NULL,
  keeper_product_id uuid NOT NULL REFERENCES rhautt_nexus.products(id),
  merged_product_id uuid NOT NULL REFERENCES rhautt_nexus.products(id),
  moved_sku_count integer NOT NULL DEFAULT 0,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, keeper_product_id, merged_product_id)
);

WITH ranked AS (
  SELECT
    p.*,
    row_number() OVER (
      PARTITION BY p.tenant_id, p.brand_code, p.normalized_model
      ORDER BY
        jsonb_array_length(COALESCE(p.meta -> 'officialSource' -> 'documents', '[]'::jsonb)) DESC,
        p.updated_at DESC,
        p.created_at DESC,
        p.id
    ) AS rn,
    first_value(p.id) OVER (
      PARTITION BY p.tenant_id, p.brand_code, p.normalized_model
      ORDER BY
        jsonb_array_length(COALESCE(p.meta -> 'officialSource' -> 'documents', '[]'::jsonb)) DESC,
        p.updated_at DESC,
        p.created_at DESC,
        p.id
    ) AS keeper_product_id
  FROM rhautt_nexus.products p
  WHERE p.deleted_at IS NULL
    AND p.record_status <> 'archived'
    AND COALESCE(p.brand_code, '') <> ''
    AND COALESCE(p.normalized_model, '') <> ''
),
losers AS (
  SELECT *
  FROM ranked
  WHERE rn > 1
),
moved_skus AS (
  UPDATE rhautt_nexus.product_skus s
  SET
    product_id = l.keeper_product_id,
    updated_at = now()
  FROM losers l
  WHERE s.product_id = l.id
  RETURNING l.tenant_id, l.brand_code, l.normalized_model, l.keeper_product_id, l.id AS merged_product_id, s.id AS sku_id
),
merge_counts AS (
  SELECT
    tenant_id,
    brand_code,
    normalized_model,
    keeper_product_id,
    merged_product_id,
    count(*)::integer AS moved_sku_count
  FROM moved_skus
  GROUP BY tenant_id, brand_code, normalized_model, keeper_product_id, merged_product_id
),
archived_products AS (
  UPDATE rhautt_nexus.products p
  SET
    status = 'archived',
    record_status = 'archived',
    deleted_at = now(),
    data_readiness_status = 'needs_completion',
    meta = COALESCE(p.meta, '{}'::jsonb)
      || jsonb_build_object(
        'mergedIntoProductId', l.keeper_product_id,
        'mergedReason', 'duplicate_brand_model',
        'mergedAt', now()
      ),
    updated_at = now()
  FROM losers l
  WHERE p.id = l.id
  RETURNING l.tenant_id, l.brand_code, l.normalized_model, l.keeper_product_id, p.id AS merged_product_id
)
INSERT INTO rhautt_nexus.product_merge_events (
  tenant_id,
  brand_code,
  normalized_model,
  keeper_product_id,
  merged_product_id,
  moved_sku_count,
  reason
)
SELECT
  a.tenant_id,
  a.brand_code,
  a.normalized_model,
  a.keeper_product_id,
  a.merged_product_id,
  COALESCE(m.moved_sku_count, 0),
  'duplicate_brand_model'
FROM archived_products a
LEFT JOIN merge_counts m
  ON m.tenant_id = a.tenant_id
 AND m.keeper_product_id = a.keeper_product_id
 AND m.merged_product_id = a.merged_product_id
ON CONFLICT DO NOTHING;

UPDATE rhautt_nexus.product_data_issues i
SET
  status = 'resolved',
  resolved_at = now(),
  payload = COALESCE(i.payload, '{}'::jsonb)
    || jsonb_build_object('resolution', 'merged_as_sku_under_keeper', 'resolvedAt', now())
WHERE i.issue_type = 'duplicate_brand_model'
  AND i.status = 'open'
  AND NOT EXISTS (
    SELECT 1
    FROM rhautt_nexus.products p
    WHERE p.tenant_id = i.tenant_id
      AND p.brand_code = i.payload ->> 'brandCode'
      AND p.normalized_model = i.payload ->> 'normalizedModel'
      AND p.deleted_at IS NULL
      AND p.record_status <> 'archived'
    GROUP BY p.tenant_id, p.brand_code, p.normalized_model
    HAVING count(*) > 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS products_brand_model_uidx
  ON rhautt_nexus.products (tenant_id, brand_code, normalized_model)
  WHERE deleted_at IS NULL
    AND record_status <> 'archived'
    AND COALESCE(brand_code, '') <> ''
    AND COALESCE(normalized_model, '') <> '';
