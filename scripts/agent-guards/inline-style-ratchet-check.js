#!/usr/bin/env node
/**
 * 内联样式棘轮 —— 工作台 style={{ }} 只降不升。
 *
 * 背景（2026-08 前端架构审计）：dealer-workbench 有 1800+ 处内联 style，
 * 是"不专业感"的最大病灶——间距/字号/颜色每处手写，视觉节奏不可能一致。
 * shadcn/ui + Tailwind v4 组件层已接入（见 globals.css 头部），新代码应使用
 * @/components/ui/* 与 utilities，不再手写 style={{ }}。
 *
 * 棘轮语义：基线只能往下调。低于基线时提示收紧；高于基线立即红灯。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TARGET = path.join(ROOT, 'apps', 'dealer-workbench', 'src');
// 2026-08-13 接入 shadcn 时的存量（全量递归扫描）。只准调小，不准调大。
const BASELINE = 2073;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

let count = 0;
const perFile = [];
for (const f of walk(TARGET)) {
  const n = (fs.readFileSync(f, 'utf8').match(/style=\{\{/g) || []).length;
  if (n) perFile.push([path.relative(TARGET, f), n]);
  count += n;
}

if (count > BASELINE) {
  console.error(`内联样式棘轮 —— FAIL：当前 ${count} 处 > 基线 ${BASELINE}`);
  console.error('新代码不得新增 style={{ }}——用 @/components/ui/* 组件与 Tailwind utilities。');
  console.error('最重的 5 个文件：');
  for (const [f, n] of perFile.sort((a, b) => b[1] - a[1]).slice(0, 5)) console.error(`  - ${n}  ${f}`);
  process.exit(1);
}
console.log(`内联样式棘轮 —— PASS：当前 ${count} 处 ≤ 基线 ${BASELINE}`);
if (BASELINE - count >= 50)
  console.log(`可收紧：实际已降到 ${count}，建议把 BASELINE 调低锁住成果。`);
