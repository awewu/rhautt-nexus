#!/usr/bin/env node
/**
 * GTM UI Token 审计 · 对齐 Tandem UI Charter 机制（scripts/check-ui-charter.mjs 同思路）
 *
 * 范围: apps/dealer-workbench/src + apps/public-portal/src 的 *.tsx / *.css
 * 规则:
 *   no-inline-hex : 组件/页面里的裸 hex 色值（应走 packages/tokens / globals.css 的 CSS var）
 *   no-raw-rgb    : 裸 rgb()/rgba() 数字色值（同上）
 * 豁免: 各 app 的 globals.css（token 定义处）、opengraph-image.tsx（OG 渲染器不支持 CSS var）。
 *
 * 治理模式 = ratchet（棘轮）:
 *   - scripts/agent-guards/ui-token-baseline.json 记录每文件违规数快照（历史债账本）
 *   - --strict（CI）: 任何文件超过基线 / 新文件带违规 = FAIL；只减不增
 *   - --update-baseline: 清债后收紧基线（只允许下降，上升会拒绝）
 *   - 无参数: 输出全量审计报告
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const UPDATE = args.has('--update-baseline');
const BASELINE_PATH = join(ROOT, 'scripts', 'agent-guards', 'ui-token-baseline.json');

const SCAN_DIRS = ['apps/dealer-workbench/src', 'apps/public-portal/src'];
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'public']);
const EXEMPT = new Set([
  'apps/dealer-workbench/src/app/globals.css', // token 定义处
  'apps/public-portal/src/app/globals.css', // token 定义处
  'apps/public-portal/src/app/opengraph-image.tsx', // next/og ImageResponse 不解析 CSS var
]);

const RULES = [
  {
    name: 'no-inline-hex',
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    hint: '走 CSS var: color: "var(--brand-500)" / var(--t-secondary) 等（globals.css / packages/tokens）',
  },
  {
    name: 'no-raw-rgb',
    pattern: /rgba?\(\s*\d/g,
    hint: '走 CSS var 或 color-mix(in srgb, var(--x) NN%, transparent)',
  },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (IGNORE_DIRS.has(name)) continue;
      yield* walk(full);
    } else if (/\.(tsx|css)$/.test(name)) {
      yield full;
    }
  }
}

const counts = {}; // relPath -> total violations
const byRule = {};
for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (EXEMPT.has(rel)) continue;
    const text = readFileSync(file, 'utf8');
    let n = 0;
    for (const rule of RULES) {
      const m = text.match(rule.pattern) || [];
      n += m.length;
      byRule[rule.name] = (byRule[rule.name] || 0) + m.length;
    }
    if (n > 0) counts[rel] = n;
  }
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);

if (UPDATE) {
  if (existsSync(BASELINE_PATH)) {
    const old = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    const oldTotal = Object.values(old).reduce((a, b) => a + b, 0);
    if (total > oldTotal) {
      console.error(`拒绝: 新基线总债 ${total} > 旧基线 ${oldTotal}，棘轮只允许下降。`);
      process.exit(1);
    }
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n', 'utf8');
  console.log(`基线已更新: ${Object.keys(counts).length} 文件 / ${total} 违规`);
  process.exit(0);
}

if (STRICT) {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`缺少基线文件 ${relative(ROOT, BASELINE_PATH)}，先跑 --update-baseline`);
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const failures = [];
  for (const [file, n] of Object.entries(counts)) {
    const allowed = baseline[file] ?? 0;
    if (n > allowed) failures.push(`${file}: ${n} 处裸色值（基线 ${allowed}）`);
  }
  if (failures.length) {
    console.error(`✗ UI token 棘轮门禁 FAIL（${failures.length} 文件新增裸色值债务）`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error(
      '\n修复: 改用 CSS var（globals.css / packages/tokens 定义的 token）。' +
        '\n规则: 债务只减不增；清债后跑 node scripts/agent-guards/ui-token-audit.mjs --update-baseline 收紧基线。'
    );
    process.exit(1);
  }
  const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
  console.log(`✓ UI token 棘轮门禁 OK · 当前债 ${total} ≤ 基线 ${baseTotal}`);
  if (total < baseTotal) {
    console.log(`  （已清 ${baseTotal - total} 处，可跑 --update-baseline 收紧基线）`);
  }
  process.exit(0);
}

// 报告模式
console.log('# GTM UI Token 审计报告\n');
console.log(`扫描范围: ${SCAN_DIRS.join(' · ')}（豁免 ${EXEMPT.size} 个 token 定义/OG 文件）`);
console.log(`违规文件: ${Object.keys(counts).length} · 违规总数: ${total}`);
for (const [rule, n] of Object.entries(byRule)) console.log(`  - ${rule}: ${n}`);
console.log('\nTop 20 最脏:');
for (const [f, n] of Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)) {
  console.log(`  ${String(n).padStart(4)}  ${f}`);
}
