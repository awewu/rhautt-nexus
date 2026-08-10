-- Rhautt Nexus - Migration 098
-- Product library website pricing projection.
--
-- Architecture decision:
-- - products.list_price remains the product-library base/list price.
-- - products.cost_price remains internal and must never be exposed to official sites.
-- - dealer prices remain in price_list_items.
-- - official website display price is a separate projection, because different sites
--   may choose different display copy, visibility, units, effective periods, or
--   "contact dealer" policies for the same product.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.product_website_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES rhautt_nexus.products(id) ON DELETE CASCADE,
  site_code text NOT NULL DEFAULT 'official',
  locale text NOT NULL DEFAULT 'zh-CN',
  price_display_mode text NOT NULL DEFAULT 'not_shown'
    CHECK (price_display_mode IN ('show_price', 'price_range', 'inquiry', 'contact_dealer', 'not_shown')),
  website_price numeric(14,2),
  website_price_min numeric(14,2),
  website_price_max numeric(14,2),
  promo_price numeric(14,2),
  currency text NOT NULL DEFAULT 'CNY',
  price_unit text,
  price_label text,
  price_note text,
  tax_included boolean NOT NULL DEFAULT true,
  valid_from timestamptz,
  valid_to timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT product_website_pricing_non_negative_chk CHECK (
    (website_price IS NULL OR website_price >= 0)
    AND (website_price_min IS NULL OR website_price_min >= 0)
    AND (website_price_max IS NULL OR website_price_max >= 0)
    AND (promo_price IS NULL OR promo_price >= 0)
  ),
  CONSTRAINT product_website_pricing_range_chk CHECK (
    website_price_min IS NULL
    OR website_price_max IS NULL
    OR website_price_min <= website_price_max
  ),
  CONSTRAINT product_website_pricing_valid_window_chk CHECK (
    valid_from IS NULL
    OR valid_to IS NULL
    OR valid_from <= valid_to
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS product_website_pricing_scope_uidx
  ON rhautt_nexus.product_website_pricing (tenant_id, product_id, site_code, locale)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS product_website_pricing_product_idx
  ON rhautt_nexus.product_website_pricing (tenant_id, product_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS product_website_pricing_site_idx
  ON rhautt_nexus.product_website_pricing (tenant_id, site_code, price_display_mode, status)
  WHERE deleted_at IS NULL;

ALTER TABLE rhautt_nexus.product_website_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.product_website_pricing FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_website_pricing_tenant_isolation ON rhautt_nexus.product_website_pricing;
CREATE POLICY product_website_pricing_tenant_isolation ON rhautt_nexus.product_website_pricing
  USING (tenant_id = rhautt_nexus.current_tenant_id()::text)
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id()::text);
