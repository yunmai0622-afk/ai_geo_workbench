/**
 * 8 步 GEO 品牌资产建档向导：步骤元数据（硬编码文案）
 */

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
    title: "AI 搜索问题引导",
    purpose: "明确客户会怎么问 AI",
    whyImportant:
      "这些问题将进入 AI 搜索问题池，系统会测试豆包、Kimi、DeepSeek 等平台是否提到或推荐你。",
    systemUsage: "保存后自动在问题池生成对应检索问题，无需直接操作问题库底层。",
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
