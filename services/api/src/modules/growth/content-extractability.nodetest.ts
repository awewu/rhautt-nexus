import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessExtractability } from './content-extractability';

const GOOD = `别墅采暖推荐空气源热泵两联供：一套设备同时解决采暖和空调，运行费比燃气锅炉低约 30%。

选型看三点：
1. 低温制热能力：寒冷地区选 -25℃ 仍能稳定制热的机型，COP 不低于 2.0；
2. 水力模块匹配：300 m³ 以上别墅建议双机头；
3. 末端形式：地暖 + 风盘组合舒适度最高。

安装要点：主机距卧室窗至少 3 米（噪音 55 dB 以内），机房预留检修空间。

维护上每年检查一次冷媒压力即可，滤网 3 个月清洗一次。`;

const BAD = `随着人们生活水平的不断提高，越来越多的家庭开始关注居住的舒适性，而采暖系统作为现代家居的重要组成部分，在提升生活品质方面扮演着不可或缺的角色，市场上的采暖方案琳琅满目，各种技术路线百花齐放，消费者在选择时往往感到眼花缭乱无所适从，因此了解各种采暖方式的特点就显得尤为重要，市面上从传统的集中供暖到分户式的燃气壁挂炉，从电地暖到空气源热泵，每一种方案都有其拥趸，每一种技术都有其存在的市场土壤和用户群体，在这样纷繁复杂的市场环境之下，普通消费者想要做出真正适合自己家庭情况的选择并非易事，需要综合考虑房屋结构朝向保温情况家庭成员构成生活习惯预算范围等诸多因素，只有充分了解才能做出明智的选择，让家人享受温暖舒适的冬天，这也是每个家庭的共同愿望和追求。`;

test('形态良好的内容：五项全过，score=100', () => {
  const r = assessExtractability(GOOD);
  assert.equal(r.score, 100);
  assert.equal(r.passed, true);
  assert.ok(r.checks.every((c) => c.passed));
  assert.deepEqual(r.hints, []);
});

test('铺垫整墙文：全部不过且给出人话提示', () => {
  const r = assessExtractability(BAD);
  assert.equal(r.passed, false);
  const byId = Object.fromEntries(r.checks.map((c) => [c.id, c]));
  assert.equal(byId['answer-first'].passed, false);
  assert.ok(byId['answer-first'].detail.includes('随着'), '应点名铺垫套话');
  assert.equal(byId['chunkable'].passed, false);
  assert.ok(byId['chunkable'].detail.includes('整墙段'));
  assert.equal(byId['structured'].passed, false);
  assert.equal(byId['fact-density'].passed, false);
  assert.ok(r.hints.length >= 4, '未过项应逐条给改进提示');
});

test('首段过长（结论被稀释）→ answer-first 不过', () => {
  const longFirst = '选热泵是对的，' + '这里是很长的解释'.repeat(30) + '。\n\n第二段。\n\n第三段。';
  const r = assessExtractability(longFirst);
  const c = r.checks.find((x) => x.id === 'answer-first')!;
  assert.equal(c.passed, false);
  assert.ok(c.detail.includes('过长'));
});

test('直接回答句判定：12-60 字含结论措辞才算 snippet 候选', () => {
  const noSnippet = '好。\n\n' + '这一段只是在描述现象和铺陈背景并没有给出任何判断'.repeat(2) + '。\n\n- 列表项 3 kW';
  const r = assessExtractability(noSnippet);
  assert.equal(r.checks.find((x) => x.id === 'direct-answer')!.passed, false);

  const withSnippet = '概述。\n\n寒冷地区推荐低温增焓机型，性价比最高。\n\n- 参数 COP 2.5';
  const r2 = assessExtractability(withSnippet);
  assert.equal(r2.checks.find((x) => x.id === 'direct-answer')!.passed, true);
});

test('事实密度：数字必须带单位才算（裸数字不算证据）', () => {
  const bare = '推荐选这款，理由有 3 个。\n\n- 第一\n- 第二\n\n结尾建议尽快安排。';
  const r = assessExtractability(bare);
  assert.equal(r.checks.find((x) => x.id === 'fact-density')!.passed, false);
});

test('通过≠必被引用：basis 字段声明启发式口径，阈值 70 写死可复算', () => {
  const r = assessExtractability(GOOD);
  assert.equal(r.basis, 'heuristic-form-check');
  const partial = assessExtractability('寒冷地区推荐低温热泵，COP 2.5 以上。\n\n说明一。\n\n说明二。');
  // answer-first(30)+direct(25)+chunkable(20)+fact(10)=85, structured 不过
  assert.equal(partial.score, 85);
  assert.equal(partial.passed, true);
});

test('空文本：零分且不抛异常', () => {
  const r = assessExtractability('');
  assert.equal(r.score, 0);
  assert.equal(r.passed, false);
});
