const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const spec = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));
const client = read('packages/generated-client/src/rhauttNexusClient.ts');

describe('delivery future interface contract', () => {
  test('OpenAPI preserves delivery and construction interfaces', () => {
    const paths = {
      '/api/v2/delivery/generate': ['post', 'generateDelivery'],
      '/api/v2/delivery/{orderNo}/docs': ['get', 'getDeliveryDocs'],
      '/api/v2/delivery/construction/projects/from-contract': ['post', 'createConstructionProject'],
      '/api/v2/delivery/construction/projects': ['get', 'listConstructionProjects'],
      '/api/v2/delivery/construction/projects/{id}': ['get', 'getConstructionProject'],
      '/api/v2/delivery/construction/projects/{id}/milestones/{key}/start': [
        'post',
        'startConstructionMilestone',
      ],
      '/api/v2/delivery/construction/projects/{id}/milestones/{key}/complete': [
        'post',
        'completeConstructionMilestone',
      ],
      '/api/v2/delivery/construction/projects/{id}/evidence': ['post', 'addConstructionEvidence'],
      '/api/v2/delivery/construction/projects/{id}/payments/{kind}/pay': [
        'post',
        'payConstructionPayment',
      ],
    };
    for (const [route, [method, operationId]] of Object.entries(paths)) {
      const operation = spec.paths[route]?.[method];
      expect(operation).toBeTruthy();
      expect(operation.operationId).toBe(operationId);
      expect(operation.tags).toContain('Delivery');
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
    }
  });

  test('OpenAPI preserves evidence request constraints', () => {
    const evidence =
      spec.paths['/api/v2/delivery/construction/projects/{id}/evidence'].post.requestBody.content[
        'application/json'
      ].schema;
    expect(evidence.required).toEqual(expect.arrayContaining(['milestoneKey', 'type']));
    expect(evidence.properties.type.enum).toEqual(['photo', 'esign', 'doc']);
    const fromContract =
      spec.paths['/api/v2/delivery/construction/projects/from-contract'].post.requestBody.content[
        'application/json'
      ].schema;
    expect(fromContract.required).toContain('contractId');
  });

  test('generated client preserves delivery methods', () => {
    for (const method of [
      'generateDelivery',
      'getDeliveryDocs',
      'createConstructionProject',
      'listConstructionProjects',
      'getConstructionProject',
      'startConstructionMilestone',
      'completeConstructionMilestone',
      'addConstructionEvidence',
      'payConstructionPayment',
    ]) {
      expect(client).toContain(`async ${method}`);
    }
  });

  test('delivery source has landed but is not yet assembled into the AppModule', () => {
    const boundary = read('services/api/src/modules/module-boundary.ts');
    // B1/B2/B3 迁移落了 delivery 模块源码与路由所有权，但边界仍标记 planned、
    // AppModule 尚未装配 —— 装配收口时同步更新此契约与 module-boundary
    expect(boundary).toMatch(/plannedApiInterfaces[\s\S]*'delivery'/);
    expect(fs.existsSync(path.join(ROOT, 'services/api/src/modules/delivery'))).toBe(true);
    expect(read('services/api/src/modules/app.module.ts')).not.toContain('DeliveryModule');
    expect(read('server/modules/routeOwnership.js')).toContain("prefix: '/api/v2/delivery'");
  });
});
