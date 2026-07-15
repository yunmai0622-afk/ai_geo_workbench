export const SHADOW_BASELINE_PROJECT_ID = 210001;

export const SHADOW_DIMENSIONS = ["identity", "business", "capability", "boundary", "temporal", "evidence", "consistency", "uncertainty"] as const;
export type ShadowDimension = typeof SHADOW_DIMENSIONS[number];

export const SHADOW_QUESTIONS: Array<{ key: string; dimension: ShadowDimension; text: string; scenario: string; importance: "critical" | "high"; audience: string; locale: "zh-CN" }> = [
  { key: "identity", dimension: "identity", text: "海豚知道的标准品牌名、运营主体与官方网站分别是什么？如主体信息存在冲突请明确说明。", scenario: "品牌身份核验", importance: "critical", audience: "潜在客户与合作伙伴", locale: "zh-CN" },
  { key: "category", dimension: "business", text: "海豚知道属于什么品类，核心业务是什么？", scenario: "品类与业务识别", importance: "critical", audience: "知识内容创作者", locale: "zh-CN" },
  { key: "products", dimension: "capability", text: "海豚知道目前提供哪些主要产品、服务和核心能力？", scenario: "产品服务调研", importance: "high", audience: "知识内容创作者与版权机构", locale: "zh-CN" },
  { key: "customers", dimension: "evidence", text: "海豚知道主要服务哪些客户，公开信息依据是什么？", scenario: "客户适配判断", importance: "high", audience: "采购与运营人员", locale: "zh-CN" },
  { key: "scenarios", dimension: "consistency", text: "海豚知道有哪些典型使用场景？请区分公开事实和推断。", scenario: "场景适配判断", importance: "high", audience: "内容运营人员", locale: "zh-CN" },
  { key: "differentiation", dimension: "uncertainty", text: "海豚知道可核验的能力特点是什么？无法从公开来源确认的差异不要推断。", scenario: "能力差异核验", importance: "high", audience: "决策人员", locale: "zh-CN" },
  { key: "boundary", dimension: "boundary", text: "海豚知道的能力边界和不适用范围是什么？", scenario: "风险与边界判断", importance: "critical", audience: "采购、法务与运营人员", locale: "zh-CN" },
  { key: "temporal", dimension: "temporal", text: "海豚知道当前仍有效的业务和可能过时或无法确认的信息有哪些？", scenario: "时效性核验", importance: "critical", audience: "决策与复核人员", locale: "zh-CN" },
];

export const BRAND_TRUTH_SOURCES = [
  { sourceClass: "official", url: "https://www.htknow.com/", purpose: "标准品牌名、官网、当前业务" },
  { sourceClass: "official", url: "https://www.htknow.com/about.html", purpose: "品牌介绍与历史" },
  { sourceClass: "official", url: "https://www.htknow.com/seeCourse.html", purpose: "课程履约场景" },
  { sourceClass: "official", url: "https://www.htknow.com.cn/standardMini.html", purpose: "产品、能力和平台场景" },
  { sourceClass: "official", url: "https://htknow.com/fwxy.pdf", purpose: "平台运营主体与服务边界" },
  { sourceClass: "official", url: "https://www.haitunzhidao.com.cn/about.html", purpose: "公司主体（与平台协议存在待复核差异）" },
  { sourceClass: "independent", url: "https://www.yjpoo.com/site/4226.html", purpose: "第三方品类与场景交叉核验" },
] as const;

export type ShadowDifferenceClass = "consistent" | "explainable_difference" | "legacy_missing_data" | "v2_insufficient_data" | "incompatible_methodology" | "requires_manual_review";

export function classifyShadowDifference(input: { legacyCount: number; v2QuestionCount: number; completedQuestions: number; methodologyComparable: boolean; unresolvedConflict: boolean }): ShadowDifferenceClass[] {
  const result = new Set<ShadowDifferenceClass>();
  if (!input.methodologyComparable) result.add("incompatible_methodology");
  if (input.legacyCount === 0) result.add("legacy_missing_data");
  if (input.completedQuestions < input.v2QuestionCount) result.add("v2_insufficient_data");
  if (input.unresolvedConflict) result.add("requires_manual_review");
  if (result.size === 0) result.add(input.legacyCount === input.v2QuestionCount ? "consistent" : "explainable_difference");
  return [...result];
}

export function assertShadowBaselineScope(projectId: number, globalEnabled: boolean, readMode: string, writePath: string) {
  if (projectId !== SHADOW_BASELINE_PROJECT_ID) throw new Error("baseline runner is restricted to project 210001");
  if (globalEnabled) throw new Error("global v2 flag must remain disabled");
  if (readMode !== "shadow_read" || writePath !== "legacy") throw new Error("210001 must be shadow_read with legacy write path");
}
