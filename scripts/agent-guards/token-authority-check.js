#!/usr/bin/env node
/**
 * Token 权威源一致性守卫（堵 F2 · 语义错位）
 *
 * 背景：apps/public-portal/globals.css 自己写着"SYNCED FROM packages/tokens/rhautt.css ·
 * 唯一源 brand-registry，勿在此改值"，但 --brand-primary 实际是 #c41f1e（权威 #e4002b），
 * 漂移无人报警——guard:rheem-vi-production 是特定违规探测器，从设计上不查一致性。
 *
 * 规则：对外站 app 层声明的 --brand-* 变量，凡与 packages/tokens/<brand>.css 同名者，
 * 值必须逐一相等（大小写不敏感）。已知漂移须登记 PENDING_DECISIONS（带登记日期与
 * 待裁决问题），不许静默——登记的漂移打印为 ⚠️ 待裁决，不算通过也不算失败拦截。
 *
 * 口径谦卑：只比对 app 内**字面 hex/颜色值**的同名变量；var() 引用/派生值不在本守卫
 * 职责内（那是级联正确性，非权威源一致性）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/** 对外站 app CSS ← 权威 token 文件 映射 */
const PAIRS = [
  {
    app: 'apps/public-portal/src/app/globals.css',
    authority: 'packages/tokens/rhautt.css',
    brand: 'rhautt',
  },
];

/** 已知漂移待裁决登记（不许静默；裁决后应清出此表并修值） */
const PENDING_DECISIONS = [
  {
    brand: 'rhautt',
    varName: '--brand-primary',
    appValue: '#c41f1e',
    authorityValue: '#e4002b',
    note: '2026-08-13 审计发现；权威(registry/token)为 #E4002B，portal 写 #c41f1e。该变量 portal 内无消费点（纯定义），等品牌方裁决哪个是对的（更正 registry 或改 portal）。',
  },
  {
    brand: 'rhautt',
    varName: '--brand-primary-dk',
    appValue: '#8b1414',
    authorityValue: '#76232f',
    note: '同上批次发现的伴随漂移，随 --brand-primary 一并裁决。',
  },
  // 下面三项：portal CSS 注释表明是「配比 D（2026-07-04 拍板）」的**刻意覆盖**
  // （暖米灰底/炭灰 ink/暖边界），但拍板结果从未回填 packages/tokens + brand-registry。
  // 待裁决方向：把配比 D 回写权威文件，或权威维持原值、portal 改回。本守卫上线时
  // （2026-08-14）发现并登记——此前无人知道权威文件已过时。
  {
    brand: 'rhautt',
    varName: '--brand-ink',
    appValue: '#1e1e1e',
    authorityValue: '#101c28',
    note: '配比D 刻意覆盖（Ruud Hero 炭灰，非蓝墨），权威未回填。2026-08-14 登记。',
  },
  {
    brand: 'rhautt',
    varName: '--brand-surface',
    appValue: '#f0ebe3',
    authorityValue: '#f8f8f8',
    note: '配比D 刻意覆盖（暖米灰底面，非纯白），权威未回填。2026-08-14 登记。',
  },
  {
    brand: 'rhautt',
    varName: '--brand-border',
    appValue: '#dde0dc',
    authorityValue: '#dfe2e4',
    note: '配比D 刻意覆盖（暖边界），权威未回填。2026-08-14 登记。',
  },
];

function parseVars(css) {
  const out = new Map();
  for (const m of css.matchAll(/(--brand-[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out.set(m[1], m[2].toLowerCase());
  }
  return out;
}

const failures = [];
const pendings = [];
let compared = 0;
for (const pair of PAIRS) {
  const appVars = parseVars(fs.readFileSync(path.join(ROOT, pair.app), 'utf8'));
  const authVars = parseVars(fs.readFileSync(path.join(ROOT, pair.authority), 'utf8'));
  for (const [name, authVal] of authVars) {
    const appVal = appVars.get(name);
    if (appVal === undefined) continue; // app 未声明同名变量 → 不属本守卫职责
    compared += 1;
    if (appVal === authVal) continue;
    const pending = PENDING_DECISIONS.find(
      (p) =>
        p.brand === pair.brand &&
        p.varName === name &&
        p.appValue.toLowerCase() === appVal &&
        p.authorityValue.toLowerCase() === authVal
    );
    if (pending) {
      pendings.push(`[${pair.brand}] ${name}: app=${appVal} 权威=${authVal} —— ${pending.note}`);
    } else {
      failures.push(
        `[${pair.brand}] ${name}: app=${appVal} ≠ 权威=${authVal}（${pair.authority}）——未登记的漂移`
      );
    }
  }
}

if (failures.length) {
  console.error('Token 权威源一致性守卫 —— FAIL');
  for (const x of failures) console.error('  - ' + x);
  console.error('\n处置：改回权威值；若权威本身要变，先改 packages/tokens + brand-registry 再同步 app。');
  process.exit(1);
}
console.log('Token 权威源一致性守卫 —— PASS');
console.log(`比对同名 --brand-* 变量 ${compared} 个（${PAIRS.length} 组 app↔权威映射）`);
if (pendings.length) {
  console.log(`\n⚠️  待裁决漂移 ${pendings.length} 项（已登记不算失败，但不是"没问题"）：`);
  for (const p of pendings) console.log('  - ' + p);
}
