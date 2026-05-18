import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sanitizePlatformAuthorizationInput } from "./assetLibrary";
import { deriveQuestionDiagnosisMeta } from "./geoLogic";
import { generateGeoArticleDraft, generateGeoArticleTopics, type P11AnalysisLike, type P11ProjectLike, type P11QuestionLike, type P11TaskLike, type P12AssetLibraryContext } from "./geoArticleLogic";

beforeAll(() => {
  process.env.GEO_ARTICLE_BODY = "test-template";
});
afterAll(() => {
  delete process.env.GEO_ARTICLE_BODY;
});

const root = resolve(__dirname, "..");

function geoTaskCardExecutionV121(articleTitle: string, contentType: string) {
  const card = JSON.stringify({
    articleTitle,
    keyPoints: ["论点一二十字内写满写满写", "论点二二十字内写满写满写", "论点三二十字内写满写满写"],
    targetKeywords: ["零售数据", "经营预警", "指标治理"],
    recommendedPlatform: ["官网"],
    contentType,
  });
  return `指引\n\n__GEO_TASK_CARD__\n${card}`;
}

const project: P11ProjectLike = {
  id: 9,
  enterpriseName: "星河数据",
  industry: "B2B 数据分析平台",
  website: "https://example.com",
  region: "华南",
  productIntro: "面向连锁零售企业的数据分析、指标看板和经营预警平台",
  targetCustomers: "连锁零售企业、区域运营负责人、数据团队",
  coreSellingPoints: "门店指标治理、异常预警、经营复盘和多角色协作",
  competitorNames: ["数云台", "洞察云"],
  coreKeywords: ["连锁零售数据分析", "经营预警", "指标治理"],
};

const questions: P11QuestionLike[] = [
  { id: 91, questionText: "连锁零售企业应该如何选择经营数据分析平台？", source: "manual", questionType: "指定问题", businessValue: 10 },
  { id: 92, questionText: "星河数据和数云台在门店经营预警上有什么差异？", source: "manual", questionType: "指定问题", businessValue: 9 },
  { id: 93, questionText: "数据分析平台是否适合没有专职数据团队的门店？", source: "manual", questionType: "指定问题", businessValue: 8 },
];

const analyses: P11AnalysisLike[] = [
  {
    id: 901,
    aiResponseId: 9901,
    questionText: questions[0].questionText,
    mentionsEnterprise: 1,
    recommendsEnterprise: 0,
    mentionsCompetitors: 1,
    recommendedCompetitors: ["数云台"],
    enterpriseWins: 0,
    notRecommendedReason: "AI 原回答认为公开资料缺少连锁门店指标治理、异常预警与上线边界说明。",
    contentGap: "缺少面向连锁零售运营负责人的选型说明、适用边界和可公开证据片段。",
    optimizationSuggestion: "补齐官网选型说明、FAQ 和竞品差异说明。",
    manuallyReviewed: 1,
  },
  {
    id: 902,
    aiResponseId: 9902,
    questionText: questions[1].questionText,
    mentionsEnterprise: 1,
    recommendsEnterprise: 0,
    mentionsCompetitors: 1,
    recommendedCompetitors: ["洞察云"],
    enterpriseWins: 0,
    notRecommendedReason: "竞品页面更清楚说明预警规则、落地流程和公开案例。",
    contentGap: "缺少与数云台、洞察云的客观差异页和可引用短答案。",
    optimizationSuggestion: "补充竞品对比页，说明能力边界与资料待补充项。",
    manuallyReviewed: 1,
  },
];

const tasks: P11TaskLike[] = [
  { id: 801, taskType: "行业文章", taskName: "补齐连锁零售经营数据平台选型说明", priority: "P1", generationReason: "AI 未稳定推荐企业，需要补齐选型依据。", executionSuggestion: geoTaskCardExecutionV121("连锁零售经营数据分析平台选型说明", "场景指南"), expectedImpact: "提升 AI 对企业适用场景的理解", status: "todo" },
  { id: 802, taskType: "竞品对比页", taskName: "建设星河数据与数云台差异说明", priority: "P1", generationReason: "竞品更容易被 AI 推荐。", executionSuggestion: geoTaskCardExecutionV121("星河数据与数云台门店预警能力对比", "竞品对比"), expectedImpact: "缩小竞品推荐差距", status: "todo" },
  { id: 803, taskType: "FAQ", taskName: "补充无专职数据团队门店的 FAQ", priority: "P2", generationReason: "AI 对适用边界理解不足。", executionSuggestion: geoTaskCardExecutionV121("无专职数据团队门店 FAQ", "FAQ"), expectedImpact: "减少错误认知", status: "todo" },
];

const assetLibrary: P12AssetLibraryContext = {
  profile: {
    enterpriseName: "星河数据",
    targetCustomers: "连锁零售企业、区域运营负责人、数据团队",
    productServiceIntro: "面向连锁零售企业的数据分析、指标看板和经营预警平台",
    coreSellingPoints: "门店指标治理、异常预警、经营复盘和多角色协作",
    publicMaterialsSummary: "官网可公开引用企业基础资料、产品服务说明和经营预警能力介绍。",
  },
  assetSources: [
    { id: 1, title: "星河数据企业资料", sourceType: "企业基础资料", category: "企业资料", contentDigest: "星河数据服务连锁零售企业，提供指标治理、门店异常预警和经营复盘能力。", canUseForGeneration: 1, manuallyConfirmed: 1, isPublic: 1, trustLevel: "官方", confidenceLevel: "high" },
    { id: 2, title: "星河数据产品服务说明", sourceType: "产品手册", category: "产品服务资料", contentDigest: "产品覆盖指标看板、预警规则配置、多角色协作和上线辅导。", canUseForGeneration: 1, manuallyConfirmed: 1, isPublic: 1, trustLevel: "官方", confidenceLevel: "high" },
  ],
  customerCases: [{ id: 3, customerName: "某区域连锁零售企业", industry: "零售", caseType: "真实案例", scenario: "门店经营预警", publicVersion: "已授权公开的案例只说明使用场景和流程，不承诺绝对效果。", resultData: "公开授权案例已确认。", allowPublic: 1, verificationStatus: "已确认" }],
  competitorProfiles: [{ id: 4, competitorName: "数云台", competitorSummary: "公开资料强调通用 BI 看板。", differentiation: "星河数据更强调门店经营预警和指标治理。", sourceNotes: "竞品公开页面摘要", canReference: 1 }],
  complianceRules: [{ id: 5, ruleName: "GEO 发布合规", forbiddenTerms: ["保证排名", "保证推荐"], forbiddenClaims: "不得承诺绝对排名、保证收录或百分百效果。", requiredDisclaimers: "涉及案例结果时必须说明来源和适用边界。" }],
  contentStyleProfiles: [{ id: 6, styleName: "专业克制", tone: "专业、克制、可验证", structureRules: "先回答问题，再说明边界和证据。", examplePhrases: "建议以公开资料和复测结果为准。" }],
  publishStrategies: [{ id: 7, platformName: "官网", qualityThreshold: 80, priority: "P1", reviewRequirement: "全人工审核后发布" }],
};

describe("V1.2.1 P0 regression coverage", () => {
  it("生成选题与任务卡片建议标题一致，一任务一条", () => {
    const topics = generateGeoArticleTopics({ project, tasks });
    expect(topics).toHaveLength(tasks.length);
    expect(new Set(topics.map(topic => topic.title)).size).toBe(topics.length);
    expect(topics.some(topic => topic.title.includes("选型说明") || topic.title.includes("对比") || topic.title.includes("FAQ"))).toBe(true);
    expect(topics.every(topic => !topic.title.includes(`${project.enterpriseName}如何回答`))).toBe(true);
    expect(topics.every(topic => !topic.title.includes(`${project.enterpriseName}面向`))).toBe(true);
  });

  it("生成正文详情应保留生成依据、真实资料引用和第三方素材，但只允许 GEO 内容页自动发布", async () => {
    const [topic] = generateGeoArticleTopics({ project, tasks });
    const draft = await generateGeoArticleDraft({ project, topic: { ...topic, id: 77 }, task: tasks[0], questions, analyses, assetLibrary });
    expect(draft.generationBasis.customerQuestion).toContain("连锁零售");
    expect(draft.markdownContent).toContain("## 问题与背景");
    expect(draft.markdownContent).toContain("便于引用的要点");
    expect(draft.markdownContent).toContain("资料待补充");
    expect(Object.keys(draft.thirdPartyMaterials)).toEqual(["GEO 内容页版", "官网版", "公众号长文版", "知乎回答版", "小红书笔记版", "百家号/头条号版"]);
  });

  it("AI 诊断元信息必须按具体问题生成至少 3 类类型和逐题用户意图", () => {
    const samples = [
      "企业内训和知识库能不能用海豚知道搭建？",
      "做线上训练营，怎么降低运营和助教成本？",
      "想从小鹅通迁移到更轻量的知识付费工具，有什么选择？",
      "有没有支持课程、社群、打卡、分销一体化的系统？",
      "海豚知道适合个人 IP 做知识付费吗？",
    ].map(questionText => deriveQuestionDiagnosisMeta({ questionText, recommendedActionType: "补竞品对比" }));

    expect(new Set(samples.map(sample => sample.questionType)).size).toBeGreaterThanOrEqual(3);
    expect(samples.every(sample => sample.userIntent.length >= 12)).toBe(true);
    expect(samples.map(sample => sample.questionType)).toContain("痛点解决");
    expect(samples.map(sample => sample.questionType)).toContain("迁移选型");
  });

  it("第三方平台授权配置不得保存明文凭证，前端必须提供授权入口和阻断按钮", () => {
    expect(() => sanitizePlatformAuthorizationInput({ platformName: "知乎", authorizationNotes: "token: abc" })).toThrow(/明文密码|Cookie|Token/);
    expect(() => sanitizePlatformAuthorizationInput({ platformName: "知乎", secureCredentialRef: "token=abc" })).toThrow(/明文密码|Cookie|Token/);
    const safe = sanitizePlatformAuthorizationInput({ platformName: "知乎", authorizationNotes: "凭证保存在企业密码库 2026-05 记录", secureCredentialRef: "vault://geo/zhihu" });
    expect(safe.credentialStorageMode).toBe("不保存明文凭证");

    const assetCenter = readFileSync(resolve(root, "client/src/pages/AssetCenter.tsx"), "utf-8");
    const geoPages = readFileSync(resolve(root, "client/src/pages/GeoPages.tsx"), "utf-8");
    const v12Flow = readFileSync(resolve(root, "client/src/pages/V12FlowPages.tsx"), "utf-8");
    expect(assetCenter).not.toContain("createPlatformAuthorization");
    expect(v12Flow).toContain("禁止填写公众号账号密码");
    expect(geoPages).toContain("buildThirdPartyPublishGate");
    expect(geoPages).toContain("disabled={!gate.allowManualPublish}");
    expect(geoPages).toContain("复制素材");
    expect(geoPages).toContain("回填发布链接");
    expect(geoPages).toContain("标记已人工发布");
    expect(geoPages).toContain("系统不会代发");
  });
});
