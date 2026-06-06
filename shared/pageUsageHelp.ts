import { GEO_UNIFIED_MAIN_PIPELINE_STEPS } from "./workspaceMainChain";
import { PLATFORM_CONTENT_GUIDELINES, formatPlatformContentGuidelineLine } from "./platformContentGuidelines";

/** GEO-V1.1：主要页面静态使用说明（仅前端展示） */
export type PageUsageHelpId =
  | "workspace"
  | "ai-diagnosis"
  | "content-generation"
  | "content-publishing"
  | "inclusion-monitoring";

export type PageUsageHelpSection = {
  heading: string;
  lines: string[];
};

export type PageUsageHelpContent = {
  id: PageUsageHelpId;
  title: string;
  intro?: string;
  sections: PageUsageHelpSection[];
};

const WORKSPACE_STEP_STATUS_LINES = [
  "✅ 绿色：该步骤已有完成记录，可点击进入对应模块查看或继续优化。",
  "⏳ 灰色：尚未完成，按顺序推进可更快看到 GEO 效果。",
  "顶部阶段标签（如「待建档」「待发布」）：系统根据当前数据推断的优先动作，与 8 步进度相互印证。",
];

const AI_DIAGNOSIS_SECTIONS: PageUsageHelpSection[] = [
  {
    heading: "T0 基线检测",
    lines: [
      "建档完成后首次在豆包、Kimi、DeepSeek 等平台批量提问，衡量品牌被提及、被推荐的基础水平。",
      "结果用于 GEO 评分、内容缺口建议与后续对比基线；可多次执行，以最近一次完成为准。",
    ],
  },
  {
    heading: "T1 复测",
    lines: [
      "以最近一次平台发布完成日为起点，建议第 7 天执行。",
      "对比发布前后品牌在 AI 回答中的提及与推荐变化，验证首轮内容动作是否生效。",
    ],
  },
  {
    heading: "T2 复测",
    lines: [
      "建议发布后第 30 天执行，观察中期收录与引用趋势。",
      "适合判断内容是否持续被 AI 引用，而不仅是短期波动。",
    ],
  },
  {
    heading: "T3 复测",
    lines: [
      "建议发布后第 90 天执行，用于季度级效果复盘。",
      "与交付报告、有效动作记录配合，向客户说明长期 GEO 投入产出。",
    ],
  },
];

const CONTENT_GENERATION_PLATFORM_LINES = PLATFORM_CONTENT_GUIDELINES.map(
  g => `${g.label}：${formatPlatformContentGuidelineLine(g)}`,
);

export const PAGE_USAGE_HELP: Record<PageUsageHelpId, PageUsageHelpContent> = {
  workspace: {
    id: "workspace",
    title: "项目工作台使用说明",
    intro: "工作台展示当前企业的 8 步增长主链路与关键指标，帮助你判断「现在该做什么」。",
    sections: [
      {
        heading: "8 步主链路",
        lines: GEO_UNIFIED_MAIN_PIPELINE_STEPS.map((step, index) => `${index + 1}. ${step.title}`),
      },
      {
        heading: "步骤与阶段状态",
        lines: WORKSPACE_STEP_STATUS_LINES,
      },
    ],
  },
  "ai-diagnosis": {
    id: "ai-diagnosis",
    title: "AI 实测诊断使用说明",
    intro: "本页通过真实 AI 提问检测品牌在生成式搜索中的可见度；T0 建立基线，T1/T2/T3 按发布节奏复测。",
    sections: AI_DIAGNOSIS_SECTIONS,
  },
  "content-generation": {
    id: "content-generation",
    title: "平台化内容资产使用说明",
    intro: "按平台独立生成 GEO 内容，一稿不多发；撰写前可参考各平台风格差异。",
    sections: [
      {
        heading: "各平台内容风格",
        lines: CONTENT_GENERATION_PLATFORM_LINES,
      },
      {
        heading: "使用提示",
        lines: [
          "生成前请确认品牌建档与 T0 诊断已完成，缺口建议会更准确。",
          "质量评分未达标时请先修订正文，再进入发布流程。",
        ],
      },
    ],
  },
  "content-publishing": {
    id: "content-publishing",
    title: "平台适配发布使用说明",
    intro: "发布分两种方式：本地 Agent 自动执行与人工在平台发布后回填记录。",
    sections: [
      {
        heading: "Agent 发布（本地 Agent）",
        lines: [
          "在电脑上安装并登录本地 Agent，绑定各平台账号会话。",
          "从内容页或发布中心创建发布任务后，由 Agent 在已登录浏览器中执行草稿/发布操作。",
          "适合已支持自动化的平台（如部分百家号、头条号流程）；需保持 Agent 在线。",
        ],
      },
      {
        heading: "人工发布",
        lines: [
          "系统生成适配该平台的标题、正文、封面等素材，你在平台后台手动发布。",
          "发布完成后在本系统登记公开链接与发布时间，用于收录监测与 T1/T2/T3 复测计时。",
          "知乎、小红书等以人工发布为主的平台通常走此路径。",
        ],
      },
      {
        heading: "如何选择",
        lines: [
          "平台卡片会提示当前账号能力与推荐方式；Agent 离线时请先恢复连接或改用人工作业。",
          "无论哪种方式，均以「发布记录 + 公开链接」为准，系统不代替你登录未授权账号。",
        ],
      },
    ],
  },
  "inclusion-monitoring": {
    id: "inclusion-monitoring",
    title: "收录监测使用说明",
    intro: "监测回答两个问题：内容页面能否被找到（收录），以及 AI 是否在回答里提到你的品牌（被引用）。",
    sections: [
      {
        heading: "收录",
        lines: [
          "指已发布内容的公开链接是否可访问、是否进入平台或搜索引擎的可索引范围。",
          "「已收录 / 未收录」表示页面级可见性，不等于 AI 一定会引用你的品牌。",
        ],
      },
      {
        heading: "被引用（AI 实测）",
        lines: [
          "指向目标问题再次提问 AI，看回答中是否提及、推荐你的品牌或链接。",
          "这是 GEO 核心效果指标，需在收录监测或 AI 诊断中执行实测后查看。",
        ],
      },
      {
        heading: "建议动作",
        lines: [
          "先确认发布链接可公开访问，再执行 AI 实测。",
          "收录正常但长期未提及时，回到内容生成补充缺口类型文章，并按计划做 T1 复测。",
        ],
      },
    ],
  },
};

const PATH_TO_HELP_ID: ReadonlyArray<{ paths: readonly string[]; id: PageUsageHelpId }> = [
  { paths: ["/workspace", "/flow"], id: "workspace" },
  {
    paths: ["/ai-diagnosis", "/diagnosis", "/responses", "/analysis", "/scores"],
    id: "ai-diagnosis",
  },
  { paths: ["/weekly", "/content-generation", "/articles"], id: "content-generation" },
  { paths: ["/content-publishing", "/publish"], id: "content-publishing" },
  { paths: ["/inclusion-monitoring", "/monitoring"], id: "inclusion-monitoring" },
];

export function resolvePageUsageHelpId(pathname: string): PageUsageHelpId | null {
  const path = pathname.split("?")[0] || pathname;
  for (const entry of PATH_TO_HELP_ID) {
    if (entry.paths.includes(path)) return entry.id;
  }
  return null;
}

export function getPageUsageHelpContent(id: PageUsageHelpId): PageUsageHelpContent {
  return PAGE_USAGE_HELP[id];
}
