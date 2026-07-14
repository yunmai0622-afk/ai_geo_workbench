export const AI_BRAND_ASSET_DEFINITION =
  "让 AI 能识别、理解、引用、信任并推荐品牌的公开证据体系。";

export const BRAND_ASSET_STATUS = {
  COMPLETED: "已建立",
  IN_PROGRESS: "建设中",
  INSUFFICIENT: "不足",
  TO_BUILD: "待建设",
  TO_VERIFY: "待验证",
} as const;

export type BrandAssetStatus =
  (typeof BRAND_ASSET_STATUS)[keyof typeof BRAND_ASSET_STATUS];

export type BrandAsset = {
  key: "entity" | "definition" | "trust" | "question" | "content" | "retest";
  name: string;
  coreQuestion: string;
  status: BrandAssetStatus;
  evidence: string;
  gap: string;
  nextAction: string;
  page: string;
  verification: string;
  whyItMatters: string;
  hasPublicEvidence: boolean;
  verifiedByAiRetest: boolean;
};

const DEFAULT_ASSETS: BrandAsset[] = [
  { key: "entity", name: "品牌实体资产", coreQuestion: "AI 是否知道你是谁？", status: BRAND_ASSET_STATUS.TO_BUILD, evidence: "品牌资料可作为建设输入，但不是公开资产。", gap: "尚未核验公开渠道中的品牌名、官网、主体和业务定位是否稳定一致。", nextAction: "统一标准品牌表达，并同步到官网和公开资料。", page: "/enterprise-profile", verification: "逐项核对官网与公开平台的品牌名称、主体、定位和目标客户表达。", whyItMatters: "实体信息不一致会让 AI 无法稳定识别品牌及其业务归属。", hasPublicEvidence: false, verifiedByAiRetest: false },
  { key: "definition", name: "业务定义资产", coreQuestion: "AI 是否能准确解释你做什么？", status: BRAND_ASSET_STATUS.TO_BUILD, evidence: "尚无已确认的公开定义型内容证据。", gap: "缺少回答品牌是什么、解决什么问题、适合谁的稳定公开页面。", nextAction: "建设定义页、FAQ 或定义型公开内容。", page: "/weekly", verification: "检查公开 URL 可访问，并在 AI 复测中核对品牌解释是否准确。", whyItMatters: "清晰定义决定 AI 能否准确解释品牌并匹配用户场景。", hasPublicEvidence: false, verifiedByAiRetest: false },
  { key: "trust", name: "可信信源资产", coreQuestion: "AI 凭什么信任你？", status: BRAND_ASSET_STATUS.INSUFFICIENT, evidence: "已有资料仍需转化为可访问、可核验的公开信源。", gap: "官网、第三方介绍、案例与客户背书不足或一致性待核验。", nextAction: "补强官网与第三方可信信源，并统一事实表达。", page: "/brand-source-graph", verification: "核验来源可访问性、主体一致性，并检查 AI 回答实际引用来源。", whyItMatters: "多来源一致的事实证据是 AI 建立信任与引用判断的基础。", hasPublicEvidence: false, verifiedByAiRetest: false },
  { key: "question", name: "AI 问题占位资产", coreQuestion: "用户问 AI 的关键问题里，有没有你的答案位置？", status: BRAND_ASSET_STATUS.TO_BUILD, evidence: "尚未确认目标问题与公开答案的对应证据。", gap: "目标问题、内容覆盖、公开 URL 与复测状态尚未形成闭环。", nextAction: "选择高价值目标问题，建设并发布可验证的公开答案。", page: "/questions", verification: "核对公开 URL、收录状态，以及 AI 是否提及、解释或推荐；各项分别记录。", whyItMatters: "缺少关键问题答案位置，AI 很难在真实决策场景中提及或推荐品牌。", hasPublicEvidence: false, verifiedByAiRetest: false },
  { key: "content", name: "公开内容证据资产", coreQuestion: "围绕这些问题，我们建设了哪些公开证据？", status: BRAND_ASSET_STATUS.TO_BUILD, evidence: "尚无已确认的公开 URL。", gap: "缺少可访问的官网页、文章、回答或第三方页面。", nextAction: "生成、发布并回填公开证据 URL。", page: "/weekly", verification: "分别核验 URL 可访问性、平台、收录状态和复测状态。", whyItMatters: "只有进入公开网络的内容，才可能被搜索与 AI 发现、理解和引用。", hasPublicEvidence: false, verifiedByAiRetest: false },
  { key: "retest", name: "复测与增长证据资产", coreQuestion: "建设前后，AI 回答有没有变化？", status: BRAND_ASSET_STATUS.TO_BUILD, evidence: "尚未形成连续复测与报告证据链。", gap: "缺少 T0/T1/T2/T3 对比、引用来源和可解释结论。", nextAction: "按计划复测并沉淀提及、推荐、引用与报告证据。", page: "/inclusion-monitoring", verification: "对比各轮提及、推荐、引用、竞品和情绪变化，并在报告中保留证据链。", whyItMatters: "连续验证才能判断资产是否真正影响 AI 回答并指导下一轮建设。", hasPublicEvidence: false, verifiedByAiRetest: false },
];

export const SAMPLE_210001_ZHIHU_URL =
  "https://zhuanlan.zhihu.com/p/2058633582978060994";

export function getBrandAssets(projectId: number | null | undefined): BrandAsset[] {
  if (projectId !== 210001) return DEFAULT_ASSETS;
  return [
    { ...DEFAULT_ASSETS[0], status: BRAND_ASSET_STATUS.IN_PROGRESS, evidence: "已有基础品牌资料和标准表达。", gap: "官网与其他公开渠道的一致性仍需增强。", nextAction: "将标准品牌名、主体、定位和目标客户表达同步到稳定公开页面。", hasPublicEvidence: true },
    { ...DEFAULT_ASSETS[1], status: BRAND_ASSET_STATUS.IN_PROGRESS, evidence: "已通过知乎文章建设第一条定义型公开内容。", gap: "官网尚缺同主题定义页，FAQ 与更多业务边界仍待补充。", nextAction: "在官网补充同主题定义页，并保持与知乎表达一致。", hasPublicEvidence: true },
    { ...DEFAULT_ASSETS[2], status: BRAND_ASSET_STATUS.INSUFFICIENT, evidence: "已有官网及既有公开来源可供核验，但信源结构仍薄弱。", gap: "官网主题页、第三方介绍、案例和客户背书仍需补强。" },
    { ...DEFAULT_ASSETS[3], status: BRAND_ASSET_STATUS.IN_PROGRESS, evidence: "已建立第一个问题占位：“海豚知道是什么？”，并对应真实公开内容。", gap: "尚无证据证明已被 AI 稳定提及、引用或推荐。", nextAction: "继续执行既定复查计划，并建设推荐类问题占位。", hasPublicEvidence: true, verifiedByAiRetest: true },
    { ...DEFAULT_ASSETS[4], status: BRAND_ASSET_STATUS.TO_VERIFY, evidence: `已形成第一条知乎公开内容证据：${SAMPLE_210001_ZHIHU_URL}`, gap: "收录待观察；07/12 补跑未证明知乎 URL 已被引用，稳定推荐仍待验证。", nextAction: "保持公开 URL 稳定；推进 07/16、07/23 正式验证。", hasPublicEvidence: true },
    { ...DEFAULT_ASSETS[5], status: BRAND_ASSET_STATUS.IN_PROGRESS, evidence: "已有 T1 与 07/12 真实补跑记录；07/16、07/23 计划保留。", gap: "正式 T2/T3 尚待执行；尚无稳定引用或推荐证据，效果闭环未完成。", nextAction: "按 07/16、07/23 自动复测计划继续验证，完成正式 T2/T3 后再形成增长结论。", hasPublicEvidence: true, verifiedByAiRetest: true },
  ];
}
