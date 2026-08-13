-- Rhautt Nexus - Migration 096
-- Product library identity baseline: product model identity + SKU/configuration table.
--
-- Scope:
-- - Keep the existing products table compatible with current pages and APIs.
-- - Add explicit product identity fields so brand_code + normalized_model can become
--   the business key after duplicate cleanup.
-- - Add product_skus as the stable material/SKU layer below products.
-- - Do not publish anything to official sites and do not alter site shelves.

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.products
  ADD COLUMN IF NOT EXISTS brand_code text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS normalized_model text,
  ADD COLUMN IF NOT EXISTS working_name text,
  ADD COLUMN IF NOT EXISTS record_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS data_readiness_status text NOT NULL DEFAULT 'imported_draft',
  ADD COLUMN IF NOT EXISTS readiness_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS facts_verified_by text,
  ADD COLUMN IF NOT EXISTS facts_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS source_record_key text,
  ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE rhautt_nexus.products
SET
  brand_code = lower(NULLIF(trim(COALESCE(brand_code, brand, meta ->> 'brandCode', '')), '')),
  model = NULLIF(trim(COALESCE(
    model,
    spec ->> 'officialModel',
    spec ->> 'model',
    meta -> COALESCE(NULLIF(brand, ''), NULLIF(brand_code, ''), 'everhot') ->> 'model',
    meta ->> 'model',
    sku
  )), ''),
  working_name = NULLIF(trim(COALESCE(working_name, name)), ''),
  record_status = CASE
    WHEN status = 'archived' THEN 'archived'
    WHEN status = 'inactive' THEN 'withdrawn'
    WHEN record_status IN ('active', 'withdrawn', 'archived') THEN record_status
    ELSE 'active'
  END,
  data_readiness_status = CASE
    WHEN data_readiness_status IN ('imported_draft', 'needs_completion', 'fact_verified') THEN data_readiness_status
    ELSE 'imported_draft'
  END,
  source_system = COALESCE(source_system, 'legacy_product_catalog'),
  source_record_key = COALESCE(source_record_key, sku);

UPDATE rhautt_nexus.products
SET
  normalized_model = lower(regexp_replace(trim(COALESCE(model, sku)), '[[:space:]]+', '', 'g')),
  product_key = COALESCE(
    NULLIF(product_key, ''),
    lower(COALESCE(brand_code, brand, 'unknown')) || ':' ||
      lower(regexp_replace(trim(COALESCE(model, sku)), '[[:space:]]+', '', 'g'))
  )
WHERE COALESCE(normalized_model, '') = '' OR COALESCE(product_key, '') = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_record_status_chk'
  ) THEN
    ALTER TABLE rhautt_nexus.products
      ADD CONSTRAINT products_record_status_chk
      CHECK (record_status IN ('active', 'withdrawn', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_data_readiness_status_chk'
  ) THEN
    ALTER TABLE rhautt_nexus.products
      ADD CONSTRAINT products_data_readiness_status_chk
      CHECK (data_readiness_status IN ('imported_draft', 'needs_completion', 'fact_verified'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_row_version_positive_chk'
  ) THEN
    ALTER TABLE rhautt_nexus.products
      ADD CONSTRAINT products_row_version_positive_chk
      CHECK (row_version >= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS products_brand_model_idx
  ON rhautt_nexus.products (tenant_id, brand_code, normalized_model)
  WHERE deleted_at IS NULL AND record_status <> 'archived';

CREATE INDEX IF NOT EXISTS products_readiness_idx
  ON rhautt_nexus.products (tenant_id, data_readiness_status, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS rhautt_nexus.product_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES rhautt_nexus.products(id) ON DELETE CASCADE,
  sku_code text NOT NULL,
  normalized_sku_code text NOT NULL,
  material_code text,
  gtin text,
  mpn text,
  record_status text NOT NULL DEFAULT 'active'
    CHECK (record_status IN ('active', 'archived')),
  source_system text,
  source_record_key text,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS product_skus_tenant_sku_uidx
  ON rhautt_nexus.product_skus (tenant_id, normalized_sku_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS product_skus_product_idx
  ON rhautt_nexus.product_skus (tenant_id, product_id, record_status)
  WHERE deleted_at IS NULL;

INSERT INTO rhautt_nexus.product_skus (
  tenant_id,
  product_id,
  sku_code,
  normalized_sku_code,
  material_code,
  record_status,
  source_system,
  source_record_key
)
SELECT
  p.tenant_id,
  p.id,
  p.sku,
  lower(regexp_replace(trim(p.sku), '[[:space:]]+', '', 'g')),
  p.sku,
  CASE WHEN p.record_status = 'archived' THEN 'archived' ELSE 'active' END,
  COALESCE(p.source_system, 'legacy_product_catalog'),
  COALESCE(p.source_record_key, p.sku)
FROM rhautt_nexus.products p
WHERE p.sku IS NOT NULL
  AND trim(p.sku) <> ''
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS rhautt_nexus.product_data_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  product_id uuid REFERENCES rhautt_nexus.products(id) ON DELETE CASCADE,
  issue_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'blocker')),
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'ignored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS product_data_issues_open_idx
  ON rhautt_nexus.product_data_issues (tenant_id, issue_type, status, created_at DESC);

INSERT INTO rhautt_nexus.product_data_issues (
  tenant_id,
  product_id,
  issue_type,
  severity,
  message,
  payload
)
SELECT
  p.tenant_id,
  p.id,
  'duplicate_brand_model',
  'blocker',
  'Multiple active products share the same brand_code + normalized_model. Resolve before enforcing the unique business key.',
  jsonb_build_object(
    'brandCode', d.brand_code,
    'normalizedModel', d.normalized_model,
    'duplicateCount', d.duplicate_count
  )
FROM (
  SELECT tenant_id, brand_code, normalized_model, count(*) AS duplicate_count
  FROM rhautt_nexus.products
  WHERE deleted_at IS NULL
    AND record_status <> 'archived'
    AND COALESCE(brand_code, '') <> ''
    AND COALESCE(normalized_model, '') <> ''
  GROUP BY tenant_id, brand_code, normalized_model
  HAVING count(*) > 1
) d
JOIN rhautt_nexus.products p
  ON p.tenant_id = d.tenant_id
 AND p.brand_code = d.brand_code
 AND p.normalized_model = d.normalized_model
WHERE NOT EXISTS (
  SELECT 1
  FROM rhautt_nexus.product_data_issues i
  WHERE i.tenant_id = p.tenant_id
    AND i.product_id = p.id
    AND i.issue_type = 'duplicate_brand_model'
    AND i.status = 'open'
);
