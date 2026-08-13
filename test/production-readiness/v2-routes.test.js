/**
 * /api/v2 生产路由契约（Express v2 router 退役版）
 *
 * 本地 Express /api/v2 实现（server/modules/v2.router.js）已退役删除：
 * P1 架构收敛后 /api/v2/** 默认全部反向代理到 NestJS 单一真相源
 * （见 server/modules/productionMiddleware.js）。原 in-process router
 * 行为测试随实现一并退役，此处锁死退役状态与代理契约，防止回潮。
 */
const fs = require('fs');
const path = require('path');
const {
  isNestJSMigrated,
  NESTJS_MIGRATED_PREFIXES,
} = require('../../server/modules/productionMiddleware');

const ROOT = path.join(__dirname, '..', '..');

describe('production v2 routes (retired Express fallback)', () => {
  test('retired Express v2 router stays deleted', () => {
    expect(fs.existsSync(path.join(ROOT, 'server/modules/v2.router.js'))).toBe(false);
  });

  test('no production runtime source still requires the retired v2 router', () => {
    for (const rel of [
      'server/index.js',
      'server/modules/productionMiddleware.js',
      'server-production.js',
    ]) {
      const full = path.join(ROOT, rel);
      if (!fs.existsSync(full)) continue;
      expect(fs.readFileSync(full, 'utf8')).not.toContain("require('./v2.router')");
      expect(fs.readFileSync(full, 'utf8')).not.toContain("require('./modules/v2.router')");
    }
  });

  test('all /api/v2 traffic routes to the NestJS single source of truth by default', () => {
    delete process.env.LEGACY_V2_INPROCESS;
    expect(isNestJSMigrated('/api/v2')).toBe(true);
    expect(isNestJSMigrated('/api/v2/auth/login')).toBe(true);
    expect(isNestJSMigrated('/api/v2/crm/customers')).toBe(true);
    expect(isNestJSMigrated('/api/v2/quotation')).toBe(true);
    expect(isNestJSMigrated('/api/legacy-route')).toBe(false);
  });

  test('partial rollback allowlist keeps every migrated domain on NestJS', () => {
    for (const prefix of [
      '/api/v2/auth',
      '/api/v2/tenants',
      '/api/v2/crm',
      '/api/v2/diagnosis',
      '/api/v2/quotation',
      '/api/v2/delivery',
      '/api/v2/lifecycle',
      '/api/v2/contracts',
      '/api/v2/analytics',
    ]) {
      expect(NESTJS_MIGRATED_PREFIXES).toContain(prefix);
    }
  });
});
