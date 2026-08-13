#!/usr/bin/env node
/**
 * 对外站点（public-portal）纯函数单测运行器。
 *
 * 为什么需要：GEO 的结构化数据构建器是纯函数，但此前对外站没有任何单测运行器
 * （`test:api-units` 只扫 services/api/src）。JSON-LD 一旦写错，缺陷会静默流到线上
 * ——引擎不会报错，只会"看不懂这页"，这类问题最难靠肉眼发现，必须靠测试守。
 *
 * 递归收集 apps/public-portal/src 下所有 *.nodetest.ts，经 ts-node transpile-only 用 node:test 运行。
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const testDir = path.join(root, 'apps', 'public-portal', 'src');

function collect(dir, acc) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p, acc);
    else if (e.name.endsWith('.nodetest.ts')) acc.push(p);
  }
  return acc;
}

const files = collect(testDir, []);
if (!files.length) {
  console.error('no *.nodetest.ts found under apps/public-portal/src');
  process.exit(1);
}

const r = spawnSync(
  process.execPath,
  ['-r', 'ts-node/register/transpile-only', '--test', ...files],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      // 门户源码为 ESM + JSX；此处只测纯函数模块，用 CommonJS + react-jsx 转译即可。
      TS_NODE_COMPILER_OPTIONS: JSON.stringify({
        module: 'commonjs',
        moduleResolution: 'node',
        jsx: 'react-jsx',
        target: 'es2022',
        esModuleInterop: true,
        skipLibCheck: true,
      }),
    },
  },
);
process.exit(r.status ?? 1);
