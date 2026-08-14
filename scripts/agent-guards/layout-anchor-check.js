#!/usr/bin/env node
/**
 * 布局锚定清单守卫（堵 F4 · 隐式契约）
 *
 * 背景：删 48px 顶栏时五处 `position:fixed; top:48px` 悬空——"tab 栏跑到中间"。
 * 每个写死的定位值都是没登记的契约：它锚定的东西没了，它自己不会报错。
 *
 * 规则：工作台 globals.css 中所有 position:fixed/sticky 规则的锚定属性
 * （top/left/right/bottom/height 的 px/calc 值）必须与清单 layout-anchor-manifest.json
 * 完全一致。新增/变更/删除锚定 → 红，直到同步清单（清单条目必须写"锚定对象"）。
 *
 * 用法：node ... [--update-manifest]  改布局后核对无误再更新清单。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CSS = path.join(ROOT, 'apps', 'dealer-workbench', 'src', 'app', 'globals.css');
const MANIFEST = path.join(__dirname, 'layout-anchor-manifest.json');
const ANCHOR_PROPS = ['top', 'left', 'right', 'bottom', 'height'];

function extractAnchors(css) {
  const anchors = [];
  // 粗块解析：selector { body }（不处理嵌套 @media 的 selector 前缀——@media 内规则同样收录）
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const selector = m[1].trim().split('\n').pop().trim();
    const body = m[2];
    if (!/position\s*:\s*(fixed|sticky)/.test(body)) continue;
    const entry = { selector, position: body.match(/position\s*:\s*(fixed|sticky)/)[1], props: {} };
    for (const p of ANCHOR_PROPS) {
      const pm = body.match(new RegExp(`(?:^|;|\\s)${p}\\s*:\\s*([^;]+);`));
      if (pm) entry.props[p] = pm[1].trim();
    }
    anchors.push(entry);
  }
  anchors.sort((a, b) => (a.selector + a.position).localeCompare(b.selector + b.position));
  return anchors;
}

const actual = extractAnchors(fs.readFileSync(CSS, 'utf8'));

if (process.argv.includes('--update-manifest')) {
  const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { anchors: [] };
  const prevNotes = new Map(prev.anchors.map((a) => [a.selector, a.anchoredTo]));
  const manifest = {
    _comment:
      '布局锚定清单：position:fixed/sticky 的定位值是隐式契约。anchoredTo 必须写清锚定对象——删布局元素前先查这张账。',
    updatedAt: new Date().toISOString().slice(0, 10),
    anchors: actual.map((a) => ({
      ...a,
      anchoredTo: prevNotes.get(a.selector) || 'TODO: 写明锚定对象',
    })),
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`清单已更新：${actual.length} 个锚定。请为 TODO 条目补"锚定对象"说明。`);
  process.exit(0);
}

if (!fs.existsSync(MANIFEST)) {
  console.error('布局锚定守卫 —— FAIL：清单不存在，先跑 --update-manifest 并补锚定对象说明。');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const key = (a) => `${a.selector} [${a.position}] ${JSON.stringify(a.props)}`;
const wantSet = new Map(manifest.anchors.map((a) => [key(a), a]));
const gotSet = new Map(actual.map((a) => [key(a), a]));

const missing = [...wantSet.keys()].filter((k) => !gotSet.has(k));
const added = [...gotSet.keys()].filter((k) => !wantSet.has(k));
const todo = manifest.anchors.filter((a) => /^TODO/.test(a.anchoredTo || ''));

if (missing.length || added.length || todo.length) {
  console.error('布局锚定守卫 —— FAIL');
  for (const k of missing) console.error(`  - 清单有但 CSS 已无（删了没记账）：${k}`);
  for (const k of added) console.error(`  - CSS 新增/变更未登记：${k}`);
  for (const a of todo) console.error(`  - 清单条目缺"锚定对象"说明：${a.selector}`);
  console.error('\n处置：核对布局改动无悬空后，跑 --update-manifest 并写明每个锚定值锚的是什么。');
  process.exit(1);
}
console.log('布局锚定守卫 —— PASS');
console.log(`登记锚定 ${actual.length} 个（fixed/sticky），与清单一致，均已注明锚定对象。`);
