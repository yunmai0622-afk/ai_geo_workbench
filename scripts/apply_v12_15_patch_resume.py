from pathlib import Path

ROOT = Path('/home/ubuntu/ai_geo_workbench')
logic = ROOT / 'server/geoArticleLogic.ts'
routers = ROOT / 'server/routers.ts'
geo_pages = ROOT / 'client/src/pages/GeoPages.tsx'
public_content = ROOT / 'client/src/pages/GeoPublicContent.tsx'
test = ROOT / 'server/geoArticleLogic.test.ts'

def replace_once(path: Path, find: str, replace: str):
    text = path.read_text()
    if find not in text:
        raise SystemExit(f'Cannot find expected block in {path}: {find[:180]!r}')
    path.write_text(text.replace(find, replace, 1))

def replace_if(path: Path, find: str, replace: str, marker: str):
    text = path.read_text()
    if marker in text:
        return
    if find not in text:
        raise SystemExit(f'Cannot find expected block in {path}: {find[:180]!r}')
    path.write_text(text.replace(find, replace, 1))

def insert_after_if(path: Path, find: str, insert: str, marker: str):
    text = path.read_text()
    if marker in text:
        return
    if find not in text:
        raise SystemExit(f'Cannot find expected insertion point in {path}: {find[:180]!r}')
    path.write_text(text.replace(find, find + insert, 1))

# geoArticleLogic remaining patches
replace_if(logic, '''function formatGenerationBasis(basis: P11GenerationBasis) {
  return [
    `- 客户指定问题：${basis.customerQuestion}`,
    `- 内容缺口：${basis.contentGap}`,
    `- 优化任务：${basis.optimizationTask}`,
    `- AI 未推荐原因：${basis.notRecommendedReason}`,
    `- 竞品差距：${basis.competitorGap}`,
  ].join("\\n");
}
''', r'''function formatGenerationBasis(basis: P11GenerationBasis) {
  const usage = basis.assetLibraryUsage;
  return [
    `- 客户指定问题：${basis.customerQuestion}`,
    `- 内容缺口：${basis.contentGap}`,
    `- 优化任务：${basis.optimizationTask}`,
    `- AI 未推荐原因：${basis.notRecommendedReason}`,
    `- 竞品差距：${basis.competitorGap}`,
    ...(usage ? [
      "- 使用企业资料：\n" + formatCitationList(usage.enterpriseMaterials, "暂无可用企业资料，需补充企业基础资料或产品服务资料。"),
      "- 使用竞品资料：\n" + (usage.competitorMaterials.length > 0 ? usage.competitorMaterials.map(item => `- ${item.competitorName}；我方差异化：${item.differentiation || "待补充"}；来源：${item.sourceNotes || "资产库竞品资料"}`).join("\n") : "暂无可引用竞品资料。"),
      `- 是否使用客户案例：${usage.customerCaseUsage.status}`,
      `- 是否使用合规规则：${usage.complianceRules.length > 0 ? usage.complianceRules.join("；") : "未配置，发布前需人工复核。"}`,
      `- 是否使用内容风格：${usage.contentStyles.length > 0 ? usage.contentStyles.join("；") : "未配置，按稳健解释型风格处理。"}`,
      `- 是否使用发布策略：${usage.publishStrategy.length > 0 ? usage.publishStrategy.join("；") : "未配置，默认全人工审核。"}`,
      `- 证据缺口提示：${usage.missingEvidenceNotes.length > 0 ? usage.missingEvidenceNotes.join("；") : "暂无关键证据缺口。"}`,
    ] : []),
  ].join("\n");
}
''', '证据缺口提示')

replace_if(logic, '''  analyses: P11AnalysisLike[];
}): P11ArticleDraft {''', '''  analyses: P11AnalysisLike[];
  assetLibrary?: P12AssetLibraryContext | null;
}): P11ArticleDraft {''', 'assetLibrary?: P12AssetLibraryContext | null;\n}): P11ArticleDraft')

replace_if(logic, '''  const evidence = buildEvidenceList({ project, task, questions: input.questions, analyses: input.analyses });
  const intro = `${project.enterpriseName}在${project.industry}场景中的 GEO 优化，必须从客户真实会问的问题、AI 没有推荐企业的原因、竞品被提及的理由和当前内容缺口出发。本文根据本项目已完成的 GEO 诊断结果整理，不虚构案例，不添加未验证链接，也不承诺任何平台的绝对排名结果。`;''', '''  const evidence = buildEvidenceList({ project, task, questions: input.questions, analyses: input.analyses });
  const assetUsage = basis.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const evidenceGapText = assetUsage.missingEvidenceNotes.length > 0 ? assetUsage.missingEvidenceNotes.join("；") : "暂无关键证据缺口。";
  const intro = `${project.enterpriseName}在${project.industry}场景中的 GEO 优化，必须从客户真实会问的问题、AI 没有推荐企业的原因、竞品被提及的理由和当前内容缺口出发。本文根据本项目已完成的 GEO 诊断结果与企业 GEO 资产库整理，不虚构案例，不添加未验证链接，也不承诺任何平台的绝对排名结果。`;''', 'evidenceGapText')

replace_if(logic, '''    paragraph("六、发布前应补齐的证据清单", `为避免文章停留在概念层面，建议发布前由业务负责人补充以下真实证据：第一，能够证明${project.enterpriseName}服务边界的官网页面或产品说明；第二，能够解释${project.targetCustomers}为何适用的真实问答；第三，能够展示部署方式、售后流程或数据口径的截图；第四，与${basis.competitorNames.slice(0, 2).join("、")}进行客观比较时使用的可核验事实。若这些证据暂时缺失，应在文章中明确标注“需要补充”，而不是填写未经核验的案例或引用无法访问的链接。`),''', '''    paragraph("六、发布前应补齐的证据清单", `为避免文章停留在概念层面，建议发布前由业务负责人补充以下真实证据：第一，能够证明${project.enterpriseName}服务边界的官网页面或产品说明；第二，能够解释${project.targetCustomers}为何适用的真实问答；第三，能够展示部署方式、售后流程或数据口径的截图；第四，与${basis.competitorNames.slice(0, 2).join("、")}进行客观比较时使用的可核验事实。当前资产库证据缺口为：${evidenceGapText}。若这些证据暂时缺失，应在文章中明确标注对应缺口，而不是填写未经核验的案例、结果数据、价格口径或引用无法访问的链接。`),''', '当前资产库证据缺口为')

replace_if(logic, '''  task?: P11TaskLike | null;
}): P11QualityScore {''', '''  task?: P11TaskLike | null;
  assetLibrary?: P12AssetLibraryContext | null;
}): P11QualityScore {''', 'assetLibrary?: P12AssetLibraryContext | null;\n}): P11QualityScore')

replace_if(logic, '''  const basisComplete = Boolean(input.article.generationBasis && validateGeoCollectableStructure(content, input.article.citableSnippets ?? undefined, input.article.generationBasis).filter(item => item === "完整生成依据").length === 0);

  const problemMatchScore = Math.min(20, 8 + Math.min(questionMatches, 2) * 5 + (basisComplete ? 2 : 0));
  const evidenceScore = Math.min(20, 6 + Math.min(gapMatches, 2) * 4 + Math.min(competitorMatches, 2) * 2 + (input.task ? 4 : 0) + (basisComplete ? 2 : 0));''', '''  const basisComplete = Boolean(input.article.generationBasis && validateGeoCollectableStructure(content, input.article.citableSnippets ?? undefined, input.article.generationBasis).filter(item => item === "完整生成依据").length === 0);
  const assetUsage = input.article.generationBasis?.assetLibraryUsage ?? buildAssetLibraryUsage(input.assetLibrary);
  const prePublishCheck = evaluateAssetLibraryPrePublishCheck({ content, project: input.project, basis: input.article.generationBasis ?? undefined, assetLibrary: input.assetLibrary });
  const assetEvidenceStrength = assetUsage.enterpriseMaterials.length >= 2 && assetUsage.competitorMaterials.length >= 1 ? "高" : assetUsage.enterpriseMaterials.length >= 1 ? "中" : "低";
  const factSourceSummary = `资产库企业资料 ${assetUsage.enterpriseMaterials.length} 条，竞品资料 ${assetUsage.competitorMaterials.length} 条，客户案例 ${assetUsage.customerCaseUsage.references.length} 条；${assetUsage.customerCaseUsage.status}`;
  const complianceRiskSummary = prePublishCheck.blocked ? prePublishCheck.summary : "未发现资产库合规阻断项。";

  const problemMatchScore = Math.min(20, 8 + Math.min(questionMatches, 2) * 5 + (basisComplete ? 2 : 0));
  const evidenceScore = Math.min(20, 6 + Math.min(gapMatches, 2) * 4 + Math.min(competitorMatches, 2) * 2 + (input.task ? 4 : 0) + (basisComplete ? 2 : 0) + (assetEvidenceStrength === "高" ? 2 : assetEvidenceStrength === "中" ? 1 : 0));''', 'assetEvidenceStrength')

replace_if(logic, '''    ...forbiddenReasons,
    ...(structureBlocked ? [`缺少 GEO 可收录结构或生成依据：${structureIssues.join("、")}`] : []),
    ...(lowScoreBlocked ? [`内容质量分 ${totalScore} 低于 80 分`] : []),
  ];''', '''    ...forbiddenReasons,
    ...prePublishCheck.blockReasons,
    ...(structureBlocked ? [`缺少 GEO 可收录结构或生成依据：${structureIssues.join("、")}`] : []),
    ...(lowScoreBlocked ? [`内容质量分 ${totalScore} 低于 80 分`] : []),
  ];''', '...prePublishCheck.blockReasons')

replace_if(logic, '''    ...(forbiddenReasons.length > 0 ? ["删除假链接、占位链接、虚假案例、虚假数据和排名保证等高风险表述。"] : []),
  ];''', '''    ...(forbiddenReasons.length > 0 ? ["删除假链接、占位链接、虚假案例、虚假数据和排名保证等高风险表述。"] : []),
    ...(assetEvidenceStrength === "低" ? ["补充并确认企业基础资料、产品服务资料或官网内容，提升资产库证据强度。"] : []),
    ...(assetUsage.missingEvidenceNotes.length > 0 ? [`关键事实仍需补充或确认：${assetUsage.missingEvidenceNotes.join("；")}。`] : []),
    ...(prePublishCheck.blocked ? ["根据资产库发布前检查结果，修正不可公开资料、禁用词、未确认事实或不允许承诺内容后再发布。"] : []),
  ];''', '关键事实仍需补充或确认')

replace_if(logic, '''      ? `质检未通过：${blockReasons.join("；")}。优化建议：${optimizationSuggestions.join("；")}`
      : `质检通过：文章具备生成依据、GEO 可收录结构、引用友好片段、平台适配素材和合规说明，质量分 ${totalScore}。优化建议：${optimizationSuggestions.join("；")}`,
  };''', '''      ? `质检未通过：${blockReasons.join("；")}。资产库证据强度：${assetEvidenceStrength}。事实来源：${factSourceSummary}。未确认事实：${prePublishCheck.unconfirmedFacts.length > 0 ? prePublishCheck.unconfirmedFacts.join("；") : "无"}。合规风险：${complianceRiskSummary}。优化建议：${optimizationSuggestions.join("；")}`
      : `质检通过：文章具备生成依据、GEO 可收录结构、引用友好片段、平台适配素材和合规说明，质量分 ${totalScore}。资产库证据强度：${assetEvidenceStrength}。事实来源：${factSourceSummary}。未确认事实：${prePublishCheck.unconfirmedFacts.length > 0 ? prePublishCheck.unconfirmedFacts.join("；") : "无"}。合规风险：${complianceRiskSummary}。优化建议：${optimizationSuggestions.join("；")}`,
    assetEvidenceStrength,
    factSourceSummary,
    unconfirmedFacts: prePublishCheck.unconfirmedFacts,
    complianceRiskSummary,
    prePublishCheck,
  };''', 'assetEvidenceStrength,')

# routers patches
replace_if(routers, '''  generateGeoArticleDraft,
  generateGeoArticleTopics,
  scoreGeoArticleQuality,
  type ArticleStatus,
} from "./geoArticleLogic";''', '''  evaluateAssetLibraryPrePublishCheck,
  generateGeoArticleDraft,
  generateGeoArticleTopics,
  scoreGeoArticleQuality,
  type ArticleStatus,
  type P12AssetLibraryContext,
} from "./geoArticleLogic";''', 'evaluateAssetLibraryPrePublishCheck')

insert_after_if(routers, '''const getProjectOrThrow = async (projectId: number) => {
  const db = await requireDb();
  const result = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
  return result[0];
};
''', '''
const getAssetLibraryContext = async (projectId: number): Promise<P12AssetLibraryContext> => {
  const db = await requireDb();
  const [profiles, assetSources, cases, competitors, rules, styles, strategies] = await Promise.all([
    db.select().from(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId)).orderBy(desc(enterpriseGeoProfiles.updatedAt)).limit(1),
    db.select().from(geoAssetSources).where(eq(geoAssetSources.projectId, projectId)).orderBy(desc(geoAssetSources.updatedAt)),
    db.select().from(customerCases).where(eq(customerCases.projectId, projectId)).orderBy(desc(customerCases.updatedAt)),
    db.select().from(competitorProfiles).where(eq(competitorProfiles.projectId, projectId)).orderBy(desc(competitorProfiles.updatedAt)),
    db.select().from(complianceRules).where(eq(complianceRules.projectId, projectId)).orderBy(desc(complianceRules.updatedAt)),
    db.select().from(contentStyleProfiles).where(eq(contentStyleProfiles.projectId, projectId)).orderBy(desc(contentStyleProfiles.updatedAt)),
    db.select().from(publishStrategies).where(eq(publishStrategies.projectId, projectId)).orderBy(desc(publishStrategies.updatedAt)),
  ]);
  return {
    profile: profiles[0] ?? null,
    assetSources,
    customerCases: cases,
    competitorProfiles: competitors,
    complianceRules: rules,
    contentStyleProfiles: styles,
    publishStrategies: strategies,
  };
};
''', 'getAssetLibraryContext')

replace_if(routers, '''      const analysisScope = analysesWithQuestions.filter(analysis => sourceAnalysisIds.includes(analysis.id));
      const draft = generateGeoArticleDraft({''', '''      const analysisScope = analysesWithQuestions.filter(analysis => sourceAnalysisIds.includes(analysis.id));
      const assetLibrary = await getAssetLibraryContext(topic.projectId);
      const draft = generateGeoArticleDraft({''', 'const assetLibrary = await getAssetLibraryContext(topic.projectId);')

replace_if(routers, '''        questions: questionScope.length > 0 ? questionScope : projectQuestions,
        analyses: analysisScope.length > 0 ? analysisScope : analysesWithQuestions,
      });''', '''        questions: questionScope.length > 0 ? questionScope : projectQuestions,
        analyses: analysisScope.length > 0 ? analysisScope : analysesWithQuestions,
        assetLibrary,
      });''', 'assetLibrary,\n      });')

replace_if(routers, '''      const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
      const quality = scoreGeoArticleQuality({''', '''      const analysesWithQuestions = attachQuestionTextToAnalyses(resolveEffectiveAnalysisResults(analyses), responses, projectQuestions);
      const assetLibrary = await getAssetLibraryContext(article.projectId);
      const quality = scoreGeoArticleQuality({''', 'const assetLibrary = await getAssetLibraryContext(article.projectId);')

replace_if(routers, '''        analyses: analysesWithQuestions,
        task: taskRows[0] ?? null,
      });''', '''        analyses: analysesWithQuestions,
        task: taskRows[0] ?? null,
        assetLibrary,
      });''', 'task: taskRows[0] ?? null,\n        assetLibrary')

replace_if(routers, '''      if (!latestScore || latestScore.blocked || latestScore.totalScore < 80) throw new TRPCError({ code: "BAD_REQUEST", message: "文章质量分低于 80 或存在禁止发布风险，不能发布" });
      const publicPath = `/geo/content/${article.projectId}/${article.id}`;''', '''      if (!latestScore || latestScore.blocked || latestScore.totalScore < 80) throw new TRPCError({ code: "BAD_REQUEST", message: "文章质量分低于 80 或存在禁止发布风险，不能发布" });
      const assetLibrary = await getAssetLibraryContext(article.projectId);
      const prePublishCheck = evaluateAssetLibraryPrePublishCheck({
        content: `${article.title}\n${article.markdownContent}`,
        project: await getProjectOrThrow(article.projectId),
        basis: article.generationBasis as Parameters<typeof evaluateAssetLibraryPrePublishCheck>[0]["basis"],
        assetLibrary,
      });
      if (prePublishCheck.blocked) throw new TRPCError({ code: "BAD_REQUEST", message: prePublishCheck.summary });
      const publicPath = `/geo/content/${article.projectId}/${article.id}`;''', 'prePublishCheck = evaluateAssetLibraryPrePublishCheck')

# frontend basis type
replace_if(geo_pages, '''type ArticleGenerationBasisView = {
  customerQuestion?: string;
  contentGap?: string;
  optimizationTask?: string;
  optimizationTaskName?: string;
  notRecommendedReason?: string;
  competitorGap?: string;
  competitorNames?: string[];
  manualReviewConclusion?: string;
  humanRevisionConclusion?: string;
};''', '''type ArticleGenerationBasisView = {
  customerQuestion?: string;
  contentGap?: string;
  optimizationTask?: string;
  optimizationTaskName?: string;
  notRecommendedReason?: string;
  competitorGap?: string;
  competitorNames?: string[];
  manualReviewConclusion?: string;
  humanRevisionConclusion?: string;
  assetLibraryUsage?: {
    enterpriseMaterials?: Array<{ title?: string; sourceType?: string; trustLevel?: string; isPublic?: boolean }>;
    competitorMaterials?: Array<{ competitorName?: string; differentiation?: string }>;
    customerCaseUsage?: { used?: boolean; status?: string };
    complianceRules?: string[];
    contentStyles?: string[];
    publishStrategy?: string[];
    missingEvidenceNotes?: string[];
  };
};''', 'assetLibraryUsage?:')

# public content guarded
text = public_content.read_text()
if 'assetLibraryUsage?' not in text and 'type ArticleGenerationBasisView' in text:
    text = text.replace('''type ArticleGenerationBasisView = {
  customerQuestion?: string;
  contentGap?: string;
  optimizationTaskName?: string;
  notRecommendedReason?: string;
  competitorGap?: string;
  humanRevisionConclusion?: string;
};''', '''type ArticleGenerationBasisView = {
  customerQuestion?: string;
  contentGap?: string;
  optimizationTaskName?: string;
  optimizationTask?: string;
  notRecommendedReason?: string;
  competitorGap?: string;
  humanRevisionConclusion?: string;
  manualReviewConclusion?: string;
  assetLibraryUsage?: {
    enterpriseMaterials?: Array<{ title?: string; sourceType?: string; trustLevel?: string; isPublic?: boolean }>;
    competitorMaterials?: Array<{ competitorName?: string; differentiation?: string }>;
    customerCaseUsage?: { used?: boolean; status?: string };
    complianceRules?: string[];
    contentStyles?: string[];
    publishStrategy?: string[];
    missingEvidenceNotes?: string[];
  };
};''')
    text = text.replace('''    ["人工修订", basis.humanRevisionConclusion],
  ].filter(([, value]) => Boolean(value));''', '''    ["人工修订", basis.humanRevisionConclusion ?? basis.manualReviewConclusion],
    ["使用企业资料", basis.assetLibraryUsage?.enterpriseMaterials?.map(item => `${item.title ?? "未命名资料"}（${item.sourceType ?? "资料"}，${item.trustLevel ?? "可信度未标注"}，${item.isPublic ? "可公开" : "不可公开"}）`).join("；")],
    ["使用竞品资料", basis.assetLibraryUsage?.competitorMaterials?.map(item => `${item.competitorName ?? "未命名竞品"}：${item.differentiation ?? "差异待补充"}`).join("；")],
    ["是否使用客户案例", basis.assetLibraryUsage?.customerCaseUsage?.status],
    ["是否使用合规规则", basis.assetLibraryUsage?.complianceRules?.join("；")],
    ["是否使用内容风格", basis.assetLibraryUsage?.contentStyles?.join("；")],
    ["是否使用发布策略", basis.assetLibraryUsage?.publishStrategy?.join("；")],
    ["证据缺口", basis.assetLibraryUsage?.missingEvidenceNotes?.join("；")],
  ].filter(([, value]) => Boolean(value));''')
    public_content.write_text(text)

# tests import and cases
replace_if(test, '''  scoreGeoArticleQuality,
  sortContentGapAnalysesByPriority,
  validateGenerationBasis,
  validateGeoCollectableStructure,
  type P11AnalysisLike,
''', '''  scoreGeoArticleQuality,
  sortContentGapAnalysesByPriority,
  validateGenerationBasis,
  validateGeoCollectableStructure,
  evaluateAssetLibraryPrePublishCheck,
  type P11AnalysisLike,
''', 'evaluateAssetLibraryPrePublishCheck')

if 'V1.2 Sprint 1.5 资产库接入验证' not in test.read_text():
    test.write_text(test.read_text() + r'''

describe("V1.2 Sprint 1.5 资产库接入验证", () => {
  const topic = generateGeoArticleTopics({ project, questions, analyses, tasks })[0];
  const assetLibrary = {
    profile: {
      targetCustomers: "制造企业售后负责人",
      productServiceIntro: "清源智能提供工业知识库与售后问答系统",
      servicePriceRange: "",
      priceExplanation: "",
    },
    assetSources: [
      {
        id: 1001,
        sourceType: "企业基础资料",
        title: "清源智能企业资料",
        trustLevel: "高",
        isPublic: 1,
        canUseForGeneration: 1,
        manuallyConfirmed: 1,
        structuredSummary: { digest: "清源智能面向制造企业提供工业知识库、售后问答和工单辅助能力。" },
      },
      {
        id: 1002,
        sourceType: "产品服务资料",
        title: "工业知识库产品手册",
        trustLevel: "高",
        isPublic: 1,
        canUseForGeneration: 1,
        manuallyConfirmed: 1,
        structuredSummary: { digest: "产品能力包括知识库维护、FAQ、工单闭环与复测分析。" },
      },
    ],
    customerCases: [],
    competitorProfiles: [
      {
        id: 2001,
        competitorName: "云答科技",
        website: "https://example.org/yunda",
        comparisonNotes: "清源智能更强调工业售后知识库治理与工单闭环，云答科技更强调通用客服覆盖。",
        aiRecommendationSignals: "竞品公开页面更容易被识别为工业客服解决方案",
        canReference: 1,
      },
    ],
    complianceRules: [
      {
        ruleName: "GEO 稳健表达",
        forbiddenClaims: "保证收录；保证排名",
        forbiddenWords: ["行业第一"],
        requiredDisclaimers: "不得承诺任何平台收录或排名结果",
        enabled: 1,
      },
    ],
    contentStyleProfiles: [
      {
        profileName: "专家解释型",
        tone: "专业、克制、可验证",
        writingStyle: "使用清晰判断标准和证据缺口说明",
        enabled: 1,
      },
    ],
    publishStrategies: [
      {
        reviewMode: "全人工审核",
        dailyLimit: 2,
        minQualityScore: 80,
        preferredPlatforms: ["官网版", "知乎回答版"],
        enabled: 1,
      },
    ],
  };

  it("文章生成依据真实引用资产库并显式标注证据缺口", () => {
    const draft = generateGeoArticleDraft({
      project,
      topic: { ...topic, id: 301 },
      task: tasks[0],
      questions,
      analyses,
      assetLibrary,
    });

    expect(draft.generationBasis.assetLibraryUsage?.enterpriseMaterials.map(item => item.title)).toContain("清源智能企业资料");
    expect(draft.generationBasis.assetLibraryUsage?.competitorMaterials.map(item => item.competitorName)).toContain("云答科技");
    expect(draft.generationBasis.assetLibraryUsage?.customerCaseUsage.status).toBe("案例信息待补充");
    expect(draft.markdownContent).toContain("案例信息待补充");
    expect(draft.markdownContent).toContain("数据暂无公开来源");
    expect(draft.markdownContent).toContain("价格口径需客户确认");
    expect(draft.markdownContent).not.toContain("成功提升了");
  });

  it("质量评分读取资产库并体现证据强度、事实来源和合规风险", () => {
    const draft = generateGeoArticleDraft({ project, topic: { ...topic, id: 302 }, task: tasks[0], questions, analyses, assetLibrary });
    const quality = scoreGeoArticleQuality({ article: draft, project, questions, analyses, task: tasks[0], assetLibrary });

    expect(quality.assetEvidenceStrength).toBe("高");
    expect(quality.factSourceSummary).toContain("资产库企业资料 2 条");
    expect(quality.reviewSummary).toContain("资产库证据强度");
    expect(quality.reviewSummary).toContain("事实来源");
    expect(quality.reviewSummary).toContain("合规风险");
  });

  it("发布前检查识别不可公开资料、禁用词和保证收录排名承诺并阻断发布", () => {
    const draft = generateGeoArticleDraft({ project, topic: { ...topic, id: 303 }, task: tasks[0], questions, analyses, assetLibrary });
    const riskyContent = `${draft.markdownContent}\n行业第一，保证收录并保证排名。`;
    const check = evaluateAssetLibraryPrePublishCheck({
      content: riskyContent,
      project,
      basis: {
        ...draft.generationBasis,
        assetLibraryUsage: {
          ...draft.generationBasis.assetLibraryUsage!,
          enterpriseMaterials: [{ ...draft.generationBasis.assetLibraryUsage!.enterpriseMaterials[0], isPublic: false }],
        },
      },
      assetLibrary,
    });

    expect(check.blocked).toBe(true);
    expect(check.blockReasons.join("；")).toContain("不可公开资料");
    expect(check.blockReasons.join("；")).toContain("行业第一");
    expect(check.blockReasons.join("；")).toContain("承诺保证收录或排名");
  });
});
''')

print('V1.2 Sprint 1.5 resume patch applied')
