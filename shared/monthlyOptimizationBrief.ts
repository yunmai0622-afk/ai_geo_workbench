import type {
  GeoBusinessMaturityDimension,
  GeoBusinessMaturityDimensionKey,
  GeoBusinessMaturityReport,
} from "./geoBusinessMaturity";

export type MonthlyOptimizationBriefTask = {
  id: number | null;
  title: string;
  status: string;
  actionUrl: string;
  reason?: string | null;
  targetDimension?: string | null;
};

export type MonthlyOptimizationPriority = {
  rank: number;
  title: string;
  relatedDimensionKey: GeoBusinessMaturityDimensionKey;
  relatedDimensionName: string;
  source: "existing_task" | "suggestion";
  reason: string;
  shortcoming: string;
  tasks: MonthlyOptimizationBriefTask[];
  successCriteria: string;
  retestMethod: string;
};

export type MonthlyOptimizationBrief = {
  projectId: number;
  monthLabel: string;
  maturityScore: number;
  maturityLevel: string;
  summary: string;
  hasActivePlan: boolean;
  planRoundNumber: number | null;
  priorities: MonthlyOptimizationPriority[];
  reviewCalendar: Array<{
    label: string;
    timing: string;
    purpose: string;
  }>;
  generatedAt: string;
};

export type MonthlyOptimizationBriefInput = {
  projectId: number;
  monthLabel?: string;
  maturityReport: GeoBusinessMaturityReport;
  plan?: {
    status: string;
    roundNumber: number;
  } | null;
  tasks: MonthlyOptimizationBriefTask[];
};

const LEGACY_DIMENSION_TO_BUSINESS_DIMENSION: Record<string, GeoBusinessMaturityDimensionKey> = {
  brandIdentity: "profile",
  categoryPositioning: "profile",
  questionCoverage: "questionCoverage",
  sourceGraph: "sourceConsistency",
  trustEvidence: "sourceConsistency",
  aiTestPerformance: "aiVisibility",
  contentExecution: "contentExecution",
  retestDelivery: "retestDelivery",
  profile: "profile",
  aiVisibility: "aiVisibility",
  sourceConsistency: "sourceConsistency",
};

function currentMonthLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function toBusinessDimension(value?: string | null): GeoBusinessMaturityDimensionKey | null {
  if (!value) return null;
  return LEGACY_DIMENSION_TO_BUSINESS_DIMENSION[value] ?? null;
}

function tasksForDimension(tasks: MonthlyOptimizationBriefTask[], dimensionKey: GeoBusinessMaturityDimensionKey) {
  return tasks.filter(task => toBusinessDimension(task.targetDimension) === dimensionKey);
}

function suggestedTaskForDimension(dimension: GeoBusinessMaturityDimension): MonthlyOptimizationBriefTask[] {
  const actionUrlByDimension: Record<GeoBusinessMaturityDimensionKey, string> = {
    profile: "/enterprise-profile",
    questionCoverage: "/questions",
    aiVisibility: "/weekly",
    sourceConsistency: "/brand-source-graph",
    contentExecution: "/weekly",
    retestDelivery: "/delivery-reports",
  };
  return [
    {
      id: null,
      title: dimension.nextAction,
      status: "suggested",
      actionUrl: actionUrlByDimension[dimension.key],
      reason: dimension.explanation,
      targetDimension: dimension.key,
    },
  ];
}

function successCriteriaForDimension(dimensionKey: GeoBusinessMaturityDimensionKey): string {
  const criteria: Record<GeoBusinessMaturityDimensionKey, string> = {
    profile: "品牌档案关键信息补齐，后续内容统一使用同一套品牌口径。",
    questionCoverage: "新增或补齐高价值 AI 搜索问题，并至少转化为对应内容任务。",
    aiVisibility: "复测中品牌提及或推荐次数较基线提升，低提及问题有明确原因。",
    sourceConsistency: "新增可公开引用信源或已验证证据，AI 回答可引用的材料更完整。",
    contentExecution: "Top 任务完成生成、发布或人工确认，形成可被收录和复测的内容资产。",
    retestDelivery: "完成发布后 7/14/30 天复测，能在月报中说明变化和下一步动作。",
  };
  return criteria[dimensionKey];
}

function retestMethodForDimension(dimensionKey: GeoBusinessMaturityDimensionKey): string {
  const methods: Record<GeoBusinessMaturityDimensionKey, string> = {
    profile: "复查 AI 对品牌身份、业务范围和适合客户的描述是否一致。",
    questionCoverage: "抽取新增问题做 AI 实测，确认是否能触发品牌或内容资产。",
    aiVisibility: "对同一问题池执行 T1/T2/T3 复测，对比提及率和推荐率。",
    sourceConsistency: "检查 AI 回答是否引用或复述新增信源中的关键事实。",
    contentExecution: "发布后监测收录、阅读/曝光和关键词触发，再做 AI 复测。",
    retestDelivery: "把复测结果汇总到月报，沉淀为续费和下月计划依据。",
  };
  return methods[dimensionKey];
}

function priorityTitle(dimension: GeoBusinessMaturityDimension): string {
  const titleByDimension: Record<GeoBusinessMaturityDimensionKey, string> = {
    profile: "统一品牌档案与基础口径",
    questionCoverage: "补齐 AI 搜索问题机会",
    aiVisibility: "提升 AI 提及与推荐",
    sourceConsistency: "增强公开信源与可信证据",
    contentExecution: "推进内容资产生成与发布",
    retestDelivery: "建立复测和月报证明闭环",
  };
  return titleByDimension[dimension.key];
}

export function buildMonthlyOptimizationBrief(input: MonthlyOptimizationBriefInput): MonthlyOptimizationBrief {
  const monthLabel = input.monthLabel ?? currentMonthLabel();
  const weakDimensions = [...input.maturityReport.dimensions]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const priorities = weakDimensions.map((dimension, index): MonthlyOptimizationPriority => {
    const existingTasks = tasksForDimension(input.tasks, dimension.key).slice(0, 3);
    const tasks = existingTasks.length > 0 ? existingTasks : suggestedTaskForDimension(dimension);
    return {
      rank: index + 1,
      title: priorityTitle(dimension),
      relatedDimensionKey: dimension.key,
      relatedDimensionName: dimension.name,
      source: existingTasks.length > 0 ? "existing_task" : "suggestion",
      reason: dimension.explanation,
      shortcoming: dimension.evidence.join("；"),
      tasks,
      successCriteria: successCriteriaForDimension(dimension.key),
      retestMethod: retestMethodForDimension(dimension.key),
    };
  });

  return {
    projectId: input.projectId,
    monthLabel,
    maturityScore: input.maturityReport.totalScore,
    maturityLevel: input.maturityReport.level,
    summary: `本月围绕 ${priorities.map(p => p.relatedDimensionName).join("、")} 推进优化，完成后通过复测和月报证明效果。`,
    hasActivePlan: input.plan?.status === "active",
    planRoundNumber: input.plan?.roundNumber ?? null,
    priorities,
    reviewCalendar: [
      { label: "T1", timing: "发布后 7 天", purpose: "确认内容是否被 AI 初步感知" },
      { label: "T2", timing: "发布后 14 天", purpose: "观察提及、推荐和引用变化" },
      { label: "T3", timing: "发布后 30 天", purpose: "沉淀月报证明与下月优先级" },
    ],
    generatedAt: new Date().toISOString(),
  };
}
