-- Rhautt Nexus - Migration 091
-- Add an explicit official-site visibility gate for brand product categories.

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.brand_product_categories
  ADD COLUMN IF NOT EXISTS show_on_website boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS brand_product_categories_website_visibility_idx
  ON rhautt_nexus.brand_product_categories (brand_code, show_on_website, status)
  WHERE deleted_at IS NULL;
