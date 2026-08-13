#!/usr/bin/env node
/**
 * decision.v1 契约防漂移门禁（四仓一致）
 * ────────────────────────────────────────────────────────────────
 * 权威副本: hermes-tandem/contracts/decision.v1.contract.ts
 * 消费副本: StrategyOS / PLM / rhautt_gtm 各 vendor 一份逐字节相同的副本。
 *
 * 校验两层:
 *   1. 字节层: 本仓契约文件 (LF 归一后) 的 sha256 必须等于 PINNED_SHA256。
 *      四个仓 pin 同一个值 → 任何一侧擅自改动 (包括格式化器改写) 立即红。
 *   2. 语义层: 文件内 CONTRACT_FINGERPRINT 常量必须等于 PINNED_FINGERPRINT
 *      (各仓单测另有 computeContractFingerprint() === CONTRACT_FINGERPRINT 断言)。
 *
 * 升级流程: 改 hermes 权威副本 → 更新 CONTRACT_FINGERPRINT → 原样同步三个
 * 消费仓 → 四个仓同时更新本文件的 PINNED_SHA256 / PINNED_FINGERPRINT。
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const CONTRACT_PATH = 'services/api/src/contracts/decision/decision.v1.contract.ts';
const PINNED_SHA256 = '0d4736a0d282c927e885aa218665429ac4b79b37a510fe71f29280706687ef3f';
const PINNED_FINGERPRINT = '292878317b41828d';

const raw = readFileSync(CONTRACT_PATH, 'utf8');
const normalized = raw.replace(/\r\n/g, '\n');
const sha = createHash('sha256').update(normalized, 'utf8').digest('hex');

const failures = [];
if (sha !== PINNED_SHA256) {
  failures.push(
    `字节漂移: ${CONTRACT_PATH} 的 sha256(LF 归一) = ${sha}\n` +
      `  期望 pin = ${PINNED_SHA256}\n` +
      `  契约文件必须与 hermes-tandem 权威副本逐字节一致（不得被格式化器改写）。\n` +
      `  如是有意升级契约，请按升级流程同步四仓并同时更新四仓的 pin。`
  );
}
const m = normalized.match(/CONTRACT_FINGERPRINT\s*=\s*'([0-9a-f]+)'/);
if (!m) failures.push(`未找到 CONTRACT_FINGERPRINT 常量: ${CONTRACT_PATH}`);
else if (m[1] !== PINNED_FINGERPRINT) {
  failures.push(`指纹漂移: CONTRACT_FINGERPRINT=${m[1]}，期望 ${PINNED_FINGERPRINT}`);
}

if (failures.length) {
  console.error(`decision.v1 contract sync check: FAIL (${failures.length})`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(
  `decision.v1 contract sync check: OK (sha256=${sha.slice(0, 12)}…, fingerprint=${PINNED_FINGERPRINT})`
);
