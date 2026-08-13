#!/usr/bin/env node
/**
 * P0-2 · 真实 Redis Stream 运行时烟雾（redis-stream-smoke）。
 *
 * 面向真实 Redis（REDIS_URL 或 REDIS_HOST/REDIS_PORT，默认 localhost:6379）验证
 * 消费组分发底座的最小闭环：XADD → XGROUP CREATE(幂等) → XREADGROUP('>') → XACK → XPENDING=0。
 * 使用独立的一次性 smoke stream key（跑完即删），不触碰业务流 rhautt:events。
 *
 * Redis 不可达时打印「跳过」并以 0 退出 —— 由 guard:redis-stream-dispatch 记为
 * 非阻断 skip（语义正确性另由内存客户端语义单测保证）。
 */

const REDIS_URL =
  process.env.REDIS_URL ||
  `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || '6379'}`;

async function main() {
  let createClient;
  try {
    ({ createClient } = require('redis'));
  } catch {
    console.log('跳过：未安装 redis 依赖（npm install 后重试）');
    return;
  }

  const client = createClient({
    url: REDIS_URL,
    socket: { connectTimeout: 2000, reconnectStrategy: false },
  });
  client.on('error', () => {
    /* 由 connect() 的 reject 统一处理 */
  });

  try {
    await client.connect();
  } catch (e) {
    console.log(
      `跳过：真实 Redis 不可达（${REDIS_URL}）—— ${String((e && e.message) || e).slice(0, 120)}`
    );
    return;
  }

  const key = `rhautt:smoke:stream:${Date.now()}`;
  const group = 'smoke-consumers';
  const failures = [];

  try {
    // 1) XADD
    const id = await client.xAdd(key, '*', {
      outboxId: 'smoke-1',
      tenantId: 'smoke',
      eventType: 'smoke.test',
    });
    if (!id) failures.push('XADD 未返回消息 id');

    // 2) XGROUP CREATE（幂等：BUSYGROUP 视为成功）
    try {
      await client.xGroupCreate(key, group, '0', { MKSTREAM: true });
    } catch (e) {
      if (!String((e && e.message) || e).includes('BUSYGROUP')) throw e;
    }

    // 3) XREADGROUP('>') 互斥读取
    const res = await client.xReadGroup(group, 'smoke-consumer-1', [{ key, id: '>' }], {
      COUNT: 10,
    });
    const messages = (res && res[0] && res[0].messages) || [];
    if (messages.length !== 1) failures.push(`XREADGROUP 应读到 1 条，实际 ${messages.length}`);
    if (messages[0] && messages[0].message.outboxId !== 'smoke-1')
      failures.push('消息字段 outboxId 不符');

    // 4) 二次 '>' 读取不得重复投递同一条
    const res2 = await client.xReadGroup(group, 'smoke-consumer-2', [{ key, id: '>' }], {
      COUNT: 10,
    });
    const messages2 = (res2 && res2[0] && res2[0].messages) || [];
    if (messages2.length !== 0)
      failures.push(`消费组互斥被破坏：第二个消费者读到 ${messages2.length} 条`);

    // 5) XACK 后 PEL 清零
    if (messages.length)
      await client.xAck(
        key,
        group,
        messages.map((m) => m.id)
      );
    const pending = await client.xPending(key, group);
    const pendingCount = Number((pending && pending.pending) || 0);
    if (pendingCount !== 0) failures.push(`XACK 后 PEL 应为 0，实际 ${pendingCount}`);
  } finally {
    try {
      await client.del(key);
    } catch {
      /* noop */
    }
    try {
      await client.quit();
    } catch {
      /* noop */
    }
  }

  if (failures.length) {
    console.error('❌ Redis Stream 运行时烟雾未通过：');
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }
  console.log(
    `✅ Redis Stream 运行时烟雾通过（${REDIS_URL}）：XADD/XREADGROUP 互斥/XACK/PEL 全部符合预期`
  );
}

main().catch((e) => {
  console.error(`❌ Redis Stream 运行时烟雾异常：${String((e && e.message) || e)}`);
  process.exit(1);
});
