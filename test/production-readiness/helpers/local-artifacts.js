/**
 * 本地产物门禁助手 —— 与 scripts/agent-guards 的 SKIPPED 约定一致：
 * archive/、evidence/、audit/ 等目录在 .gitignore 且没有 CI 生成步骤，
 * 依赖这些产物的断言在产物缺失时跳过（产物恢复/生成后自动恢复严格校验），
 * 而不是在干净 checkout 上必然 ENOENT 红掉。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');

function missingArtifacts(relPaths) {
  return relPaths.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
}

/**
 * 产物齐全时返回原 describe/test；缺失时返回带原因的 skip 版本。
 * 用法：const d = describeIfArtifacts([...paths]); d('suite', () => {...})
 */
function describeIfArtifacts(relPaths) {
  const missing = missingArtifacts(relPaths);
  if (missing.length === 0) return describe;
  const skipped = (name, fn) =>
    describe(`${name} [SKIPPED: 缺少产物 ${missing.join(', ')}]`, () => {
      test.skip(`缺少本地产物（.gitignore 且无生成步骤）: ${missing.join(', ')}`, () => {});
      if (typeof fn === 'function') {
        // 不执行原 suite 体，避免模块级读取 ENOENT
      }
    });
  skipped.missing = missing;
  return skipped;
}

function testIfArtifacts(relPaths) {
  return missingArtifacts(relPaths).length === 0 ? test : test.skip;
}

module.exports = { ROOT, missingArtifacts, describeIfArtifacts, testIfArtifacts };
