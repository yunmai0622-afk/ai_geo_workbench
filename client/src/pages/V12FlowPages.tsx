import { GeoStatusGuide } from "@/components/GeoStatusGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Brain, ChevronDown, FileBarChart2, FileText, HelpCircle, RadioTower, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useLocation } from "wouter";

type ProjectOption = { id: number; enterpriseName: string };

type ArticleLike = {
  id: number;
  projectId?: number | null;
  topicId?: number | null;
  optimizationTaskId?: number | null;
  title: string;
  articleType?: string | null;
  markdownContent?: string | null;
  generationBasis?: Record<string, unknown> | null;
  citableSnippets?: Array<Record<string, unknown>> | null;
  factTraceability?: Array<Record<string, unknown>> | null;
  consistencyCheck?: Record<string, unknown> | null;
  status?: string | null;
  qualityScore?: number | null;
  publishStatus?: string | null;
  publicPath?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type TopicLike = {
  id: number;
  optimizationTaskId?: number | null;
  sourceAnalysisIds?: number[] | null;
  sourceQuestionIds?: number[] | null;
  title: string;
  articleType?: string | null;
  contentGap?: string | null;
  businessReason?: string | null;
  status?: string | null;
};

type TaskLike = {
  id: number;
  taskName: string;
  taskType?: string | null;
  priority?: string | null;
  generationReason?: string | null;
  executionSuggestion?: string | null;
  status?: string | null;
};

type QualityScoreLike = {
  articleId?: number;
  totalScore: number;
  problemMatchScore?: number | null;
  evidenceScore?: number | null;
  structureScore?: number | null;
  originalityScore?: number | null;
  geoCitableScore?: number | null;
  complianceScore?: number | null;
  blocked?: number | boolean | null;
  blockReasons?: string[] | null;
  reviewSummary?: string | null;
};

type ContentPlanRecord = {
  id: number;
  projectId: number;
  planName: string;
  weekStartDate: string;
  weeklyArticleCount: number;
  targetPlatforms?: string[] | null;
  contentTypes?: string[] | null;
  linkedOptimizationTaskIds?: number[] | null;
  status?: string | null;
};

type ContentPlanItemRecord = {
  id: number;
  planId: number;
  topicId?: number | null;
  articleId?: number | null;
  targetPlatform?: string | null;
  contentType?: string | null;
  status?: string | null;
  differentiationAngle?: string | null;
  duplicateRisk?: string | null;
};

type PlatformAuthorizationLike = {
  id?: number | null;
  platformName?: string | null;
  accountAlias?: string | null;
  authorizationStatus?: "未配置" | "待人工授权" | "已授权" | "已失效" | "无需授权" | string | null;
  secureCredentialRef?: string | null;
  authorizationNotes?: string | null;
};

type PublishRecordLike = {
  id: number;
  articleId?: number | null;
  optimizationTaskId?: number | null;
  title?: string | null;
  publishTitle?: string | null;
  publishChannel?: string | null;
  publishStatus?: string | null;
  publishUrl?: string | null;
  publicUrl?: string | null;
  qualityScore?: number | null;
  needRetest?: number | boolean | null;
  checkedAt?: number | Date | string | null;
  publishedAt?: number | Date | string | null;
  createdAt?: number | Date | string | null;
  updatedAt?: number | Date | string | null;
  notes?: string | null;
};

type ManualPublishStatus = "pending_human_publish" | "published" | "publish_failed" | "manual_publish_needed" | "link_backfilled";

type MonitoringRecordLike = {
  id: number;
  articleId: number;
  publishRecordId: number;
  publicUrl: string;
  inclusionStatus: string;
  aiMentionStatus: string;
  aiRecommendStatus: string;
  lastCheckedAt?: Date | string | null;
  currentSuggestion?: string | null;
};

type ReportLike = {
  id: number;
  totalScore: number;
  oneSentenceConclusion: string;
  markdownContent: string;
  createdAt?: Date | string | null;
};

function useProjectSelection() {
  const { data: projects = [] } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const projectInput = useMemo(() => ({ projectId: selectedProjectId }), [selectedProjectId]);
  return { projects: projects as ProjectOption[], selectedProjectId, setSelectedProjectId, projectInput, enabled: Boolean(selectedProjectId) };
}

function ProjectSelector({ projects, selectedProjectId, setSelectedProjectId }: { projects: ProjectOption[]; selectedProjectId?: number; setSelectedProjectId: (id?: number) => void }) {
  return (
    <select value={selectedProjectId ?? ""} onChange={event => setSelectedProjectId(Number(event.target.value) || undefined)} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:max-w-md">
      <option value="">请选择项目</option>
      {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName}</option>)}
    </select>
  );
}

function InfoCard({ title, desc, value }: { title: string; desc: string; value?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/56 p-5 text-slate-100">
      <p className="text-sm font-semibold text-cyan-100">{title}</p>
      {value ? <p className="mt-2 text-2xl font-semibold text-white">{value}</p> : null}
      <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
    </div>
  );
}

function EmptyStep({ title, description }: { title: string; description: string }) {
  return <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm leading-6 text-slate-300"><p className="font-semibold text-white">{title}</p><p className="mt-2">{description}</p></div>;
}

function ActionState({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return <div className={`rounded-2xl border p-4 text-sm leading-6 ${error ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"}`}>{error || message}</div>;
}

function articleGate(article: ArticleLike, qualityScore?: number | null) {
  const score = qualityScore ?? article.qualityScore ?? 0;
  if (article.status === "已发布" || article.publishStatus === "已发布") return { label: "已发布", reason: "已进入公开内容页，可进入收录监测。", tone: "text-emerald-200" };
  if (score >= GEO_ARTICLE_MIN_PASS_SCORE || article.status === "审核通过") return { label: "允许发布", reason: "质量评分和人工状态满足发布准入。", tone: "text-emerald-200" };
  if (score > 0) return { label: "暂不可发布", reason: `质量评分低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 分，需要先优化。`, tone: "text-amber-200" };
  return { label: "待检查", reason: "缺少质量评分，暂不进入发布队列。", tone: "text-slate-300" };
}

function toAbsoluteUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${window.location.origin}${path}`;
}

function formatTime(value?: Date | string | number | null) {
  if (!value) return "未记录";
  return new Date(value).toLocaleString();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** 标题/百家号等场景：常见工商全称（与 publish_baijiahao 一致时可替换） */
const LEGACY_ENTERPRISE_FULL_TITLE_NAMES = ["河南海豚知道文化传媒有限公司"];

const ORG_TITLE_SUFFIX_RE = /(有限公司|股份有限公司|有限责任公司|集团公司)$/;

/** 品牌锚点：取锚点前最多 2 个汉字 + 锚点词作为简称（如「河南海豚知道文化传媒有限公司」→「海豚知道」） */
const BRAND_TITLE_ANCHOR_KEYWORDS = ["知道", "科技", "智能", "数据", "网络", "信息", "传媒", "软件", "系统", "云"];

export function deriveBrandShortFromEnterpriseName(enterpriseName: string): string {
  const raw = (enterpriseName || "").trim();
  if (!raw) return "";
  const base = raw.replace(/（[^）]+）/g, "").replace(ORG_TITLE_SUFFIX_RE, "").trim();
  for (const kw of BRAND_TITLE_ANCHOR_KEYWORDS) {
    const idx = base.indexOf(kw);
    if (idx === -1) continue;
    const before = base.slice(0, idx);
    const han = before.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
    const tail = han.length >= 2 ? han.slice(-2) : han;
    return `${tail}${kw}`;
  }
  if (base.length <= 8) return base;
  return base.slice(0, 8);
}

/** 发布用展示标题：去掉工商全称前缀，替换为基于 enterpriseName 推导的品牌简称；其余保持原文便于手动微调 */
export function buildPublishDisplayTitle(articleTitle: string, enterpriseName: string): string {
  let t = (articleTitle || "").trim();
  const short = deriveBrandShortFromEnterpriseName(enterpriseName);
  const fallbackShort = short || "品牌";
  for (const full of LEGACY_ENTERPRISE_FULL_TITLE_NAMES) {
    if (t.includes(full)) t = t.split(full).join(fallbackShort);
  }
  const fullName = (enterpriseName || "").trim();
  if (fullName && short && fullName !== short && t.includes(fullName)) {
    t = t.split(fullName).join(short);
  }
  return t;
}

/**
 * 去掉正文首行「单井号」Markdown 一级标题（如 `# 标题`），从下一非空行起保留，避免与发布标题重复粘贴。
 * 不以 `##` 开头，避免误删 `## 引言` 等二级标题。
 */
export function stripLeadingMarkdownH1Line(markdown: string | null | undefined): string {
  if (markdown == null) return "";
  const normalized = markdown.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return normalized.trim();
  const head = lines[i].trim();
  if (!/^#(?![#])\s*\S/.test(head) && !/^#(?![#])\s*$/.test(head)) return normalized.trim();
  i++;
  while (i < lines.length && lines[i].trim() === "") i++;
  return lines.slice(i).join("\n").trimEnd();
}

function textValue(value: unknown, fallback = "待补充") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

/** 正文是否出现企业档案中的品牌/一句话/产品或客户描述（支持新字段 brandName 等） */
function markdownReflectsProfileEntity(profile: Record<string, unknown> | undefined | null, markdown: string | undefined | null) {
  const body = typeof markdown === "string" ? markdown : "";
  if (!body.trim()) return false;
  const p = profile ?? {};
  const seeds = [textValue(p.brandName, ""), textValue(p.enterpriseName, ""), textValue(p.oneLiner, ""), textValue(p.productDesc, "").slice(0, 64), textValue(p.targetCustomer, "").slice(0, 64)].filter(s => s.length >= 2);
  return seeds.some(s => body.includes(s.slice(0, Math.min(16, s.length))));
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => typeof item === "string" ? item : "").filter(Boolean);
}

function objectList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.map(asRecord).filter(item => Object.keys(item).length > 0);
}

function isBlocked(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

/** 与步骤 5「质检通过」展示规则一致：无阻断且（状态为质检通过或总分达参考线） */
function articleQualityPassesGate(article: ArticleLike, q?: QualityScoreLike) {
  if (!q) return false;
  if (isBlocked(q.blocked)) return false;
  return article.status === "质检通过" || (q.totalScore ?? 0) >= GEO_ARTICLE_MIN_PASS_SCORE;
}

function diagnosisJson(item: { rawJson?: unknown }) {
  const raw = item.rawJson && typeof item.rawJson === "object" ? item.rawJson as Record<string, unknown> : {};
  const nested = raw.questionDiagnosis && typeof raw.questionDiagnosis === "object" ? raw.questionDiagnosis as Record<string, unknown> : {};
  return { ...raw, ...nested };
}

function diagnosisText(value: unknown, fallback = "待补充") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

const GEO_TASK_CARD_MARK = "__GEO_TASK_CARD__";

function parseStoredQuestionMeta(targetKeyword?: string | null) {
  const raw = typeof targetKeyword === "string" ? targetKeyword.trim() : "";
  if (!raw.startsWith("{")) return { intent: "", disadvantaged: false };
  try {
    const j = JSON.parse(raw) as { intent?: unknown; disadvantaged?: unknown };
    return {
      intent: typeof j.intent === "string" ? j.intent.trim() : "",
      disadvantaged: j.disadvantaged === true,
    };
  } catch {
    return { intent: "", disadvantaged: false };
  }
}

type ParsedGeoTaskCard = {
  articleTitle: string;
  keyPoints: string[];
  targetKeywords: string[];
  recommendedPlatform: string[];
  contentType: string;
};

function parseGeoTaskCard(executionSuggestion?: string | null): ParsedGeoTaskCard | null {
  if (!executionSuggestion?.includes(GEO_TASK_CARD_MARK)) return null;
  const parts = executionSuggestion.split(`${GEO_TASK_CARD_MARK}\n`);
  const jsonPart = parts[1]?.trim();
  if (!jsonPart) return null;
  try {
    const j = JSON.parse(jsonPart) as Record<string, unknown>;
    const articleTitle = typeof j.articleTitle === "string" ? j.articleTitle : "";
    const keyPoints = Array.isArray(j.keyPoints) ? j.keyPoints.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim()) : [];
    const targetKeywords = Array.isArray(j.targetKeywords) ? j.targetKeywords.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim()) : [];
    const recommendedPlatform = Array.isArray(j.recommendedPlatform) ? j.recommendedPlatform.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim()) : [];
    const contentType = typeof j.contentType === "string" ? j.contentType : "";
    return { articleTitle, keyPoints, targetKeywords, recommendedPlatform, contentType };
  } catch {
    return null;
  }
}

function diagnosisV12DisplayFields(detail: Record<string, unknown>) {
  const suggestedTitle = typeof detail.suggestedTitle === "string" ? detail.suggestedTitle.trim() : "";
  const coreTheses = Array.isArray(detail.coreTheses) ? detail.coreTheses.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim()) : [];
  const recommendedPlatforms = Array.isArray(detail.recommendedPlatforms)
    ? detail.recommendedPlatforms.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map(x => x.trim())
    : [];
  return { suggestedTitle, coreTheses, recommendedPlatforms };
}

/** 诊断/库表常见 0/1/boolean → 是否「是」 */
function triBoolYes(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function qcScoreTextClass(score: number) {
  if (score >= 80) return "text-emerald-400 font-semibold";
  if (score >= 60) return "text-amber-400 font-semibold";
  return "text-red-400 font-semibold";
}

function taskStatusLabelCn(status: string | undefined) {
  if (status === "done") return "已完成";
  if (status === "in_progress") return "进行中";
  return "待处理";
}

function priorityBadgeClass(p: string | undefined) {
  if (p === "P0") return "border-rose-500/50 bg-rose-950/60 text-rose-100";
  if (p === "P1") return "border-amber-500/50 bg-amber-950/50 text-amber-100";
  return "border-slate-500/40 bg-slate-900/70 text-slate-300";
}

function customerErrorMessage(value?: string) {
  if (!value) return undefined;
  if (/timeout|timed out|UND_ERR|fetch failed|network|ECONN|ETIMEDOUT/i.test(value)) return "内容诊断失败，可能是模型服务超时或网络暂时异常。请稍后重试。";
  if (/Internal Server Error|TRPCError|unexpected|TypeError/i.test(value)) return "内容诊断暂时无法完成，可能是上游服务异常。请稍后重试，或联系交付人员查看服务状态。";
  if (/目标客户问题|指定问题/.test(value)) return "请先在下方点击「重新生成」，或手动添加「指定问题」类型问题，再运行诊断。";
  return value;
}

function scoreReason(score?: { totalScore?: number | null; aiVisibilityScore?: number | null; aiRecommendationScore?: number | null; contentAssetScore?: number | null } | null) {
  if (!score || typeof score.totalScore !== "number") return "当前还没有生成 内容覆盖评分。请先运行内容诊断，系统会根据诊断结果生成评分和优化任务。";
  if (score.totalScore >= 80) return "当前分数较高，说明 AI 回答中已经较稳定地提到或推荐企业，但仍需持续补充可引用内容资产。";
  if (score.totalScore >= 50) return "当前分数处于中等水平，说明企业已有一定内容覆盖，但推荐稳定性、竞品对比或内容证据仍需加强。";
  return "当前分数偏低，通常意味着 AI 对企业认知不足、推荐理由不稳定，或缺少可引用的官网、FAQ、案例和对比内容。";
}

function scoreFactors(score?: { aiVisibilityScore?: number | null; aiRecommendationScore?: number | null; contentAssetScore?: number | null } | null) {
  if (!score) return "主要因素将在评分生成后展示。";
  return `主要因素：AI 提及 ${score.aiVisibilityScore ?? 0} 分，AI 推荐 ${score.aiRecommendationScore ?? 0} 分，内容资产 ${score.contentAssetScore ?? 0} 分。`;
}

function yesNo(value: unknown) {
  return value === true || value === 1 ? "是" : "否";
}

function listText(value: unknown, fallback = "暂无明确竞品") {
  return Array.isArray(value) && value.length > 0 ? value.filter(Boolean).join("、") : fallback;
}

type ContentPlanForm = {
  name: string;
  weekStart: string;
  weeklyCount: number;
  targetPlatforms: string[];
  contentTypes: string[];
  taskIds: number[];
};

const OWN_SITE_PLATFORM_API = "自有内容站 / 企业官网 GEO 页面";

function platformDisplayName(name: string) {
  return name === OWN_SITE_PLATFORM_API ? "官网/自有平台" : name;
}

const platformMatrix = [
  { name: OWN_SITE_PLATFORM_API, priority: "A 级优先平台", capability: "A：API 自动发布", aiEntry: "百度 AI 搜索 / 文心一言、DeepSeek、Kimi、通义 / 夸克", geoValue: "自有站可控，适合沉淀长期可引用的品牌实体页、FAQ、对比页和产品页。", supportMode: "企业自有权威内容源，配置后可作为长期承载 内容的发布渠道；每次发布仍需人工确认。", connectAction: "配置企业官网内容站", currentState: "未连接", customerFields: ["发布渠道名称", "网站首页地址", "内容发布路径", "是否允许搜索引擎收录", "是否生成 sitemap"], risk: "必须确认公开路径、收录许可和站点地图，不承诺自动收录。", inV1: true },
  { name: "微信公众号", priority: "A 级优先平台", capability: "B：草稿箱 / 半自动发布", aiEntry: "微信搜索 / 搜一搜、腾讯元宝", geoValue: "微信生态搜索价值高，适合行业观点、FAQ 和服务说明进入搜一搜语境。", supportMode: "账号能力和草稿箱连接需要交付人员按官方授权方式确认，最终群发由人工确认。", connectAction: "申请公众号草稿箱连接", currentState: "需交付人员验证", customerFields: ["公众号名称", "扫码授权状态", "草稿箱能力"], risk: "禁止填写公众号账号密码；真实扫码授权未接入前不得假装成功。", inV1: true },
  { name: "知乎", priority: "A 级优先平台", capability: "C：内容适配 + 人工复制发布", aiEntry: "知乎直答、Kimi、DeepSeek、百度 AI 搜索", geoValue: "知乎问答和文章容易承载选型、对比、误区澄清等可引用内容。", supportMode: "生成知乎文章/回答版本内容，人工确认发布并回填链接。", connectAction: "生成知乎发布素材", currentState: "需人工发布", customerFields: ["知乎主页", "文章/回答类型", "发布素材备注"], risk: "不保存知乎账号密码，不做模拟登录。", inV1: true },
  { name: "百家号", priority: "A 级优先平台", capability: "B：草稿箱 / 半自动发布", aiEntry: "百度 AI 搜索 / 文心一言", geoValue: "百度生态内容对 AI 搜索内容覆盖有较高价值，适合结构化品牌与行业内容。", supportMode: "账号是否支持接口发布，需要交付人员验证；无法接口发布时降级为人工发布助手。", connectAction: "申请百家号发布配置", currentState: "需交付人员验证", customerFields: ["百家号名称", "接口权限状态", "人工发布方式"], risk: "不要求客户填写接口密钥；接口权限需由交付人员通过官方方式验证。", inV1: true },
  { name: "头条号", priority: "A 级优先平台", capability: "B：草稿箱 / 半自动发布", aiEntry: "豆包、头条搜索", geoValue: "适合行业观点、痛点解决和产品说明类内容进入字节生态。", supportMode: "优先验证官方授权或内容源同步能力，系统不做模拟登录和账号风控绕过。", connectAction: "申请头条号发布配置", currentState: "需交付人员验证", customerFields: ["头条号名称", "内容源同步状态", "人工发布方式"], risk: "不处理验证码，不绕过账号风控。", inV1: true },
  { name: "小红书", priority: "B 级可配置平台", capability: "C：内容适配 + 人工复制发布", aiEntry: "小红书搜索、豆包、Kimi", geoValue: "适合轻量案例、经验清单和痛点解释，但更依赖人工内容语气。", supportMode: "生成标题、正文、标签、封面建议，人工复制发布。", connectAction: "生成小红书发布素材", currentState: "需人工发布", customerFields: ["账号名称", "默认标签", "封面风格"], risk: "不自动登录，不承诺自动收录或推荐。", inV1: true },
  { name: "搜狐号", priority: "B 级可配置平台", capability: "C：内容适配 + 人工复制发布", aiEntry: "百度 AI 搜索、DeepSeek、Kimi", geoValue: "可作为补充收录渠道，适合行业解释型和品牌认知内容。", supportMode: "先做内容适配和人工发布记录，不承诺自动发布。", connectAction: "生成平台发布素材", currentState: "需人工发布", customerFields: ["账号名称", "主页地址", "人工发布方式"], risk: "仅作为补充分发，不承诺 AI 引用效果。", inV1: true },
  { name: "网易号", priority: "B 级可配置平台", capability: "C：内容适配 + 人工复制发布", aiEntry: "百度 AI 搜索、通义 / 夸克、Kimi", geoValue: "适合补充行业观点、误区澄清和品牌解释内容。", supportMode: "先做内容适配和人工发布记录，不承诺自动发布。", connectAction: "生成平台发布素材", currentState: "需人工发布", customerFields: ["账号名称", "主页地址", "人工发布方式"], risk: "平台审核和收录不确定，需要人工复核。", inV1: true },
  { name: "CSDN / 掘金", priority: "B 级可配置平台", capability: "C：内容适配 + 人工复制发布", aiEntry: "DeepSeek、Kimi、通义 / 夸克、百度 AI 搜索", geoValue: "面向技术 / SaaS / AI 客户，适合教程、FAQ、架构说明和产品能力说明。", supportMode: "生成技术向发布素材，人工复制到目标平台并回填链接。", connectAction: "生成平台发布素材 / 回填发布链接", currentState: "需人工发布", customerFields: ["账号名称", "目标行业", "主页地址"], risk: "技术内容必须事实准确，不得夸大集成能力或编造 benchmark。", inV1: true },
];

const contentTypeOptions = ["品牌认知页", "FAQ 问答页", "竞品对比页", "痛点解决页", "客户案例页", "产品说明页", "行业观点页", "误区澄清页"];

/** 发布记录页登记平台（与 server `manualPublishPlatforms` 枚举一致） */
const publishRecordUiPlatforms = ["百家号", "知乎", "微信公众号", "头条号", "小红书"] as const;
type PublishRecordUiPlatform = (typeof publishRecordUiPlatforms)[number];

function defaultWeekStart() {
  return new Date().toISOString().slice(0, 10);
}

function emptyContentPlanForm(): ContentPlanForm {
  return {
    name: "本周 内容生产计划",
    weekStart: defaultWeekStart(),
    weeklyCount: 3,
    targetPlatforms: [OWN_SITE_PLATFORM_API, "微信公众号", "知乎"],
    contentTypes: ["FAQ 问答页", "竞品对比页", "产品说明页"],
    taskIds: [],
  };
}

function excerptMarkdown(value?: string | null) {
  if (!value) return "摘要待生成";
  const cleaned = value.replace(/^#+\s+/gm, "").replace(/\s+/g, " ").trim();
  return cleaned.length > 180 ? `${cleaned.slice(0, 180)}...` : cleaned;
}

function cyclePick(list: string[], index: number, fallback: string) {
  return list.length > 0 ? list[index % list.length] : fallback;
}

function topicRepeatHint(topic: TopicLike, topics: TopicLike[]) {
  const sameTaskCount = topics.filter(item => item.optimizationTaskId && item.optimizationTaskId === topic.optimizationTaskId).length;
  const sameTitleCount = topics.filter(item => item.title.trim() === topic.title.trim()).length;
  if (sameTitleCount > 1) return "标题重复风险较高，建议调整标题角度后再生成。";
  if (sameTaskCount > 2) return "同一优化任务下选题较集中，建议换平台场景或内容类型。";
  return "";
}

function duplicateRiskLabel(value: "low" | "medium" | "high" | string | undefined) {
  if (value === "high") return "高";
  if (value === "medium") return "中";
  return "低";
}

function duplicateRiskStatus(value: "low" | "medium" | "high" | string | undefined) {
  if (value === "high") return "重复风险高";
  if (value === "medium") return "重复风险中";
  return "重复风险低";
}

function titleTokens(value?: string | null) {
  if (!value) return [];
  return Array.from(new Set(value.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, " ").split(/\s+/).flatMap(part => part.length > 8 ? [part.slice(0, 4), part.slice(4, 8)] : [part]).filter(part => part.length >= 2)));
}

function overlapRatio(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  return a.filter(item => bSet.has(item)).length / Math.max(a.length, b.length);
}

function headingSignature(content?: string | null) {
  if (!content) return [];
  return content.split("\n").filter(line => /^#{1,3}\s+/.test(line)).map(line => line.replace(/^#{1,3}\s+/, "").trim()).slice(0, 12);
}

function buildAntiDuplicationResult(article: ArticleLike | undefined, articles: ArticleLike[], topic: TopicLike | undefined, plan: ContentPlanForm) {
  if (!article) {
    return {
      similarityRisk: "low" as const,
      similarArticles: [] as ArticleLike[],
      titleRepeated: false,
      topicRepeated: false,
      structureRepeated: false,
      viewpointRepeated: false,
      sameTaskRepeated: false,
      sameWeekRepeated: false,
      differentiationAngle: "生成文章后检查差异化角度。",
      rewriteSuggestion: "生成文章后再进行差异度检查。",
      blocked: false,
    };
  }
  const peers = articles.filter(item => item.id !== article.id);
  const currentTokens = titleTokens(article.title);
  const similarArticles = peers
    .map(item => ({ article: item, ratio: overlapRatio(currentTokens, titleTokens(item.title)) }))
    .filter(item => item.ratio >= 0.35 || (article.optimizationTaskId && item.article.optimizationTaskId === article.optimizationTaskId))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 4)
    .map(item => item.article);
  const currentHeadings = headingSignature(article.markdownContent);
  const structureRepeated = peers.some(item => overlapRatio(currentHeadings, headingSignature(item.markdownContent)) >= 0.55);
  const titleRepeated = similarArticles.some(item => item.title.trim() === article.title.trim() || overlapRatio(currentTokens, titleTokens(item.title)) >= 0.55);
  const topicRepeated = Boolean(topic && peers.some(item => item.topicId === topic.id || (item.optimizationTaskId && item.optimizationTaskId === topic.optimizationTaskId && overlapRatio(currentTokens, titleTokens(item.title)) >= 0.35)));
  const sameTaskRepeated = Boolean(article.optimizationTaskId && peers.filter(item => item.optimizationTaskId === article.optimizationTaskId).length >= 2);
  const sameWeekRepeated = plan.taskIds.filter(id => id === article.optimizationTaskId).length > 1 || peers.filter(item => item.articleType === article.articleType).length >= Math.max(2, plan.weeklyCount);
  const viewpointRepeated = peers.some(item => overlapRatio(titleTokens(excerptMarkdown(article.markdownContent)), titleTokens(excerptMarkdown(item.markdownContent))) >= 0.45);
  const highSignals = [titleRepeated, topicRepeated, structureRepeated, viewpointRepeated, sameTaskRepeated, sameWeekRepeated].filter(Boolean).length;
  const similarityRisk = highSignals >= 3 ? "high" as const : highSignals >= 1 ? "medium" as const : "low" as const;
  return {
    similarityRisk,
    similarArticles,
    titleRepeated,
    topicRepeated,
    structureRepeated,
    viewpointRepeated,
    sameTaskRepeated,
    sameWeekRepeated,
    differentiationAngle: similarityRisk === "high" ? "改用新的客户问题切入，增加企业资料证据、竞品比较维度和平台表达方式，避免继续覆盖同一任务下的相同观点。" : similarityRisk === "medium" ? "保留当前诊断缺口，但换成新的平台场景、FAQ 角度或案例证据展开。" : "当前文章和历史内容差异较清楚，可继续补强企业资料来源和 AI 可引用片段。",
    rewriteSuggestion: similarityRisk === "high" ? "建议重写标题、摘要、FAQ 和核心观点，并减少与相似文章重复的段落结构。" : similarityRisk === "medium" ? "建议调整标题关键词、增加差异化小标题，并补充新的产品/服务/案例/对比信息。" : "建议进入人工复核，确认事实、案例、平台格式和品牌实体信息。",
    blocked: similarityRisk === "high",
  };
}

function defaultManualPublishedAt() {
  const value = new Date();
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}

function toDatetimeLocalInput(value?: Date | string | number | null): string {
  if (!value) return defaultManualPublishedAt();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return defaultManualPublishedAt();
  const copy = new Date(d.getTime());
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 16);
}

function articleLatestQuality(articleId: number | undefined, scores: QualityScoreLike[]) {
  if (!articleId) return undefined;
  return scores.find(score => score.articleId === articleId);
}

function isQualityPassed(score?: QualityScoreLike) {
  return Boolean(score && !score.blocked && score.totalScore >= GEO_ARTICLE_MIN_PASS_SCORE);
}

function publishRecordNoticeText(notes?: string | null) {
  if (!notes) return "暂无说明";
  return notes.replace("V1.0 人工确认发布记录：本系统只记录人工发布结果和公开链接，不调用外部平台 API，不创建收录监测记录。", "").trim() || "已记录人工发布边界。";
}

function articleTargetPlatform(article: ArticleLike, index: number, authorizations: PlatformAuthorizationLike[]) {
  const basis = asRecord(article.generationBasis);
  const platformFromBasis = textValue(basis.targetPlatform, "");
  if (platformFromBasis) return platformFromBasis;
  if (authorizations[index]?.platformName) return platformDisplayName(authorizations[index]?.platformName ?? OWN_SITE_PLATFORM_API);
  return platformDisplayName(platformMatrix[index % platformMatrix.length]?.name ?? OWN_SITE_PLATFORM_API);
}

function supportModeForPlatform(platformName: string) {
  if (platformName === OWN_SITE_PLATFORM_API) return "可进入人工确认发布";
  if (["微信公众号", "百家号", "头条号", "知乎"].includes(platformName)) return "需交付配置或人工发布";
  return "生成素材后人工发布";
}

export function AiDiagnosisFlowPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput, { enabled });
  const assetSummaryQuery = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const generateTargetQuestionsMutation = trpc.geo.questions.generateTargetQuestions.useMutation();
  const runAnalysis = trpc.geo.analysis.run.useMutation();
  const calculateScore = trpc.geo.scores.calculate.useMutation();
  const generateTasks = trpc.geo.tasks.generate.useMutation();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<string>();
  const questions = questionsQuery.data ?? [];
  const analyses = analysisQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const profile = assetSummaryQuery.data?.profile;
  const hasProfile = Boolean(profile);
  const targetQuestions = questions.filter(q => Number(q.enabled) !== 0 && q.questionType === "指定问题");
  const loading = questionsQuery.isLoading || assetSummaryQuery.isLoading || analysisQuery.isLoading || scoreQuery.isLoading || tasksQuery.isLoading;
  const generatingQuestions = generateTargetQuestionsMutation.isPending;
  const running = runAnalysis.isPending || calculateScore.isPending || generateTasks.isPending;
  const pageError = customerErrorMessage(
    assetSummaryQuery.error?.message || questionsQuery.error?.message || analysisQuery.error?.message || scoreQuery.error?.message || tasksQuery.error?.message,
  );
  const canOperate = Boolean(selectedProjectId && hasProfile);
  const complete = analyses.length > 0 && Boolean(scoreQuery.data) && tasks.length > 0;

  async function executeDiagnosisPipeline(projectId: number) {
    setProgress("正在基于企业信息与目标问题生成诊断…");
    await runAnalysis.mutateAsync({ projectId });
    setProgress("诊断结果已生成，正在计算 内容覆盖评分...");
    await calculateScore.mutateAsync({ projectId });
    setProgress("内容覆盖评分已生成，正在整理优化任务...");
    await generateTasks.mutateAsync({ projectId });
    await Promise.all([
      utils.geo.questions.list.invalidate({ projectId }),
      utils.geo.analysis.list.invalidate({ projectId }),
      utils.geo.scores.latest.invalidate({ projectId }),
      utils.geo.tasks.list.invalidate({ projectId }),
    ]);
    setProgress(undefined);
    setMessage("内容诊断已完成。下一步：进入内容生产，根据优化任务生成本周内容计划。");
  }

  async function handleGenerateTargetQuestions() {
    if (!selectedProjectId) {
      setError("请先选择项目。");
      return;
    }
    if (!hasProfile) {
      setError("当前项目还没有企业档案，请先完成建档后再生成问题。");
      return;
    }
    setMessage(undefined);
    setError(undefined);
    try {
      const result = await generateTargetQuestionsMutation.mutateAsync({ projectId: selectedProjectId });
      await utils.geo.questions.list.invalidate({ projectId: selectedProjectId });
      const refetchResult = await questionsQuery.refetch();
      const refreshed = refetchResult.data ?? [];
      const readyTargets = refreshed.filter(q => Number(q.enabled) !== 0 && q.questionType === "指定问题");
      if (readyTargets.length === 0) {
        setMessage(`已写入 ${result.count} 条目标客户问题，但列表暂未同步到可用的「指定问题」。请刷新页面或点击「运行内容诊断」重试。`);
        return;
      }
      setMessage(`已生成并写入 ${result.count} 条目标客户问题，正在自动运行内容诊断…`);
      try {
        await executeDiagnosisPipeline(selectedProjectId);
      } catch (diagErr) {
        setProgress(undefined);
        setError(customerErrorMessage(diagErr instanceof Error ? diagErr.message : "运行内容诊断失败"));
        setMessage(`已生成 ${result.count} 条目标客户问题，但自动诊断未完成。请点击「运行内容诊断」重试。`);
      }
    } catch (err) {
      setError(customerErrorMessage(err instanceof Error ? err.message : "生成问题失败"));
    }
  }

  async function handleRunDiagnosis() {
    if (!selectedProjectId) return;
    if (!hasProfile) {
      setError("当前项目还没有企业档案，请先进入企业档案页完成建档。");
      return;
    }
    if (targetQuestions.length === 0) {
      setError("当前还没有「指定问题」类型的目标客户问题。请先点击「重新生成」或手动添加「指定问题」。");
      return;
    }
    setMessage(undefined);
    setError(undefined);
    try {
      await executeDiagnosisPipeline(selectedProjectId);
    } catch (err) {
      setProgress(undefined);
      setError(customerErrorMessage(err instanceof Error ? err.message : "运行内容诊断失败"));
    }
  }

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide
        stage="内容诊断"
        completion={complete ? 86 : analyses.length > 0 ? 72 : targetQuestions.length > 0 ? 58 : hasProfile ? 42 : 22}
        nextAction={
          complete
            ? "进入内容生产"
            : running || generatingQuestions
              ? "正在生成问题或运行诊断…"
              : targetQuestions.length > 0
                ? "运行内容诊断"
                : "重新生成目标客户问题"
        }
        why="基于企业档案与目标客户检索问题，分析内容缺口、生成评分与优化任务。"
        risk="诊断为模型分析结果，未接入各 AI 平台实时回答；样本与结论仅供内容规划参考。"
        ctaLabel="进入内容生产"
        ctaPath="/content-generation"
      />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader>
          <CardTitle className="text-white">内容诊断</CardTitle>
          <CardDescription className="text-cyan-200">
            系统根据企业档案自动生成目标客户检索问题，并结合竞品与行业常识做 内容分析，输出诊断摘要、内容覆盖评分与优化任务。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} />
          <ActionState message={message} error={error || pageError} />
          {loading ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">正在读取项目、企业档案、问题与诊断结果...</div> : null}
          {projects.length === 0 ? <EmptyStep title="暂无项目" description="请先进入企业档案页面创建企业项目，再回到本页生成问题并运行诊断。" /> : null}
          {selectedProjectId && !hasProfile && !assetSummaryQuery.isLoading ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">当前项目还没有企业档案，请先进入企业档案完成建档。</div>
          ) : null}
          {progress ? <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">{progress}</div> : null}

          <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
            <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">目标客户问题</span>
            <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">分析内容缺口</span>
            <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">形成内容评分与优化任务</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <InfoCard title="目标客户问题" value={String(targetQuestions.length)} desc="已纳入诊断的「指定问题」；含 AI 自动生成与手动添加。" />
            <InfoCard title="诊断结果" value={String(analyses.length)} desc="按问题维度输出的内容缺口。" />
            <InfoCard title="内容覆盖评分" value={scoreQuery.data ? String(scoreQuery.data.totalScore) : "未生成"} desc={scoreQuery.data ? `AI 提及 ${scoreQuery.data.aiVisibilityScore} / AI 推荐 ${scoreQuery.data.aiRecommendationScore}` : "运行诊断后同步计算。"} />
            <InfoCard title="优化任务" value={String(tasks.length)} desc={tasks.length > 0 ? "已生成下一步内容优化任务。" : "请先完成诊断并生成优化任务。"} />
            <InfoCard title="全部问题库" value={String(questions.length)} desc="含历史批量问题；诊断仅使用指定问题子集。" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="font-semibold text-white">目标客户问题</h2>
                <Button
                  type="button"
                  onClick={() => void handleGenerateTargetQuestions()}
                  disabled={!canOperate || generatingQuestions || running}
                  variant="outline"
                  className="shrink-0 border-white/15 text-cyan-100 hover:bg-white/10 sm:self-start"
                >
                  {generatingQuestions ? "正在生成…" : "重新生成"}
                </Button>
              </div>
              {targetQuestions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">暂无问题，点击重新生成</p>
              ) : (
                <ul className="mt-4 max-h-64 list-none space-y-2 overflow-auto p-0 text-sm text-slate-300">
                  {targetQuestions.slice(0, 20).map(q => {
                    const qm = parseStoredQuestionMeta(q.targetKeyword ?? null);
                    return (
                      <li key={q.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <span>{q.questionText}</span>
                        {qm.disadvantaged ? <span className="ml-2 text-xs text-amber-300">劣势场景</span> : null}
                        {qm.intent ? <span className="mt-1 block text-xs text-slate-500">意图：{qm.intent}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <Button onClick={() => setLocation("/enterprise-profile")} variant="outline" className="border-white/15 text-cyan-100 hover:bg-white/10">
                  进入企业档案
                </Button>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
              <h2 className="font-semibold text-white">内容覆盖评分</h2>
              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                <div className="min-w-0 flex-1">
                  {scoreQuery.data ? (
                    <div className="space-y-3 text-sm leading-6 text-slate-300">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <p>总分：{scoreQuery.data.totalScore}</p>
                        <p>当前等级：{scoreQuery.data.visibilityLevel}</p>
                        <p>AI 提及分：{scoreQuery.data.aiVisibilityScore}</p>
                        <p>AI 推荐分：{scoreQuery.data.aiRecommendationScore}</p>
                      </div>
                      <p className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-cyan-50">分数代表分析语境下企业对 内容覆盖与内容资产的匹配程度。</p>
                      <p>{scoreReason(scoreQuery.data)}</p>
                      <p>{scoreFactors(scoreQuery.data)}</p>
                      <p className="text-emerald-100">下一步：优先处理 P0 优化任务，再进入内容生产生成本周内容计划。</p>
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-slate-400">当前还没有生成 内容覆盖评分。生成目标客户问题后，可在此运行诊断。</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 lg:max-w-[12rem] lg:border-l lg:border-white/10 lg:pl-6">
                  <Button
                    onClick={() => void handleRunDiagnosis()}
                    disabled={!canOperate || targetQuestions.length === 0 || running || generatingQuestions}
                    className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300 lg:w-auto lg:min-w-[10.5rem]"
                  >
                    {running ? "正在运行内容诊断" : analyses.length > 0 ? "重新诊断" : "运行内容诊断"}
                  </Button>
                  <p className="text-xs leading-5 text-slate-500">查看分数后可直接重跑；首次诊断也在此开始。</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
            <h2 className="font-semibold text-white">诊断结果</h2>
            {analyses.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-400">当前还没有诊断结果。请先生成目标问题，再点击「运行内容诊断」。</p>
            ) : (
              <div className="mt-3 space-y-3">
                {analyses.slice(0, 10).map(item => {
                  const detail = diagnosisJson(item) as Record<string, unknown>;
                  const v12 = diagnosisV12DisplayFields(detail);
                  return (
                    <div key={item.id} className="rounded-2xl bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                      <p className="font-medium text-white">客户问题：{diagnosisText(detail.questionText, "未关联客户问题")}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <p>客户搜这个问题时，AI会提到你吗：{yesNo(item.mentionsEnterprise)}</p>
                        <p>AI会把你推荐给客户吗：{yesNo(item.recommendsEnterprise)}</p>
                        <p>被关注的竞品：{listText(item.recommendedCompetitors)}</p>
                        <p>用户真实意图：{diagnosisText(detail.userIntent)}</p>
                      </div>
                      <p className="mt-2">内容缺口 / 未推荐原因：{diagnosisText(item.notRecommendedReason, "暂无。")}</p>
                      <p>内容缺口：{item.contentGap || "暂无"}</p>
                      <p>优化建议：{item.optimizationSuggestion || "暂无"}</p>
                      <div className="mt-2 space-y-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-cyan-50">
                        <p>
                          <span className="text-xs text-cyan-200/90">建议标题</span>
                          <span className="mt-1 block text-sm text-cyan-50">{v12.suggestedTitle ? `《${v12.suggestedTitle}》` : diagnosisText(detail.semanticSummary, "暂无。")}</span>
                        </p>
                        <div>
                          <p className="text-xs text-cyan-200/90">核心论点</p>
                          {v12.coreTheses.length > 0 ? (
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                              {v12.coreTheses.map((t, idx) => (
                                <li key={idx}>{t}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-sm text-slate-400">暂无结构化论点，请结合上方「优化建议」执行。</p>
                          )}
                        </div>
                        <p>
                          <span className="text-xs text-cyan-200/90">推荐发布平台</span>
                          <span className="mt-1 block text-sm">{v12.recommendedPlatforms.length ? v12.recommendedPlatforms.join("、") : "待补充"}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
            <h2 className="font-semibold text-white">优化任务</h2>
            {tasks.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-400">当前还没有优化任务。请先运行内容诊断。</p>
            ) : (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {tasks.map(task => {
                  const card = parseGeoTaskCard(task.executionSuggestion);
                  return (
                    <div key={task.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                      <p className="font-medium text-white">任务名称：{task.taskName}</p>
                      <p className="mt-1 text-cyan-200">优先级：{task.priority || "待评估"}</p>
                      <p>这个任务解决什么问题：{task.generationReason || "用于补齐诊断发现的内容缺口。"}</p>
                      <p>建议内容类型：{task.taskType || "内容"}</p>
                      {card ? (
                        <div className="mt-2 space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-slate-200">
                          <p><span className="text-xs text-slate-500">建议标题</span><span className="mt-1 block text-cyan-100">《{card.articleTitle}》</span></p>
                          <div>
                            <p className="text-xs text-slate-500">核心论点</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5">
                              {card.keyPoints.map((k, i) => (
                                <li key={i}>{k}</li>
                              ))}
                            </ul>
                          </div>
                          <p><span className="text-xs text-slate-500">目标关键词</span><span className="mt-1 block">{card.targetKeywords.join("、")}</span></p>
                          <p><span className="text-xs text-slate-500">推荐发布平台</span><span className="mt-1 block">{card.recommendedPlatform.join("、")}</span></p>
                          <p><span className="text-xs text-slate-500">内容形态</span><span className="mt-1 block">{card.contentType}</span></p>
                        </div>
                      ) : null}
                      <p className="mt-2 text-emerald-100">下一步动作：进入内容生产，基于该任务生成本周内容计划。</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {complete ? <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">内容诊断已完成。下一步：进入内容生产，根据优化任务生成本周内容计划。</div> : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={() => setLocation("/content-generation")} disabled={!complete} variant="outline" className="border-white/15 text-cyan-100 hover:bg-white/10">
              进入内容生产
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ContentGenerationFlowInner({ selection }: { selection: ReturnType<typeof useProjectSelection> }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = selection;
  const assetSummaryQuery = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const topicsQuery = trpc.geo.articles.topics.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const contentPlanQuery = trpc.geo.contentPlans.latest.useQuery(projectInput, { enabled });
  const generateTopics = trpc.geo.articles.topics.generate.useMutation();
  const generateArticle = trpc.geo.articles.generate.useMutation();
  const qualityCheck = trpc.geo.articles.qualityCheck.useMutation();
  const upsertContentPlan = trpc.geo.contentPlans.upsert.useMutation();
  const addContentPlanItem = trpc.geo.contentPlans.addItem.useMutation();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [publishTitleEdit, setPublishTitleEdit] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<null | "title" | "body">(null);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [contentPlan, setContentPlan] = useState<ContentPlanForm>(() => emptyContentPlanForm());
  const [selectedTaskId, setSelectedTaskId] = useState<number>();
  const [selectedTopicId, setSelectedTopicId] = useState<number>();
  const [selectedArticleId, setSelectedArticleId] = useState<number>();
  const [batchGeneratingAll, setBatchGeneratingAll] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const assetSummary = assetSummaryQuery.data;
  const hasProfile = Boolean(assetSummary?.profile);
  const assetSources = (assetSummary?.assetSources ?? []) as Array<{ title?: string | null; sourceType?: string | null; contentText?: string | null; isPublic?: number | boolean | null }>;
  const analyses = analysisQuery.data ?? [];
  const tasks = (tasksQuery.data ?? []) as TaskLike[];
  const topics = (topicsQuery.data ?? []) as TopicLike[];
  const articles = (articlesQuery.data ?? []) as ArticleLike[];
  const scores = (scoresQuery.data ?? []) as QualityScoreLike[];
  const articlesSorted = useMemo(() => {
    return [...articles].sort((a, b) => {
      const ta = new Date(a.createdAt ?? 0).getTime();
      const tb = new Date(b.createdAt ?? 0).getTime();
      return tb - ta;
    });
  }, [articles]);
  const latestPlan = contentPlanQuery.data?.plan as ContentPlanRecord | null | undefined;
  const contentPlanItems = (contentPlanQuery.data?.items ?? []) as ContentPlanItemRecord[];
  const pageLoading =
    (assetSummaryQuery.isFetching && assetSummaryQuery.data === undefined) ||
    (analysisQuery.isFetching && analysisQuery.data === undefined) ||
    (tasksQuery.isFetching && tasksQuery.data === undefined) ||
    (topicsQuery.isFetching && topicsQuery.data === undefined) ||
    (articlesQuery.isFetching && articlesQuery.data === undefined) ||
    (scoresQuery.isFetching && scoresQuery.data === undefined) ||
    (contentPlanQuery.isFetching && contentPlanQuery.data === undefined);
  const pageError = assetSummaryQuery.error?.message || analysisQuery.error?.message || tasksQuery.error?.message || topicsQuery.error?.message || articlesQuery.error?.message || scoresQuery.error?.message || contentPlanQuery.error?.message;
  const selectedTask = tasks.find(task => task.id === selectedTaskId);
  const planTaskIdSet = new Set(contentPlan.taskIds);
  const visibleTopics =
    planTaskIdSet.size > 0
      ? topics.filter(t => t.optimizationTaskId != null && planTaskIdSet.has(t.optimizationTaskId))
      : topics;
  const visibleTopicIdsKey = useMemo(() => visibleTopics.map(t => t.id).join(","), [visibleTopics]);
  const articleIdsKey = useMemo(() => articles.map(a => a.id).join(","), [articles]);
  const stableTaskIdsKey = useMemo(() => tasks.map(t => t.id).join(","), [tasks]);
  const selectedTopic = topics.find(topic => topic.id === selectedTopicId);
  const selectedArticle = articles.find(article => article.id === selectedArticleId) ?? (selectedTopicId ? articles.find(article => article.topicId === selectedTopicId) : articles[0]);
  /** 与列表同源的文章行，用于发布标题等字段，避免展示对象与 articles 缓存不一致 */
  const articleRowFromList = useMemo(() => {
    if (!selectedArticle?.id) return null;
    return articles.find(a => a.id === selectedArticle.id) ?? selectedArticle;
  }, [articles, selectedArticle]);
  const publishBodyMarkdown = useMemo(
    () => stripLeadingMarkdownH1Line(selectedArticle?.markdownContent),
    [selectedArticle?.id, selectedArticle?.markdownContent],
  );
  const currentEnterpriseName = useMemo(() => projects.find(p => p.id === selectedProjectId)?.enterpriseName ?? "", [projects, selectedProjectId]);
  const selectedQuality = selectedArticle ? scores.find(score => score.articleId === selectedArticle.id) : undefined;
  const basis = asRecord(selectedArticle?.generationBasis);
  const assetUsage = asRecord(basis.assetLibraryUsage);
  const enterpriseMaterials = objectList(assetUsage.enterpriseMaterials);
  const consistencyCheck = asRecord(selectedArticle?.consistencyCheck);
  const antiDuplication = buildAntiDuplicationResult(selectedArticle, articles, selectedTopic, contentPlan);
  const qualityBlocked = selectedQuality ? isBlocked(selectedQuality.blocked) : false;
  const generatingTopics = generateTopics.isPending;
  const generatingArticle = generateArticle.isPending;
  const contentGenerating = generatingArticle || batchGeneratingAll;
  const checkingQuality = qualityCheck.isPending;
  const savingPlan = upsertContentPlan.isPending;
  const hasDiagnosis = analyses.length > 0;
  const hasTasks = tasks.length > 0;
  const planFormComplete = Boolean(contentPlan.name.trim() && contentPlan.weekStart && contentPlan.weeklyCount > 0 && contentPlan.targetPlatforms.length > 0 && contentPlan.contentTypes.length > 0 && contentPlan.taskIds.length > 0);
  const planConfigured = Boolean(latestPlan && planFormComplete);
  const contentComplete = Boolean(selectedArticle);
  const reviewComplete = Boolean(selectedArticle && selectedQuality);
  const reviewPassed = Boolean(
    selectedArticle &&
      selectedQuality &&
      !qualityBlocked &&
      (selectedArticle.status === "质检通过" || (selectedQuality.totalScore ?? 0) >= GEO_ARTICLE_MIN_PASS_SCORE),
  );
  const canReQualityCheck = Boolean(
    selectedArticle && ["需人工审核", "质检未通过", "待质检", "已生成"].includes(selectedArticle.status ?? ""),
  );
  const reviewBlocked = qualityBlocked;
  const pageReady = Boolean(selectedProjectId && hasProfile && hasDiagnosis && hasTasks && planConfigured);

  useEffect(() => {
    startTransition(() => {
      setSelectedTopicId(undefined);
      setSelectedArticleId(undefined);
    });
    setMessage(undefined);
    setError(undefined);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;

    const valid = new Set(tasks.map(t => t.id));
    const serverPlan = latestPlan && latestPlan.projectId === selectedProjectId ? latestPlan : null;

    if (serverPlan) {
      const raw = Array.isArray(serverPlan.linkedOptimizationTaskIds) ? serverPlan.linkedOptimizationTaskIds : [];
      const taskIds = tasks.length === 0 ? raw : raw.filter(id => valid.has(id));
      setContentPlan({
        name: serverPlan.planName,
        weekStart: serverPlan.weekStartDate,
        weeklyCount: serverPlan.weeklyArticleCount,
        targetPlatforms: Array.isArray(serverPlan.targetPlatforms) ? serverPlan.targetPlatforms : [],
        contentTypes: Array.isArray(serverPlan.contentTypes) ? serverPlan.contentTypes : [],
        taskIds,
      });
      setSelectedTaskId(prev => {
        if (prev && taskIds.includes(prev)) return prev;
        return taskIds[0];
      });
      return;
    }

    const base = emptyContentPlanForm();
    if (tasks.length === 0) {
      setContentPlan(base);
      setSelectedTaskId(undefined);
      return;
    }
    const picked = tasks.slice(0, Math.min(3, tasks.length)).map(t => t.id);
    setContentPlan({ ...base, taskIds: picked });
    setSelectedTaskId(prev => {
      if (prev && picked.includes(prev)) return prev;
      return picked[0];
    });
  }, [
    selectedProjectId,
    latestPlan?.id,
    latestPlan?.projectId,
    latestPlan?.planName,
    latestPlan?.weekStartDate,
    latestPlan?.weeklyArticleCount,
    JSON.stringify(latestPlan?.linkedOptimizationTaskIds ?? []),
    JSON.stringify(latestPlan?.targetPlatforms ?? []),
    JSON.stringify(latestPlan?.contentTypes ?? []),
    stableTaskIdsKey,
  ]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) clearTimeout(copyFeedbackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!articleRowFromList) {
      setPublishTitleEdit("");
      return;
    }
    const recordTitle = typeof articleRowFromList.title === "string" ? articleRowFromList.title.trim() : "";
    setPublishTitleEdit(buildPublishDisplayTitle(recordTitle, currentEnterpriseName));
  }, [articleRowFromList?.id, articleRowFromList?.title, currentEnterpriseName]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const first = visibleTopics[0]?.id;
    if (!first) return;
    const ids = new Set(visibleTopics.map(t => t.id));
    if (!selectedTopicId || !ids.has(selectedTopicId)) startTransition(() => setSelectedTopicId(first));
  }, [selectedProjectId, selectedTopicId, visibleTopicIdsKey]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const first = articles[0]?.id;
    if (!first) return;
    const ids = new Set(articles.map(a => a.id));
    if (!selectedArticleId || !ids.has(selectedArticleId)) startTransition(() => setSelectedArticleId(first));
  }, [selectedProjectId, selectedArticleId, articleIdsKey]);

  function togglePlanValue(field: "targetPlatforms" | "contentTypes", value: string) {
    setContentPlan(plan => {
      const current = plan[field];
      const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
      return { ...plan, [field]: next };
    });
  }

  function togglePlanTask(taskId: number) {
    setContentPlan(plan => {
      const nextTaskIds = plan.taskIds.includes(taskId) ? plan.taskIds.filter(id => id !== taskId) : [...plan.taskIds, taskId];
      return { ...plan, taskIds: nextTaskIds };
    });
    setSelectedTaskId(taskId);
    startTransition(() => setSelectedTopicId(undefined));
  }

  async function handleSaveContentPlan() {
    if (!selectedProjectId) return;
    if (!planFormComplete) {
      setError("请完整填写计划名称、周期开始日期、本周篇数、目标平台、内容类型，并至少绑定一个优化任务。");
      return;
    }
    setMessage(undefined);
    setError(undefined);
    try {
      const validTaskIds = new Set(tasks.map(t => t.id));
      const linkedOptimizationTaskIds = contentPlan.taskIds.filter(id => validTaskIds.has(id));
      if (linkedOptimizationTaskIds.length === 0) {
        setError("选中的优化任务已失效或不属于当前项目，请重新勾选后再保存。");
        return;
      }
      if (linkedOptimizationTaskIds.length !== contentPlan.taskIds.length) {
        setContentPlan(plan => ({ ...plan, taskIds: linkedOptimizationTaskIds }));
      }
      const result = await upsertContentPlan.mutateAsync({
        id: latestPlan?.id,
        projectId: selectedProjectId,
        planName: contentPlan.name,
        weekStartDate: contentPlan.weekStart,
        weeklyArticleCount: contentPlan.weeklyCount,
        targetPlatforms: contentPlan.targetPlatforms,
        contentTypes: contentPlan.contentTypes,
        linkedOptimizationTaskIds,
        status: "已配置",
      });
      await Promise.all([
        utils.geo.contentPlans.latest.invalidate({ projectId: selectedProjectId }),
        utils.geo.contentPlans.list.invalidate({ projectId: selectedProjectId }),
      ]);
      setMessage(`内容生产计划已保存，刷新页面后仍可读回。计划 ID：${result.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存内容生产计划失败");
    }
  }

  async function handleGenerateTopics() {
    if (!selectedProjectId) return;
    if (!hasProfile) {
      setError("当前项目还没有企业档案。请先在企业档案中完成「基本身份」与「你的客户」等必填项，再配置内容生产计划。");
      return;
    }
    if (!hasDiagnosis) {
      setError("当前项目还没有 内容诊断结果，请先进入内容诊断完成分析。");
      return;
    }
    if (!hasTasks) {
      setError("当前项目还没有优化任务，请先运行内容诊断并生成优化任务。");
      return;
    }
    if (!planConfigured) {
      setError("请先保存本周内容生产计划。计划保存后，刷新页面仍能读回，才能继续生成本周内容选题。");
      return;
    }
    setMessage(undefined);
    setError(undefined);
    try {
      await generateTopics.mutateAsync({ projectId: selectedProjectId });
      const refreshedTopics = await topicsQuery.refetch();
      const refreshed = (refreshedTopics.data ?? []) as TopicLike[];
      const nextTopic = refreshed.find(topic => topic.optimizationTaskId && contentPlan.taskIds.includes(topic.optimizationTaskId)) ?? refreshed[0];
      if (!nextTopic) throw new Error("没有可用于生成文章的选题，请先完成 内容诊断和优化任务。");
      startTransition(() => setSelectedTopicId(nextTopic.id));
      setMessage("已根据优化任务同步内容选题，请选择一个选题生成 1 篇文章。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成内容选题失败");
    }
  }

  async function generateOneArticleAndPersist(topicId: number) {
    if (!selectedProjectId || !latestPlan) throw new Error("请先保存本周内容生产计划，再生成文章。");
    const result = await generateArticle.mutateAsync({ topicId });
    if (!result.articleId) throw new Error("生成未返回文章 ID");
    const topicIndex = Math.max(visibleTopics.findIndex(topic => topic.id === topicId), 0);
    const topicForItem = visibleTopics.find(t => t.id === topicId) ?? topics.find(t => t.id === topicId);
    if (!topicForItem) throw new Error("选题不存在");
    const repeatHint = topicRepeatHint(topicForItem, visibleTopics);
    await addContentPlanItem.mutateAsync({
      projectId: selectedProjectId,
      planId: latestPlan.id,
      topicId,
      articleId: result.articleId,
      targetPlatform: cyclePick(contentPlan.targetPlatforms, topicIndex, "目标平台待确认"),
      contentType: cyclePick(contentPlan.contentTypes, topicIndex, topicForItem.articleType || "内容"),
      status: result.finalStatus === "质检通过" ? "质检通过" : "已生成",
      differentiationAngle: "基于已选优化任务和目标平台生成，生成时已自动完成质量检查与轻量差异度检查。",
      duplicateRisk: repeatHint.includes("较高") ? "高" : repeatHint.includes("集中") ? "中" : "低",
    });
    await Promise.all([
      utils.geo.articles.list.invalidate({ projectId: selectedProjectId }),
      utils.geo.articles.topics.list.invalidate({ projectId: selectedProjectId }),
      utils.geo.articles.latestQualityScores.invalidate({ projectId: selectedProjectId }),
      utils.geo.contentPlans.latest.invalidate({ projectId: selectedProjectId }),
    ]);
    await articlesQuery.refetch();
    await scoresQuery.refetch();
    return result;
  }

  async function handleGenerateArticle() {
    if (!selectedTopicId) {
      setError("请先选择一个内容选题。");
      return;
    }
    setMessage("正在生成正文并执行 质量检查…");
    setError(undefined);
    try {
      const result = await generateOneArticleAndPersist(selectedTopicId);
      if (result.articleId) startTransition(() => setSelectedArticleId(result.articleId));
      const totalScore = result.quality?.totalScore;
      if (result.finalStatus === "质检通过") {
        setMessage(`内容已生成并完成质量检查：通过（${totalScore ?? "—"} 分）。可进入发布记录进行人工确认发布。`);
      } else if (result.finalStatus === "需人工审核") {
        setMessage(`内容已生成，质量检查结果为需人工审核（${totalScore ?? "—"} 分）。请查看下方质量检查摘要，修订后可点击「重新检查」。`);
      } else {
        setMessage(`内容已生成并完成质量检查（${totalScore ?? "—"} 分）。请查看下方质量检查结果。`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成内容失败");
    }
  }

  async function handleGenerateAllArticles() {
    if (!selectedProjectId || !latestPlan) {
      setError("请先保存本周内容生产计划，再生成文章。");
      return;
    }
    if (visibleTopics.length === 0) {
      setError("暂无可用选题，请先生成本周内容选题。");
      return;
    }
    setError(undefined);
    setBatchGeneratingAll(true);
    const total = visibleTopics.length;
    let ok = 0;
    const skippedRounds: number[] = [];
    try {
      for (let i = 0; i < total; i++) {
        const topic = visibleTopics[i];
        setBatchProgress({ current: i + 1, total });
        try {
          const result = await generateOneArticleAndPersist(topic.id);
          ok += 1;
          if (result.articleId) startTransition(() => setSelectedArticleId(result.articleId));
          startTransition(() => setSelectedTopicId(topic.id));
        } catch {
          skippedRounds.push(i + 1);
          setMessage(`第${i + 1}篇生成失败，已跳过，继续生成剩余文章`);
        }
      }
      const skipText =
        skippedRounds.length > 0
          ? `（${skippedRounds.map(n => `第${n}篇失败已跳过`).join("；")}）`
          : "";
      setMessage(`已生成 ${ok} 篇，请查看下方质量检查结果${skipText}`);
    } finally {
      setBatchGeneratingAll(false);
      setBatchProgress(null);
    }
  }

  function formatQualityCheckMessage(result: { quality?: QualityScoreLike; autoRewriteCount?: number; finalStatus?: string }) {
    const checked = result.quality;
    const totalScore = checked?.totalScore;
    if (result.finalStatus === "质检通过") {
      return `文章质量检查完成：质量通过（${totalScore ?? "—"} 分）。可进入发布与人工审核流程。`;
    }
    if (result.finalStatus === "需人工审核") {
      return `文章质量检查结束：当前为需人工审核（${totalScore ?? "—"} 分）。请按最新质量检查摘要修订正文后再次检查。`;
    }
    const blocked = isBlocked(checked?.blocked);
    return blocked ? `文章质量检查完成：存在合规阻断（${totalScore ?? "—"} 分）。请按「阻断原因」修订。` : `文章质量检查完成（${totalScore ?? "—"} 分）。`;
  }

  async function handleQualityReview() {
    if (!selectedArticle?.id) {
      setError("请先选择一篇已生成文章。");
      return;
    }
    if (!canReQualityCheck) {
      setError("当前文章已完成自动质量检查。如需再次评分，请先将文章修订为可重新检查的状态。");
      return;
    }
    setMessage("重新检查中…");
    setError(undefined);
    try {
      const result = await qualityCheck.mutateAsync({ articleId: selectedArticle.id });
      await Promise.all([
        utils.geo.articles.list.invalidate({ projectId: selectedProjectId }),
        utils.geo.articles.latestQualityScores.invalidate({ projectId: selectedProjectId }),
      ]);
      setMessage(formatQualityCheckMessage(result as { quality?: QualityScoreLike; autoRewriteCount?: number; finalStatus?: string }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "文章质量检查失败");
    }
  }

  async function copyPublishField(text: string, kind: "title" | "body") {
    const payload = kind === "title" ? text.trim() : text;
    if (!payload) {
      setError(kind === "title" ? "标题为空，请先编辑后再复制。" : "正文为空，无法复制。");
      return;
    }
    setError(undefined);
    try {
      await navigator.clipboard.writeText(payload);
      if (copyFeedbackTimerRef.current) clearTimeout(copyFeedbackTimerRef.current);
      setCopyFeedback(kind);
      copyFeedbackTimerRef.current = setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setError("复制失败，请检查浏览器剪贴板权限或 HTTPS 环境。");
    }
  }

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="内容生产计划" completion={reviewPassed ? 88 : reviewComplete ? 80 : contentComplete ? 72 : topics.length > 0 ? 58 : planConfigured ? 44 : hasTasks ? 32 : 18} nextAction={reviewPassed ? "进入发布记录，连接内容发布渠道" : reviewComplete ? "查看质量检查结果并确认是否发布" : contentComplete ? "等待质量检查结果" : topics.length > 0 ? "选择选题并生成 1 篇内容" : planConfigured ? "生成本周内容选题" : "保存本周内容生产计划"} why="根据 内容诊断结果和优化任务，制定本周内容计划，并生成可用于发布前质量检查的内容资产。" risk="本页不做平台授权、不发布、不写发布记录。" ctaLabel="进入发布记录" ctaPath="/content-publishing" />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader>
          <CardTitle className="text-white">内容生产计划</CardTitle>
          <CardDescription className="text-cyan-200">本步骤用于根据 内容诊断结果和优化任务，制定本周内容计划，并生成可用于发布前质量检查的内容资产。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} />
          <ActionState message={message} error={error || pageError} />
          {pageLoading ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">正在读取项目、企业资料、诊断结果、优化任务、内容计划、选题、文章和已有质量分...</div> : null}
          {projects.length === 0 ? <EmptyStep title="暂无项目" description="请先进入企业档案页面创建项目，再完成 内容诊断后生成内容。" /> : null}
          {selectedProjectId && !hasProfile && !assetSummaryQuery.isLoading ? <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">当前项目还没有企业档案。内容计划需要企业定位、产品与客户信息；请先在「企业档案」完成 Section 1 / 2 等必填项并保存。</div> : null}
          {selectedProjectId && !hasDiagnosis && !analysisQuery.isLoading ? <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">当前项目还没有 内容诊断结果。内容必须基于诊断缺口生成，请先进入内容诊断生成目标问题并运行诊断。</div> : null}
          {selectedProjectId && hasDiagnosis && !hasTasks && !tasksQuery.isLoading ? <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">当前项目还没有优化任务。请先在 内容诊断页生成 内容评分和优化任务，再回到这里选择任务生成内容。</div> : null}

          <div className="grid gap-4 lg:grid-cols-5">
            <InfoCard title="企业档案" value={hasProfile ? "已完成" : "未完成"} desc={hasProfile ? "可作为本周内容生成依据。" : "缺少企业档案会阻断内容计划。"} />
            <InfoCard title="内容诊断" value={String(analyses.length)} desc="用于定位客户问题、未推荐原因和内容缺口。" />
            <InfoCard title="优化任务" value={String(tasks.length)} desc="内容计划必须绑定任务，避免泛泛写文章。" />
            <InfoCard title="本周计划" value={planConfigured ? "已保存" : "待保存"} desc={planConfigured ? `${contentPlan.weeklyCount} 篇，${contentPlan.targetPlatforms.length} 个平台，${contentPlan.contentTypes.length} 类内容。` : "请配置并保存篇数、平台、内容类型和任务。"} />
            <InfoCard title="已生成文章" value={String(articles.length)} desc="每次生成 1 篇并自动完成质量检查与轻量差异度检查。" />
          </div>

          <section className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold text-white">1. 配置本周内容生产计划</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">保存后会写入数据库，刷新页面仍可读回，用于后续复盘本周选题、文章和质量检查结果。</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs ${planConfigured ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>{planConfigured ? "内容计划已保存" : "内容计划待保存"}</span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.7fr_0.5fr]">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">计划名称</span>
                <span className="block text-xs text-slate-500">给本周内容计划起一个名字，方便后续复盘。示例：5月第2周 内容计划</span>
                <input value={contentPlan.name} onChange={event => setContentPlan(plan => ({ ...plan, name: event.target.value }))} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400" />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">周期开始日期</span>
                <span className="block text-xs text-slate-500">选择本周内容计划的开始时间。</span>
                <input type="date" value={contentPlan.weekStart} onChange={event => setContentPlan(plan => ({ ...plan, weekStart: event.target.value }))} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400" />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span className="font-medium text-slate-100">本周计划生成篇数</span>
                <span className="block text-xs text-slate-500">建议 3-5 篇，不建议一次生成过多。</span>
                <input type="number" min={1} max={10} value={contentPlan.weeklyCount} onChange={event => setContentPlan(plan => ({ ...plan, weeklyCount: Number(event.target.value) || 1 }))} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400" />
              </label>
            </div>
            <div className="mt-5">
              <p className="text-sm font-medium text-white">目标发布平台</p>
              <p className="mt-1 text-sm text-slate-400">选择本周内容将优先适配的平台。本页只配置内容计划，不连接平台、不发布。</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {platformMatrix.map(platform => (
                  <button key={platform.name} type="button" onClick={() => togglePlanValue("targetPlatforms", platform.name)} className={`rounded-2xl border p-4 text-left text-sm leading-6 transition ${contentPlan.targetPlatforms.includes(platform.name) ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"}`}>
                    <p className="font-medium text-white">{platformDisplayName(platform.name)}</p>
                    <p className="mt-1 text-cyan-200">{platform.priority}</p>
                    <p className="mt-1">{platform.capability}</p>
                    <p className="mt-2 text-slate-400">{platform.geoValue}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5">
              <p className="text-sm font-medium text-white">内容类型</p>
              <p className="mt-1 text-sm text-slate-400">选择本周要补齐的内容资产类型，让内容围绕诊断缺口和优化任务展开。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {contentTypeOptions.map(type => (
                  <button key={type} type="button" onClick={() => togglePlanValue("contentTypes", type)} className={`rounded-full border px-3 py-2 text-sm ${contentPlan.contentTypes.includes(type) ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"}`}>{type}</button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-400">{latestPlan ? `已保存计划：${latestPlan.planName}。内容计划明细 ${contentPlanItems.length} 条。` : "保存计划后才能生成本周内容选题。"}</p>
              <Button onClick={handleSaveContentPlan} disabled={!selectedProjectId || !planFormComplete || savingPlan} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{savingPlan ? "正在保存内容计划" : latestPlan ? "更新内容计划" : "保存内容计划"}</Button>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold text-white">2. 选择优化任务进入内容计划</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">可以选择一个或多个任务进入本周计划；生成文章时会选择其中一个任务对应的选题。</p>
              </div>
              <Button onClick={() => setLocation("/ai-diagnosis")} variant="outline" className="border-white/15 text-cyan-100 hover:bg-white/10">查看 内容诊断</Button>
            </div>
            {tasks.length === 0 ? <EmptyStep title="暂无优化任务" description="完成 内容诊断并生成任务后，才能基于任务生成内容。" /> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{tasks.map(task => {
              const card = parseGeoTaskCard(task.executionSuggestion);
              return (
                <button key={task.id} type="button" onClick={() => togglePlanTask(task.id)} className={`rounded-2xl border p-4 text-left text-sm leading-6 transition ${contentPlan.taskIds.includes(task.id) ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"}`}>
                  <p className="font-medium text-white">{contentPlan.taskIds.includes(task.id) ? "已纳入计划：" : ""}{task.taskName}</p>
                  <p className="mt-1 text-cyan-200">{task.taskType || "内容任务"} · {task.priority || "优先级未标注"}</p>
                  <p className="mt-2 text-slate-400">{task.generationReason || "该任务来自 内容诊断后的内容缺口判断。"}</p>
                  {card ? (
                    <div className="mt-2 space-y-1 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-left text-xs text-slate-300">
                      <p><span className="text-slate-500">建议标题</span><span className="mt-0.5 block text-sm text-cyan-100">《{card.articleTitle}》</span></p>
                      <p><span className="text-slate-500">核心论点</span><span className="mt-0.5 block">{card.keyPoints.join("；")}</span></p>
                      <p><span className="text-slate-500">关键词</span><span className="mt-0.5 block">{card.targetKeywords.join("、")}</span></p>
                      <p><span className="text-slate-500">平台</span><span className="mt-0.5 block">{card.recommendedPlatform.join("、")}</span></p>
                    </div>
                  ) : null}
                </button>
              );
            })}</div>}
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold text-white">3. 生成并选择本周内容选题</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">选题与优化任务一一对应，标题与类型来自任务卡片。点击按钮从任务同步选题列表。重复风险仅为轻量规则提示。</p>
              </div>
              <Button onClick={handleGenerateTopics} disabled={!pageReady || generatingTopics || contentGenerating} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{generatingTopics ? "正在生成本周内容选题" : "生成本周内容选题"}</Button>
            </div>
            <div
              className="mt-4"
              key={`topic-area-${String(selectedTaskId ?? "none")}-${visibleTopicIdsKey}`}
            >
              {topics.length === 0 ? (
                <EmptyStep title="暂无内容选题" description="配置内容计划并选择优化任务后，点击生成本周内容选题。不会生成文章，也不会自动质量检查。" />
              ) : topics.length > 0 && visibleTopics.length === 0 ? (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">计划中勾选的优化任务暂无对应选题。请先点击「生成本周内容选题」，或勾选更多已生成选题的任务。</div>
              ) : visibleTopics.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {visibleTopics.map(topic => {
                    const taskForTopic = tasks.find(t => t.id === topic.optimizationTaskId);
                    const topicCard = parseGeoTaskCard(taskForTopic?.executionSuggestion ?? null);
                    const platformLine = topicCard?.recommendedPlatform?.length ? topicCard.recommendedPlatform.join("、") : "—";
                    const contentTypeLine = topicCard?.contentType || topic.articleType || "—";
                    return (
                      <button key={topic.id} type="button" onClick={() => setSelectedTopicId(topic.id)} className={`rounded-2xl border p-4 text-left text-sm leading-6 transition ${selectedTopicId === topic.id ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"}`}>
                        <p className="font-medium text-white">{topic.title}</p>
                        <p className="mt-2 text-slate-400">优化任务：{taskForTopic?.taskName ?? "—"}</p>
                        {topicCard?.keyPoints?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {topicCard.keyPoints.map((kp, i) => (
                              <span key={i} className="rounded-full border border-white/10 bg-slate-950/50 px-2 py-0.5 text-xs text-cyan-100">{kp}</span>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-500">目标关键词：{topicCard?.targetKeywords?.length ? topicCard.targetKeywords.join("、") : "—"}</p>
                        <p className="mt-1 text-xs text-slate-500">推荐平台：{platformLine}</p>
                        <p className="mt-1 text-xs text-slate-500">内容类型：{contentTypeLine}</p>
                        <p className="mt-2 text-xs text-amber-100">重复风险提示：{topicRepeatHint(topic, topics)}</p>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold text-white">4. 生成内容</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">可针对当前选中选题生成 1 篇，或按当前选题列表顺序串行生成全部；每篇完成后自动质量检查，结果在下方列表与质量检查区实时更新。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleGenerateArticle}
                  disabled={!selectedTopicId || generatingTopics || contentGenerating || checkingQuality}
                  className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                >
                  {generatingArticle && !batchGeneratingAll ? "生成中…" : "生成 1 篇文章"}
                </Button>
                <Button
                  onClick={() => void handleGenerateAllArticles()}
                  disabled={visibleTopics.length === 0 || generatingTopics || contentGenerating || checkingQuality}
                  variant="outline"
                  className="border-white/15 text-cyan-100 hover:bg-white/10"
                >
                  {batchGeneratingAll && batchProgress
                    ? `生成中（${batchProgress.current}/${batchProgress.total}）…`
                    : `一键生成全部（${visibleTopics.length}篇）`}
                </Button>
              </div>
            </div>
            {!selectedTopic ? <EmptyStep title="尚未选择选题" description="请先生成并选择一个内容选题。" /> : (() => {
              const stTask = tasks.find(t => t.id === selectedTopic.optimizationTaskId);
              const stCard = parseGeoTaskCard(stTask?.executionSuggestion ?? null);
              return (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                  <p className="font-medium text-white">当前选题：{selectedTopic.title}</p>
                  <p className="mt-1">优化任务：{stTask?.taskName ?? "—"}</p>
                  <p className="mt-1">推荐平台：{stCard?.recommendedPlatform?.length ? stCard.recommendedPlatform.join("、") : "—"}</p>
                  <p className="mt-1">内容类型：{stCard?.contentType ?? selectedTopic.articleType ?? "—"}</p>
                </div>
              );
            })()}
            {articlesSorted.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">已生成文章</p>
                <p className="mt-1 text-xs text-slate-400">按生成时间倒序；点击一行可查看正文与下方质量检查详情。</p>
                <ul className="mt-3 divide-y divide-white/10">
                  {articlesSorted.map(article => {
                    const q = scores.find(s => s.articleId === article.id);
                    const pass = articleQualityPassesGate(article, q);
                    const scoreLabel = q?.totalScore != null ? `${q.totalScore} 分` : "—";
                    return (
                      <li key={article.id}>
                        <button
                          type="button"
                          onClick={() => {
                            startTransition(() => {
                              setSelectedArticleId(article.id);
                              if (article.topicId != null) setSelectedTopicId(article.topicId);
                            });
                          }}
                          className={`flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left text-sm transition hover:bg-white/[0.04] ${selectedArticleId === article.id ? "text-cyan-100" : "text-slate-200"}`}
                        >
                          <span className="min-w-0 flex-1 font-medium text-white">
                            #{article.id} · {article.title || "无标题"}
                          </span>
                          <span className="shrink-0 text-xs text-slate-400">质量 {scoreLabel}</span>
                          <Badge
                            variant="outline"
                            className={
                              pass
                                ? "shrink-0 border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                                : "shrink-0 border-amber-300/40 bg-amber-400/10 text-amber-100"
                            }
                          >
                            {pass ? "通过" : "未通过"}
                          </Badge>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {!selectedArticle ? <EmptyStep title="暂无已生成文章" description="生成后会在这里展示发布标题、Markdown 正文、生成依据和下一步检查状态。" /> : (
              <div className="mt-4 space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm text-cyan-200">文章 #{selectedArticle.id} · {cyclePick(contentPlan.targetPlatforms, 0, "目标平台待确认")} · {cyclePick(contentPlan.contentTypes, 0, selectedArticle.articleType || "内容")}</p>
                      <p className="mt-2 text-xs text-slate-500">模型原标题：{articleRowFromList?.title ?? selectedArticle.title}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-200">{selectedArticle.status || (selectedQuality ? "已检查" : "生成中")}</span>
                  </div>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/56 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">发布标题</p>
                      <p className="mt-1 text-xs text-slate-500">已按企业简称处理工商全称，可直接微调后复制。</p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                        <input
                          value={publishTitleEdit}
                          onChange={event => setPublishTitleEdit(event.target.value)}
                          className="min-h-10 w-full flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                          placeholder="发布用标题"
                          aria-label="发布标题"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 border-white/15 text-cyan-100 hover:bg-white/10 sm:w-28"
                          onClick={() => void copyPublishField(publishTitleEdit, "title")}
                        >
                          {copyFeedback === "title" ? "已复制" : "复制标题"}
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/56 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">正文（Markdown）</p>
                          <p className="mt-1 text-xs text-slate-500">完整正文，复制后到平台编辑器粘贴。</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 border-white/15 text-cyan-100 hover:bg-white/10 sm:w-28"
                          onClick={() => void copyPublishField(publishBodyMarkdown, "body")}
                        >
                          {copyFeedback === "body" ? "已复制" : "复制正文"}
                        </Button>
                      </div>
                      <textarea
                        readOnly
                        value={publishBodyMarkdown}
                        className="mt-3 max-h-[520px] min-h-[240px] w-full resize-y rounded-xl border border-white/10 bg-slate-950/80 p-3 font-mono text-sm leading-6 text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                        aria-label="文章 Markdown 正文"
                      />
                    </div>
                    <p className="text-center text-sm text-slate-400">复制后前往对应平台粘贴发布</p>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/56 p-4 text-sm leading-6 text-slate-300">
                      <p className="font-medium text-white">优化任务</p>
                      <p className="mt-2">{textValue(basis.optimizationTask ?? selectedTask?.taskName)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/56 p-4 text-sm leading-6 text-slate-300">
                      <p className="font-medium text-white">目标问题</p>
                      <p className="mt-2">{textValue(basis.customerQuestion)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/56 p-4 text-sm leading-6 text-slate-300">
                      <p className="font-medium text-white">本周计划归属</p>
                      <p className="mt-2">计划：{contentPlan.name || "未命名计划"}</p>
                      <p className="mt-1">目标平台：{cyclePick(contentPlan.targetPlatforms, 0, "未选择目标平台")}</p>
                      <p className="mt-1">内容类型：{cyclePick(contentPlan.contentTypes, 0, selectedArticle.articleType || "内容")}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/56 p-4 text-sm leading-6 text-slate-300">
                      <p className="font-medium text-white">企业资料依据</p>
                      {enterpriseMaterials.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5">{enterpriseMaterials.slice(0, 4).map((item, index) => <li key={index}>{textValue(item.name ?? item.title ?? item.sourceName, "企业资料")}：{textValue(item.summary ?? item.content ?? item.evidence, "已纳入生成依据")}</li>)}</ul> : assetSources.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5">{assetSources.slice(0, 4).map((source, index) => <li key={index}>{source.title || source.sourceType || `资料来源 ${index + 1}`}</li>)}</ul> : <p className="mt-2">企业资料依据较少，发布前建议补充来源和案例。</p>}
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
                    <span className="rounded-2xl border border-white/10 bg-slate-950/56 px-4 py-3">质量状态：{selectedQuality ? `${selectedQuality.totalScore} 分` : "生成后自动质量检查"}</span>
                    <span className="rounded-2xl border border-white/10 bg-slate-950/56 px-4 py-3">差异度：{selectedArticle ? duplicateRiskLabel(antiDuplication.similarityRisk) : "待检查"}</span>
                    <span className="rounded-2xl border border-white/10 bg-slate-950/56 px-4 py-3">发布准备：{reviewPassed ? "可进入人工确认" : reviewComplete ? "需修订或复核" : "待生成"}</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold text-white">5. 文章质量检查</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">生成文章后会自动完成质量检查与差异度检查；下方展示分数、合规阻断（如有）与发布前可优化建议。</p>
              </div>
              {canReQualityCheck ? (
                <Button onClick={handleQualityReview} disabled={!selectedArticle || checkingQuality || generatingTopics || contentGenerating} variant="outline" className="border-white/15 text-cyan-100 hover:bg-white/10">{checkingQuality ? "重新检查中…" : "重新检查"}</Button>
              ) : null}
            </div>
            {!selectedArticle ? <EmptyStep title="文章为空" description="请先生成 1 篇文章，系统会自动完成质量检查并在此展示结果。" /> : null}
            {selectedArticle && !selectedQuality && !contentGenerating ? <EmptyStep title="等待质量检查结果" description="文章已生成，正在等待质量检查结果回写；若长时间无结果，可点击「重新检查」。" /> : null}
            {contentGenerating ? (
              <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-50">
                {batchGeneratingAll && batchProgress
                  ? `正在批量生成：第 ${batchProgress.current} / ${batchProgress.total} 篇（串行执行生成与质量检查）…`
                  : "正在生成正文并执行 质量检查…"}
              </div>
            ) : null}
            {selectedQuality ? <div className="mt-4 space-y-4">
              <div className={`rounded-3xl border p-5 ${reviewBlocked ? "border-amber-300/20 bg-amber-400/10 text-amber-50" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-50"}`}>
                <p className="text-sm text-cyan-100">质量总分</p>
                <p className="mt-2 text-4xl font-semibold text-white">{selectedQuality.totalScore}</p>
                <p className="mt-3 text-sm leading-6">
                  {qualityBlocked
                    ? "需要修改，必须修改后才能发布（合规类问题）。"
                    : (selectedQuality.totalScore ?? 0) >= GEO_ARTICLE_MIN_PASS_SCORE || selectedArticle?.status === "质检通过"
                      ? "质量通过，可发布。"
                      : "建议修订后发布，也可直接发布。"}
                  下一步：进入发布记录进行人工确认发布。
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard title="诊断缺口匹配度" value={String(selectedQuality.problemMatchScore ?? "未记录")} desc="检查正文是否回应 内容诊断中的内容缺口和客户问题。" />
                <InfoCard title="企业资料引用完整度" value={String(selectedQuality.evidenceScore ?? "未记录")} desc="检查是否引用企业资料来源、事实依据和可公开证据。" />
                <InfoCard title="事实一致性" value={String(asRecord(selectedArticle?.consistencyCheck).score ?? "未记录")} desc={textValue(asRecord(selectedArticle?.consistencyCheck).summary, "检查是否存在事实、案例、承诺或合规冲突。")} />
                <InfoCard title="品牌实体强化" value={markdownReflectsProfileEntity(asRecord(assetSummary?.profile), selectedArticle?.markdownContent) ? "通过" : "待加强"} desc="检查是否包含品牌/企业名称、产品服务、目标客户等档案信息（含新字段 brandName、oneLiner 等）。" />
                <InfoCard title="结构化程度" value={String(selectedQuality.structureScore ?? "未记录")} desc="检查摘要、FAQ、对比、结论、行动引导等结构是否清晰。" />
                <InfoCard title="AI 可引用性" value={String(selectedQuality.geoCitableScore ?? "未记录")} desc="检查是否包含 AI 可引用片段、实体信息和明确回答。" />
                <InfoCard title="内容重复风险" value={duplicateRiskLabel(antiDuplication.similarityRisk)} desc="与同任务或历史文章的标题、结构重复程度。" />
                <InfoCard title="平台适配性" value={String(selectedQuality.complianceScore ?? "未记录")} desc={`目标平台：${cyclePick(contentPlan.targetPlatforms, 0, "未选择目标平台")}。检查基础格式和合规边界。`} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-300">
                  <h3 className="font-semibold text-white">阻断原因（仅合规）</h3>
                  {qualityBlocked && stringList(selectedQuality.blockReasons).length > 0 ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5">{stringList(selectedQuality.blockReasons).map((reason, index) => <li key={index}>{reason}</li>)}</ul>
                  ) : (
                    <p className="mt-3 text-emerald-100">未发现合规类阻断。</p>
                  )}
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-300">
                  <h3 className="font-semibold text-white">发布前可优化的建议（非必须）</h3>
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                  {stringList((selectedQuality as any).optimizationSuggestions ?? []).map((suggestion, index) => <li key={`s-${index}`}>{suggestion}</li>)}
                    {stringList(consistencyCheck.suggestions).map((suggestion, index) => <li key={`c-${index}`}>{suggestion}</li>)}
                    {antiDuplication.blocked ? <li>与历史内容高度重复，建议调整标题或差异化角度后再发布。</li> : null}
                    <li>{antiDuplication.rewriteSuggestion}</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-slate-300">
                <h3 className="font-semibold text-white">与历史文章差异度</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <p>标题是否重复：{antiDuplication.titleRepeated ? "是" : "否"}</p>
                  <p>选题是否重复：{antiDuplication.topicRepeated ? "是" : "否"}</p>
                  <p>内容结构是否重复：{antiDuplication.structureRepeated ? "是" : "否"}</p>
                  <p>核心观点是否重复：{antiDuplication.viewpointRepeated ? "是" : "否"}</p>
                  <p>同一优化任务下是否连续相似：{antiDuplication.sameTaskRepeated ? "是" : "否"}</p>
                  <p>同周是否重复覆盖同一问题：{antiDuplication.sameWeekRepeated ? "是" : "否"}</p>
                </div>
                <p className="mt-3 text-cyan-100">内容重复风险：{duplicateRiskStatus(antiDuplication.similarityRisk)}（轻量规则，不作为合规阻断）。</p>
                <p className="mt-2">差异化角度建议：{antiDuplication.differentiationAngle}</p>
                {antiDuplication.similarArticles.length > 0 ? <div className="mt-3"><p className="font-medium text-white">相似历史文章</p><ul className="mt-2 list-disc space-y-1 pl-5">{antiDuplication.similarArticles.map(item => <li key={item.id}>{item.title}</li>)}</ul></div> : <p className="mt-3 text-emerald-100">未发现明显相似历史文章。</p>}
                <p className="mt-3 text-amber-100">差异度结果当前为轻量规则计算，未写入数据库；不是复杂语义向量相似度。</p>
              </div>
            </div> : null}
          </section>

          {reviewPassed ? <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">内容已完成生成和 质量检查（达到参考分或已通过）。下一步：进入发布记录，连接内容发布渠道，并进行人工确认发布。</div> : reviewComplete && selectedQuality && !qualityBlocked ? <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">内容已生成；当前为「建议修订后发布，也可直接发布」。可按下方建议优化，或进入发布记录人工复核。</div> : reviewComplete && qualityBlocked ? <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">需要修改：请先处理合规类问题后再继续发布流程。</div> : contentComplete ? <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">内容已生成。系统正在或即将完成质量检查，请稍候查看结果。</div> : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={() => setLocation("/content-publishing")} disabled={!reviewComplete} variant="outline" className="border-white/15 text-cyan-100 hover:bg-white/10">进入发布记录</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 外层持有项目选择状态；内层按 selectedProjectId 为 key 重挂载，避免跨项目本地状态与 Fiber 不一致 */
export function ContentGenerationFlowPage() {
  const selection = useProjectSelection();
  return <ContentGenerationFlowInner key={String(selection.selectedProjectId ?? "none")} selection={selection} />;
}

export function ContentPublishingFlowPage() {
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const createManualPublishRecord = trpc.geo.articles.createManualPublishRecord.useMutation();
  const updateManualPublishRecord = trpc.geo.articles.updateManualPublishRecord.useMutation();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [newArticleId, setNewArticleId] = useState<number | "">("");
  const [platformSelected, setPlatformSelected] = useState<Record<PublishRecordUiPlatform, boolean>>(() =>
    Object.fromEntries(publishRecordUiPlatforms.map(p => [p, false])) as Record<PublishRecordUiPlatform, boolean>,
  );
  const [linkByPlatform, setLinkByPlatform] = useState<Record<PublishRecordUiPlatform, string>>(() =>
    Object.fromEntries(publishRecordUiPlatforms.map(p => [p, ""])) as Record<PublishRecordUiPlatform, string>,
  );
  const [publishedAtForm, setPublishedAtForm] = useState(defaultManualPublishedAt());
  const [linkDraftById, setLinkDraftById] = useState<Record<number, string>>({});
  const [savingNew, setSavingNew] = useState(false);
  const [savingRowId, setSavingRowId] = useState<number | null>(null);

  const articles = (articlesQuery.data ?? []) as ArticleLike[];
  const qualityScores = (scoresQuery.data ?? []) as QualityScoreLike[];
  const publishRecords = (publishRecordsQuery.data ?? []) as PublishRecordLike[];
  const publishRecordArticleMap = new Map(articles.map(a => [a.id, a]));
  const publishableArticles = articles.filter(a => isQualityPassed(articleLatestQuality(a.id, qualityScores)));

  useEffect(() => {
    setLinkDraftById(prev => {
      const next = { ...prev };
      for (const r of publishRecords) {
        const url = (r.publishUrl || r.publicUrl || "").trim();
        if (next[r.id] === undefined) next[r.id] = url;
      }
      return next;
    });
  }, [publishRecords]);

  useEffect(() => {
    if (publishableArticles.length === 0) {
      setNewArticleId("");
      return;
    }
    const current = typeof newArticleId === "number" ? newArticleId : undefined;
    if (current == null || !publishableArticles.some(a => a.id === current)) {
      setNewArticleId(publishableArticles[0].id);
    }
  }, [publishableArticles, newArticleId]);

  type ManualPublishPlatformPayload =
    | typeof OWN_SITE_PLATFORM_API
    | "微信公众号"
    | "知乎"
    | "百家号"
    | "头条号"
    | "小红书"
    | "搜狐号"
    | "网易号"
    | "CSDN / 掘金";

  async function handleSaveNewRecords() {
    if (!selectedProjectId) {
      setError("请先选择项目。");
      return;
    }
    const articleId = typeof newArticleId === "number" ? newArticleId : undefined;
    if (!articleId) {
      setError("请选择一篇文章。");
      return;
    }
    const article = articles.find(a => a.id === articleId);
    if (!article || !isQualityPassed(articleLatestQuality(articleId, qualityScores))) {
      setError("仅可选择已通过质量检查的文章。");
      return;
    }
    const platforms = publishRecordUiPlatforms.filter(p => platformSelected[p]);
    if (platforms.length === 0) {
      setError("请至少选择一个发布平台。");
      return;
    }
    setError(undefined);
    setMessage(undefined);
    setSavingNew(true);
    try {
      const publishTitle = article.title?.trim() || "发布记录";
      for (const platform of platforms) {
        const url = linkByPlatform[platform].trim();
        const publishStatus: ManualPublishStatus = url ? "link_backfilled" : "pending_human_publish";
        await createManualPublishRecord.mutateAsync({
          projectId: selectedProjectId,
          articleId,
          publishPlatform: platform as ManualPublishPlatformPayload,
          publishTitle,
          publishUrl: url,
          publishedAt: publishedAtForm,
          publishStatus,
          notes: "",
        });
      }
      await utils.geo.articles.publishRecords.invalidate({ projectId: selectedProjectId });
      await publishRecordsQuery.refetch();
      setMessage(`已保存 ${platforms.length} 条发布记录。`);
      setPlatformSelected(Object.fromEntries(publishRecordUiPlatforms.map(p => [p, false])) as Record<PublishRecordUiPlatform, boolean>);
      setLinkByPlatform(Object.fromEntries(publishRecordUiPlatforms.map(p => [p, ""])) as Record<PublishRecordUiPlatform, string>);
      setPublishedAtForm(defaultManualPublishedAt());
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingNew(false);
    }
  }

  async function handleSaveRowLink(record: PublishRecordLike) {
    if (!selectedProjectId || !record.articleId) return;
    const article = publishRecordArticleMap.get(record.articleId);
    const channelRaw = (record.publishChannel || "").trim();
    if (!channelRaw) {
      setError("该记录缺少平台信息，无法更新链接。");
      return;
    }
    const channel = channelRaw as ManualPublishPlatformPayload;
    const draft = (linkDraftById[record.id] ?? "").trim();
    const publishStatus: ManualPublishStatus = draft ? "link_backfilled" : (record.publishStatus as ManualPublishStatus) || "pending_human_publish";
    setSavingRowId(record.id);
    setError(undefined);
    setMessage(undefined);
    try {
      await updateManualPublishRecord.mutateAsync({
        id: record.id,
        projectId: selectedProjectId,
        articleId: record.articleId,
        publishPlatform: channel,
        publishTitle: (record.publishTitle || article?.title || "").trim() || "发布记录",
        publishUrl: draft,
        publishedAt: toDatetimeLocalInput(record.publishedAt),
        publishStatus,
        notes: publishRecordNoticeText(record.notes),
      });
      await utils.geo.articles.publishRecords.invalidate({ projectId: selectedProjectId });
      await publishRecordsQuery.refetch();
      setMessage("链接已更新。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新链接失败");
    } finally {
      setSavingRowId(null);
    }
  }

  const loading = articlesQuery.isLoading || scoresQuery.isLoading || publishRecordsQuery.isLoading;

  return (
    <div className="space-y-6 text-slate-100">
      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader>
          <CardTitle className="text-white">发布记录</CardTitle>
          <CardDescription className="text-cyan-200">登记已发布到外部平台的文章与公开链接。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} />
          <ActionState message={message} error={error || articlesQuery.error?.message || scoresQuery.error?.message || publishRecordsQuery.error?.message} />
          {loading ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">正在加载文章与发布记录…</div> : null}
          {projects.length === 0 ? <EmptyStep title="暂无项目" description="请先在企业档案中创建项目。" /> : null}

          <section className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
            <h2 className="text-lg font-semibold text-white">新建发布记录</h2>
            {publishableArticles.length === 0 ? (
              <div className="mt-4">
                <EmptyStep title="暂无可选文章" description={`请先在内容生产完成质量检查，且总分不低于 ${GEO_ARTICLE_MIN_PASS_SCORE} 分后再登记发布。`} />
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                <label className="block space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-slate-100">选择文章</span>
                  <select
                    value={newArticleId === "" ? "" : String(newArticleId)}
                    onChange={event => setNewArticleId(event.target.value ? Number(event.target.value) : "")}
                    className="h-10 w-full max-w-2xl rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    {publishableArticles.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-slate-100">选择平台（多选）</span>
                  <div className="flex flex-wrap gap-4 pt-1">
                    {publishRecordUiPlatforms.map(p => (
                      <label key={p} className="flex cursor-pointer items-center gap-2 text-slate-200">
                        <input
                          type="checkbox"
                          checked={platformSelected[p]}
                          onChange={e => setPlatformSelected(s => ({ ...s, [p]: e.target.checked }))}
                          className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400"
                        />
                        <span>{p}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {publishRecordUiPlatforms.map(p =>
                    platformSelected[p] ? (
                      <label key={p} className="space-y-2 text-sm text-slate-300">
                        <span className="font-medium text-slate-100">{p} 发布链接</span>
                        <input
                          value={linkByPlatform[p]}
                          onChange={e => setLinkByPlatform(s => ({ ...s, [p]: e.target.value }))}
                          placeholder="https://"
                          className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                        />
                      </label>
                    ) : null,
                  )}
                </div>
                <label className="block max-w-md space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-slate-100">发布时间</span>
                  <input
                    type="datetime-local"
                    value={publishedAtForm}
                    onChange={e => setPublishedAtForm(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  />
                </label>
                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleSaveNewRecords()}
                    disabled={!selectedProjectId || savingNew || publishRecordUiPlatforms.every(p => !platformSelected[p])}
                    className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  >
                    {savingNew ? "保存中…" : "保存"}
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
            <h2 className="text-lg font-semibold text-white">已发布记录列表</h2>
            {publishRecords.length === 0 ? (
              <div className="mt-4">
                <EmptyStep title="暂无发布记录" description="在上方新建发布记录后，将在此列表展示。" />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm text-slate-200">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-3 pr-4 font-medium">文章标题</th>
                      <th className="py-3 pr-4 font-medium">平台</th>
                      <th className="py-3 pr-4 font-medium">发布时间</th>
                      <th className="py-3 pr-4 font-medium">链接</th>
                      <th className="py-3 font-medium w-28">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publishRecords.map(record => {
                      const article = record.articleId ? publishRecordArticleMap.get(record.articleId) : undefined;
                      const title = article?.title || record.publishTitle || "—";
                      return (
                        <tr key={record.id} className="border-b border-white/5 align-top">
                          <td className="py-3 pr-4 font-medium text-white">{title}</td>
                          <td className="py-3 pr-4">{record.publishChannel || "—"}</td>
                          <td className="py-3 pr-4 whitespace-nowrap">{formatTime(record.publishedAt)}</td>
                          <td className="py-3 pr-4">
                            <input
                              value={linkDraftById[record.id] ?? ""}
                              onChange={e => setLinkDraftById(d => ({ ...d, [record.id]: e.target.value }))}
                              placeholder="https://"
                              className="w-full min-w-[12rem] rounded-lg border border-white/10 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                            />
                          </td>
                          <td className="py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/15 text-cyan-100 hover:bg-white/10"
                              disabled={savingRowId === record.id}
                              onClick={() => void handleSaveRowLink(record)}
                            >
                              {savingRowId === record.id ? "保存中" : "保存链接"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

export function InclusionMonitoringFlowPage() {
  const [, setLocation] = useLocation();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(projectInput, { enabled });
  const records = (monitoringQuery.data ?? []) as MonitoringRecordLike[];

  return (
    <div className="space-y-6 text-slate-100">
      <GeoStatusGuide stage="收录监测" completion={records.length > 0 ? 90 : 62} nextAction="生成客户报告" why="收录监测页只展示已发布内容监测卡片，记录收录、AI 提及、AI 推荐、最近检测时间和当前建议。" risk="监测结果来自有限样本，不代表全网绝对排名。" ctaLabel="生成客户报告" ctaPath="/delivery-reports" />
      <Card className="border-white/10 bg-white/[0.04] text-slate-100"><CardHeader><CardTitle className="text-white">收录监测</CardTitle><CardDescription className="text-cyan-200">已发布内容监测卡片。</CardDescription></CardHeader><CardContent className="space-y-5"><ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} />{records.length === 0 ? <EmptyStep title="暂无收录监测记录" description="请先完成内容发布，发布成功后会自动创建未检测监测记录。" /> : <div className="grid gap-4 lg:grid-cols-2">{records.map(record => <div key={record.id} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-white">文章 ID：{record.articleId}</p><a className="mt-2 inline-block text-sm text-cyan-200 underline" href={toAbsoluteUrl(record.publicUrl)} target="_blank" rel="noreferrer">公开链接：{toAbsoluteUrl(record.publicUrl)}</a><p className="mt-2 text-sm text-slate-400">最近检测时间：{formatTime(record.lastCheckedAt) === "未记录" ? "未检测" : formatTime(record.lastCheckedAt)}</p></div><RadioTower className="h-5 w-5 text-cyan-200" /></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><InfoCard title="收录状态" desc={record.inclusionStatus || "未检测"} /><InfoCard title="AI 提及状态" desc={record.aiMentionStatus || "未检测"} /><InfoCard title="AI 推荐状态" desc={record.aiRecommendStatus || "未检测"} /></div><p className="mt-4 text-sm text-amber-100">当前建议：{record.currentSuggestion ?? "保持监测并更新客户报告。"}</p></div>)}</div>}<div className="flex justify-end"><Button onClick={() => setLocation("/delivery-reports")} disabled={records.length === 0} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">进入交付报告</Button></div></CardContent></Card>
    </div>
  );
}

export function DeliveryReportsFlowPage() {
  const [, setLocation] = useLocation();
  const { projects, selectedProjectId, setSelectedProjectId, projectInput, enabled } = useProjectSelection();
  const [showAllDiagnoses, setShowAllDiagnoses] = useState(false);

  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const qualityScoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const contentPlanQuery = trpc.geo.contentPlans.latest.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });

  const score = scoreQuery.data as Record<string, unknown> | null | undefined;
  const analyses = (analysisQuery.data ?? []) as any[];
  const tasks = (tasksQuery.data ?? []) as any[];
  const articles = (articlesQuery.data ?? []) as any[];
  const qualityScores = (qualityScoresQuery.data ?? []) as any[];
  const contentPlan = contentPlanQuery.data as any;
  const publishRecords = (publishRecordsQuery.data ?? []) as any[];

  const latestScoreByArticleId = useMemo(() => {
    const m = new Map<number, any>();
    for (const q of qualityScores) {
      const aid = q.articleId;
      if (typeof aid !== "number" || m.has(aid)) continue;
      m.set(aid, q);
    }
    return m;
  }, [qualityScores]);

  const totalScore = typeof score?.totalScore === "number" ? score.totalScore : typeof score?.total_score === "number" ? (score.total_score as number) : null;
  const aiVisibilityScore =
    typeof score?.aiVisibilityScore === "number"
      ? score.aiVisibilityScore
      : typeof score?.ai_visibility_score === "number"
        ? (score.ai_visibility_score as number)
        : null;
  const aiRecommendationScore =
    typeof score?.aiRecommendationScore === "number"
      ? score.aiRecommendationScore
      : typeof score?.ai_recommendation_score === "number"
        ? (score.ai_recommendation_score as number)
        : null;
  const firstAnalysis = analyses[0];
  const contentGapPrimary = (firstAnalysis?.contentGap ?? firstAnalysis?.content_gap ?? "") as string;
  const notRecommendedPrimary = (firstAnalysis?.notRecommendedReason ?? firstAnalysis?.not_recommended_reason ?? "") as string;
  const maxProblemLine = [notRecommendedPrimary, contentGapPrimary].map(s => (typeof s === "string" ? s.trim() : "")).filter(Boolean)[0] || "暂无诊断结论，请先在 内容诊断页完成一轮诊断。";
  const conclusionLine = totalScore != null && firstAnalysis
    ? `本轮 内容综合评分 ${totalScore} 分；在典型 AI 问答场景下，企业被提及与推荐的表现存在结构性差距，需用可引用内容资产补齐证据链。`
    : totalScore != null
      ? `本轮 内容综合评分 ${totalScore} 分；建议继续完善诊断样本并同步内容生产与发布记录。`
      : "请先完成 内容诊断与评分，以便生成本轮面向客户的结论摘要。";
  const nextActionLine =
    tasks.length > 0
      ? `优先完成 ${tasks.filter((t: any) => t.priority === "P0").length > 0 ? "P0" : "高优先级"} 优化任务对应的内容生产与质量检查，再登记发布链接。`
      : publishRecords.length === 0 && articles.length > 0
        ? "内容已生成，请尽快完成质量检查与发布登记，把可公开链接写入交付证据。"
        : "建议先在 内容诊断页生成优化任务，并在内容生产页落地成稿。";

  const visibleAnalyses = showAllDiagnoses ? analyses : analyses.slice(0, 3);
  const planName = contentPlan?.planName ?? contentPlan?.plan?.planName;
  const planStart = contentPlan?.startDate ?? contentPlan?.plan?.weekStartDate;
  const planPlatforms = (contentPlan?.targetPlatforms ?? contentPlan?.plan?.targetPlatforms) as string[] | undefined;
  const planTypes = (contentPlan?.contentTypes ?? contentPlan?.plan?.contentTypes) as string[] | undefined;
  const hasPlan = Boolean(contentPlan?.plan ?? planName);

  const articleTitleById = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of articles) {
      if (typeof a.id === "number" && a.title) m.set(a.id, String(a.title));
    }
    return m;
  }, [articles]);

  return (
    <div className="space-y-8 pb-10 text-slate-100">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-white">本轮内容效果报告</h1>
        <p className="text-sm text-slate-400">本轮内容诊断与生成的完整成果</p>
        <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} />
      </div>

      {/* 老板版摘要：交付页首屏核心 */}
      <Card className="border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-slate-950/40 to-slate-950/80 shadow-lg shadow-cyan-900/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl text-white">本轮交付摘要</CardTitle>
          <CardDescription className="text-cyan-100/90">给决策层的一页结论</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!selectedProjectId ? (
            <p className="text-sm text-slate-400">请选择项目后查看交付摘要。</p>
          ) : (
            <>
              <p className="text-base leading-relaxed text-slate-100">{conclusionLine}</p>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-center lg:text-left">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">内容覆盖</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-left">
                    <div>
                      <p className="text-[10px] text-slate-500">AI 提及分</p>
                      <p className="text-lg font-semibold text-cyan-200">{aiVisibilityScore != null ? `${aiVisibilityScore} 分` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">AI 推荐分</p>
                      <p className="text-lg font-semibold text-cyan-200">{aiRecommendationScore != null ? `${aiRecommendationScore} 分` : "—"}</p>
                    </div>
                  </div>
                  {totalScore != null ? (
                    <p className="mt-2 text-center text-[11px] text-slate-500 lg:text-left">综合评分 {totalScore} 分</p>
                  ) : (
                    <p className="mt-2 text-center text-[11px] text-slate-500 lg:text-left">综合评分 —</p>
                  )}
                  <p className="mt-2 text-center text-[11px] leading-snug text-slate-500 lg:text-left">内容覆盖评分（满分100），含提及率与推荐率加权</p>
                </div>
                {[
                  { label: "已生成内容", value: `${articles.length} 篇` },
                  { label: "已发布", value: `${publishRecords.length} 篇` },
                  { label: "优化任务", value: `${tasks.length} 个` },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-center">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-cyan-200">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-xs font-medium text-amber-200/90">当前最大问题</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">{maxProblemLine}</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-xs font-medium text-emerald-200/90">下一步最重要动作</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">{nextActionLine}</p>
                </div>
              </div>
              {hasPlan ? (
                <p className="text-xs leading-relaxed text-slate-400">
                  <span className="text-slate-500">内容计划摘要：</span>
                  {planName ?? "未命名计划"}
                  {planStart ? ` · 周期起 ${planStart}` : ""}
                  {planPlatforms?.length ? ` · 平台 ${planPlatforms.join("、")}` : ""}
                  {planTypes?.length ? ` · 类型 ${planTypes.join("、")}` : ""}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* 第一区：内容诊断结果 */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-2">
          <h2 className="text-lg font-semibold text-white">内容诊断结果</h2>
          <span className="text-xs text-slate-500">{analyses.length} 条</span>
        </div>
        {analyses.length === 0 ? (
          <p className="text-sm text-slate-400">暂无诊断数据。请先在 内容诊断页运行诊断。</p>
        ) : (
          <div className="space-y-3">
            {visibleAnalyses.map((a: any, i: number) => {
              const detail = diagnosisJson(a) as Record<string, unknown>;
              const v12 = diagnosisV12DisplayFields(detail);
              const topName = typeof detail.topCompetitorName === "string" ? detail.topCompetitorName.trim() : "";
              const topReason = typeof detail.topCompetitorReason === "string" ? detail.topCompetitorReason.trim() : "";
              const strong = typeof detail.strongestCompetitor === "string" ? detail.strongestCompetitor.trim() : "";
              const competitorLine =
                topName && topReason
                  ? `${topName}：${topReason}`
                  : strong || topName || (Array.isArray(a.recommendedCompetitors ?? a.recommended_competitors) ? (a.recommendedCompetitors ?? a.recommended_competitors).join("、") : "—");
              const mentionYes = triBoolYes(a.mentionsEnterprise ?? a.mentions_enterprise);
              const recommendYes = triBoolYes(a.recommendsEnterprise ?? a.recommends_enterprise);
              const gapText = (a.contentGap ?? a.content_gap ?? "") as string;
              const thesisLine = v12.coreTheses.length ? v12.coreTheses.join("；") : "—";
              return (
                <Card key={a.id ?? i} className="border-white/10 bg-white/[0.04]">
                  <CardContent className="space-y-3 pt-5">
                    <p className="text-sm font-semibold leading-snug text-white">{a.questionText ?? a.question_text ?? a.question ?? "—"}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={mentionYes ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-200" : "border-rose-500/50 bg-rose-950/60 text-rose-100"} variant="outline">
                        提及：{mentionYes ? "是" : "否"}
                      </Badge>
                      <Badge className={recommendYes ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-200" : "border-rose-500/50 bg-rose-950/60 text-rose-100"} variant="outline">
                        推荐：{recommendYes ? "是" : "否"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400">
                      易被 AI 优先引用：<span className="text-slate-200">{competitorLine}</span>
                    </p>
                    {v12.suggestedTitle ? (
                      <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2">
                        <p className="text-[11px] text-violet-200/80">建议标题</p>
                        <p className="text-sm font-semibold text-violet-50">《{v12.suggestedTitle}》</p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                      {v12.recommendedPlatforms.length ? (
                        v12.recommendedPlatforms.map((p: string) => (
                          <Badge key={p} variant="outline" className="border-cyan-500/40 bg-cyan-950/40 text-cyan-100">
                            {p}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">推荐平台：—</span>
                      )}
                    </div>
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">
                        <ChevronDown className="h-3.5 w-3.5" />
                        展开详情（内容缺口 / 核心论点）
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-2 rounded-lg border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
                        <p>
                          <span className="text-slate-500">内容缺口：</span>
                          {gapText?.trim() || "—"}
                        </p>
                        <p>
                          <span className="text-slate-500">核心论点：</span>
                          {thesisLine}
                        </p>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              );
            })}
            {analyses.length > 3 ? (
              <Button type="button" variant="ghost" className="w-full text-cyan-300 hover:bg-white/5 hover:text-cyan-200" onClick={() => setShowAllDiagnoses(v => !v)}>
                {showAllDiagnoses ? "收起" : `展开全部 ${analyses.length} 条`}
              </Button>
            ) : null}
          </div>
        )}
      </section>

      {/* 第二区：优化任务 */}
      <section className="space-y-3">
        <h2 className="border-b border-white/10 pb-2 text-lg font-semibold text-white">优化任务清单</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-400">暂无优化任务。</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tasks.map((t: any, i: number) => {
              const card = parseGeoTaskCard(t.executionSuggestion ?? t.execution_suggestion);
              const titleLine = card?.articleTitle ? `《${card.articleTitle}》` : "—";
              const kws = card?.targetKeywords?.slice(0, 3) ?? [];
              const platforms = card?.recommendedPlatform ?? [];
              return (
                <Card key={t.id ?? i} className="border-white/10 bg-white/[0.04]">
                  <CardContent className="space-y-2 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white" title={t.taskName ?? ""}>
                        {t.taskName ?? "—"}
                      </p>
                      <Badge variant="outline" className={`shrink-0 ${priorityBadgeClass(t.priority)}`}>
                        {t.priority ?? "—"}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-cyan-100/90" title={card?.articleTitle}>
                      建议标题：{titleLine}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {kws.length ? (
                        kws.map((kw: string) => (
                          <Badge key={kw} variant="outline" className="border-slate-600/60 bg-slate-900/80 text-slate-200">
                            {kw}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">目标关键词：—</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {platforms.length ? (
                        platforms.map((p: string) => (
                          <Badge key={p} variant="outline" className="border-cyan-500/35 bg-cyan-950/35 text-cyan-100">
                            {p}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">推荐平台：—</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      状态：<span className="text-slate-200">{taskStatusLabelCn(t.status)}</span>
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* 第三区：已生成内容（表格） */}
      <section className="space-y-3">
        <h2 className="border-b border-white/10 pb-2 text-lg font-semibold text-white">已生成内容</h2>
        {articles.length === 0 ? (
          <p className="text-sm text-slate-400">暂无已生成内容。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/80 text-xs text-slate-400">
                  <th className="px-3 py-2 font-medium">文章标题</th>
                  <th className="px-3 py-2 font-medium">目标平台</th>
                  <th className="px-3 py-2 font-medium">内容类型</th>
                  <th className="px-3 py-2 font-medium">质量评分</th>
                  <th className="px-3 py-2 font-medium">是否通过</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a: any) => {
                  const q = latestScoreByArticleId.get(a.id);
                  const num = typeof q?.totalScore === "number" ? q.totalScore : null;
                  const reasons = Array.isArray(q?.blockReasons) ? (q.blockReasons as string[]) : [];
                  const complianceBlock = reasons.some(r => /禁用词|禁止承诺|合规/.test(r));
                  const pass = typeof q?.isPass === "boolean" ? q.isPass : num != null && num >= 60 && !complianceBlock;
                  return (
                    <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="max-w-[220px] px-3 py-2 align-top text-slate-100">
                        <span className="line-clamp-2">{a.title ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-300">{a.targetPlatform ?? a.platform ?? "—"}</td>
                      <td className="px-3 py-2 align-top text-slate-300">{a.contentType ?? a.content_type ?? a.articleType ?? "—"}</td>
                      <td className={`px-3 py-2 align-top ${num != null ? qcScoreTextClass(num) : "text-slate-500"}`}>{num ?? "—"}</td>
                      <td className="px-3 py-2 align-top">
                        {q ? (
                          <Badge className={pass ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-200" : "border-rose-500/50 bg-rose-950/60 text-rose-100"} variant="outline">
                            {pass ? "通过" : "未通过"}
                          </Badge>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-300">{a.status ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 第四区：发布记录（表格） */}
      <section className="space-y-3">
        <h2 className="border-b border-white/10 pb-2 text-lg font-semibold text-white">发布记录</h2>
        {publishRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-center">
            <p className="text-sm text-slate-300">暂无发布记录，请前往发布记录页登记</p>
            <Button className="mt-4 bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={() => setLocation("/content-publishing")}>
              去发布记录页
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-slate-950/80 text-xs text-slate-400">
                  <th className="px-3 py-2 font-medium">文章标题</th>
                  <th className="px-3 py-2 font-medium">平台</th>
                  <th className="px-3 py-2 font-medium">发布时间</th>
                  <th className="px-3 py-2 font-medium">链接</th>
                </tr>
              </thead>
              <tbody>
                {publishRecords.map((r: any) => {
                  const title = articleTitleById.get(r.articleId) ?? r.publishTitle ?? r.title ?? "—";
                  const url = r.publishUrl ?? r.publicUrl ?? r.public_url;
                  const platform = r.publishChannel ?? r.platform ?? "—";
                  return (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="max-w-[200px] px-3 py-2 align-top text-slate-100">
                        <span className="line-clamp-2">{title}</span>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-300">{platform}</td>
                      <td className="px-3 py-2 align-top text-slate-400">{r.publishedAt ?? r.published_at ? formatTime(r.publishedAt ?? r.published_at) : "—"}</td>
                      <td className="px-3 py-2 align-top">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">
                            打开
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 第五区：下一步建议 */}
      <section className="space-y-3">
        <h2 className="border-b border-white/10 pb-2 text-lg font-semibold text-white">下一步建议</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
          <li>优先补齐诊断中标记的内容缺口，并落到可公开发布的结构化文章。</li>
          <li>对已生成内容完成质量检查与修订，确保无合规类阻断后再登记外链。</li>
          <li>在已选平台持续发布，用公开链接沉淀为下一轮复测样本。</li>
          <li>下一周期重跑 内容诊断与 内容评分，对比本轮基线变化。</li>
          <li>若竞品在 AI 回答中占位上升，及时更新企业档案与对比叙事。</li>
        </ol>
      </section>

      <p className="text-[11px] leading-relaxed text-slate-600">
        说明：样本量有限，不代表全网绝对排名；不承诺保证收录、排名或 AI 推荐；未确认事实与不可公开资料不得写入对外正式材料；发布结果以人工确认与平台审核为准。
      </p>

      <div className="flex justify-end border-t border-white/10 pt-4">
        <Button onClick={() => setLocation("/")} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
          返回总览
        </Button>
      </div>
    </div>
  );
}