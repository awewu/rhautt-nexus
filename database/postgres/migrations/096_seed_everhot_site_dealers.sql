-- Rhautt Nexus - Migration 096
-- Backfill Everhot dealer locator data into the tenant-owned official-site
-- dealer directory. The Everhot static site had placeholder dealer data in
-- public/js/dealers.js; after migrating the management UI, the backend table
-- must own the same data so console edits and the public site share one source.

SET search_path TO rhautt_nexus, public;

WITH everhot_sites AS (
  SELECT tenant_id, id AS site_id, code AS site_code
  FROM rhautt_nexus.tenant_brand_sites
  WHERE code = 'everhot'
    AND status = 'active'
    AND deleted_at IS NULL
), seed(name, province, city, district, address, phone, dealer_type, services, certifications, latitude, longitude, sort_order) AS (
  VALUES
    ('恒热上海浦东旗舰服务中心', '上海', '上海市', '浦东新区', '浦东新区张杨路 1500 号 A 座 2F', '021-5888-0001', '旗舰店', '["家用","商用","安装","售后"]'::jsonb, '["Rheem认证","金牌服务"]'::jsonb, 31.221, 121.545, 10),
    ('恒热上海徐汇授权店', '上海', '上海市', '徐汇区', '徐汇区漕溪北路 88 号', '021-5888-0002', '授权店', '["家用","安装","售后"]'::jsonb, '["Rheem认证"]'::jsonb, 31.188, 121.437, 20),
    ('恒热北京朝阳体验中心', '北京', '北京市', '朝阳区', '朝阳区建国路 95 号院 3 号楼', '010-8588-0010', '旗舰店', '["家用","商用","安装","售后"]'::jsonb, '["Rheem认证","金牌服务"]'::jsonb, 39.921, 116.486, 30),
    ('恒热北京海淀授权店', '北京', '北京市', '海淀区', '海淀区中关村大街 27 号', '010-8588-0011', '授权店', '["家用","安装"]'::jsonb, '["Rheem认证"]'::jsonb, 39.959, 116.298, 40),
    ('恒热广州天河服务中心', '广东', '广州市', '天河区', '天河区天河路 230 号', '020-3888-0020', '旗舰店', '["家用","商用","安装","售后"]'::jsonb, '["Rheem认证","金牌服务"]'::jsonb, 23.124, 113.361, 50),
    ('恒热深圳南山授权店', '广东', '深圳市', '南山区', '南山区科技园南区高新南一道', '0755-2688-0021', '授权店', '["家用","商用","安装"]'::jsonb, '["Rheem认证"]'::jsonb, 22.533, 113.930, 60),
    ('恒热杭州西湖体验店', '浙江', '杭州市', '西湖区', '西湖区文三路 478 号', '0571-8788-0030', '授权店', '["家用","安装","售后"]'::jsonb, '["Rheem认证"]'::jsonb, 30.259, 120.130, 70),
    ('恒热南京建邺服务中心', '江苏', '南京市', '建邺区', '建邺区江东中路 222 号', '025-8388-0040', '授权店', '["家用","商用","安装","售后"]'::jsonb, '["Rheem认证","金牌服务"]'::jsonb, 32.005, 118.731, 80),
    ('恒热苏州工业园授权店', '江苏', '苏州市', '工业园区', '工业园区星海街 199 号', '0512-6788-0041', '授权店', '["家用","安装"]'::jsonb, '["Rheem认证"]'::jsonb, 31.317, 120.745, 90),
    ('恒热成都高新体验中心', '四川', '成都市', '高新区', '高新区天府大道北段 1700 号', '028-8588-0050', '旗舰店', '["家用","商用","安装","售后"]'::jsonb, '["Rheem认证","金牌服务"]'::jsonb, 30.572, 104.066, 100),
    ('恒热武汉武昌授权店', '湖北', '武汉市', '武昌区', '武昌区中南路 99 号', '027-8788-0060', '授权店', '["家用","安装","售后"]'::jsonb, '["Rheem认证"]'::jsonb, 30.554, 114.342, 110),
    ('恒热重庆渝中服务中心', '重庆', '重庆市', '渝中区', '渝中区民权路 28 号', '023-6388-0070', '授权店', '["家用","商用","安装"]'::jsonb, '["Rheem认证"]'::jsonb, 29.557, 106.572, 120),
    ('恒热西安雁塔授权店', '陕西', '西安市', '雁塔区', '雁塔区科技路 33 号', '029-8588-0080', '授权店', '["家用","安装","售后"]'::jsonb, '["Rheem认证"]'::jsonb, 34.222, 108.948, 130),
    ('恒热天津和平体验店', '天津', '天津市', '和平区', '和平区南京路 189 号', '022-2388-0090', '授权店', '["家用","安装"]'::jsonb, '["Rheem认证"]'::jsonb, 39.117, 117.201, 140),
    ('恒热青岛市南服务中心', '山东', '青岛市', '市南区', '市南区香港中路 76 号', '0532-8588-0100', '授权店', '["家用","商用","安装","售后"]'::jsonb, '["Rheem认证","金牌服务"]'::jsonb, 36.067, 120.382, 150),
    ('恒热长沙岳麓授权店', '湖南', '长沙市', '岳麓区', '岳麓区枫林三路 286 号', '0731-8488-0110', '授权店', '["家用","安装"]'::jsonb, '["Rheem认证"]'::jsonb, 28.228, 112.938, 160)
)
INSERT INTO rhautt_nexus.site_dealers (
  tenant_id,
  site_id,
  site_code,
  name,
  province,
  city,
  district,
  address,
  phone,
  dealer_type,
  services,
  certifications,
  latitude,
  longitude,
  sort_order,
  status
)
SELECT
  everhot_sites.tenant_id,
  everhot_sites.site_id,
  everhot_sites.site_code,
  seed.name,
  seed.province,
  seed.city,
  seed.district,
  seed.address,
  seed.phone,
  seed.dealer_type,
  seed.services,
  seed.certifications,
  seed.latitude,
  seed.longitude,
  seed.sort_order,
  'active'
FROM everhot_sites
CROSS JOIN seed
WHERE NOT EXISTS (
  SELECT 1
  FROM rhautt_nexus.site_dealers existing
  WHERE existing.tenant_id = everhot_sites.tenant_id
    AND existing.site_id = everhot_sites.site_id
    AND lower(existing.name) = lower(seed.name)
    AND coalesce(existing.phone, '') = coalesce(seed.phone, '')
    AND existing.deleted_at IS NULL
);
