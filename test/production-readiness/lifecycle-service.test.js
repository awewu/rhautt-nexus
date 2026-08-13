const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const spec = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));
const client = read('packages/generated-client/src/rhauttNexusClient.ts');

describe('lifecycle future interface contract', () => {
  test('Express and standalone Nest lifecycle implementations are absent', () => {
    // Express v2 router 已整体退役删除；lifecycle 域由 NestJS delivery 模块承载（B1/B2/B3 迁移）
    expect(fs.existsSync(path.join(ROOT, 'server/modules/v2.router.js'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'server/modules/lifecycle'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'services/api/src/modules/lifecycle'))).toBe(false);
    expect(read('services/api/src/modules/app.module.ts')).not.toContain('LifecycleModule');
  });

  test('OpenAPI preserves lifecycle interfaces for future implementation', () => {
    const operations = {
      '/api/v2/lifecycle/customer-projects': ['get', 'listLifecycleCustomerProjects'],
      '/api/v2/lifecycle/customer-projects/{contractId}': ['get', 'getLifecycleCustomerProject'],
      '/api/v2/lifecycle/handover': ['post', 'createLifecycleHandover'],
      '/api/v2/lifecycle/handover/{contractId}': ['get', 'getLifecycleHandover'],
      '/api/v2/lifecycle/handover/{contractId}/acceptance': ['post', 'markLifecycleAccepted'],
      '/api/v2/lifecycle/handover/{contractId}/state': ['patch', 'updateLifecycleState'],
      '/api/v2/lifecycle/handover/{contractId}/handoff-package': [
        'get',
        'getLifecycleIotHandoffPackage',
      ],
    };
    for (const [route, [method, operationId]] of Object.entries(operations)) {
      expect(spec.paths[route]?.[method]?.operationId).toBe(operationId);
      expect(client).toContain(`async ${operationId}`);
    }
  });

  test('lifecycle stays a planned boundary while runtime routing is owned by the delivery module', () => {
    const boundary = read('services/api/src/modules/module-boundary.ts');
    expect(boundary).toMatch(/plannedApiInterfaces[\s\S]*'lifecycle'/);
    // B1/B2/B3 迁移后 lifecycle 路由归 NestJS delivery 模块所有并进入代理 allowlist
    expect(read('server/modules/routeOwnership.js')).toContain("prefix: '/api/v2/lifecycle'");
    expect(read('server/modules/productionMiddleware.js')).toContain("'/api/v2/lifecycle'");
  });
});
