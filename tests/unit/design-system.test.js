/**
 * 设计系统CSS单元测试
 * 简化版本 - 验证CSS文件存在和基本结构
 */

const fs = require('fs');
const path = require('path');

// 遗留 public/ UI 已随 legacy 归档从工作区移除（archive/ 在 .gitignore 且无生成步骤），
// 资产缺失时跳过；恢复后自动恢复严格校验
const cssPath = path.join(__dirname, '../../public/css/design-system.css');
const describeWithCss = fs.existsSync(cssPath) ? describe : describe.skip;

describeWithCss('设计系统CSS测试', () => {
  let cssContent;

  beforeAll(() => {
    cssContent = fs.readFileSync(cssPath, 'utf8');
  });

  test('CSS文件存在', () => {
    expect(fs.existsSync(cssPath)).toBe(true);
  });

  test('CSS文件不为空', () => {
    expect(cssContent.length).toBeGreaterThan(0);
  });

  test('包含基础工具类', () => {
    expect(cssContent).toContain('.flex');
    expect(cssContent).toContain('.grid');
    expect(cssContent).toContain('.hidden');
  });

  test('包含组件类', () => {
    expect(cssContent).toContain('.card');
    expect(cssContent).toContain('.btn');
    expect(cssContent).toContain('.tag');
  });

  test('包含CSS变量', () => {
    expect(cssContent).toContain('--rheem-red');
    expect(cssContent).toContain('--primary-blue');
  });

  test('CSS类数量充足', () => {
    const classMatches = cssContent.match(/\.[a-zA-Z-_]+/g);
    expect(classMatches.length).toBeGreaterThan(100);
  });
});
