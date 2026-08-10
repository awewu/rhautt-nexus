-- Rhautt Nexus - Migration 090
-- Tenant-owned public service point directory for official brand sites.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.site_dealers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  site_id uuid NOT NULL REFERENCES rhautt_nexus.tenant_brand_sites(id) ON DELETE CASCADE,
  site_code varchar NOT NULL,
  name varchar NOT NULL,
  province varchar,
  city varchar,
  district varchar,
  address text,
  phone varchar,
  dealer_type varchar,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  latitude numeric(10, 6),
  longitude numeric(10, 6),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status varchar NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by uuid REFERENCES rhautt_nexus.users(id),
  updated_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_dealers_site_name_phone_uidx
  ON rhautt_nexus.site_dealers (tenant_id, site_id, lower(name), coalesce(phone, ''))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS site_dealers_public_idx
  ON rhautt_nexus.site_dealers (tenant_id, site_id, status, sort_order, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS site_dealers_region_idx
  ON rhautt_nexus.site_dealers (tenant_id, site_id, province, city, district)
  WHERE deleted_at IS NULL;

ALTER TABLE rhautt_nexus.site_dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.site_dealers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_dealers_tenant_isolation ON rhautt_nexus.site_dealers;
CREATE POLICY site_dealers_tenant_isolation ON rhautt_nexus.site_dealers
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());
