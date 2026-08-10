-- Rhautt Nexus - Migration 095
-- Seed tenant-owned official brand-site master records after the site content
-- modules were migrated. Earlier content seeds are no-ops when
-- tenant_brand_sites is empty, so this migration also replays the Everhot
-- public news and document-category seeds idempotently.

SET search_path TO rhautt_nexus, public;

WITH site_tenants AS (
  SELECT id AS tenant_id
  FROM rhautt_nexus.tenants
  WHERE code = 'DEFAULT'
    AND status = 'active'
), seed(code, name_cn, name_en, app_key, development_url, production_url, sort_order, site_note, child_brand_codes) AS (
  VALUES
    (
      'rhautt-group',
      '瑞合舒适',
      'Rhautt Comfort',
      'public-portal',
      'http://localhost:3000',
      'https://www.rhautt.com',
      0,
      'Rhautt Comfort group official site. Seeded as the HQ-owned public site tenant.',
      '["rheem","ruud","everhot"]'::jsonb
    ),
    (
      'rheem',
      '瑞美',
      'Rheem',
      'rheem-cn',
      'http://localhost:5012',
      'https://www.rheem.com.cn',
      10,
      'Rheem China official brand site.',
      '[]'::jsonb
    ),
    (
      'ruud',
      '瑞德',
      'Ruud',
      'ruud-cn',
      'http://localhost:5013',
      'https://www.ruud.com.cn',
      20,
      'Ruud China official brand site.',
      '[]'::jsonb
    ),
    (
      'everhot',
      '恒热',
      'Everhot',
      'everhot-cn',
      'http://localhost:5011',
      'https://www.everhot.com.cn',
      30,
      'Everhot China official brand site.',
      '[]'::jsonb
    )
)
INSERT INTO rhautt_nexus.tenant_brand_sites (
  tenant_id,
  code,
  name_cn,
  name_en,
  app_key,
  delivery_type,
  development_url,
  production_url,
  sort_order,
  status,
  site_note,
  child_brand_codes,
  deleted_by,
  deleted_at,
  created_at,
  updated_at
)
SELECT
  site_tenants.tenant_id,
  seed.code,
  seed.name_cn,
  seed.name_en,
  seed.app_key,
  'self_hosted',
  seed.development_url,
  seed.production_url,
  seed.sort_order,
  'active',
  seed.site_note,
  seed.child_brand_codes,
  NULL,
  NULL,
  now(),
  now()
FROM site_tenants
CROSS JOIN seed
ON CONFLICT (tenant_id, code) DO UPDATE SET
  name_cn = EXCLUDED.name_cn,
  name_en = EXCLUDED.name_en,
  app_key = EXCLUDED.app_key,
  delivery_type = EXCLUDED.delivery_type,
  development_url = EXCLUDED.development_url,
  production_url = EXCLUDED.production_url,
  sort_order = EXCLUDED.sort_order,
  status = 'active',
  site_note = EXCLUDED.site_note,
  child_brand_codes = EXCLUDED.child_brand_codes,
  deleted_by = NULL,
  deleted_at = NULL,
  updated_at = now();

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND status = 'active'
    AND deleted_at IS NULL
), categories(slug, name, scope, sort_order) AS (
  VALUES
    ('installation-manual', '安装手册', 'residential', 10),
    ('user-manual', '用户说明书', 'residential', 20),
    ('maintenance-guide', '维护指南', 'residential', 30),
    ('product-catalog', '产品样本', 'residential', 40),
    ('engineering-spec', '工程规格书', 'commercial', 50),
    ('bim-revit', 'BIM / Revit 资料', 'commercial', 60)
)
INSERT INTO rhautt_nexus.site_document_categories (
  tenant_id,
  site_id,
  slug,
  name,
  scope,
  sort_order,
  status
)
SELECT
  everhot_sites.tenant_id,
  everhot_sites.site_id,
  categories.slug,
  categories.name,
  categories.scope,
  categories.sort_order,
  'active'
FROM everhot_sites
CROSS JOIN categories
ON CONFLICT DO NOTHING;

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND status = 'active'
    AND deleted_at IS NULL
), seed(slug, title, summary, cover_image_url, published_at, sort_order) AS (
  VALUES
    (
      'everhot-cn-site-upgrade',
      '恒热中国官网全新升级上线',
      '以更清晰的产品架构与服务体验，连接每一个家庭与项目。',
      '/assets/img/home-card1.webp',
      '2026-06-01 00:00:00+08',
      10
    ),
    (
      'everhot-commercial-hot-water-expo',
      '恒热商用热水方案亮相行业展会',
      '大功率连续供热系统获酒店与公寓项目方关注。',
      '/assets/img/sust-product-new.webp',
      '2026-05-01 00:00:00+08',
      20
    ),
    (
      'large-home-central-heating-guide',
      '如何为大户型选择中央采暖系统',
      '从热负荷计算到设备选型的完整选购指南。',
      '/assets/img/home-card3.webp',
      '2026-04-01 00:00:00+08',
      30
    )
)
INSERT INTO rhautt_nexus.site_news_articles (
  tenant_id,
  site_id,
  slug,
  title,
  summary,
  body,
  cover_image_url,
  published_at,
  status,
  sort_order,
  is_featured
)
SELECT
  everhot_sites.tenant_id,
  everhot_sites.site_id,
  seed.slug,
  seed.title,
  seed.summary,
  seed.summary,
  seed.cover_image_url,
  seed.published_at::timestamptz,
  'published',
  seed.sort_order,
  true
FROM everhot_sites
CROSS JOIN seed
WHERE NOT EXISTS (
  SELECT 1
  FROM rhautt_nexus.site_news_articles existing
  WHERE existing.tenant_id = everhot_sites.tenant_id
    AND existing.site_id = everhot_sites.site_id
    AND lower(existing.slug) = seed.slug
    AND existing.deleted_at IS NULL
);
