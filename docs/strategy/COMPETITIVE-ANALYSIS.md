# AI-GTM Nexus · 竞品对标与差异化分析

> **本轮检索：2026-08-13**（上轮 2026-08，见 §2.1b 首次更正）。依据：公开产品页/发布稿/文档实证检索 + 本平台代码复盘。
> 遵循基座6：每条结论标注检索日期与出处；既往错误显式更正并留痕；"我方领先"的主张必须可证伪。
> 关联：`NEXUS-CAPABILITY-EVOLUTION.md`(能力进化) · `NEXUS-MARKETING-PLATFORM-BASELINE.md`(基线)。

## 0. 本轮最重要的一句话

**上一版赖以立身的三条差异化（执行侧闭环、对照实验 lift、lift 反哺自进化），本轮检索发现基本全被对手覆盖。** 详见 §2.1c/§2.1d 两条更正。我方真正剩下的护城河比原先自述**窄得多**，须据此重排路线（§6）。

## 1. PRD 功能体系复盘
- 主轴：两支柱（产品事实基座🛡️ + AI-GEO 引擎🗡️）+ AI 贯穿层 + 十模块 + 线索飞轮 + **闭环 lift 实验**；北极星 = GEO→高意向线索。
- 强项：主线自洽、有可证伪闭环（基线→生成→发布→复投→lift）、受治理动作引擎（green/yellow/red + 人与 AI 同闸 + 审计 + RLS）、**本体对象注册表**（动作名词与事实图谱同源，编译期约束）。
- 弱项：**真实探测数据为零**（AI 网关未配置）→ lift/竞品时序/自进化全部处于"机制在、数据无"状态；多引擎覆盖窄；经销商门户占位。

## 2. 赛道对标（2026-08-13 实况）

### 2.1 GEO / AI 可见度（最卷）
| 产品 | 定位 | 本轮新增事实（出处） |
|---|---|---|
| Profound | 企业标杆 | 见 §2.1c，**已跨入执行侧** |
| Peec AI | 中端 SoV 分析 | €89–199/mo（上轮） |
| Otterly | 入门 | $29+/mo（上轮） |
| Scrunch | 2026.6 被 Sitecore 收购并入 DXP | 上轮记录 |
| AthenaHQ | 来源引用情报 | $295–499/mo（上轮） |
| Ahrefs Brand Radar / Semrush AI / HubSpot AEO | SEO 套件 AI 附加 | 上轮记录 |

### 2.1b ⚠️ 更正一（2026-08，保留痕迹）：执行侧**不是无人区**
初版"执行侧无人做"结论**不成立**。多门店赛道已闭环执行：
| 产品 | 规模 | 关键能力 |
|---|---|---|
| **Yext** | NYSE 上市 · 340 万门店实体 · 200+ 发布渠道 | Knowledge Graph + Scout → 受治理动作 |
| **SOCi** | 1→10 万+ 门店 | 品牌训练 AI Agent 代执行 + 批量动作 + 审批流 |
| **Uberall GEO Studio** | 企业级 | 导入→基线→建议→一键应用→复测 |

### 2.1c ⚠️ 更正二（2026-08-13）：**"只监测不执行"对 Profound 也已不成立**
上一版写"只监测不执行仅对 Profound/Peec/Otterly 成立"——**该结论已被证伪，特此更正**：
- **Profound Aim**（2026-07-02 发布稿, globenewswire）：常驻后台 agent，持续监测可见度/情感/事实准确性/agentic 流量，**自动识别机会 → 生成可执行 Projects → 经 Profound Agents 协调执行**，人保持控制权。
- **Profound Agents + MCP**（tryprofound.com/blog/profound-2026, product.tryprofound.com/changelog）：自然语言描述即可造 agent；经 MCP 在 Claude/Slack 内运行，支持 WordPress/Search Console/Google Docs 等第三方节点；**Enterprise 版已有 Activity Logs 全量审计 + SSO**。
- **Profound Index**（2026-06-29 发布稿）：**15 亿真实用户 prompt**、50+ 行业、每周更新的行业排行榜与 prompt 研究。
- **FactCheck**：把"AI 是否说错我方事实"做成产品指标——**直逼我方"事实基座"叙事**。

**推论**：①"监测 vs 执行"已不再是赛道分界线，执行是标配；②审计/SSO/审批等治理能力**已是入场券而非差异化**；③Profound 的 15 亿 prompt 基准与我方单租户零数据的差距是**数量级**的。

### 2.1d ⚠️ 更正三（2026-08-13）：**"对照实验 lift"与"lift 反哺策略"也已有人做**
上一版称这两条"暂未见对方公开做"——**已被证伪**：
| 产品 | 实证能力（出处） |
|---|---|
| **Siftly** | 把追踪主题**聚类后拆成 test/control 两组**，对比可见度与引用的分歧；明确论述"没有对照组，任何变化都可能是模型更新/竞品动作/主题波动的噪声"（siftly.ai/features/experimentation） |
| **TopSlot** | **中断时间序列 + 95% 置信区间排除零 + 最小样本量下限**；28 天基线 vs 7/14/30 天窗口；未过阈值时**返回"数据还不够"而不是编造胜利**（topslot.ai/product/visibility-trends） |
| **Viali** | A/B 双变体交给引擎评判；**获胜模式回流 Content Studio 简报，下一稿从上次结束的地方开始**——这正是我方所谓独有的"lift 反哺策略库"（viali.ai/product/ab-testing） |
| **LLM Pulse** | 时间型/拆分型受控测试，test/control URL 分组（llmpulse.ai/features/geo-testing） |

**尤其刺痛的一条**：TopSlot 的"宁可说数据不够也不编造胜利"与我方基座4「诚实边界」是同一主张，**且对方已产品化并作为卖点对外讲**。我方目前只是"前后对比 + 小样本闸"，**统计严谨度实际落后**（无对照组、无置信区间、无中断时间序列）。

### 2.1e ⚠️ 更正四（2026-08-13）：中文引擎**不是我方的地理护城河**
此前内部假设"国际工具不覆盖中文 AI 引擎，是我方天然壁垒"。**该假设不成立**：
- **KAWO GEO域见**（geo.kawo.com）：DeepSeek/豆包/元宝/通义等中文 LLM 品牌监测。
- **GEO Insights**（geo.geotoolhub.com）：**8 个中文平台的 API**（deepseek/doubao/qianwen/yuanbao/kimi/baiduai/quark/weibo_zhisou），返回回答正文、引用来源、截图、推理轨迹，2–3 分钟出结构化 JSON。
- **Citany**：把中文引擎与全球引擎当作同一运营问题处理。
- **ChinaRankAI**：5 个中文平台 + 9 竞品对标。
- **Eastbound**（eastbound.ai/china-ai-visibility）：公开实测**各引擎来源结构差异**——DeepSeek 中国大陆来源占 72.3%、Qwen 85.0%、豆包 88.6%；三者 Top-15 来源 Jaccard 仅 0.20–0.30；并给出一周后复测 Pearson r 0.97–0.99 的复现性数据。

**反向价值**：GEO Insights 这类 API 可直接作为我方多引擎探测后端（见 §6 P0），**不必自建爬虫**。Eastbound 的来源结构差异则说明——**一套策略打所有引擎是错的**，策略库应按引擎分化。

### 2.1f ⚠️ 更正五（2026-08-13）：HVAC 垂直**已有人在建同构架构**
"暖通垂直无对手"不再安全：**CI Web Group「Hydra OS」为海信家用暖通（Hisense Comfort）搭建**（ciwebgroup.com/featured-customers/hisensecomfort）——自述为"**一张实体图谱、渠道三层**"：厂商站持有产品系统/市场/质保/品牌证据，经销商territory 微站承载本地网点与承包商上下文，dealer locator 连接终端用户与安装商。**这与 Nexus 的"品牌事实基座 → 经销商网络 → 终端用户"几乎同构。**

同时暴露我方一处**真实盲区**：B2B 规格侧需求（MEP 工程师/设计院按 **ASHRAE 90.1 / AHRI 340-360 / SEER2 / EER2 / COP / ISO 16890** 检索，规格决定在采购前 8–18 个月写死）。我方场景词表**全部是消费者痛点**（电费高/噪音大/回南天潮），完全没有规格侧词汇——而这恰恰是 9 域技术内核最能碾压通用营销工具的战场。

### 2.2 Agentic 营销平台（横向巨头 · 2026-08-13）
- **Yext**（2026-06-17 发布稿）：**全平台开放给 agentic 执行**——品牌核实事实 + 1200 万门店的本地竞争情报 + 执行层，经 **MCP/API/桌面/移动**接入任意 AI 工具。Scout：每月 100 亿信号、4 个 AI 模型、每次扫描 150 项可见度指标 × 20 个竞品（2026-05-18 Scout MCP/API 发布稿）。指标从 Visibility Score 改为 **Win Rate**（对竞品的赢率）。CEO 原话："没有竞争情报的 agent 只会把平庸自动化。"
- **SOCi**（2026-02-11 PRNewswire）：**20 万个品牌训练 agent、完成 1250 万个任务**，同比增长 200%+；2026 LVI 基于 2751 个品牌/35 万门店/120+ 指标；自述"在 ChatGPT 本地推荐中获得可见度比传统本地搜索难约 30 倍"。
- **Uberall UB-I**：单 agent 路线（对手多 agent），持续监测 → 判定优先级 → **起草并执行**（可选人工确认或全自动），10→10000 门店。
- Salesforce Agentforce / HubSpot Agent Hub / Typeface：上轮记录，本轮未复检。

### 2.3 新赛道信号：Agentic Commerce（**与我方产品事实基座直接相关**）
**OpenAI Agentic Commerce Protocol (ACP)**（developers.openai.com/commerce/specs）：商家以**结构化产品 feed** 供 OpenAI 摄取与索引，字段含 `id/title/description/link/image_link/availability/price/brand`，要求 **GTIN 或 MPN**，支持 Google 产品数据格式兼容路径；ChatGPT Shopping 已在美国上线，Shopify/Etsy 目录已自动接入。Profound 已把 **Shopping 数据**纳入监测与 MCP。
**含义**：AI 可见度正从"答案里被提到"扩展到"**商品被 AI 导购摆上货架**"。我方 D2 产品事实基座（含 GTIN/MPN/规格/JSON-LD）是**天然的供给侧资产**——这是少数我方起点优于纯营销工具的赛道。

## 3. 我方剩余护城河（经本轮证伪后收窄）
| 主张 | 状态 | 说明 |
|---|---|---|
| 执行侧闭环 | ❌ **不再是差异化** | Profound/Yext/SOCi/Uberall 全部具备 |
| 对照实验 lift | ❌ **落后** | Siftly/TopSlot/LLM Pulse 已有对照组与统计闸，我方仅前后对比 |
| lift 反哺策略 | ❌ **不再独有** | Viali 已产品化 |
| 治理/审批/审计 | ❌ **入场券** | Uberall/SOCi/Profound 均具备 |
| 中文引擎覆盖 | ❌ **非壁垒** | 中文 GEO 工具市场已成形 |
| HVAC 垂直 | 🟡 **正被进入** | CI Web Group × 海信 Hydra OS 同构 |
| **9 域 HVAC 精算内核**（从工况算出参数再生成内容） | ✅ **仍成立** | 对手是"实体一致性 + 列表分发"，无工程计算资产；这是软件工程壁垒而非内容壁垒 |
| **同一 RLS 边界内 事实→内容→AI可见度→线索→经销商成交 全链路** | 🟡 **条件成立** | 对手止于营销层，成交在客户自有 CRM；但我方须真跑出归因数据才算数 |
| **规格侧（specifier）技术内容** | ✅ **空位** | 通用工具无 ASHRAE/AHRI/SEER2 语义；我方有内核但**尚未建词表** |

**结论**：护城河从"组合优势"收窄为**「工程计算资产 × 规格侧语义 × 单租户全链路归因」**，且三条都尚未用数据证明。

## 4. 诚实差距（2026-08-13）
| 维度 | 国际领先 | Nexus |
|---|---|---|
| 基准数据规模 | Profound 15 亿 prompt / Yext 每月 100 亿信号 · 1200 万门店 | **单租户，真实探测 0 条** |
| 执行 agent 规模 | SOCi 20 万 agent / 1250 万任务 | 4 个受治理动作，未接真模型 |
| 实验统计严谨度 | TopSlot 中断时间序列 + 95% CI + 样本下限 | 前后对比 + 小样本闸（无对照组/无 CI） |
| 分发形态 | Profound/Yext 均已 MCP 化 | 仅自有 UI + REST |
| 引擎覆盖 | 4–6 引擎常态 | 单一网关，且未配置 |
| 合规认证 | Profound SOC2 | RLS/审计齐，无外部认证 |

## 5. 不再成立的说法（供全仓引用时校正）
- ❌ "GEO 执行侧是无人区" → 已是标配。
- ❌ "对照实验 lift 是我方独有" → Siftly/TopSlot/LLM Pulse 更严谨。
- ❌ "lift 反哺策略库暂未见对方做" → Viali 已做。
- ❌ "受治理动作 + 审计是差异化" → 入场券。
- ❌ "中文引擎是天然壁垒" → 中文 GEO 工具市场已成形。

## 6. 进化路线（按"能否解开死结"排序，全部锚定 §2 证据）
**P0 · 解开数据死结（一切能力的血液）**
接入中文引擎探测数据源（§2.1e：GEO Insights 8 平台 API 返回回答/引用/截图，2–3 分钟出 JSON），或配置 Hermes 网关真模型。**在此之前，lift、竞品时序、自进化、SWOT 全部是"机制在、数据无"，对外不得宣称有效（基座4）。**

**P1 · 把统计严谨度补到不落后**（对标 §2.1d）
实验从"前后对比"升级为：test/control 主题分组 + 中断时间序列 + 95% 置信区间 + 最小样本下限；未过闸时返回"数据不足"。我方已有"小样本不出结论"的诚实设计，**补上对照组与 CI 即可反超**——这是投入产出比最高的一项。

**P2 · 建规格侧（specifier）场景词表**（§2.1f 暴露的盲区）
在既有场景播种器中新增 B2B 词表：ASHRAE 90.1 / AHRI 340-360 / SEER2 / EER2 / HSPF2 / COP / SCOP / ISO 16890 / BIM-Revit 族文件；角色扩展至 MEP 工程师、设计院、机电承包商、调试方。**这是 9 域技术内核唯一能形成碾压的战场**，且通用营销工具无此语义。

**P3 · 产品事实基座 → Agentic Commerce feed**（§2.3）
把 D2 产品事实（GTIN/MPN/规格/价格/可得性）产出为 ACP 兼容 feed，使产品进入 AI 导购供给侧。**这是我方资产结构优于纯营销工具的少数赛道**，且与"事实基座唯一真相源"的架构天然一致。

**P4 · MCP 出口**（§2.1c/§2.2：Profound 与 Yext 均已 MCP 化，正在成为标配分发形态）
把 Nexus 的事实基座（只读）与受治理动作（写，走同一治理闸）通过 MCP 暴露，让 AI 工具直接调用。我方的**治理闸 + 审计 + RLS 恰好是 MCP 写操作最需要的东西**。

**P5 · 策略库按引擎分化**（§2.1e Eastbound 实测：三引擎来源结构差异大、Top-15 Jaccard 仅 0.20–0.30）
现行一套策略打所有引擎的做法缺乏依据；策略权重应增加"引擎"维度（与现有品牌/品类三层收缩同构）。

**不做**：不比广度（Yext 200+ 渠道 / SOCi 20 万 agent 无可比性）；不建跨客户基准去追 15 亿 prompt；不把治理当卖点讲（已是入场券）。

## 7. 下轮复检（基座6：季度复核，重大事件即时更新）
- 触发即时复检的事件：Profound Aim/Index 的定价与开放范围变化；Yext MCP 写能力开放；ACP 对非美市场开放；中文引擎 API 供给方出现整合收购。
- 待验证（本轮未查证，不得当结论引用）：Salesforce Agentforce / HubSpot Agent Hub / Typeface 的 2026 下半年进展；Peec/Otterly/AthenaHQ 是否也已跨入执行侧。
