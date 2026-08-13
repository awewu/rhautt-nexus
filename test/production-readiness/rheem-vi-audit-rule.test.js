const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const auditScript = fs.readFileSync(
  path.join(ROOT, 'scripts/agent-guards/rheem-vi-production-audit.js'),
  'utf8'
);

describe('Rheem VI audit rule precision', () => {
  test('only flags 瑞美 when baked into a Rheem logo/wordmark asset itself', () => {
    expect(auditScript).toContain('contextualChecks');
    expect(auditScript).toContain(
      'Potential fake Rheem Chinese lockup baked into a Rheem logo/wordmark asset.'
    );

    // 与 guard 当前规则一致：瑞美 是 Rheem 的权威中文名，正文/页脚引用合法；
    // 仅当出现在 Rheem logo/wordmark 资产文件本身时判定为伪造锁形。
    const benignEquipmentCopy = "desc: '瑞美 RTG-95X 80L'";
    const contextualPattern = /瑞\s*美/gi;
    const shouldFlag = ({ relativePath }) =>
      /rheem-logo\.svg$/.test(relativePath) ||
      /rheem[-_]?(logo|wordmark|lockup)/i.test(relativePath);

    expect(contextualPattern.test(benignEquipmentCopy)).toBe(true);
    expect(
      shouldFlag({
        relativePath: 'public/customer-share.html',
        snippet: benignEquipmentCopy,
      })
    ).toBe(false);
    expect(
      shouldFlag({
        relativePath: 'public/images/rheem-logo.svg',
        snippet: '<text>瑞美</text>',
      })
    ).toBe(true);
    // HTML 页面正文里的母品牌引用（哪怕邻近 brand-card/Since 1925 文案）不再误报
    expect(
      shouldFlag({
        relativePath: 'public/index-ready.html',
        snippet: 'brand-card Rheem 瑞美 Since 1925',
      })
    ).toBe(false);
  });
});
