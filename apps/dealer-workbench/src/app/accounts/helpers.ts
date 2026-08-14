// accounts 账号权限工作台 · 纯 helpers（2026-08 巨页拆分：类型/标签映射/展示函数）

export type AdminUser = {
  id: string;
  name: string;
  role: string;
  roles?: string[];
  permissions?: string[];
  status: 'active' | 'inactive' | 'suspended';
  identifierMasked: string;
  identifierKind?: 'email' | 'phone' | 'unknown';
  isLocked: boolean;
  dealerId: string | null;
  storeId: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
};

export type PermissionItem = {
  code: string;
  name: string;
  domain: string;
  action: string;
  description?: string;
  sortOrder?: number;
};

export type RoleItem = {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  isSystem?: boolean;
  permissions: string[];
  userCount?: number;
};

export type EffectiveRole = {
  id: string;
  code: string;
  name: string;
  isPrimary: boolean;
};

export type AuditLogRow = {
  id: string;
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  resourceLabel?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  status?: 'success' | 'failed';
  requestId?: string | null;
  traceId?: string | null;
  createdAt: string;
};

export type AccountsTab = 'users' | 'roles' | 'audit';

export const LEGACY_ROLE_LABEL: Record<string, string> = {
  platform_admin: '平台超级管理员',
  hq_admin: '总部管理员',
  brand_admin: '品牌管理员',
  regional_manager: '区域经理',
  dealer_admin: '经销商管理员',
  store_manager: '门店经理',
  designer: '设计师',
  sales: '销售',
  engineer: '工程师',
  installer: '安装工',
  customer: '客户',
};

export const PERMISSION_DOMAIN_LABEL: Record<string, string> = {
  'admin.users': '账号管理',
  'admin.roles': '角色管理',
  'admin.permissions': '权限目录',
  'marketing.content': '营销内容',
  'marketing.campaigns': '营销活动',
  'marketing.assets': '营销物料',
  'product.catalog': '产品库',
  'product.content': '产品内容',
  'brand.library': '品牌库',
  'site.documentation': '官网资料库',
  'brand.asset': '品牌资源',
  'analytics.dashboard': '数据看板',
  analytics: '数据分析',
  'system.audit': '审计日志',
};

export const PERMISSION_NAME_LABEL: Record<string, string> = {
  'admin.users.view': '查看账号权限页面',
  'admin.users.read': '查看账号列表',
  'admin.users.create': '新建账号',
  'admin.users.update': '编辑账号',
  'admin.users.delete': '删除账号',
  'admin.users.reset_password': '重置账号密码',
  'admin.users.assign_roles': '分配用户角色',
  'admin.roles.view': '查看角色权限页面',
  'admin.roles.read': '查看角色列表',
  'admin.roles.create': '新建角色',
  'admin.roles.update': '编辑角色',
  'admin.roles.assign_permissions': '配置角色权限',
  'admin.permissions.read': '查看权限点目录',
  'marketing.content.view': '查看内容页面',
  'marketing.content.create': '新建内容',
  'marketing.content.update': '编辑内容',
  'marketing.content.delete': '删除内容',
  'marketing.campaigns.view': '查看营销活动',
  'marketing.campaigns.create': '新建营销活动',
  'marketing.campaigns.update': '编辑营销活动',
  'marketing.campaigns.delete': '删除营销活动',
  'marketing.assets.view': '查看营销物料',
  'marketing.assets.create': '新建营销物料',
  'marketing.assets.update': '编辑营销物料',
  'marketing.assets.delete': '删除营销物料',
  'product.catalog.view': '查看产品库页面',
  'product.catalog.read': '查看产品库列表',
  'product.catalog.create': '新增产品',
  'product.catalog.update': '编辑产品',
  'product.catalog.delete': '删除产品',
  'product.catalog.publish': '发布产品内容',
  'product.content.read': '查看产品内容',
  'product.content.create': '新增产品内容',
  'product.content.update': '编辑产品内容',
  'product.content.delete': '删除产品内容',
  'brand.library.view': '查看品牌库页面',
  'brand.library.read': '查看品牌库列表',
  'brand.library.create': '新增品牌库内容',
  'brand.library.update': '编辑品牌库内容',
  'brand.library.delete': '删除品牌库内容',
  'brand.library.publish': '发布品牌库内容',
  'brand.asset.update': '更新品牌资源',
  'site.documentation.view': '查看官网资料库页面',
  'site.documentation.read': '查看官网资料库',
  'site.documentation.create': '新增官网资料',
  'site.documentation.update': '编辑官网资料',
  'site.documentation.delete': '删除官网资料',
  'site.documentation.publish': '发布官网资料',
  'analytics.dashboard.view': '查看数据看板',
  'analytics.export': '导出数据',
  'system.audit.read': '查看审计日志',
};

export const PERMISSION_ACTION_LABEL: Record<string, string> = {
  view: '页面可见',
  read: '查看',
  create: '新增',
  update: '编辑',
  delete: '删除',
  reset_password: '重置密码',
  assign_roles: '分配角色',
  assign_permissions: '配置权限',
  export: '导出',
  publish: '发布',
};

export const AUDIT_MODULE_LABEL: Record<string, string> = {
  'admin.users': '账号管理',
  'admin.roles': '角色权限',
  product: '产品管理',
  'product.catalog': '产品库',
  'product.content': '产品内容',
  'site-news': '资讯管理',
  'site-product-assignment': '官网产品',
  'site-document': '官网资料',
  'site-document-category': '官网资料分类',
  'site-dealer': '官网服务网点',
  'brand-site': '官网站点',
  'brand-site-basic-settings': '基础信息',
  'marketing.content': '咨询/资讯',
  'marketing.assets': '图片素材',
  'growth.geo': 'GEO 可见度',
  'growth.copy': 'AI 文案',
  'growth.opinion': '舆情雷达',
  'growth.campaigns': '营销活动',
  'growth.materials': '营销物料',
  'brand.library': '品牌发布',
  'diagnosis.consultation': '咨询问诊',
  'crm.consultation': '客户咨询',
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  create: '新增',
  update: '修改',
  delete: '删除',
  publish: '发布',
  published: '发布',
  draft: '草稿',
  hidden: '隐藏',
  upload: '上传',
  archive: '归档/隐藏',
  restore: '恢复',
  reset_password: '重置密码',
  assign_roles: '分配角色',
  assign_permissions: '配置权限',
};

export const AUDIT_MODULE_FILTER_OPTIONS = [
  ['site-news', '资讯管理'],
  ['site-product-assignment', '官网产品'],
  ['site-document', '官网资料'],
  ['site-document-category', '官网资料分类'],
  ['site-dealer', '官网服务网点'],
  ['brand-site-basic-settings', '基础信息'],
  ['brand-site', '官网站点'],
  ['product', '产品管理'],
  ['product.catalog', '产品库'],
  ['product.content', '产品内容'],
  ['marketing.content', '咨询/资讯'],
  ['marketing.assets', '图片素材'],
  ['growth.geo', 'GEO 可见度'],
  ['growth.copy', 'AI 文案'],
  ['growth.opinion', '舆情雷达'],
  ['growth.campaigns', '营销活动'],
  ['growth.materials', '营销物料'],
  ['brand.library', '品牌发布'],
  ['admin.users', '账号管理'],
  ['admin.roles', '角色权限'],
  ['diagnosis.consultation', '咨询问诊'],
  ['crm.consultation', '客户咨询'],
] as const;

export const AUDIT_ACTION_FILTER_OPTIONS = [
  ['create', '新增'],
  ['update', '修改'],
  ['delete', '删除'],
  ['publish', '发布'],
  ['upload', '上传'],
  ['archive', '归档/隐藏'],
  ['restore', '恢复'],
  ['reset_password', '重置密码'],
  ['assign_roles', '分配角色'],
  ['assign_permissions', '配置权限'],
] as const;

export const AUDIT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const ACCOUNT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const STATUS_TONE: Record<AdminUser['status'], 'success' | 'neutral' | 'danger'> = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
};

export const PHONE_PATTERN = /^1[3-9]\d{9}$/;
export const ROLE_CODE_PATTERN = /^[a-z0-9_:-]+$/;

export function labelForRole(code: string, roles: RoleItem[]) {
  const role = roles.find((item) => item.code === code);
  if (role?.name && role.name !== role.code) return role.name;
  return LEGACY_ROLE_LABEL[code] || code;
}

export function displayRoleName(
  role: Pick<RoleItem, 'code' | 'name'> | Pick<EffectiveRole, 'code' | 'name'>
) {
  if (role.name && role.name !== role.code) return role.name;
  return LEGACY_ROLE_LABEL[role.code] || role.name || role.code;
}

export function displayRoleDescription(role: RoleItem) {
  if (role.description === 'Backfilled from users.role') return '由历史账号角色自动迁移生成';
  return role.description || '-';
}

export function displayPermissionName(permission: PermissionItem) {
  if (permission.name && permission.name !== permission.code) return permission.name;
  return PERMISSION_NAME_LABEL[permission.code] || permission.name || permission.code;
}

export function displayPermissionDomain(domain: string) {
  return PERMISSION_DOMAIN_LABEL[domain] || domain;
}

export function displayPermissionAction(action: string) {
  return PERMISSION_ACTION_LABEL[action] || '操作权限';
}

export function displayAuditModule(resourceType: string) {
  return AUDIT_MODULE_LABEL[resourceType] || resourceType || '-';
}

export function displayAuditAction(action: string) {
  const actionKey = action.split('.').pop() || action;
  return AUDIT_ACTION_LABEL[actionKey] || actionKey;
}

export function displayAuditSummary(action: string, resourceType: string) {
  return `${displayAuditModule(resourceType)} · ${displayAuditAction(action)}`;
}

export function displayAuditResource(log: AuditLogRow) {
  const states = [log.afterState, log.beforeState].filter(Boolean) as Record<string, unknown>[];
  const label = String(log.resourceLabel || '').trim();
  const labelParts = splitAuditLabel(label);
  const resourceName = labelParts[0] || auditResourceTitle(states) || auditResourceFallback(log);
  const action = displayAuditAction(log.action);
  const target = auditTargetLabel(log.resourceType);
  const primary =
    resourceName && resourceName !== '-'
      ? `${action}${target}：${resourceName}`
      : `${action}${target}`;
  const id = String(log.resourceId || '').trim();
  const details = auditDetailParts(states);
  const secondaryParts = [
    ...(details.length ? details : auditDetailsFromLabel(log.resourceType, labelParts.slice(1))),
    id && resourceName !== id ? `ID：${id}` : '',
  ].filter(Boolean);
  return {
    primary,
    secondary: secondaryParts.join(' / '),
  };
}

export function auditTargetLabel(resourceType: string) {
  const labels: Record<string, string> = {
    'admin.users': '账号',
    'admin.roles': '角色',
    product: '产品',
    'product.catalog': '产品',
    'product.content': '产品内容',
    'site-news': '资讯',
    'site-product-assignment': '官网产品',
    'site-document': '官网资料',
    'site-document-category': '官网资料分类',
    'site-dealer': '官网服务网点',
    'brand-site': '品牌站点',
    'brand-site-basic-settings': '官网基础信息',
    'marketing.content': '资讯',
    'marketing.assets': '图片素材',
    'growth.geo': 'GEO 探测',
    'growth.copy': 'AI 文案',
    'growth.opinion': '舆情记录',
    'growth.campaigns': '营销活动',
    'growth.materials': '营销物料',
    'brand.library': '品牌内容',
    'diagnosis.consultation': '咨询问诊',
    'crm.consultation': '客户咨询',
  };
  return labels[resourceType] || displayAuditModule(resourceType);
}

export function splitAuditLabel(label: string) {
  return label
    .split(/\s*[·|/]\s*/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function auditDetailsFromLabel(resourceType: string, parts: string[]) {
  if (!parts.length) return [];
  if (resourceType === 'growth.materials') {
    const [materialType, brandSlug, fileFormat] = parts;
    return [
      materialType ? `类型：${materialType}` : '',
      brandSlug ? `品牌：${brandSlug}` : '',
      fileFormat ? `格式：${fileFormat}` : '',
    ].filter(Boolean);
  }
  if (resourceType === 'growth.geo') {
    const [category, brandSlug, engine] = parts;
    return [
      category ? `品类：${category}` : '',
      brandSlug ? `品牌：${brandSlug}` : '',
      engine ? `引擎：${engine}` : '',
    ].filter(Boolean);
  }
  if (resourceType === 'product' || resourceType === 'product.catalog') {
    const [sku] = parts;
    return sku ? [`SKU：${sku}`] : [];
  }
  return parts.map((item) => `信息：${item}`);
}

export function auditDetailParts(states: Record<string, unknown>[]) {
  for (const state of states) {
    const current = auditDetailsFromObject(state);
    if (current.length) return current;
    const nested = auditNestedDetails(state);
    if (nested.length) return nested;
  }
  return [];
}

export function auditNestedDetails(state: Record<string, unknown>) {
  const queue = [state];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const details = auditDetailsFromObject(current);
    if (details.length) return details;
    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        for (const item of value.slice(0, 8)) {
          if (item && typeof item === 'object') queue.push(item as Record<string, unknown>);
        }
      } else if (value && typeof value === 'object') {
        queue.push(value as Record<string, unknown>);
      }
    }
  }
  return [];
}

export function auditDetailsFromObject(value: Record<string, unknown>) {
  return [
    labeledAuditText('问题', value, ['question']),
    labeledAuditText('引擎', value, ['engine']),
    labeledAuditText('类型', value, ['materialType', 'category', 'kind', 'type']),
    labeledAuditText('品牌', value, ['brandSlug', 'brand']),
    labeledAuditText('渠道', value, ['channel']),
    labeledAuditText('格式', value, ['fileFormat', 'mimeType']),
    labeledAuditText('版本', value, ['versionLabel']),
    labeledAuditText('SKU', value, ['sku']),
    labeledAuditText('型号', value, ['model']),
    labeledAuditText('路径', value, ['publicSlug', 'slug']),
    labeledAuditText('AIVS', value, ['aivs']),
  ].filter(Boolean);
}

export function labeledAuditText(label: string, value: Record<string, unknown>, keys: string[]) {
  const text = firstAuditText(value, keys);
  return text ? `${label}：${text}` : '';
}

export function auditResourceFallback(log: AuditLogRow) {
  const id = String(log.resourceId || '').trim();
  if (id && !isOpaqueAuditId(id)) return id;
  return id || '-';
}

export function auditResourceTitle(states: Record<string, unknown>[]) {
  for (const state of states) {
    const direct = auditTitleFromObject(state);
    if (direct) return direct;
    const nested = auditTitleFromNestedState(state);
    if (nested) return nested;
  }
  return '';
}

export function auditTitleFromNestedState(state: Record<string, unknown>) {
  const queue = [state];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const title = auditTitleFromObject(current);
    if (title) return title;
    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        for (const item of value.slice(0, 8)) {
          if (item && typeof item === 'object') queue.push(item as Record<string, unknown>);
        }
      } else if (value && typeof value === 'object') {
        queue.push(value as Record<string, unknown>);
      }
    }
  }
  return '';
}

export function auditTitleFromObject(value: Record<string, unknown>) {
  const name = firstAuditText(value, [
    'displayName',
    'productName',
    'officialName',
    'name',
    'title',
    'headline',
    'filename',
    'fileName',
    'originalName',
    'label',
  ]);
  const detail = firstAuditText(value, [
    'materialType',
    'category',
    'sku',
    'model',
    'code',
    'slug',
    'publicSlug',
    'brandSlug',
    'brand',
    'channel',
    'fileFormat',
  ]);
  if (name && detail && name !== detail) return `${name} · ${detail}`;
  if (name) return name;
  return detail && !isOpaqueAuditId(detail) ? detail : '';
}

export function firstAuditText(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = value[key];
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    const text = String(raw).trim();
    if (text && !isRedactedAuditText(text)) return text;
  }
  return '';
}

export function isRedactedAuditText(value: string) {
  return value === '[Redacted]' || value === '[Truncated]';
}

export function isOpaqueAuditId(value: string) {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
    /^[0-9a-f]{24}$/i.test(value)
  );
}

export function displayContact(user: AdminUser) {
  if (user.identifierMasked && user.identifierMasked !== '***') return user.identifierMasked;
  return '未绑定联系方式';
}

export function normalizeRoleCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function displayStatus(status: AdminUser['status']) {
  if (status === 'active') return '正常';
  if (status === 'suspended') return '冻结';
  return '停用';
}

export function can(mePermissions: string[], permission: string, meRole?: string | null) {
  return (
    meRole === 'platform_admin' ||
    meRole === 'hq_admin' ||
    mePermissions.includes('*') ||
    mePermissions.includes(permission)
  );
}
