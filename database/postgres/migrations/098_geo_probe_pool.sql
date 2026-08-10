-- 098 · GEO 探测池优先：先找战场，再做千问引爆
-- geo_target 从“单点选点”扩展为“探测池坐标”：品类/场景/对比/选型/痛点/区域/角色。

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.geo_target
  ADD COLUMN IF NOT EXISTS intent_stage text,
  ADD COLUMN IF NOT EXISTS probe_type text NOT NULL DEFAULT 'category',
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS asset_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS probe_strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_probed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_target_probe_type_check'
      AND conrelid = 'rhautt_nexus.geo_target'::regclass
  ) THEN
    ALTER TABLE rhautt_nexus.geo_target
      ADD CONSTRAINT geo_target_probe_type_check
      CHECK (probe_type IN ('category', 'scenario', 'comparison', 'selection', 'pain_point', 'region', 'role'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'geo_target_intent_stage_check'
      AND conrelid = 'rhautt_nexus.geo_target'::regclass
  ) THEN
    ALTER TABLE rhautt_nexus.geo_target
      ADD CONSTRAINT geo_target_intent_stage_check
      CHECK (intent_stage IS NULL OR intent_stage IN ('awareness', 'compare', 'selection', 'quote', 'after_sales'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS geo_target_probe_pool_idx
  ON rhautt_nexus.geo_target (tenant_id, category, probe_type, priority_score DESC);
