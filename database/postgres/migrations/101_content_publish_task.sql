-- 101 content publish task
-- Review approval is not external publication. This table tracks channel tasks and publication evidence.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.content_publish_task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  content_id uuid NOT NULL REFERENCES rhautt_nexus.content_asset(id) ON DELETE CASCADE,
  channel text NOT NULL,
  target_name text,
  publish_mode text NOT NULL DEFAULT 'manual' CHECK (publish_mode IN ('auto', 'manual')),
  status text NOT NULL DEFAULT 'manual_required'
    CHECK (status IN ('queued', 'ready', 'manual_required', 'published', 'failed', 'cancelled')),
  owner text,
  scheduled_at timestamptz,
  published_at timestamptz,
  evidence_url text,
  evidence_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_publish_task_idx
  ON rhautt_nexus.content_publish_task (tenant_id, status, channel, updated_at DESC);
CREATE INDEX IF NOT EXISTS content_publish_task_content_idx
  ON rhautt_nexus.content_publish_task (tenant_id, content_id, updated_at DESC);

ALTER TABLE rhautt_nexus.content_publish_task ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_publish_task_tenant_isolation ON rhautt_nexus.content_publish_task;
CREATE POLICY content_publish_task_tenant_isolation ON rhautt_nexus.content_publish_task
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
ALTER TABLE rhautt_nexus.content_publish_task FORCE ROW LEVEL SECURITY;
