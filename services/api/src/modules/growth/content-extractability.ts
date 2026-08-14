/**
 * 内容可抽取性评估（GEO 因果链第三环「能被抽取引用」的生成时守卫）
 *
 * 背景：策略库有 7 条研究支撑策略，但"生成的内容是否真的可被 AI 抽取引用"此前从未
 * 被检查过——写得再对，形态不可抽取（铺垫冗长/无直接回答句/整墙不分段）AI 引擎
 * 也引不动。本模块把 GEO 研究里可操作的形态特征固化为可复算的检查。
 *
 * 检查依据（均来自公开 GEO/answer-engine 研究的共性结论，非臆造）：
 *  - answer-first：引擎摘要偏好首段直接给答案（倒金字塔）；
 *  - 直接回答句：存在可独立摘出的短句结论（snippet 候选）；
 *  - 可切分：RAG 按段切块，超长整墙段会被截断或整段丢弃；
 *  - 结构化：列表/小标题是抽取锚点；
 *  - 事实密度：带数字/参数的句子更常被引用为证据。
 *
 * ⚠️ 诚实边界：
 *  - 这是**形态启发式**，通过≠一定被引用（被引用还取决于站点权威度/引擎索引等外因）；
 *  - 分数只用于排序与提示，**不阻断生成**——形态差的草稿仍落库，由审核人决定；
 *  - 各检查的判定规则全部写死在此文件、可复算，不依赖任何模型打分（模型打分不可复现）。
 */

export interface ExtractabilityCheck {
  id: 'answer-first' | 'direct-answer' | 'chunkable' | 'structured' | 'fact-density';
  passed: boolean;
  /** 人可读的判定说明（通过与否都给） */
  detail: string;
}

export interface ExtractabilityReport {
  /** 0-100，各检查加权 */
  score: number;
  /** score ≥ 70：形态达标（阈值写死可复算） */
  passed: boolean;
  checks: ExtractabilityCheck[];
  /** 给审核人的改进提示（只对未过项生成） */
  hints: string[];
  basis: 'heuristic-form-check';
}

/** 各检查权重（合计 100）。answer-first 与直接回答句最重——它们直接决定 snippet 候选。 */
const WEIGHTS: Record<ExtractabilityCheck['id'], number> = {
  'answer-first': 30,
  'direct-answer': 25,
  chunkable: 20,
  structured: 15,
  'fact-density': 10,
};

/** 铺垫套话（首段出现即判 answer-first 不过——引擎会跳过或截断这类开头） */
const FLUFF_OPENINGS = [
  '随着',
  '近年来',
  '在当今',
  '众所周知',
  '如今',
  '在这个',
  '不可否认',
  '首先让我们',
];
/** 结论性措辞（直接回答句的判据之一） */
const ANSWER_MARKERS = ['推荐', '建议', '适合', '应选', '选择', '答案是', '结论', '可以', '需要', '取决于', '优先'];
/** 事实密度：数字+单位（参数/年限/费用/性能），可被引擎当证据引用。
 *  兼容指标前置写法（"COP 2.5"/"IPLV 达 5.8"）——暖通参数惯用指标名在前。 */
const FACT_PATTERN =
  /\d+(?:\.\d+)?\s*(?:kW|W|℃|度|%|年|dB|分贝|匹|L|升|元|万|Pa|m³|小时|分钟)|(?:COP|IPLV|EER|SEER2?|HSPF2?|SCOP)\s*(?:达|为|不低于|≥|>=)?\s*\d/;

function paragraphs(text: string): string[] {
  return text
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function sentences(text: string): string[] {
  return text
    .split(/[。！？!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function assessExtractability(rawText: string): ExtractabilityReport {
  const text = String(rawText || '').trim();
  if (!text) {
    return {
      score: 0,
      passed: false,
      checks: [],
      hints: ['内容为空，无从评估'],
      basis: 'heuristic-form-check',
    };
  }
  const paras = paragraphs(text);
  const sents = sentences(text);
  const first = paras[0] || '';
  const checks: ExtractabilityCheck[] = [];

  // ① answer-first：首段 ≤200 字、含结论性措辞、不以铺垫套话开头
  const fluff = FLUFF_OPENINGS.find((f) => first.startsWith(f));
  const firstHasAnswer = ANSWER_MARKERS.some((m) => first.includes(m));
  const answerFirst = !fluff && firstHasAnswer && first.length <= 200 && first.length >= 15;
  checks.push({
    id: 'answer-first',
    passed: answerFirst,
    detail: answerFirst
      ? `首段 ${first.length} 字直接给出结论`
      : fluff
        ? `首段以铺垫套话「${fluff}…」开头——引擎摘要会跳过或截断`
        : first.length > 200
          ? `首段 ${first.length} 字过长，结论被稀释`
          : '首段没有结论性表述（推荐/适合/选择…），答案没有先行',
  });

  // ② 直接回答句：存在 12-60 字、含结论措辞的独立短句（snippet 候选）
  const snippet = sents.find(
    (s) => s.length >= 12 && s.length <= 60 && ANSWER_MARKERS.some((m) => s.includes(m))
  );
  checks.push({
    id: 'direct-answer',
    passed: Boolean(snippet),
    detail: snippet
      ? `存在可独立摘出的回答句：「${snippet.slice(0, 40)}…」`
      : '没有 12-60 字的独立结论句——引擎没有现成的 snippet 可摘',
  });

  // ③ 可切分：无超长整墙段（单段 ≤300 字）；≥300 字的内容须至少 3 段
  const longest = Math.max(0, ...paras.map((p) => p.length));
  const chunkable = longest <= 300 && (text.length < 300 || paras.length >= 3);
  checks.push({
    id: 'chunkable',
    passed: chunkable,
    detail: chunkable
      ? `${paras.length} 段、最长段 ${longest} 字，RAG 可按段切块`
      : longest > 300
        ? `存在 ${longest} 字整墙段——RAG 切块会截断或整段丢弃`
        : `${text.length} 字内容只有 ${paras.length} 段，缺乏切分点`,
  });

  // ④ 结构化：列表/编号/小标题（抽取锚点）
  const structured = /(^|\n)\s*(?:[-·•*]|\d+[.、）)]|#{1,4}\s|[一二三四五六七八九十][、.])/m.test(text);
  checks.push({
    id: 'structured',
    passed: structured,
    detail: structured ? '含列表/编号/小标题锚点' : '无列表或小标题——引擎缺少结构化抽取锚点',
  });

  // ⑤ 事实密度：至少一处 数字+单位（参数/年限/费用）
  const hasFact = FACT_PATTERN.test(text);
  checks.push({
    id: 'fact-density',
    passed: hasFact,
    detail: hasFact
      ? '含带单位的具体数字，可作为证据被引用'
      : '全文没有带单位的具体数字——没有可引用的事实点',
  });

  const score = checks.reduce((s, c) => s + (c.passed ? WEIGHTS[c.id] : 0), 0);
  const hints = checks
    .filter((c) => !c.passed)
    .map((c) => `[${c.id}] ${c.detail}`);
  return { score, passed: score >= 70, checks, hints, basis: 'heuristic-form-check' };
}
