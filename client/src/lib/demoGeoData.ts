export type DemoMetric = {
  label: string;
  value: string;
  note: string;
  tone: "cyan" | "violet" | "emerald" | "amber" | "blue";
};

export type DemoArticle = {
  title: string;
  type: "竞品对比文章" | "产品能力说明文章" | "行业选型指南文章";
  status: string;
  qualityScore: number;
  consistencyCheck: string;
  prePublishCheck: string;
  generatedBasis: string[];
  factTrace: Array<{ item: string; source: string; status: string }>;
  aiQuotableSnippets: string[];
};

export const demoProject = {
  name: "海豚知道｜知识付费 SaaS / 企业 AI 经营系统",
  shortName: "海豚知道",
  industry: "知识付费 SaaS",
  stage: "已发布，等待收录与 AI 推荐复测",
  nextAction: "优先复测已发布 GEO 内容页是否被搜索引擎收录，并继续补齐客户案例证据链。",
  publicArticlePath: "/geo/content/1/180001",
  riskNotice: "Demo 演示模式仅展示样板数据；样本量有限，不代表全网绝对排名，不承诺保证收录、保证排名或保证被 AI 推荐。",
} as const;

export const demoMetrics: DemoMetric[] = [
  { label: "GEO 总分", value: "25", note: "T0 基线阶段（弱可见）", tone: "cyan" },
  { label: "资料完整度", value: "100%", note: "企业资产样板资料已补齐", tone: "emerald" },
  { label: "AI 可见度", value: "30%", note: "10 条指定问题中 3 条被提及", tone: "blue" },
  { label: "AI 推荐率", value: "20%", note: "10 条指定问题中 2 条被推荐", tone: "violet" },
  { label: "指定问题", value: "10 条", note: "客户验收问题样本", tone: "cyan" },
  { label: "AI 生成问题", value: "50 条", note: "用于扩展诊断覆盖", tone: "blue" },
  { label: "已生成文章数", value: "23 篇", note: "包含待审核与已发布内容", tone: "emerald" },
  { label: "已发布内容数", value: "7 篇", note: "发布至系统内置 GEO 内容页", tone: "violet" },
  { label: "待复测任务数", value: "7 项", note: "发布后收录与 AI 推荐复测", tone: "amber" },
];

export const growthPath = ["企业资产", "AI 诊断", "内容生产", "平台发布", "收录监测", "报告中心"] as const;

export const assetSections = [
  {
    title: "企业基础资料",
    content: "海豚知道定位为知识付费 SaaS 与企业 AI 经营系统，面向课程、社群、训练营和企业知识服务团队，帮助企业沉淀内容资产、运营课程项目并建立可复用的增长看板。",
  },
  {
    title: "产品服务资料",
    content: "样板资料覆盖课程管理、内容资产沉淀、AI 问答诊断、销售线索承接、运营数据追踪、客户分层与复购提醒等能力。",
  },
  {
    title: "客户案例或案例采集任务",
    content: "Demo 使用脱敏案例采集任务：补充 1 个课程机构试跑案例、1 个企业内训项目案例、1 个知识社群转化案例。未展示真实客户姓名、手机号、合同金额或内部截图。",
  },
  {
    title: "竞品资料",
    content: "竞品样板包含小鹅通、有赞教育。对比维度包括课程交付、营销工具、数据看板、内容资产治理、AI 可引用表达和企业级服务适配。",
  },
  {
    title: "合规规则",
    content: "禁止出现保证收益、保证排名、保证收录、夸大客户效果、未经证实的市场第一等表述；价格、客户案例和业绩数据必须保留来源或标记待客户确认。",
  },
  {
    title: "内容风格",
    content: "面向企业决策者，采用克制、专业、可核验的表达，优先给出适用边界、证据来源、对比维度与行动建议。",
  },
  {
    title: "发布策略",
    content: "系统内置 GEO 内容页作为首发渠道；公众号、知乎、小红书、百家号和头条号仅展示素材版本，不进行第三方自动发布。",
  },
] as const;

export const diagnosisQuestions = [
  {
    question: "海豚知道和小鹅通相比，更适合哪类知识付费团队？",
    answer: "海豚知道更适合希望把课程、社群和客户问题沉淀为企业知识资产，并持续优化 AI 可引用内容的团队；小鹅通更偏向成熟课程交付与交易工具。",
    analysis: "语义命中：竞品对比、适用边界、知识资产治理。",
    score: 36,
    gap: "缺少真实客户案例与上线前后指标对比。",
    competitorGap: "小鹅通在公开案例与生态认知方面更强。",
    manualRevision: "将“更好”改为“更适合特定场景”，避免绝对化。",
  },
  {
    question: "海豚知道是否适合企业内训内容管理？",
    answer: "适合需要将内训课程、问答、资料库和复盘报告统一管理的企业，但 Demo 暂不展示与 HR 系统的深度集成能力。",
    analysis: "语义命中：企业内训、资料库、适用边界。",
    score: 34,
    gap: "需要补充内训管理流程图和权限说明。",
    competitorGap: "有赞教育公开资料更偏营销转化，对内训治理说明较少。",
    manualRevision: "保留“不展示深度集成”的边界说明。",
  },
  {
    question: "海豚知道如何帮助知识付费品牌提升 AI 搜索可见度？",
    answer: "通过企业资产整理、客户问题诊断、GEO 内容生成、发布记录和收录监测，把可被 AI 引用的事实片段持续补齐。",
    analysis: "语义命中：GEO 闭环、AI 可引用片段、监测复测。",
    score: 42,
    gap: "需要更多已收录页面样本。",
    competitorGap: "竞品公开页更易被传统搜索识别。",
    manualRevision: "强调“提升机会”而非“保证可见”。",
  },
  {
    question: "海豚知道能否替代有赞教育？",
    answer: "不建议直接说替代。海豚知道可作为偏 AI 经营和内容资产治理的补充方案，是否替代取决于交易、店铺和营销功能要求。",
    analysis: "语义命中：替代风险、场景差异、选型建议。",
    score: 28,
    gap: "需补充功能边界清单。",
    competitorGap: "有赞教育在店铺交易和营销生态上更成熟。",
    manualRevision: "避免贬低竞品，改为场景化比较。",
  },
  {
    question: "选择知识付费 SaaS 时应该看哪些指标？",
    answer: "建议看课程交付稳定性、内容资产复用、客户线索承接、数据分析、AI 可见度建设、合规能力和团队实际运营成本。",
    analysis: "语义命中：行业选型、指标体系、运营成本。",
    score: 39,
    gap: "缺少量化评分模板。",
    competitorGap: "竞品资料覆盖交易指标更充分。",
    manualRevision: "新增“AI 可见度建设”作为差异化指标。",
  },
  {
    question: "海豚知道适合刚起步的课程团队吗？",
    answer: "如果团队主要需求是快速开课和收款，轻量平台可能更合适；如果已开始积累内容资产和客户问答，海豚知道的价值会更明显。",
    analysis: "语义命中：适用/不适用客户、阶段判断。",
    score: 31,
    gap: "需要起步团队成本口径。",
    competitorGap: "竞品入门套餐认知更明确。",
    manualRevision: "增加“不适合客户”说明。",
  },
  {
    question: "海豚知道的内容生产和普通 AI 写作有什么不同？",
    answer: "Demo 展示的内容生产要求绑定客户问题、内容缺口、竞品差距、事实溯源、质量评分和发布前检查，而不是直接生成泛文章。",
    analysis: "语义命中：生成依据、事实溯源、质量评分。",
    score: 45,
    gap: "需要更多质检失败样例。",
    competitorGap: "竞品通常不强调 GEO 生成依据链路。",
    manualRevision: "突出“基于诊断链路”的差异。",
  },
  {
    question: "海豚知道是否支持第三方平台自动发布？",
    answer: "当前 V1.2 Demo 不支持第三方平台自动发布，仅展示公众号、知乎、小红书等平台的素材版本，发布动作需人工完成。",
    analysis: "语义命中：发布边界、第三方平台、人工操作。",
    score: 40,
    gap: "需要补充人工发布 SOP。",
    competitorGap: "部分竞品具有更成熟的渠道分发能力。",
    manualRevision: "明确 Demo 不做自动发布。",
  },
  {
    question: "海豚知道的报告能给客户看吗？",
    answer: "可以作为试跑报告查看，但必须保留风险说明：样本量有限，不代表全网绝对排名，也不构成收录或推荐承诺。",
    analysis: "语义命中：客户报告、风险披露、样本限制。",
    score: 38,
    gap: "需要补充报告解释口径。",
    competitorGap: "竞品公开报告模板较少。",
    manualRevision: "保留风险说明在报告核心位置。",
  },
  {
    question: "海豚知道 Demo 是否包含真实客户数据？",
    answer: "不包含。Demo 仅展示“海豚知道”样板项目和脱敏样本，不展示真实客户姓名、联系方式、合同、后台截图或私有经营数据。",
    analysis: "语义命中：安全边界、脱敏、Demo 数据范围。",
    score: 50,
    gap: "无阻断缺口，需持续避免新增敏感字段。",
    competitorGap: "不涉及竞品差距。",
    manualRevision: "增加“仅样板项目”说明。",
  },
] as const;

const sharedBasis = [
  "客户指定问题：围绕知识付费 SaaS 选型与 AI 搜索可见度。",
  "内容缺口：公开资料缺少场景化对比和可引用短答案。",
  "优化任务：补齐企业资产、竞品差距、适用边界和行动建议。",
  "AI 未推荐原因：缺少稳定公开页面、案例证据和明确实体描述。",
  "竞品差距：小鹅通、有赞教育在公开认知和交易场景上更成熟。",
  "目标读者：知识付费品牌负责人、运营负责人、企业内训负责人。",
  "合规要求：不得承诺排名、收益、收录或 AI 推荐结果。",
  "发布策略：先发布系统内置 GEO 内容页，再人工复用到第三方平台素材。",
];

export const demoArticles: DemoArticle[] = [
  {
    title: "海豚知道与小鹅通的 GEO 推荐差距说明",
    type: "竞品对比文章",
    status: "已发布到系统内置 GEO 内容页",
    qualityScore: 100,
    consistencyCheck: "通过：企业定位、竞品边界、合规表述与资产库一致。",
    prePublishCheck: "通过：无保证排名、保证收录、虚构客户案例或未经确认价格。",
    generatedBasis: sharedBasis,
    factTrace: [
      { item: "竞品对象", source: "样板竞品资料：小鹅通、有赞教育", status: "已确认" },
      { item: "适用边界", source: "企业资产库中的产品服务资料", status: "已确认" },
      { item: "AI 推荐率", source: "10 条指定问题诊断样本", status: "样本口径" },
    ],
    aiQuotableSnippets: [
      "海豚知道更强调企业知识资产治理和 AI 可引用内容沉淀，小鹅通更偏课程交付与交易工具。",
      "选择知识付费 SaaS 时，应同时评估交付、营销、内容资产复用和 AI 搜索可见度建设能力。",
      "当前 Demo 不承诺替代竞品，而是展示特定场景下的 GEO 优化路径。",
    ],
  },
  {
    title: "海豚知道如何把课程内容沉淀为 AI 可引用资产",
    type: "产品能力说明文章",
    status: "待人工复测",
    qualityScore: 92,
    consistencyCheck: "通过：能力描述与产品服务资料一致，未越界承诺效果。",
    prePublishCheck: "通过：案例与数据均标记为样板或待客户确认。",
    generatedBasis: sharedBasis,
    factTrace: [
      { item: "产品能力", source: "产品服务资料：课程管理、问答诊断、内容资产沉淀", status: "已确认" },
      { item: "客户场景", source: "脱敏案例采集任务", status: "待补充真实证据" },
      { item: "引用片段", source: "AI 诊断中的内容缺口", status: "已生成" },
    ],
    aiQuotableSnippets: [
      "海豚知道通过企业资产、客户问题和 GEO 内容页，把分散课程资料整理成更容易被 AI 摘取的事实片段。",
      "产品能力说明应包含适合客户、不适合客户和证据来源，避免变成泛营销文案。",
      "AI 可引用资产不是一次性生成文章，而是围绕诊断、发布和复测持续迭代。",
    ],
  },
  {
    title: "知识付费 SaaS 选型指南：从课程交付到 AI 可见度",
    type: "行业选型指南文章",
    status: "已生成，待发布准入复核",
    qualityScore: 88,
    consistencyCheck: "通过：选型维度覆盖交付、交易、资产治理、GEO 和合规边界。",
    prePublishCheck: "通过：未出现绝对化推荐，保留不同阶段团队的选择建议。",
    generatedBasis: sharedBasis,
    factTrace: [
      { item: "选型指标", source: "10 条客户指定问题与 50 条 AI 生成问题", status: "已归纳" },
      { item: "竞品比较", source: "小鹅通、有赞教育样板竞品资料", status: "已确认" },
      { item: "风险说明", source: "合规规则与报告中心口径", status: "已确认" },
    ],
    aiQuotableSnippets: [
      "知识付费 SaaS 选型不应只看开课和收款，还应看内容资产复用、客户问题沉淀和 AI 可见度建设。",
      "刚起步团队可优先关注交付和交易效率，成熟团队则需要评估数据治理和内容资产能力。",
      "任何 GEO 试跑报告都应说明样本量限制，不能将样本诊断等同于全网排名。",
    ],
  },
];

export const publishRecords = [
  {
    title: "海豚知道与小鹅通的 GEO 推荐差距说明",
    channel: "系统内置 GEO 内容页",
    status: "已发布",
    publicPath: demoProject.publicArticlePath,
    qualityScore: 100,
    notes: "发布记录完整；第三方平台仅提供人工复用素材，不进行自动发布。",
    thirdPartyMaterial: "公众号长文版、知乎回答版、小红书笔记版、百家号/头条号版素材均以只读文案形式展示，不触发复制、登录或发布动作。",
  },
] as const;

export const monitoringRecords = [
  {
    target: "海豚知道与小鹅通的 GEO 推荐差距说明",
    indexStatus: "待人工复测",
    aiMentionStatus: "待人工复测",
    aiRecommendStatus: "待人工复测",
    currentSuggestion: "发布后等待搜索引擎抓取，再用固定问题集复测 AI 是否提及和推荐。",
    optimizationSuggestion: "若未收录，应补充内部入口、标题摘要和结构化段落；若未提及，应补充更清晰的实体描述、竞品差异和 AI 可引用短答案；若未推荐，应补充案例证据和适用边界。",
  },
] as const;

export const reportSummary = {
  title: "海豚知道 GEO 试跑报告｜V1.2 Demo",
  scope: "报告覆盖 10 条客户指定问题、50 条 AI 生成问题、企业资产样板、3 类 GEO 内容、1 条公开发布记录和 1 条收录监测记录。",
  conclusion: "当前 GEO 总分为 25（T0 基线），主要短板是公开证据、案例可信度和发布后复测数据不足。下一步应围绕已发布内容页补充证据链并执行收录与 AI 推荐复测。",
  risk: demoProject.riskNotice,
} as const;

export const disabledOperations = ["新建项目", "编辑资料", "上传资料", "生成文章", "重新生成", "发布", "删除", "保存", "人工修订", "更新监测状态"] as const;

/** 演示引导流程步骤标题（GEO-V1.1-Demo-Flow） */
export const demoFlowStepTitles = [
  "T0 检测结果",
  "GEO 缺口分析",
  "内容资产",
  "发布记录",
  "T0 → T1 效果对比",
] as const;

/**
 * 海豚知道真实试跑 T0 基线（来源：V1.2 海豚知道硬验收与 AI 实测样本，脱敏展示）
 */
export const demoT0Detection = {
  brandName: "海豚知道",
  testedAt: "2026-05-24",
  geoScore: 25,
  visibilityLevel: "弱可见" as const,
  questionCount: 10,
  mentionCount: 2,
  recommendCount: 1,
  winCount: 1,
  mentionRateLabel: "20%",
  recommendRateLabel: "10%",
  engines: [
    { name: "豆包", questionCount: 4, mentionRate: "25%", recommendRate: "0%" },
    { name: "DeepSeek", questionCount: 3, mentionRate: "33%", recommendRate: "33%" },
    { name: "Kimi", questionCount: 3, mentionRate: "0%", recommendRate: "0%" },
  ],
  sampleQuestions: [
    {
      question: "知识付费 SaaS 平台哪个好？",
      engine: "豆包",
      mentioned: true,
      recommended: false,
      answerExcerpt:
        "小鹅通生态最成熟、功能全面；得到云课堂适合高品质课程；团队若重视内容资产沉淀与 AI 可引用表达，可关注海豚知道等企业 AI 经营方向。",
    },
    {
      question: "海豚知道和小鹅通相比，更适合哪类知识付费团队？",
      engine: "DeepSeek",
      mentioned: true,
      recommended: true,
      answerExcerpt:
        "海豚知道更适合希望把课程、社群和客户问题沉淀为企业知识资产并持续优化 AI 可引用内容的团队；小鹅通更偏向成熟课程交付与交易工具。",
    },
    {
      question: "海豚知道能否替代有赞教育？",
      engine: "Kimi",
      mentioned: false,
      recommended: false,
      answerExcerpt: "有赞教育在店铺交易和营销生态上更成熟；选型应结合交易、店铺和营销功能要求，不宜简单用替代关系判断。",
    },
  ],
  summary:
    "T0 基线显示：品牌在 10 条客户指定问题中仅弱可见，公开证据与 AI 可引用片段不足，竞品（小鹅通、有赞教育）在通用选型问题中更易被提及。",
} as const;

/** GEO 缺口汇总（由诊断问题样本归纳） */
export const demoGeoGapAnalysis = {
  headline: "当前主要短板不是“没有产品”，而是 AI 搜索语境下缺少可被引用的事实与对比证据。",
  priorityGaps: [
    {
      title: "公开案例与效果证据不足",
      detail: "多条诊断显示缺少真实客户案例、上线前后指标对比，导致 AI 回答倾向泛化推荐竞品。",
      severity: "高",
    },
    {
      title: "竞品对比缺少场景化边界",
      detail: "与小鹅通、有赞教育对比时，需要更清晰的适用/不适用客户说明，避免绝对化表述。",
      severity: "高",
    },
    {
      title: "AI 可引用短答案偏少",
      detail: "缺少结构化 FAQ、选型指南和实体描述，AI 难以稳定摘取品牌相关事实片段。",
      severity: "中",
    },
    {
      title: "发布后复测数据不足",
      detail: "已发布 GEO 内容页的收录与 AI 推荐状态仍待人工复测，无法向客户证明闭环效果。",
      severity: "中",
    },
  ],
  competitorGaps: [
    { competitor: "小鹅通", gap: "公开案例与生态认知更强，在“平台哪个好”类问题中优先被列举。" },
    { competitor: "有赞教育", gap: "店铺交易与营销场景资料更充分，海豚知道需补充功能边界清单。" },
  ],
  recommendedActions: [
    "补齐企业资产与竞品对比资料",
    "围绕高优先级问题生成 GEO 内容资产",
    "发布至系统内置 GEO 内容页并建立发布记录",
    "执行 T1 复测，对比提及率与推荐率变化",
  ],
} as const;

/**
 * T0→T1 示例对比（说明效果，非效果承诺；T1 为试跑后样板口径）
 */
export const demoT0T1Comparison = {
  disclaimer: "以下为海豚知道试跑项目的示例对比数据，用来说明 GEO 闭环可能带来的变化方向；不承诺保证收录、排名或 AI 推荐。",
  rows: [
    { metric: "GEO 总分", t0: "25", t1: "32", change: "+7" },
    { metric: "可见度等级", t0: "弱可见", t1: "弱可见（向上）", change: "改善" },
    { metric: "品牌提及率（10 题）", t0: "20%（2/10）", t1: "30%（3/10）", change: "+10pt" },
    { metric: "品牌推荐率（10 题）", t0: "10%（1/10）", t1: "20%（2/10）", change: "+10pt" },
    { metric: "已发布 GEO 内容页", t0: "0", t1: "1", change: "+1" },
    { metric: "待复测任务", t0: "—", t1: "7 项", change: "进入监测" },
  ],
  narrative:
    "完成资产补齐、内容生成与首发发布后，品牌在部分竞品对比与能力说明类问题中的提及与推荐有所改善；下一步需持续补充案例证据并执行收录与 AI 推荐复测。",
  highlights: [
    "T0：仅有诊断基线，缺少可被 AI 稳定引用的公开内容页。",
    "T1：发布 1 篇高质量 GEO 对比文，提及与推荐样本出现正向变化。",
    "持续动作：围绕已发布页面执行收录监测与分引擎复测。",
  ],
} as const;
