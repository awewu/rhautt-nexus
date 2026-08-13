#!/usr/bin/env node
/**
 * 发布证据账本工具（release evidence ledger utils）。
 *
 * 多个 agent-guard 门禁在真实检查执行后，把"何时、用什么命令、产出了哪份报告"
 * 登记进 evidence/release-evidence.json —— 该文件是运行门禁的生成产物（gitignored），
 * 不是手工维护的清单；缺失时由重新运行相应门禁再生。
 *
 * 账本 schema 以 browser-visual-acceptance.js 内置的本地回退实现为准：
 *   { platform, status: 'not-production-complete', requiredEvidence: { <key>: {...} }, updatedAt }
 * 条目一律挂在 requiredEvidence 下；status 只有真实生产验收流程才可改动。
 *
 * 本模块只做读取-合并-写回并盖时间戳，自身不生成任何"通过"结论 ——
 * 结论只能来自调用方门禁真实执行的检查。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const EVIDENCE_PATH = path.join(ROOT, 'evidence', 'release-evidence.json');

function baseline() {
  return {
    platform: 'Rhautt Nexus / 瑞合数智枢纽',
    status: 'not-production-complete',
    requiredEvidence: {},
  };
}

function readReleaseEvidence() {
  if (!fs.existsSync(EVIDENCE_PATH)) return baseline();
  try {
    const parsed = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
    return {
      ...baseline(),
      ...parsed,
      platform: 'Rhautt Nexus / 瑞合数智枢纽',
      requiredEvidence: parsed.requiredEvidence || {},
    };
  } catch {
    // 损坏的账本不吞错误地"修复"，从基线重建（旧条目由门禁重跑再生）。
    return baseline();
  }
}

function updateReleaseEvidence(key, patch) {
  if (!key || typeof key !== 'string') throw new Error('release evidence key is required');
  const evidence = readReleaseEvidence();
  evidence.requiredEvidence[key] = {
    ...(evidence.requiredEvidence[key] || {}),
    ...(patch || {}),
    recordedAt: new Date().toISOString(),
  };
  evidence.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(EVIDENCE_PATH), { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return evidence.requiredEvidence[key];
}

module.exports = { readReleaseEvidence, updateReleaseEvidence, EVIDENCE_PATH };
