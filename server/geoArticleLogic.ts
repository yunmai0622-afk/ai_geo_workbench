export const articleTypes = ["官网版 GEO 文章", "问答型 GEO 文章", "竞品对比型 GEO 文章", "行业选型型 GEO 文章"] as const;
export const articleStatuses = ["待生成", "已生成", "待质检", "质检通过", "待审核", "审核通过", "已发布", "待复测", "质检未通过", "审核未通过"] as const;
export const p11ForbiddenPatterns = [
  { label: "存在 example.com 或演示域名", pattern: /example\.com|示例链接/i },
  { label: "存在占位链接或假链接表述", pattern: /假链接|虚假链接|占位链接/i },
  { label: "存在虚假案例或编造案例", pattern: /虚假案例|编造案例|杜撰案例|伪造案例/i },
  { label: "存在攻击竞品表述", pattern: /恶意攻击竞品|贬低竞品|竞品(都是|全是|完全是|一定是)(错误|垃圾|骗子|无效)/i },
  { label: "存在绝对排名或效果承诺", pattern: /保证排名|一定排名|保证推荐|一定推荐|保证流量|保证成交|绝对排名承诺|百分百|100%/i },
] as const;

export type ArticleType = (typeof articleTypes)[number];
export type ArticleStatus = (typeof articleStatuses)[number];
export type ThirdPartyMaterialKey = "官网版" | "公众号版" | "知乎回答版" | "小红书笔记版" | "百家号/头条号版";

export type P11ProjectLike = {
  id: number;
  enterpriseName: string;
  industry: string;
  website: string;
  region: string;
  productIntro: string;
  targetCustomers: string;
  coreSellingPoints: string;
  competitorNames: string[];
  coreKeywords: string[];
};

export type P11QuestionLike = {
  id: number;
  questionText: string;
  source?: string;
  questionType?: string;
  businessValue?: number;
};

export type P11AnalysisLike = {
  id: number;
  aiResponseId?: number | null;
  questionText?: string | null;
  mentionsEnterprise: number;
  recommendsEnterprise: number;
  mentionsCompetitors: number;
  recommendedCompetitors: string[];
  enterpriseWins: number;
  recommendationReason?: string | null;
  notRecommendedReason?: string | null;
  contentGap?: string | null;
  optimizationSuggestion?: string | null;
  manuallyReviewed?: number | boolean | null;
  reviewNote?: string | null;
};

export type P11TaskLike = {
  id: number;
  taskType: string;
  taskName: string;
  priority: "P0" | "P1" | "P2";
  generationReason: string;
  executionSuggestion: string;
  expectedImpact: string;
  status?: string;
};

export type P11TopicDraft = {
  projectId: number;
  optimizationTaskId: number;
  sourceAnalysisIds: number[];
  sourceQuestionIds: number[];
  title: string;
  articleType: ArticleType;
  contentGap: string;
  businessReason: string;
  status: ArticleStatus;
};

export type P11ArticleDraft = {
  projectId: number;
  topicId: number;
  optimizationTaskId: number;
  title: string;
  articleType: ArticleType;
  markdownContent: string;
  thirdPartyMaterials: Record<ThirdPartyMaterialKey, string>;
  status: "待质检";
};

export type P11QualityScore = {
  problemMatchScore: number;
  evidenceScore: number;
  structureScore: number;
  originalityScore: number;
  geoCitableScore: number;
  complianceScore: number;
  totalScore: number;
  blocked: boolean;
  blockReasons: string[];
  reviewSummary: string;
};

const unique = <T>(items: T[]) => Array.from(new Set(items));
const nonEmpty = (value?: string | null) => typeof value === "string" && value.trim().length > 0;
const compactTexts = (items: Array<string | null | undefined>) => items.map(item => item?.trim()).filter((item): item is string => Boolean(item));
const truncate = (value: string, max = 90) => value.length > max ? `${value.slice(0, max)}…` : value;
const countIncludes = (content: string, values: string[]) => values.filter(value => value && content.includes(value)).length;

export function detectForbiddenArticleContent(content: string): string[] {
  const normalized = content
    .replace(/不虚构案例/g, "")
    .replace(/不得包含虚假案例/g, "")
    .replace(/不要攻击竞品/g, "")
    .replace(/不是攻击竞品/g, "")
    .replace(/不承诺任何平台的绝对排名结果/g, "")
    .replace(/不承诺绝对排名/g, "");
  return p11ForbiddenPatterns.filter(item => item.pattern.test(normalized)).map(item => item.label);
}

export function canQualityCheckArticle(status: ArticleStatus) {
  return status === "待质检" || status === "已生成";
}

export function canAuditArticle(status: ArticleStatus, quality?: Pick<P11QualityScore, "totalScore" | "blocked"> | null) {
  return (status === "质检通过" || status === "待审核") && Boolean(quality) && !quality?.blocked && (quality?.totalScore ?? 0) >= 80;
}

export function canPublishArticle(status: ArticleStatus) {
  return status === "审核通过";
}

export function generateGeoArticleTopics(input: {
  project: P11ProjectLike;
  questions: P11QuestionLike[];
  analyses: P11AnalysisLike[];
  tasks: P11TaskLike[];
}): P11TopicDraft[] {
  const manualQuestions = input.questions.filter(question => question.source === "manual" || question.questionType === "指定问题").slice(0, 10);
  if (manualQuestions.length === 0) throw new Error("缺少客户指定问题，不能生成 GEO 文章选题。");
  if (input.analyses.length === 0) throw new Error("缺少 AI 语义分析结果，不能生成 GEO 文章选题。");
  if (input.tasks.length === 0) throw new Error("缺少优化任务，不能生成 GEO 文章选题。");

  const gapAnalyses = input.analyses.filter(analysis => nonEmpty(analysis.contentGap) || nonEmpty(analysis.notRecommendedReason) || nonEmpty(analysis.optimizationSuggestion));
  if (gapAnalyses.length === 0) throw new Error("缺少内容缺口或未推荐原因，不能生成 GEO 文章选题。");

  const preferredTasks = input.tasks.filter(task => ["官网首页", "FAQ", "竞品对比页", "行业文章", "产品页"].includes(task.taskType));
  const sourceTasks = preferredTasks.length > 0 ? preferredTasks : input.tasks;
  const articleTypeCycle: ArticleType[] = ["官网版 GEO 文章", "问答型 GEO 文章", "竞品对比型 GEO 文章", "行业选型型 GEO 文章"];
  const topics = sourceTasks.slice(0, 4).map((task, index) => {
    const relatedAnalyses = gapAnalyses.slice(index, index + 3).length > 0 ? gapAnalyses.slice(index, index + 3) : gapAnalyses.slice(0, 3);
    const relatedQuestions = manualQuestions.slice(index, index + 4).length > 0 ? manualQuestions.slice(index, index + 4) : manualQuestions.slice(0, 4);
    const gap = compactTexts([
      ...relatedAnalyses.map(analysis => analysis.contentGap),
      ...relatedAnalyses.map(analysis => analysis.notRecommendedReason),
      task.generationReason,
    ]).slice(0, 4).join("；");
    const competitor = input.project.competitorNames[index % Math.max(input.project.competitorNames.length, 1)] ?? "主要竞品";
    const titlePrefix = articleTypeCycle[index];
    const title = titlePrefix === "竞品对比型 GEO 文章"
      ? `${input.project.enterpriseName} 与 ${competitor} 的 GEO 可见度差距说明`
      : `${input.project.enterpriseName}${task.taskName.replace(/^补齐|^优化|^建设/, "")}：面向 AI 推荐的内容补齐指南`;
    return {
      projectId: input.project.id,
      optimizationTaskId: task.id,
      sourceAnalysisIds: unique(relatedAnalyses.map(analysis => analysis.id)),
      sourceQuestionIds: unique(relatedQuestions.map(question => question.id)),
      title: truncate(title, 120),
      articleType: titlePrefix,
      contentGap: gap || task.executionSuggestion,
      businessReason: `该选题来自优化任务「${task.taskName}」，用于回应客户指定问题「${relatedQuestions[0]?.questionText ?? manualQuestions[0].questionText}」，并补齐 AI 未推荐原因与内容缺口。`,
      status: "待生成" as const,
    };
  });

  const seenTypes = new Set(topics.map(topic => topic.articleType));
  articleTypeCycle.forEach((type, index) => {
    if (seenTypes.size >= 3 || seenTypes.has(type)) return;
    const task = sourceTasks[index % sourceTasks.length];
    const analysis = gapAnalyses[index % gapAnalyses.length];
    const question = manualQuestions[index % manualQuestions.length];
    topics.push({
      projectId: input.project.id,
      optimizationTaskId: task.id,
      sourceAnalysisIds: [analysis.id],
      sourceQuestionIds: [question.id],
      title: truncate(`${input.project.enterpriseName}${type.replace(" GEO 文章", "内容补齐方案")}`, 120),
      articleType: type,
      contentGap: compactTexts([analysis.contentGap, analysis.notRecommendedReason, task.generationReason]).join("；"),
      businessReason: `该选题补齐文章类型覆盖，绑定任务「${task.taskName}」和客户指定问题「${question.questionText}」。`,
      status: "待生成",
    });
    seenTypes.add(type);
  });

  return topics.slice(0, 4);
}

function paragraph(title: string, body: string) {
  return `## ${title}\n\n${body.trim()}\n`;
}

function buildEvidenceList(input: { questions: P11QuestionLike[]; analyses: P11AnalysisLike[]; task: P11TaskLike; project: P11ProjectLike }) {
  const questionsText = input.questions.slice(0, 5).map((question, index) => `${index + 1}. ${question.questionText}`).join("\n");
  const gaps = compactTexts(input.analyses.map(analysis => analysis.contentGap)).slice(0, 4).map((gap, index) => `${index + 1}. ${gap}`).join("\n");
  const reasons = compactTexts(input.analyses.map(analysis => analysis.notRecommendedReason)).slice(0, 4).map((reason, index) => `${index + 1}. ${reason}`).join("\n");
  const competitors = unique(input.analyses.flatMap(analysis => analysis.recommendedCompetitors ?? []).concat(input.project.competitorNames)).slice(0, 5).join("、") || "本轮回答未形成稳定竞品名单";
  return { questionsText, gaps, reasons, competitors };
}

export function generateGeoArticleDraft(input: {
  project: P11ProjectLike;
  topic: P11TopicDraft & { id?: number };
  task: P11TaskLike;
  questions: P11QuestionLike[];
  analyses: P11AnalysisLike[];
}): P11ArticleDraft {
  if (!input.topic.optimizationTaskId && !nonEmpty(input.topic.contentGap)) throw new Error("文章选题必须绑定任务或内容缺口。");
  const { project, topic, task } = input;
  const evidence = buildEvidenceList({ project, task, questions: input.questions, analyses: input.analyses });
  const manualConclusion = input.analyses.filter(analysis => analysis.manuallyReviewed).slice(0, 2).map(analysis => compactTexts([analysis.reviewNote, analysis.notRecommendedReason, analysis.contentGap]).join("；")).filter(Boolean).join("\n\n") || "本轮人工修订主要用于校准 AI 是否真实理解企业服务边界、竞品差距和内容缺口，发布前仍建议由业务负责人复核。";
  const intro = `${project.enterpriseName}在${project.industry}场景中的 GEO 优化，不能从泛泛的品牌介绍开始，而应从客户真实会问的问题、AI 没有推荐企业的原因、竞品被提及的理由和当前内容缺口出发。本文根据本项目已完成的 GEO 诊断结果整理，不虚构案例，不添加未验证链接，也不承诺任何平台的绝对排名结果。`;
  const content = [
    `# ${topic.title}`,
    intro,
    paragraph("一、本篇文章对应的真实客户问题", `本篇文章优先回应以下客户指定问题。这些问题代表潜在客户在做方案选择、竞品比较和购买判断时可能向 AI 提出的真实表达。\n\n${evidence.questionsText}`),
    paragraph("二、AI 未稳定推荐企业的关键原因", `本轮诊断显示，${project.enterpriseName}并非没有业务价值，而是公开内容中对目标客户、服务边界、适用场景和差异化证据的表达不够集中。系统记录的未推荐原因包括：\n\n${evidence.reasons || topic.contentGap}\n\n这意味着后续内容不应只写品牌介绍，而要把 AI 可以引用的判断依据写清楚。`),
    paragraph("三、竞品推荐差距说明", `本轮回答中被提及或被推荐的竞品包括：${evidence.competitors}。竞品被推荐通常不是因为其绝对更强，而是因为 AI 更容易从公开内容中识别其产品定位、适用客户、功能边界、案例证据或对比信息。${project.enterpriseName}需要补齐的是可被 AI 复述和引用的结构化内容，而不是攻击竞品或做绝对化承诺。`),
    paragraph("四、当前内容缺口", `结合 AI 语义分析和优化任务「${task.taskName}」，当前最需要补齐的内容缺口包括：\n\n${evidence.gaps || topic.contentGap}\n\n这些缺口会影响 AI 判断企业是否适合作为答案中的推荐对象，也会影响潜在客户理解企业与竞品之间的差异。`),
    paragraph("五、建议发布的内容结构", `建议围绕“问题—判断标准—企业能力—竞品差异—适用边界—下一步行动”组织内容。第一部分回答客户真实问题，第二部分说明行业选型标准，第三部分用${project.enterpriseName}已有卖点解释适配场景，第四部分客观说明与${project.competitorNames.slice(0, 2).join("、") || "主要竞品"}的内容差异，第五部分列出仍需客户补充的真实案例、截图、链接和数据。`),
    paragraph("六、企业可被 AI 引用的信息", `${project.enterpriseName}目前可被整理为以下可引用信息：产品或服务介绍为「${project.productIntro}」；目标客户为「${project.targetCustomers}」；核心卖点为「${project.coreSellingPoints}」。这些信息应在官网、FAQ、竞品对比页和行业文章中保持一致，避免 AI 在不同页面中读取到相互矛盾的描述。`),
    paragraph("七、发布前应补齐的证据清单", `为避免文章停留在概念层面，建议发布前由业务负责人补充以下真实证据：第一，能够证明${project.enterpriseName}服务边界的官网页面或产品说明；第二，能够解释${project.targetCustomers}为何适用的真实问答；第三，能够展示部署方式、售后流程或数据口径的截图；第四，与${project.competitorNames.slice(0, 2).join("、") || "主要竞品"}进行客观比较时使用的可核验事实。若这些证据暂时缺失，应在文章中明确标注“需要补充”，而不是填写未经核验的案例或引用无法访问的链接。`),
    paragraph("八、人工修订结论", manualConclusion),
    paragraph("九、发布后复测建议", `文章发布后，不应立即宣称 GEO 排名提升。建议在内容被客户确认并发布后，使用同一组客户指定问题重新采集 AI 回答，观察${project.enterpriseName}是否更容易被提及、是否出现更准确的推荐理由，以及竞品对比中的内容差距是否缩小。复测时应同时记录是否仍存在“未推荐原因”、竞品是否继续被优先提及、AI 是否引用了本文中的客户问题、内容缺口和证据清单。`),
  ].join("\n\n");
  return {
    projectId: project.id,
    topicId: topic.id ?? 0,
    optimizationTaskId: topic.optimizationTaskId,
    title: topic.title,
    articleType: topic.articleType,
    markdownContent: content,
    thirdPartyMaterials: generateThirdPartyMaterials({ project, title: topic.title, markdownContent: content, questions: input.questions, task }),
    status: "待质检",
  };
}

export function scoreGeoArticleQuality(input: {
  article: { title: string; markdownContent: string };
  project: P11ProjectLike;
  questions: P11QuestionLike[];
  analyses: P11AnalysisLike[];
  task?: P11TaskLike | null;
}): P11QualityScore {
  const content = `${input.article.title}\n${input.article.markdownContent}`;
  const forbiddenReasons = detectForbiddenArticleContent(content);
  const manualQuestions = input.questions.filter(question => question.source === "manual" || question.questionType === "指定问题");
  const questionMatches = countIncludes(content, manualQuestions.map(question => question.questionText.slice(0, 18)).filter(Boolean));
  const gapMatches = countIncludes(content, compactTexts(input.analyses.map(analysis => analysis.contentGap)).map(gap => gap.slice(0, 18)));
  const competitorMatches = countIncludes(content, input.project.competitorNames);
  const headingCount = (content.match(/^##\s+/gm) ?? []).length;
  const length = content.length;
  const hasNoFakeDisclaimer = content.includes("不虚构案例") && content.includes("不承诺") && content.includes("绝对排名");

  const problemMatchScore = Math.min(20, 10 + Math.min(questionMatches, 2) * 5);
  const evidenceScore = Math.min(20, 8 + Math.min(gapMatches, 2) * 4 + Math.min(competitorMatches, 2) * 2 + (input.task ? 4 : 0));
  const structureScore = Math.min(15, headingCount >= 6 ? 15 : headingCount >= 4 ? 12 : headingCount >= 2 ? 8 : 4);
  const originalityScore = Math.min(15, length >= 2600 ? 15 : length >= 1800 ? 12 : length >= 1200 ? 9 : 5);
  const geoCitableScore = Math.min(15, 7 + (content.includes(input.project.enterpriseName) ? 3 : 0) + (content.includes("客户指定问题") ? 2 : 0) + (content.includes("内容缺口") ? 2 : 0) + (content.includes("复测") ? 1 : 0));
  const complianceScore = forbiddenReasons.length > 0 ? 0 : hasNoFakeDisclaimer ? 15 : 12;
  const totalScore = problemMatchScore + evidenceScore + structureScore + originalityScore + geoCitableScore + complianceScore;
  const lowScoreBlocked = totalScore < 80;
  const blockReasons = [...forbiddenReasons, ...(lowScoreBlocked ? [`内容质量分 ${totalScore} 低于 80 分`] : [])];
  return {
    problemMatchScore,
    evidenceScore,
    structureScore,
    originalityScore,
    geoCitableScore,
    complianceScore,
    totalScore,
    blocked: blockReasons.length > 0,
    blockReasons,
    reviewSummary: blockReasons.length > 0
      ? `质检未通过：${blockReasons.join("；")}。`
      : `质检通过：文章围绕真实客户问题、内容缺口、竞品推荐差距和任务建议展开，质量分 ${totalScore}。`,
  };
}

export function generateThirdPartyMaterials(input: {
  project: P11ProjectLike;
  title: string;
  markdownContent: string;
  questions: P11QuestionLike[];
  task: P11TaskLike;
}): Record<ThirdPartyMaterialKey, string> {
  const question = input.questions[0]?.questionText ?? "客户在 AI 中如何选择同类服务？";
  const summary = `${input.project.enterpriseName}本轮 GEO 诊断显示，内容优化应围绕客户真实问题、竞品推荐差距和可被 AI 引用的证据展开。`;
  return {
    "官网版": input.markdownContent,
    "公众号版": `# ${input.title}\n\n${summary}\n\n这篇内容适合改写为公众号长文。建议保留诊断依据、客户问题、竞品差距和任务建议，并在发布前补充企业真实案例和合规审核。\n\n原文主体：\n\n${input.markdownContent}`,
    "知乎回答版": `问题：${question}\n\n回答：如果要判断${input.project.enterpriseName}是否适合被 AI 推荐，不能只看品牌介绍，而要看公开内容是否回答了真实选型问题。${summary}\n\n建议从三个方面检查：第一，是否解释适用客户；第二，是否说明与竞品的客观差异；第三，是否给出可验证的能力证据。`,
    "小红书笔记版": `${input.title}\n\n适合人群：正在做 ${input.project.industry} 选型或内容优化的团队。\n\n核心发现：${summary}\n\n发布前需要补充：真实客户案例、真实页面链接、真实截图或可核验数据。\n\n提醒：不要承诺绝对排名，不要攻击竞品。`,
    "百家号/头条号版": `# ${input.title}\n\n${summary}\n\n本素材适合改写为行业观察文章。建议采用“问题背景—诊断发现—竞品差距—内容补齐建议—复测方式”的结构，并围绕任务「${input.task.taskName}」展开。`,
  };
}
