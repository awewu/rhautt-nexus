/**
 * Jest测试配置 - 测试覆盖提升目标80%
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.js',
    '**/tests/**/*.spec.ts',
    '**/test/**/*.test.js',
    '**/test/**/*.test.ts',
    '**/__tests__/**/*.js',
    '**/__tests__/**/*.ts',
  ],

  // 覆盖率收集目标 - ⭐ 2026-08 对齐迁移现状：
  // 原 12 引擎清单里，MultiDiscipline/AIConsultant/RoleSystemV8 已在 2026-04 清理中删除，
  // 其余引擎的 Jest 单测也已随 Express→NestJS 迁移退役（见 testPathIgnorePatterns），
  // NestJS 侧由 scripts/test-api-units.js 独立门禁覆盖。此处只对仍有活跃 Jest 单测的
  // legacy 引擎设覆盖率门禁，避免用已退役测试的死目标把全绿测试打红。
  collectCoverageFrom: [
    'server/core/LoadCalculationEngineV3.js',
    // 排除项
    '!**/node_modules/**',
    '!**/test/**',
    '!**/tests/**',
    '!**/coverage/**',
    '!**/dist/**',
  ],

  // 覆盖率目标阈值 - 核心引擎要求85%
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },

  // 覆盖率报告输出目录
  coverageDirectory: 'coverage',

  // 覆盖率报告格式
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  // 测试超时时间
  testTimeout: 30000,

  // 模块文件扩展名
  moduleFileExtensions: ['js', 'json'],

  // 覆盖率路径忽略
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/test/',
    '/tests/',
    '/public/',
    '/logs/',
    '/backups/',
    '/.windsurf/',
  ],

  // 测试报告器
  reporters: ['default'],

  // 排除独立测试框架文件（它们使用自己的test()实现，与Jest冲突）
  // 排除E2E测试（需要Playwright，在单独环境中运行）
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/supreme-system.test.js',
    '/test/oneclick-engine.test.js',
    '/test/supreme-comprehensive.test.js',
    '/tests/e2e/',
    // 以下测试引用的模块已在 2026-04 清理中删除（迁移至 NestJS/PG 或归档）
    '/test/AIConsultantEngine.test.js',
    '/test/AIValidationSuite.test.js',
    '/test/AdminSystemV2.test.js',
    '/test/AgencyAgent.test.js',
    '/test/ConfigManager.test.js',
    '/test/CoreModules.test.js',
    '/test/CriticAgent.test.js',
    '/test/DataPersistence.test.js',
    '/test/DrawingSyncEngine.test.js',
    '/test/EnterpriseValidationEngine.test.js',
    '/test/HTTPSSecurity.test.js',
    '/test/HermesSelfEvolution.test.js',
    '/test/ImageRecognition.test.js',
    '/test/InputValidator.test.js',
    '/test/Logger.test.js',
    '/test/MarketingEngine.test.js',
    '/test/MasterAgent.test.js',
    '/test/MultiRoleEngine.test.js',
    '/test/QuickLockModeV2.test.js',
    '/test/StrictValidationAgent.test.js',
    '/test/SystemCoordinationEngine.test.js',
    '/test/ThreeTierEngine.test.js',
  ],

  // 多worker配置优化
  maxWorkers: 2,
  workerIdleMemoryLimit: '512MB',
};
