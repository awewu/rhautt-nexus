-- Rhautt Nexus - Migration 109
-- Product physical master-data fields.
--
-- Architecture decision:
-- - Product dimensions and weights are core product facts, not marketing copy.
-- - Store them directly on products so official sites, logistics, installation,
--   quotation, and dealer tools read one structured source of truth.
-- - Units are explicit in column names: dimensions in mm, weights in kg.

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.products
  ADD COLUMN IF NOT EXISTS length_mm numeric(12,2),
  ADD COLUMN IF NOT EXISTS width_mm numeric(12,2),
  ADD COLUMN IF NOT EXISTS height_mm numeric(12,2),
  ADD COLUMN IF NOT EXISTS net_weight_kg numeric(12,3),
  ADD COLUMN IF NOT EXISTS package_length_mm numeric(12,2),
  ADD COLUMN IF NOT EXISTS package_width_mm numeric(12,2),
  ADD COLUMN IF NOT EXISTS package_height_mm numeric(12,2),
  ADD COLUMN IF NOT EXISTS gross_weight_kg numeric(12,3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_physical_dimensions_non_negative_chk'
  ) THEN
    ALTER TABLE rhautt_nexus.products
      ADD CONSTRAINT products_physical_dimensions_non_negative_chk
      CHECK (
        (length_mm IS NULL OR length_mm >= 0)
        AND (width_mm IS NULL OR width_mm >= 0)
        AND (height_mm IS NULL OR height_mm >= 0)
        AND (net_weight_kg IS NULL OR net_weight_kg >= 0)
        AND (package_length_mm IS NULL OR package_length_mm >= 0)
        AND (package_width_mm IS NULL OR package_width_mm >= 0)
        AND (package_height_mm IS NULL OR package_height_mm >= 0)
        AND (gross_weight_kg IS NULL OR gross_weight_kg >= 0)
      );
  END IF;
END $$;
