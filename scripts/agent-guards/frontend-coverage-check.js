#!/usr/bin/env node
/**
 * 前端覆盖度守卫 —— 后端路由要么被前端调用，要么被显式登记豁免，不允许默默存在。
 *
 * 为什么需要它：主销产品线曾出现"5 个接口全部无前端入口"——功能只存在于 API 里，
 * 总部的人永远不知道它存在。该缺口是人工盘点才发现的；本守卫把盘点固化，
 * 与 guard:geo-next 同一思路：盲区要么被覆盖，要么被显式登记。
 *
 * 口径（诚实声明）：
 * - 匹配是**字符串特征级**（路由静态段出现在前端源码中即算覆盖）——匹配上≠真用上，
 *   未匹配≈基本确定没用。本守卫只捕"完全没接"，不验证调用正确性
 *   （调用正确性由 guard:frontend-api-contract 负责）。
 * - 豁免必须写原因。豁免清单本身受审查：删了豁免理由守卫就红。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// ── 豁免登记（每条必须带原因）────────────────────────────────────────────────
// 模块级豁免：整个模块不要求前端覆盖
const EXEMPT_MODULES = {
  delivery: '客户赋能独立产品线，已从营销中台剥离/停挂载（AGENTS.md）',
  bim: '客户赋能独立产品线，已剥离',
  contracts: '客户赋能独立产品线，已剥离',
  design: '客户赋能独立产品线，已剥离',
  quotation: '客户赋能独立产品线，已剥离（报价数据仍被主销后验镜子只读消费）',
  devices: '客户赋能独立产品线（选型器），已剥离',
  diagnosis: '瑞诺瓦问诊域（消费端 App 前台），不属工作台',
  compliance: '合规底座，由系统流程调用而非人操作界面',
  entitlement: '订阅授权底座，运维/商务后台性质',
  cdp: '写路径（profiles/segments/consent POST）由事件与系统调用；读路径已有工作台面板',
  'file-artifact': '文件底座，由业务模块间接使用',
  activation: '(激活作业由事件驱动，participate 为消费端动作)',
};
// 路由级豁免：`METHOD path` 精确匹配
const EXEMPT_ROUTES = {
  'GET /tenants': '平台级租户管理，属运维后台，不进业务工作台',
  'GET /tenants/:id': '同上',
  'POST /tenants': '同上',
  'PUT /tenants/:id': '同上',
  'GET /stores': '门店主数据由 CRM/渠道流程间接维护',
  'GET /stores/:id': '同上',
  'POST /stores': '同上',
  'PUT /stores/:id': '同上',
  'POST auth/refresh-token': '前端刻意采用会话过期重登（安全决策），不静默续期',
  'GET workflow': '工作流查询由具体业务页内嵌，不设独立入口',
  // 更正 2026-08-13：此前豁免理由"通知走站内铃铛组件的独立通道"是错的——当时铃铛是
  // 无事件的死按钮。现侧栏 NotificationBell 已接真数据，本豁免删除（由特征匹配覆盖）。
  'GET dispatch/decisions': '已有工作台面板（channel 页）——特征词与面板文件名不同故登记',
  'GET metrics/gtm-digest':
    '机器对机器端点（StratOS 感知回传，Bearer 令牌鉴权非用户 JWT）——不该有人工界面。更正 2026-08-13：此前误登记为"待接驾驶舱卡片 P2"，读源码后确认是 M2M 契约',
  'POST channel/performance': '渠道绩效由数据管道写入，非人工界面动作',
  'POST product-catalog/content/publish-due': '由调度器触发的定时动作，非人工界面',
  'GET growth/ontology/object-types': '本体登记表（治理可见性 P3，2026-08 登记）',
  'POST growth/geo/focus-products/derive-topics': '已有工作台面板（product-mgmt 主销面板）——路径与特征词不同故登记',
  'POST file-artifact/:id/verify-round-trip': '存证校验由发布流水线调用',
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/nodetest|\.spec\./.test(e.name)) out.push(full);
  }
  return out;
}

// ① 后端路由清单
const routes = [];
for (const f of walk(path.join(ROOT, 'services/api/src/modules')).filter((x) => /controller/.test(x))) {
  const src = fs.readFileSync(f, 'utf8');
  const ctrl = (src.match(/@Controller\(['"`]([^'"`]*)['"`]\)/) || [])[1] ?? '';
  for (const m of src.matchAll(/@(Get|Post|Patch|Put|Delete)\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/g)) {
    const full = (ctrl + '/' + (m[2] || '')).replace(/\/+/g, '/').replace(/\/$/, '');
    routes.push({ method: m[1].toUpperCase(), path: full });
  }
}

// ② 前端源码合并文本
let feSrc = '';
for (const f of walk(path.join(ROOT, 'apps/dealer-workbench/src'))) feSrc += fs.readFileSync(f, 'utf8') + '\n';

function covered(route) {
  const segs = route.path.split('/').filter((s) => s && !s.startsWith(':'));
  if (!segs.length) return true;
  return feSrc.includes(segs.slice(-2).join('/')) || feSrc.includes(segs[segs.length - 1]);
}

const failures = [];
let exempted = 0;
for (const r of routes) {
  const key = `${r.method} ${r.path}`;
  const mod = r.path.split('/')[0] || '(root)';
  if (covered(r)) continue;
  if (EXEMPT_MODULES[mod] || EXEMPT_ROUTES[key] || (mod === '' && EXEMPT_ROUTES[`${r.method} /${r.path}`])) {
    exempted += 1;
    continue;
  }
  // (root) 前缀路由的 key 形如 'GET /tenants'
  if (r.path.startsWith('/') === false && EXEMPT_ROUTES[`${r.method} /${r.path}`]) {
    exempted += 1;
    continue;
  }
  failures.push(key);
}

if (failures.length) {
  console.error('前端覆盖度守卫 —— FAIL');
  console.error(`后端路由 ${routes.length} 个 · 未覆盖且未登记豁免 ${failures.length} 个：`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('\n处置：为其接前端入口，或在本守卫 EXEMPT_* 登记豁免并写明原因。');
  process.exit(1);
}
console.log('前端覆盖度守卫 —— PASS');
console.log(
  `后端路由 ${routes.length} 个 · 前端特征覆盖 ${routes.length - exempted - failures.length} 个 · 显式豁免 ${exempted} 个`
);
console.log('（字符串特征级口径：只捕"完全没接"，调用正确性由 guard:frontend-api-contract 负责）');
