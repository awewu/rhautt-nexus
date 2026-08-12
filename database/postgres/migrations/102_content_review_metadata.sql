-- 102 content review metadata
-- Adds source lineage and rejection feedback so content review can loop back to editing.

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.content_asset
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS source_label text,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS review_history jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS content_asset_source_idx
  ON rhautt_nexus.content_asset (tenant_id, source_type, source_ref);
