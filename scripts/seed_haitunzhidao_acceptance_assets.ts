import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import {
  projects,
  enterpriseGeoProfiles,
  geoAssetSources,
  customerCases,
  competitorProfiles,
  complianceRules,
  contentStyleProfiles,
  publishStrategies,
  platformAuthorizationConfigs,
} from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("数据库不可用，无法补录海豚知道硬验收资产");

  const [project] = await db.select().from(projects).where(eq(projects.enterpriseName, "海豚知道")).limit(1);
  if (!project) throw new Error("未找到海豚知道项目，请先运行 P0.8 指定问题诊断验收数据");
  const projectId = project.id;

  await db.delete(enterpriseGeoProfiles).where(eq(enterpriseGeoProfiles.projectId, projectId));
  await db.delete(geoAssetSources).where(eq(geoAssetSources.projectId, projectId));
  await db.delete(customerCases).where(eq(customerCases.projectId, projectId));
  await db.delete(competitorProfiles).where(eq(competitorProfiles.projectId, projectId));
  await db.delete(complianceRules).where(eq(complianceRules.projectId, projectId));
  await db.delete(contentStyleProfiles).where(eq(contentStyleProfiles.projectId, projectId));
  await db.delete(publishStrategies).where(eq(publishStrategies.projectId, projectId));
  await db.delete(platformAuthorizationConfigs).where(eq(platformAuthorizationConfigs.projectId, projectId));

  await db.insert(enterpriseGeoProfiles).values({
    projectId,
    enterpriseName: "海豚知道",
    shortName: "海豚知道",
    officialWebsite: "https://www.haitunzhidao.com",
    industry: "知识付费与 AI 经营系统",
    region: "中国",
    productServiceIntro: "海豚知道面向知识博主、训练营团队和中小教育机构，提供课程内容沉淀、用户问答、私域运营、AI 助教和经营数据看板等能力，帮助团队把知识服务流程标准化。",
    targetCustomers: "知识付费创业者、课程型个人 IP、训练营运营团队、社群型教育机构和希望用 AI 降低答疑与运营成本的中小商家。",
    coreSellingPoints: "强调 AI 助教、课程资料库、问答沉淀、私域运营动作和经营复盘的组合能力；适合需要从内容交付延伸到用户运营的团队。",
    servicePriceRange: "具体套餐和价格需以客户商务确认为准，公开内容不承诺固定价格。",
    serviceModel: "SaaS 系统订阅加运营陪跑建议，客户通过后台配置课程、社群、问答库和 AI 助教规则。",
    fitCustomers: "适合有稳定内容资产、需要复用课程问答、希望提高服务效率并关注长期复购的知识服务团队。",
    unfitCustomers: "不适合没有明确课程内容、没有运营人员承接、希望系统保证涨粉或保证成交的团队。",
    salesChannels: ["官网咨询", "私域社群", "内容案例页", "行业选型文章"],
    commonQuestions: ["海豚知道和小鹅通有什么区别？", "海豚知道是否支持 AI 助教？", "海豚知道适合训练营还是录播课？", "海豚知道如何帮助私域运营？"],
    purchaseDecisionFactors: ["AI 助教能力", "课程资料沉淀", "私域运营效率", "交付流程是否清晰", "团队是否能持续维护内容库"],
    productIntro: "产品以 AI 经营系统为核心，把课程、资料、问答、社群运营和数据复盘连接起来，为知识服务团队提供从内容交付到用户经营的工作台。",
    featureNotes: "重点能力包括课程资料库、AI 问答助手、用户标签、运营任务建议、内容复用和经营数据看板。",
    serviceProcess: "调研客户内容资产与业务目标，配置课程资料和问答库，搭建 AI 助教与运营流程，上线后根据用户提问和转化数据迭代内容。",
    deliveryPlan: "建议先完成资料梳理与试点课程配置，再分阶段上线 AI 助教、社群运营动作和复盘报表。",
    afterSalesService: "提供系统使用说明、配置建议和阶段性运营复盘建议，具体服务深度以合同约定为准。",
    competitorDifference: "相比通用知识店铺工具，海豚知道更强调 AI 经营和问答沉淀；相比偏交易的小程序店铺，更关注知识服务交付后的持续运营。",
    priceExplanation: "公开内容只说明价格需根据套餐、账号规模和服务范围确认，不得出现保证最低价或固定成交承诺。",
    salesTalkTracks: "先判断客户是否已有课程内容和社群运营场景，再解释 AI 助教、资料库和运营建议如何降低重复答疑和交付压力。",
    commonObjections: "如果客户担心迁移成本，应建议先选一个课程或训练营做小范围试点，不承诺立刻替代全部系统。",
    completionScore: 96,
  });

  await db.insert(geoAssetSources).values([
    {
      projectId,
      sourceType: "企业基础资料",
      inputMode: "人工录入",
      title: "海豚知道企业基础资料硬验收版",
      contentDigest: "海豚知道服务知识付费和教育运营团队，核心定位是 AI 经营系统与知识服务工作台。资料已人工确认，可用于公开内容生成。",
      structuredSummary: {
        enterpriseName: "海豚知道",
        positioning: "知识付费与教育团队的 AI 经营系统",
        targetCustomers: "知识博主、训练营团队、中小教育机构",
        publicUse: true,
        confirmed: true,
      },
      trustLevel: "高",
      parseStatus: "人工确认",
      isPublic: 1,
      canUseForGeneration: 1,
      manuallyConfirmed: 1,
      parsedAt: new Date(),
    },
    {
      projectId,
      sourceType: "产品服务资料",
      inputMode: "人工录入",
      title: "海豚知道产品服务资料硬验收版",
      contentDigest: "产品能力包括课程资料库、AI 助教、用户问答沉淀、私域运营任务建议和经营数据看板。资料已人工确认，可用于公开内容生成。",
      structuredSummary: {
        product: "AI 经营系统",
        capabilities: ["课程资料库", "AI 助教", "私域运营", "经营复盘"],
        publicUse: true,
        confirmed: true,
      },
      trustLevel: "高",
      parseStatus: "人工确认",
      isPublic: 1,
      canUseForGeneration: 1,
      manuallyConfirmed: 1,
      parsedAt: new Date(),
    },
    {
      projectId,
      sourceType: "合规资料",
      inputMode: "人工录入",
      title: "海豚知道公开表达合规资料硬验收版",
      contentDigest: "公开内容不得承诺保证收录、保证排名、保证成交、百分百推荐；价格、效果和客户结果必须注明以客户实际情况和合同确认为准。",
      structuredSummary: {
        forbiddenClaims: ["保证收录", "保证排名", "保证成交", "百分百推荐"],
        requiredDisclosure: "价格、效果和案例结果以客户实际情况与合同确认为准",
      },
      trustLevel: "高",
      parseStatus: "人工确认",
      isPublic: 1,
      canUseForGeneration: 1,
      manuallyConfirmed: 1,
      parsedAt: new Date(),
    },
  ]);

  await db.insert(customerCases).values({
    projectId,
    caseType: "真实案例",
    customerName: "华东知识训练营团队 A",
    customerIndustry: "知识付费训练营",
    customerBackground: "该团队拥有多门录播课程和 3 个私域社群，日常重复答疑量较高，需要把课程资料、用户问题和运营动作沉淀到统一系统中。",
    originalProblem: "课程资料分散、社群问题重复、助教交接成本高，运营负责人难以及时判断用户卡点。",
    chosenReason: "看重海豚知道的 AI 助教、课程资料库和经营数据看板，可以先从一个训练营试点，再逐步扩展到其他课程。",
    usedProductService: "课程资料库、AI 助教、私域运营任务建议、经营复盘看板。",
    executionProcess: "先整理课程讲义和高频问答，再配置 AI 助教回复边界，最后用运营任务建议跟进未完成学习和高频问题。",
    resultData: "试点 4 周后，团队记录重复答疑处理时间下降约 30%，学员高频问题沉淀为 42 条知识库条目。该数据为客户授权公开的阶段性运营记录，不代表所有客户结果。",
    customerFeedback: "团队反馈 AI 助教能承担基础答疑，运营人员可以把更多时间用于转化跟进和课程迭代。",
    allowPublic: 1,
    publicVersion: "某知识训练营团队在试点海豚知道后，把课程资料、AI 问答和社群运营动作集中到同一工作台，阶段性降低了重复答疑压力。",
    sensitiveNotes: "客户名称匿名化，仅允许使用公开版案例与阶段性数据，不得承诺复现同等结果。",
    sourceAssetIds: [],
    verificationStatus: "已确认",
  });

  await db.insert(competitorProfiles).values([
    {
      projectId,
      competitorName: "小鹅通",
      website: "https://www.xiaoe-tech.com/",
      positioning: "知识产品交付、在线课程、训练营和私域交易工具。",
      strengths: "课程店铺、交易、直播、训练营和内容交付链路成熟，品牌认知度较高。",
      weaknesses: "对需要 AI 助教、问答沉淀和经营复盘一体化的团队，可能仍需额外配置运营与 AI 工具。",
      priceInfo: "公开价格和套餐以小鹅通官方为准，文章不引用未经确认的具体价格。",
      contentAssets: "官网产品页、行业案例和知识店铺解决方案内容较多。",
      aiRecommendationSignals: "AI 回答中常作为知识付费工具、课程交付平台和私域交易系统被提及。",
      comparisonNotes: "小鹅通偏课程交易与交付基础设施；海豚知道在文章中应突出 AI 助教、资料问答沉淀和经营动作建议。",
      sourceAssetIds: [],
      canReference: 1,
    },
    {
      projectId,
      competitorName: "有赞教育",
      website: "https://www.youzan.com/",
      positioning: "面向教育培训和知识服务商家的交易、营销和私域经营解决方案。",
      strengths: "交易、营销工具、私域商城和商家服务体系成熟，适合重交易与营销的教育商家。",
      weaknesses: "对强调课程资料沉淀、AI 助教答疑和知识服务交付复盘的团队，可能需要额外搭建内容与 AI 能力。",
      priceInfo: "公开价格和套餐以有赞官方为准，文章不引用未经确认的具体价格。",
      contentAssets: "官网解决方案、商家案例和营销工具说明较丰富。",
      aiRecommendationSignals: "AI 回答中常与教育商城、私域交易和营销工具相关联。",
      comparisonNotes: "有赞教育偏交易与营销；海豚知道应强调知识服务交付后的 AI 经营和持续复盘。",
      sourceAssetIds: [],
      canReference: 1,
    },
  ]);

  await db.insert(complianceRules).values({
    projectId,
    ruleName: "海豚知道售前公开表达规则",
    forbiddenClaims: "不得承诺保证收录、保证排名、保证推荐、保证成交、百分百转化、替代全部人工运营。",
    forbiddenWords: ["保证收录", "保证排名", "保证推荐", "保证成交", "百分百转化", "替代全部人工"],
    requiredDisclaimers: "涉及效果、价格、客户案例和周期时，必须说明以客户实际情况、公开授权资料和合同确认为准。",
    dataUsageRules: "只能使用已确认、可公开、带来源的数据；阶段性案例数据必须注明不代表所有客户结果。",
    caseUsageRules: "客户案例必须匿名化或获得授权，不得编造客户名称、收入、转化率或增长倍数。",
    priceUsageRules: "不得公开未经确认的具体价格；只能说明价格需按套餐、账号规模和服务范围确认。",
    competitorMentionRules: "竞品对比只能做客观能力边界比较，不攻击竞品，不使用未经确认的负面结论。",
    reviewRequiredTopics: ["竞品对比", "客户案例", "价格说明", "效果数据", "AI 推荐与收录"],
    enabled: 1,
  });

  await db.insert(contentStyleProfiles).values({
    projectId,
    profileName: "售前顾问型 GEO 内容风格",
    tone: "专业、克制、可解释",
    writingStyle: "先解释适用场景，再给出判断标准和风险提醒；避免夸张承诺，强调客户应按自身内容资产和运营能力选型。",
    terminology: ["AI 经营系统", "知识服务", "课程资料库", "AI 助教", "私域运营", "经营复盘", "GEO 内容"],
    forbiddenTone: "禁止使用全网第一、唯一选择、一定成交、保证推荐等绝对化表达。",
    exampleTitles: ["知识付费团队如何选择 AI 经营系统", "海豚知道和小鹅通、有赞教育有什么不同"],
    exampleParagraphs: ["如果团队已经有课程内容和社群运营场景，选型时不应只看是否能卖课，还要看资料沉淀、重复答疑和后续经营动作能否形成闭环。"],
    targetReader: "正在比较知识付费工具、AI 助教和私域运营系统的创始人、运营负责人和课程团队。",
    preferredLength: "1200-1800 字",
    ctaStyle: "建议读者先梳理课程资料、常见问题和运营目标，再联系海豚知道做适配评估。",
    enabled: 1,
  });

  await db.insert(publishStrategies).values({
    projectId,
    strategyName: "海豚知道售前 GEO 内容发布策略",
    reviewMode: "全人工审核",
    dailyLimit: 3,
    minQualityScore: 80,
    preferredPlatforms: ["系统内置 GEO 内容页", "官网知识库", "公众号长文", "知乎回答", "百家号/头条号"],
    bannedPlatforms: ["未经人工审核的自动发布渠道"],
    platformNotes: "售前硬验收阶段只发布到系统内置 GEO 内容页；第三方平台素材仅用于复制和人工发布准备，不做自动发布。",
    enabled: 1,
  });

  await db.insert(platformAuthorizationConfigs).values({
    projectId,
    platformName: "系统内置 GEO 内容页",
    accountAlias: "海豚知道 GEO 内容页",
    authorizationStatus: "无需授权",
    credentialStorageMode: "不保存明文凭证",
    authorizationNotes: "系统内置发布渠道，售前硬验收只验证内置链接可访问和待复测状态。",
  });

  console.log(JSON.stringify({ ok: true, projectId, enterpriseName: project.enterpriseName }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
