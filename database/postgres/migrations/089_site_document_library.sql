-- Rhautt Nexus - Migration 089
-- Tenant-owned official-site document categories, published downloads, and RBAC.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.site_document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  site_id uuid NOT NULL REFERENCES rhautt_nexus.tenant_brand_sites(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('residential', 'commercial', 'all')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by uuid REFERENCES rhautt_nexus.users(id),
  updated_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_document_categories_site_slug_uidx
  ON rhautt_nexus.site_document_categories (tenant_id, site_id, lower(slug))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS site_document_categories_public_idx
  ON rhautt_nexus.site_document_categories (tenant_id, site_id, scope, status, sort_order)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS rhautt_nexus.site_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  site_id uuid NOT NULL REFERENCES rhautt_nexus.tenant_brand_sites(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES rhautt_nexus.site_document_categories(id),
  artifact_id uuid NOT NULL REFERENCES rhautt_nexus.uploaded_files(id),
  display_name text NOT NULL,
  original_filename text NOT NULL,
  mime_type varchar,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  scope text NOT NULL DEFAULT 'residential' CHECK (scope IN ('residential', 'commercial')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden', 'archived')),
  published_at timestamptz,
  created_by uuid REFERENCES rhautt_nexus.users(id),
  updated_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_documents_public_idx
  ON rhautt_nexus.site_documents (tenant_id, site_id, scope, status, sort_order, published_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS site_documents_category_idx
  ON rhautt_nexus.site_documents (tenant_id, site_id, category_id)
  WHERE deleted_at IS NULL;

ALTER TABLE rhautt_nexus.site_document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.site_document_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.site_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.site_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_document_categories_tenant_isolation ON rhautt_nexus.site_document_categories;
CREATE POLICY site_document_categories_tenant_isolation ON rhautt_nexus.site_document_categories
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

DROP POLICY IF EXISTS site_documents_tenant_isolation ON rhautt_nexus.site_documents;
CREATE POLICY site_documents_tenant_isolation ON rhautt_nexus.site_documents
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

INSERT INTO rhautt_nexus.rbac_permissions (code, name, domain, action, description, sort_order) VALUES
  ('site.documentation.view', '查看官网资料库页面', 'site.documentation', 'view', '允许打开品牌官网资料库管理页面。', 121),
  ('site.documentation.read', '查看官网资料库', 'site.documentation', 'read', '允许查看资料分类、文件和发布状态。', 122),
  ('site.documentation.create', '新增官网资料', 'site.documentation', 'create', '允许新增资料分类并上传文件。', 123),
  ('site.documentation.update', '编辑官网资料', 'site.documentation', 'update', '允许编辑分类、资料信息和隐藏资料。', 124),
  ('site.documentation.delete', '删除官网资料', 'site.documentation', 'delete', '允许删除分类或归档资料文件。', 125),
  ('site.documentation.publish', '发布官网资料', 'site.documentation', 'publish', '允许将资料发布到品牌官网。', 126)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO rhautt_nexus.rbac_role_permissions (tenant_id, role_id, permission_code)
SELECT r.tenant_id, r.id, p.code
FROM rhautt_nexus.rbac_roles r
CROSS JOIN rhautt_nexus.rbac_permissions p
WHERE r.code IN ('platform_admin', 'hq_admin', 'brand_admin')
  AND p.code LIKE 'site.documentation.%'
ON CONFLICT DO NOTHING;

INSERT INTO rhautt_nexus.rbac_role_permissions (tenant_id, role_id, permission_code)
SELECT r.tenant_id, r.id, p.code
FROM rhautt_nexus.rbac_roles r
JOIN rhautt_nexus.rbac_permissions p
  ON p.code IN ('site.documentation.view', 'site.documentation.read')
WHERE r.code = 'internal_staff'
ON CONFLICT DO NOTHING;
