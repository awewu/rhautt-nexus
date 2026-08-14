import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveTopics,
  deriveProductTopics,
  scoreTopic,
  FOCUS_WEIGHT,
  SCENARIO_TEMPLATES,
  resolveVocabulary,
  planSeedScenarios,
  DEFAULT_VOCABULARY,
} from './geo-scenarios';

const base = {
  category: '空调',
  audience: 'owner' as const,
  painPoint: '电费高',
  intent: 'compare' as const,
};

test('缺少可选字段时，需要该字段的模板被跳过（绝不产出未填充占位）', () => {
  const topics = deriveTopics({ ...base, houseType: null, climateZone: null });
  assert.ok(topics.length > 0, '应仍能派生出不依赖可选字段的问题');
  for (const t of topics) {
    assert.ok(!t.question.includes('null'), `问句不得包含 null: ${t.question}`);
    assert.ok(!t.question.includes('undefined'), `问句不得包含 undefined: ${t.question}`);
    assert.ok(!/\{|\}/.test(t.question), `问句不得残留占位符: ${t.question}`);
  }
});

test('补齐房型与气候区后，派生问题数量增加且填充正确', () => {
  const few = deriveTopics({ ...base });
  const many = deriveTopics({ ...base, houseType: '老房', climateZone: '寒冷' });
  assert.ok(many.length > few.length, '字段更全应派生出更多问题');
  assert.ok(
    many.some((t) => t.question.includes('老房')),
    '应把房型填入问句'
  );
  assert.ok(
    many.some((t) => t.question.includes('寒冷')),
    '应把气候区填入问句'
  );
});

test('priority 方向正确：商业价值越高，priority 数字越小（与问题库 ASC 排序一致）', () => {
  const decide = scoreTopic({ intent: 'decide' });
  const info = scoreTopic({ intent: 'info' });
  assert.ok(decide.score > info.score, '决策型意向强度应高于信息型');
  assert.ok(decide.priority < info.priority, '价值高者 priority 数字应更小');
  assert.ok(decide.priority >= 1 && info.priority <= 199, 'priority 应落在合法区间');
});

test('具体度与胜算提升分数，且分数封顶 100', () => {
  const plain = scoreTopic({ intent: 'compare' });
  const specific = scoreTopic({ intent: 'compare', hasHouseType: true, hasClimateZone: true });
  assert.ok(specific.score > plain.score, '更具体的问题应得分更高');
  const maxed = scoreTopic({
    intent: 'decide',
    hasHouseType: true,
    hasClimateZone: true,
    winnability: 999,
  });
  assert.equal(maxed.score, 100, '分数应封顶 100');
  assert.ok(maxed.factors.winnability <= 20, '胜算因子应被夹到 0-20');
});

test('角色专属模板只对相应角色生效', () => {
  const installerOnly = SCENARIO_TEMPLATES.find(
    (t) => t.audiences?.includes('installer') && t.audiences.length === 1
  );
  assert.ok(installerOnly, '应存在仅安装工可见的模板');
  const owner = deriveTopics({ ...base, audience: 'owner' });
  const installer = deriveTopics({ ...base, audience: 'installer' });
  assert.ok(!owner.some((t) => t.templateId === installerOnly!.id), '业主不应看到安装工专属问题');
  assert.ok(
    installer.some((t) => t.templateId === installerOnly!.id),
    '安装工应看到其专属问题'
  );
});

// ── 播种器 ──
test('未知品类且未提供痛点 → 拒绝播种（不编造痛点）', () => {
  assert.equal(resolveVocabulary('量子空调'), null, '未知品类应返回 null');
  assert.equal(resolveVocabulary(''), null);
  const withOverride = resolveVocabulary('量子空调', { painPoints: ['纠缠失效'] });
  assert.ok(withOverride, '调用方提供痛点后应可播种');
  assert.deepEqual(withOverride!.painPoints, ['纠缠失效']);
});

test('内置品类词表可用，且调用方覆盖优先', () => {
  const builtin = resolveVocabulary('空调');
  assert.ok(builtin && builtin.painPoints.length > 0, '内置品类应有痛点词表');
  assert.deepEqual(builtin!.painPoints, DEFAULT_VOCABULARY['空调'].painPoints);
  const overridden = resolveVocabulary('空调', { painPoints: ['自定义痛点'] });
  assert.deepEqual(overridden!.painPoints, ['自定义痛点'], '覆盖应优先于内置');
});

test('播种采用轮转配对而非笛卡尔积，受 cap 约束且结果去重', () => {
  const vocabulary = resolveVocabulary('空调')!;
  const seeds = planSeedScenarios({ category: '空调', vocabulary, maxScenarios: 6 });
  assert.ok(seeds.length <= 6, '不得超过 cap');
  assert.ok(seeds.length > 0, '应产出场景');
  const keys = seeds.map((s) => [s.painPoint, s.houseType, s.climateZone, s.audience].join('|'));
  assert.equal(new Set(keys).size, keys.length, '场景不得重复');
  // 全笛卡尔积会是 5痛点×6房型×5气候区=150，轮转应远小于此
  const uncapped = planSeedScenarios({ category: '空调', vocabulary, maxScenarios: 50 });
  assert.ok(uncapped.length <= 10, `轮转配对应避免组合爆炸，实际 ${uncapped.length}`);
});

test('播种覆盖多个痛点并轮转意向层级（覆盖全漏斗）', () => {
  const vocabulary = resolveVocabulary('空调')!;
  const seeds = planSeedScenarios({ category: '空调', vocabulary, maxScenarios: 6 });
  assert.ok(new Set(seeds.map((s) => s.painPoint)).size > 1, '应覆盖多个痛点');
  assert.ok(new Set(seeds.map((s) => s.intent)).size > 1, '意向层级应轮转');
});

test('多角色播种时各角色均被覆盖', () => {
  const vocabulary = resolveVocabulary('空调')!;
  const seeds = planSeedScenarios({
    category: '空调',
    vocabulary,
    audiences: ['owner', 'installer'],
    maxScenarios: 8,
  });
  const roles = new Set(seeds.map((s) => s.audience));
  assert.ok(roles.has('owner') && roles.has('installer'), '两个角色都应出现');
});

test('派生结果按商业价值排序（priority 升序）', () => {
  const topics = deriveTopics({ ...base, houseType: '老房', climateZone: '寒冷' });
  for (let i = 1; i < topics.length; i += 1) {
    assert.ok(topics[i - 1].priority <= topics[i].priority, '结果应按 priority 升序');
  }
});

// ── 主销权重（政策权重，非市场事实）──

test('主销权重：同意向下主销选题 priority 更优，factors.focus 如实记录', () => {
  const plain = scoreTopic({ intent: 'compare' });
  const focus = scoreTopic({ intent: 'compare', isFocus: true });
  assert.equal(focus.factors.focus, FOCUS_WEIGHT);
  assert.equal(plain.factors.focus, 0);
  assert.ok(focus.priority < plain.priority, '主销应更优先');
  assert.equal(focus.score - plain.score, FOCUS_WEIGHT);
});

test('主销权重不得凌驾意向：低意向+主销 仍排在 高意向 之后', () => {
  const infoFocus = scoreTopic({ intent: 'info', isFocus: true }); // 20 + 12
  const decidePlain = scoreTopic({ intent: 'decide' }); // 80
  assert.ok(
    infoFocus.priority > decidePlain.priority,
    '政策权重(12)必须小于意向档差(30)，主销不能把闲聊问题抬过决策问题'
  );
});

// ── 产品级选题派生 ──

const product = {
  productName: 'Rheem AP-500 空气源热泵',
  category: '中央热水',
  sku: 'AP-500',
  sellingPoints: [{ claim: 'COP 4.2 实测' }],
};

test('产品级选题：产出型号级问题且含卖点验证问句', () => {
  const topics = deriveProductTopics(product, { isFocus: true });
  assert.ok(topics.length >= 4, '3 个固定模板 + 1 个卖点问句');
  assert.ok(topics.every((t) => t.question.includes('Rheem AP-500')), '每个问题都应含型号名');
  const claimQ = topics.find((t) => t.templateId === 'product-claim-verify');
  assert.ok(claimQ && claimQ.question.includes('COP 4.2 实测'), '卖点应入题');
  assert.ok(topics.every((t) => t.factors.focus === FOCUS_WEIGHT), '主销权重应生效');
});

test('产品级选题：过长卖点(>24字)不入题——宁可跳过不硬凑', () => {
  const topics = deriveProductTopics(
    { ...product, sellingPoints: [{ claim: '这是一条超过二十四个字符长度上限的卖点描述文本示例内容' }] },
    {}
  );
  assert.ok(!topics.some((t) => t.templateId === 'product-claim-verify'), '长 claim 不应生成问句');
});

test('产品级选题：产品名或品类为空 → 返回空数组（不产出残缺问题）', () => {
  assert.deepEqual(deriveProductTopics({ productName: '', category: '中央热水' }), []);
  assert.deepEqual(deriveProductTopics({ productName: 'X', category: '  ' }), []);
});

test('产品级选题：重复卖点去重，结果按 priority 升序', () => {
  const topics = deriveProductTopics(
    { ...product, sellingPoints: [{ claim: 'COP 4.2 实测' }, { claim: 'COP 4.2 实测' }] },
    {}
  );
  const claimQs = topics.filter((t) => t.templateId === 'product-claim-verify');
  assert.equal(claimQs.length, 1, '相同卖点只应产出一个问句');
  for (let i = 1; i < topics.length; i += 1) {
    assert.ok(topics[i - 1].priority <= topics[i].priority);
  }
});

test('产品级选题：非主销(isFocus 缺省) focus 因子为 0', () => {
  const topics = deriveProductTopics(product, {});
  assert.ok(topics.every((t) => t.factors.focus === 0));
});
