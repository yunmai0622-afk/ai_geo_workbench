/**
 * 8 步 GEO 品牌资产建档向导：步骤元数据（硬编码文案）
 */

import type { QuestionGuideExamples } from "./onboardingWizardGeoGoalNotes";

export type OnboardingWizardStepMeta = {
  step: number;
  title: string;
  purpose: string;
  whyImportant: string;
  systemUsage: string;
};

export const ONBOARDING_WIZARD_STEPS: OnboardingWizardStepMeta[] = [
  {
    step: 1,
    title: "品牌实体",
    purpose: "让 AI 确认不同平台说的是同一个企业",
    whyImportant:
      "品牌名称、官网、一句话介绍是 AI 识别企业实体的核心依据。如果不同平台的品牌名不一致，AI 可能无法判断这些内容属于同一家公司。",
    systemUsage: "系统会将品牌实体写入实体锚点，用于跨平台一致性检测与 AI 实测识别。",
  },
  {
    step: 2,
    title: "品类定位",
    purpose: "让 AI 知道你应该出现在什么推荐场景",
    whyImportant:
      "AI 只有在理解你属于哪个品类、解决什么问题后，才可能在相关问题中提及或推荐你。",
    systemUsage: "品类与卖点将用于生成行业推荐类问题与内容选题。",
  },
  {
    step: 3,
    title: "目标客户",
    purpose: "让 AI 理解什么样的人适合选择你",
    whyImportant:
      "GEO 不只优化品牌名，还要覆盖客户购买前会问 AI 的场景问题。目标客户越清晰，问题池越精准。",
    systemUsage: "客户画像用于匹配场景需求类问题与内容缺口分析。",
  },
  {
    step: 4,
    title: "客户会怎么问 AI？",
    purpose:
      "系统会根据这些问题测试豆包、Kimi、DeepSeek 等 AI 平台是否认识你、是否推荐你，以及是否推荐了竞品。",
    whyImportant:
      "客户在购买前会向 AI 提问；你补充的问题越贴近真实场景，基线实测与后续内容任务越精准。",
    systemUsage: "保存后将自动写入 AI 搜索问题池，并作为发布后复测基准。",
  },
  {
    step: 5,
    title: "竞品信息",
    purpose: "让系统知道 AI 可能推荐谁而不是你",
    whyImportant:
      "系统会在 AI 实测中监测竞品出现情况，并生成竞品对比类内容，帮助你在对比问题中胜出。",
    systemUsage: "竞品列表用于对比类问题生成与竞品监测报告。",
  },
  {
    step: 6,
    title: "信任证据",
    purpose: "让 AI 判断凭什么推荐你",
    whyImportant:
      "AI 不只看你自己怎么介绍自己，也会参考案例、评价、媒体等公开证据。信任证据越充分，推荐率越高。",
    systemUsage: "案例与信任证据将作为 AI 推荐时的佐证材料。",
  },
  {
    step: 7,
    title: "公开信源",
    purpose: "让 AI 能在外部找到并交叉验证你",
    whyImportant:
      "AI 需要在多个独立平台找到关于你的信息，才会稳定识别和推荐你。信源越多、越一致，AI 信任度越高。",
    systemUsage: "信源图谱用于实体一致性检查与信源增强建议。",
  },
  {
    step: 8,
    title: "90 天 GEO 目标",
    purpose: "明确这次服务要改善什么",
    whyImportant:
      "明确目标后，系统会生成月度优化计划，每月围绕目标补内容、补信源、补证据，并通过复测验证效果。",
    systemUsage: "目标将驱动月度优化任务与交付报告中的进展对比。",
  },
];

export const ONBOARDING_WIZARD_PAGE_TITLE = "GEO 品牌资产建档";
export const ONBOARDING_WIZARD_PAGE_SUBTITLE =
  "帮助 AI 正确理解企业是谁、做什么、服务谁、凭什么值得推荐。";

export const ONBOARDING_TARGET_PLATFORMS = ["豆包", "Kimi", "DeepSeek", "通义", "文心", "ChatGPT", "Perplexity"] as const;

/** Step4：这些问题会用于 */
export const ONBOARDING_QUESTION_GUIDE_USAGE_ITEMS = [
  "生成 AI 搜索问题池",
  "执行多平台 AI 基线实测",
  "判断品牌提及率、推荐率和竞品出现率",
  "生成后续内容任务",
  "作为发布后复测基准",
] as const;

export type OnboardingQuestionGuideCategoryKey = keyof QuestionGuideExamples;

export type OnboardingQuestionGuideCategoryMeta = {
  key: OnboardingQuestionGuideCategoryKey;
  label: string;
  description: string;
  examples: readonly string[];
  placeholder: string;
};

/** Step4：五类问题的客户化名称、说明与示例 */
export const ONBOARDING_QUESTION_GUIDE_CATEGORIES: readonly OnboardingQuestionGuideCategoryMeta[] = [
  {
    key: "brandSearch",
    label: "客户直接搜你",
    description: "客户已经知道你的品牌，直接问 AI 了解你。",
    examples: ["海豚知道是做什么的？", "海豚知道靠谱吗？", "海豚知道适合哪些知识付费老师？"],
    placeholder: "例如：海豚知道适合哪些知识付费老师？",
  },
  {
    key: "categoryRecommend",
    label: "客户找同类服务",
    description: "客户不知道你是谁，只是在找某类服务商。",
    examples: [
      "知识付费系统哪家公司好？",
      "知识付费 SaaS 平台怎么选？",
      "适合知识主播的课程交付系统有哪些？",
    ],
    placeholder: "例如：知识付费系统哪家公司好？",
  },
  {
    key: "sceneNeed",
    label: "客户带着问题找方案",
    description: "客户先描述自己的问题，希望 AI 推荐解决方案。",
    examples: ["课程卖不出去怎么提升转化？", "学员完课率低怎么办？", "知识付费团队怎么做私域运营？"],
    placeholder: "例如：学员完课率低怎么办？",
  },
  {
    key: "comparison",
    label: "客户拿你和竞品对比",
    description: "客户已经在比较多个服务商，希望 AI 帮他判断。",
    examples: [
      "海豚知道和某某平台哪个好？",
      "海豚知道和传统知识付费系统有什么区别？",
      "海豚知道适合中小团队还是大机构？",
    ],
    placeholder: "例如：海豚知道和某某平台哪个好？",
  },
  {
    key: "longTail",
    label: "客户用具体痛点提问",
    description: "客户用非常具体的问题表达需求，这类问题更接近成交场景。",
    examples: [
      "学员年龄偏大，AI 推荐学习路径有用吗？",
      "知识付费课程交付混乱怎么解决？",
      "知识主播怎么用 AI 提升复购？",
    ],
    placeholder: "例如：知识主播怎么提升复购？",
  },
] as const;

export const ONBOARDING_QUESTION_GUIDE_MIN_COUNT = 3;
export const ONBOARDING_QUESTION_GUIDE_TARGET_MAX = 5;
