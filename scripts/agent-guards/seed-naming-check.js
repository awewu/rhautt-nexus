#!/usr/bin/env node
/**
 * 种子命名守卫（堵 F3 · 数据面失守）
 *
 * 背景：杜撰命名「瑞合舒适」在 tenant_brand_sites 种子里躺了 20 个迁移版本，
 * guard:nexus-naming 只扫代码不扫 SQL——代码有 57 个守卫，数据面接近零。
 *
 * 规则（语句级，避免把内容种子里的城市/品类词误伤）：
 *  ① 迁移 SQL（去注释后）出现**废弃/杜撰名** → 红。
 *     例外：登记在 CORRECTION_MIGRATIONS 的更正迁移可引用旧错名（WHERE name_cn=旧名）。
 *  ② 仅针对 `INSERT INTO ... tenant_brand_sites` / `UPDATE ... tenant_brand_sites` 语句：
 *     语句内出现的中文字符串字面量必须出自 brand-registry 权威命名集合
 *     （name_cn / naming.short_cn）→ 否则红。内容种子只 JOIN 不写该表，不受影响。
 * 口径谦卑：字面量启发式，只捕"名字写错"，不验证种子结构正确性。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const MIG_DIR = path.join(ROOT, 'database', 'postgres', 'migrations');

// 更正迁移豁免（引用旧错名是它的本职）+ 历史迁移豁免（已应用迁移不可改写，错误由后续迁移更正）
const CORRECTION_MIGRATIONS = {
  '115_brand_sites_naming_and_lithnova.sql':
    '命名更正迁移本身需引用旧错名（UPDATE ... WHERE name_cn=旧名）',
  '095_seed_official_brand_sites.sql':
    '历史错误本尊：已应用迁移不可改写（会破坏各环境一致性），其「瑞合舒适」由 115 更正——新迁移不许再犯',
};

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand-registry.json'), 'utf8'));
const allowed = new Set();
const forbidden = new Map();
for (const b of registry.brands || []) {
  if (b.name_cn) allowed.add(String(b.name_cn).trim());
  const shortCn = b.fundamentals?.naming?.short_cn;
  if (shortCn) allowed.add(String(shortCn).trim());
  for (const aka of b.fundamentals?.naming?.deprecatedAka || []) {
    forbidden.set(String(aka).trim(), `brand-registry 将其列为 ${b.slug} 的废弃别名`);
  }
}
forbidden.set('瑞合舒适', '2026-08 实证的杜撰名——Rhautt Comfort 中文是「瑞合瑞德」（迁移 115 已更正）');

const stripSqlComments = (sql) => sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** 抽取写 tenant_brand_sites 的语句（INSERT/UPDATE 到分号；含 CTE 前缀 WITH ... INSERT） */
function brandSiteWriteStatements(sql) {
  const out = [];
  const re = /(?:WITH[\s\S]*?)?(?:INSERT\s+INTO|UPDATE)\s+(?:\w+\.)?tenant_brand_sites[\s\S]*?;/gi;
  for (const m of sql.matchAll(re)) out.push(m[0]);
  return out;
}

const failures = [];
let scanned = 0;
let writeStmts = 0;
for (const f of fs.readdirSync(MIG_DIR).filter((x) => x.endsWith('.sql'))) {
  const sql = stripSqlComments(fs.readFileSync(path.join(MIG_DIR, f), 'utf8'));
  scanned += 1;

  // ① 禁用名（更正迁移豁免）
  if (!CORRECTION_MIGRATIONS[f]) {
    for (const [name, why] of forbidden) {
      if (sql.includes(name)) failures.push(`${f}: 出现禁用名「${name}」—— ${why}`);
    }
  }

  // ② 写 tenant_brand_sites 的语句：中文名须出自权威集合
  for (const stmt of brandSiteWriteStatements(sql)) {
    writeStmts += 1;
    for (const m of stmt.matchAll(/'([\u4e00-\u9fff][\u4e00-\u9fff\s]{0,15})'/g)) {
      const lit = m[1].trim();
      if (!allowed.has(lit) && !forbidden.has(lit)) {
        failures.push(
          `${f}: tenant_brand_sites 写入语句含中文名「${lit}」，不在 brand-registry 权威命名集合中`
        );
      }
    }
  }
}

if (failures.length) {
  console.error('种子命名守卫 —— FAIL');
  for (const x of [...new Set(failures)]) console.error('  - ' + x);
  console.error('\n处置：命名以 brand-registry 为唯一真相源；新品牌先入 registry 再写种子。');
  process.exit(1);
}
console.log('种子命名守卫 —— PASS');
console.log(
  `扫描迁移 ${scanned} 个 · tenant_brand_sites 写入语句 ${writeStmts} 条 · 权威命名 ${allowed.size} 个 · 禁用名 ${forbidden.size} 个 · 更正迁移豁免 ${Object.keys(CORRECTION_MIGRATIONS).length} 个`
);
console.log('（语句级字面量启发式：只捕"名字写错"，不验证种子结构正确性）');
