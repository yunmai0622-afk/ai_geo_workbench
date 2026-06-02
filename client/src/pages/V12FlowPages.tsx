import { AiPageHeader } from "@/components/AiPageHeader";
import {
  AiActionCard,
  AiConsolePanel,
  AiGlassPanel,
  AiMetricCard,
  AiPageHero,
  AiPageShell,
  AiSection,
  AiStatusBadge,
  AiStepRail,
} from "@/components/ai/ProductUi";
import { DeliveryReportCustomerView } from "@/components/DeliveryReportCustomerView";
import { GeoStatusGuide } from "@/components/GeoStatusGuide";
import {
  buildPublishNextActions,
  computePlatformDistribution,
  computePublishOverview,
  formatMetricValue,
  publishStatusLabel,
  recordPublicLink,
  retestHintForRecord,
  type PublishRecordForDisplay,
} from "@/lib/assetProgressDisplay";
import { BusinessPageProjectHeader } from "@/components/BusinessPageProjectHeader";
import { RetestDueReminderCard } from "@/components/diagnosis/RetestDueReminderCard";
import { RetestPlanPanel } from "@/components/diagnosis/RetestPlanPanel";
import { DangerousActionConfirmDialog } from "@/components/DangerousActionConfirmDialog";
import { FirstUseHintBanner } from "@/components/FirstUseHintBanner";
import { SubscriptionUpgradePrompt } from "@/components/SubscriptionUpgradePrompt";
import { useDangerousActionConfirm } from "@/hooks/useDangerousActionConfirm";
import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { useActiveProjectSelection, type ProjectOption } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { downloadT0ResultsCsv } from "@/lib/geoDataExportDownload";
import { FIRST_USE_HINT_KEYS } from "@/lib/firstUseHints";
import { aiChipActive, aiChipIdle, aiDataTable, aiGlassPanel, aiInput, aiInternalZone, aiListRow, aiMetricCard, aiSubPanel } from "@/lib/aiProductUi";
import {
  buildDeliveryReportConclusionLine,
  mapPublishRecordsToItems,
  resolveDeliveryReportVisibilityScore,
} from "@/lib/deliveryReportDisplay";
import { AiTaskProgressCard } from "@/components/geo/AiTaskProgressCard";
import { useAiTaskStagedProgress } from "@/hooks/useAiTaskStagedProgress";
import { mapGeoDiagnosisErrorCategory } from "@/lib/aiTaskProgressErrors";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TRPCClientError } from "@trpc/client";
import {
  AI_DIAGNOSIS_PROGRESS_HINT_30S,
  AI_DIAGNOSIS_PROGRESS_HINT_60S,
  AI_DIAGNOSIS_PROGRESS_STAGES,
  type AiTaskProgressErrorCategory,
} from "@shared/aiTaskProgress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { handleSubscriptionLimitMutationError } from "@/lib/subscriptionUpgrade";
import { trpc } from "@/lib/trpc";
import {
  isSubscriptionLimitMessage,
  SUBSCRIPTION_LIMIT_CONTENT_MESSAGE,
} from "@shared/subscriptionLimits";
import { publishTaskStatusCustomerLabel } from "@shared/publishTaskErrors";
import {
  aggregateAiTestEvidence,
  buildEvidenceDetailPath,
  isAiTestMissReason,
  missReasonLabelCn,
  sentimentLabelCn,
  type AiTestStage,
} from "@shared/aiTestEvidence";
import { publishLinkAccessLabel } from "@shared/inclusionMonitoringDisplay";
import {
  buildT0DiagnosisResultsDisplay,
  computeT0QuestionProgress,
  formatT0Rate,
  T0_AI_ENGINE_OPTIONS,
  T0_DEFAULT_PLATFORMS,
} from "@shared/t0DiagnosisDisplay";
import { buildT0DiagnosisVisualization } from "@shared/t0DiagnosisVisualization";
import { T0DiagnosisVisualizationPanel } from "@/components/diagnosis/T0DiagnosisVisualizationPanel";
import {
  diagnosisMentionRateHint,
  diagnosisRecommendRateHint,
  formatAiDiagnosisDateTime,
  resolveAiDiagnosisLastTestLabel,
} from "@shared/aiDiagnosisResultDisplay";

const MONITORING_TEST_STAGE_OPTIONS: { value: AiTestStage; label: string }[] = [
  { value: "manual_check", label: "人工复测" },
  { value: "before_publish", label: "发布前测试" },
  { value: "after_publish", label: "发布后复测" },
];

const MONITORING_TEST_STAGE_DONE_LABEL: Record<AiTestStage, string> = {
  manual_check: "人工复测",
  before_publish: "发布前测试",
  after_publish: "发布后复测",
};
type T0PlatformSelectable = string;
import { GEO_ARTICLE_MIN_PASS_SCORE } from "@shared/const";
import { DANGEROUS_ACTION_LABELS } from "@shared/dangerousActionConfirm";
import { classifyGeoDiagnosisLlmError } from "@shared/geoDiagnosisLlmErrors";
import { toPlatformContentGenerationError } from "@shared/platformContentGenerationErrors";
import {
  toUserFacingError,
  toUserFacingErrorFromUnknown,
  toUserFacingQueryError,
} from "@shared/userFacingErrors";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Brain, ChevronDown, FileBarChart2, FileText, HelpCircle, RadioTower, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

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

type PublishRecordMonitoringLike = {
  id: number;
  aiMentionStatus: string;
  aiRecommendStatus?: string | null;
  inclusionStatus?: string | null;
  lastAiTestedAt?: Date | string | null;
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
  monitoring?: PublishRecordMonitoringLike | null;
};

type ManualPublishStatus = "pending_human_publish" | "published" | "publish_failed" | "manual_publish_needed" | "link_backfilled";

type AiTestResultLike = {
  engine: string;
  engineName?: string;
  question: string;
  answer?: string;
  mentionsBrand: boolean;
  recommendsBrand: boolean;
  recommendationRank?: number | null;
  testedAt?: string;
  mentionedBrand?: boolean;
  recommendedBrand?: boolean;
  citedUrls?: string[];
  sentiment?: "positive" | "neutral" | "negative";
  missReason?: string;
};

type MonitoringRecordLike = {
  id: number;
  articleId: number;
  publishRecordId: number;
  publicUrl: string;
  inclusionStatus: string;
  aiMentionStatus: string;
  aiRecommendStatus: string;
  lastCheckedAt?: Date | string | null;
  lastAiTestedAt?: Date | string | null;
  currentSuggestion?: string | null;
  aiTestResults?: AiTestResultLike[] | null;
  articleTitle?: string | null;
  linkedDetectionQuestion?: string | null;
  gapLinkDisplay?: string | null;
  questionMentionRateChange?: {
    summaryLine: string;
    hasData: boolean;
  } | null;
  linkAccess?: {
    accessible: boolean;
    checkedAt: string;
    statusCode?: number | null;
    errorMessage?: string | null;
  } | null;
  nextAction?: string | null;
};

type ReportLike = {
  id: number;
  totalScore: number;
  oneSentenceConclusion: string;
  markdownContent: string;
  createdAt?: Date | string | null;
};

function useProjectSelection() {
  return useActiveProjectSelection();
}

function requireValidProjectId(selectedProjectId: number | undefined): number {
  const pid = selectedProjectId;
  if (pid == null || !Number.isFinite(pid) || pid <= 0) {
    throw new Error("项目未选择");
  }
  return pid;
}

function InfoCard({ title, desc, value }: { title: string; desc: string; value?: string }) {
  return (
    <div className="ai-metric-card text-gray-900">
      <p className="text-xs font-medium uppercase tracking-wide text-blue-600/80">{title}</p>
      {value ? <p className="ai-metric-value mt-2 text-white">{value}</p> : null}
      <p className="mt-2 text-sm leading-6 text-gray-400">{desc}</p>
    </div>
  );
}

function EmptyStep({ title, description }: { title: string; description: string }) {
  return (
    <div className="ai-glass-panel border border-dashed border-gray-200 p-6 text-sm leading-6 text-gray-600">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
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
  return { label: "待检查", reason: "缺少质量评分，暂不进入发布队列。", tone: "text-gray-600" };
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
  return "border-blue-300 bg-blue-50 text-blue-700";
}

function customerErrorMessage(value?: string) {
  if (!value) return undefined;
  const classified = classifyGeoDiagnosisLlmError(value);
  if (classified.code !== "NOT_LLM_ERROR") return classified.userMessage;
  if (/目标客户问题|指定问题/.test(value)) return "请先在下方点击「重新生成」，或手动添加「指定问题」类型问题，再运行诊断。";
  return toUserFacingError(
    value,
    "内容诊断暂时无法完成，可能是上游服务异常。请稍后重试，或联系交付人员查看服务状态。",
  );
}

function contentGenerationErrorMessage(value?: string) {
  if (!value) return undefined;
  if (isSubscriptionLimitMessage(value)) return value;
  return toPlatformContentGenerationError(value);
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

type DiagnosisAnalysisRow = {
  id: number;
  contentGap?: string | null;
  notRecommendedReason?: string | null;
  rawJson?: unknown;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

type DiagnosisQuestionRow = {
  id: number;
  questionText?: string | null;
  targetKeyword?: string | null;
};

function countDiagnosisGaps(analyses: DiagnosisAnalysisRow[]): number {
  if (analyses.length === 0) return 0;
  const withGap = analyses.filter(row => {
    if (!row) return false;
    const gap = (row.contentGap ?? "").trim();
    const reason = (row.notRecommendedReason ?? "").trim();
    return gap.length > 0 || reason.length > 0;
  });
  return withGap.length > 0 ? withGap.length : analyses.length;
}

function buildDiagnosisHeadlineLine(
  score?: { totalScore?: number | null } | null,
  gapCount = 0,
): string {
  if (!score || typeof score.totalScore !== "number") {
    return "请先完成诊断流程，系统将在此给出可面向客户的一句话结论。";
  }
  if (score.totalScore >= 80) {
    return "品牌内容资产覆盖较好，AI 已能较稳定识别并推荐；建议持续补充竞品对比与案例证据，巩固推荐信号。";
  }
  if (score.totalScore >= 50) {
    return "当前品牌内容资产中等偏上，AI 能识别通用问题，但品牌推荐信号仍不够稳定，需补强缺口方向的内容。";
  }
  if (gapCount > 0) {
    return "当前品牌内容资产仍偏薄弱，AI 更容易识别通用问题，但尚未形成稳定的品牌推荐信号。";
  }
  return "当前品牌内容资产仍偏薄弱，建议优先补齐官网、FAQ 与案例类可引用内容。";
}

function topDiagnosisGapCards(analyses: DiagnosisAnalysisRow[], limit = 5) {
  const cards: { id: number; title: string; detail: string }[] = [];
  for (const item of analyses) {
    if (!item || typeof item?.id !== "number") continue;
    const detail = diagnosisJson(item) as Record<string, unknown>;
    const gapRaw = (item.contentGap ?? item.notRecommendedReason ?? "").trim();
    const gap = gapRaw || diagnosisText(item.notRecommendedReason, "");
    if (!gap || gap === "暂无。") continue;
    cards.push({
      id: item?.id,
      title: diagnosisText(detail.questionText, "内容缺口"),
      detail: gap.length > 140 ? `${gap.slice(0, 140)}…` : gap,
    });
    if (cards.length >= limit) break;
  }
  return cards;
}

const TARGET_QUESTION_PREVIEW_COUNT = 8;

function targetQuestionIntentLabel(intent: string, disadvantaged: boolean) {
  if (intent.trim()) return intent.trim();
  return disadvantaged ? "劣势场景" : "目标问题";
}

function buildTargetQuestionGenerateMessage(result: {
  count: number;
  newCount?: number;
  filteredCount?: number;
  hadPreviousQuestions?: boolean;
}) {
  const n = result.newCount ?? result.count;
  if ((result.filteredCount ?? 0) > 0) {
    return `已过滤部分重复问题，本次生成 ${n} 个新问题。`;
  }
  if (result.hadPreviousQuestions) {
    return "已生成一组新的目标客户问题。";
  }
  return `已生成并写入 ${result.count} 条目标客户问题。`;
}

function topTargetQuestionCards(questions: DiagnosisQuestionRow[], limit = TARGET_QUESTION_PREVIEW_COUNT) {
  const cards: {
    id: number;
    title: string;
    intentLabel: string;
    disadvantaged: boolean;
  }[] = [];
  for (const q of questions) {
    if (!q || typeof q?.id !== "number") continue;
    const meta = parseStoredQuestionMeta(q.targetKeyword ?? null);
    cards.push({
      id: q?.id,
      title: (q.questionText ?? "").trim() || "待补充问题",
      intentLabel: targetQuestionIntentLabel(meta.intent, meta.disadvantaged),
      disadvantaged: meta.disadvantaged,
    });
    if (cards.length >= limit) break;
  }
  return cards;
}

const DIAGNOSIS_CONSOLE_STEPS = [
  { title: "品牌与产品信息", desc: "完善企业档案与产品服务" },
  { title: "目标客户与场景", desc: "生成指定检索问题" },
  { title: "内容方向与平台", desc: "分析缺口与覆盖评分" },
  { title: "生成诊断结论", desc: "输出优化任务与建议" },
] as const;

const DIAGNOSIS_NEXT_ACTIONS = [
  { title: "生成本周内容资产", hint: "根据诊断任务批量生成可发布的 AI 搜索内容" },
  { title: "补充品牌认知类内容", hint: "强化官网、FAQ 与品牌介绍，提升 AI 识别稳定性" },
  { title: "补充竞品对比类内容", hint: "围绕劣势场景补齐对比与案例，改善推荐信号" },
] as const;

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
  const peers = articles
    .filter((item): item is ArticleLike => item != null && typeof item?.id === "number")
    .filter(item => item?.id !== article?.id);
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
  const topicRepeated = Boolean(topic && peers.some(item => item.topicId === topic?.id || (item.optimizationTaskId && item.optimizationTaskId === topic.optimizationTaskId && overlapRatio(currentTokens, titleTokens(item.title)) >= 0.35)));
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
  const selection = useProjectSelection();
  const { projects, selectedProjectId, selectedProject, projectInput, enabled, isLoading: projectsLoading } = selection;
  const questionsQuery = trpc.geo.questions.list.useQuery(projectInput, { enabled });
  const assetSummaryQuery = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const scoreQuery = trpc.geo.scores.latest.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const generateTargetQuestionsMutation = trpc.geo.questions.generateTargetQuestions.useMutation();
  const runAnalysis = trpc.geo.analysis.run.useMutation();
  const calculateScore = trpc.geo.scores.calculate.useMutation();
  const generateTasks = trpc.geo.tasks.generate.useMutation();
  const createT0WithQuestions = trpc.geo.testRounds.createT0WithQuestions.useMutation();
  const startT0Execution = trpc.geo.testRounds.startT0Execution.useMutation();
  const resetT0Baseline = trpc.geo.testRounds.resetT0Baseline.useMutation();
  const dangerousConfirm = useDangerousActionConfirm();
  const testRoundsQuery = trpc.geo.testRounds.list.useQuery(
    { projectId: selectedProjectId! },
    { enabled: enabled && Boolean(selectedProjectId) },
  );
  const testRounds = testRoundsQuery.data ?? [];
  const runningT0Round = testRounds.find(
    round => round.roundType === "T0_BASELINE" && round.status === "running",
  );
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [t0Message, setT0Message] = useState<string>();
  const [t0Error, setT0Error] = useState<string>();
  const [activeT0RoundId, setActiveT0RoundId] = useState<string | null>(null);
  const [selectedT0Platforms, setSelectedT0Platforms] = useState<T0PlatformSelectable[]>([...T0_DEFAULT_PLATFORMS]);
  const [diagnosisProgressErrorCategory, setDiagnosisProgressErrorCategory] = useState<
    AiTaskProgressErrorCategory | undefined
  >();
  const diagnosisProgress = useAiTaskStagedProgress({ stages: AI_DIAGNOSIS_PROGRESS_STAGES });
  const questions = questionsQuery.data ?? [];
  const analyses = analysisQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const profile = assetSummaryQuery.data?.profile;
  const hasProfile = Boolean(profile);
  const targetQuestions = questions.filter(q => Number(q.enabled) !== 0 && q.questionType === "指定问题");
  const loading = questionsQuery.isLoading || assetSummaryQuery.isLoading || analysisQuery.isLoading || scoreQuery.isLoading || tasksQuery.isLoading;
  const generatingQuestions = generateTargetQuestionsMutation.isPending;
  const running = runAnalysis.isPending || calculateScore.isPending || generateTasks.isPending;
  const t0PollRoundId = activeT0RoundId ?? runningT0Round?.id ?? null;
  const activeT0RoundQuery = trpc.geo.testRounds.get.useQuery(
    { projectId: selectedProjectId!, id: t0PollRoundId! },
    {
      enabled: enabled && Boolean(selectedProjectId && t0PollRoundId),
      refetchInterval: query => (query.state.data?.status === "running" ? 5000 : false),
    },
  );
  const t0StartingMutation = createT0WithQuestions.isPending || startT0Execution.isPending;
  const latestCompletedT0Round = testRounds.find(
    round => round.roundType === "T0_BASELINE" && round.status === "completed",
  );
  const displayT0Round =
    activeT0RoundQuery.data ??
    (activeT0RoundId ? testRounds.find(round => round?.id === activeT0RoundId) : null) ??
    runningT0Round ??
    latestCompletedT0Round ??
    null;
  const isT0Running = t0StartingMutation || displayT0Round?.status === "running";
  const displayT0RoundId = displayT0Round?.id;
  const t0RunsQuery = trpc.geo.aiTestRuns.listByRound.useQuery(
    { projectId: selectedProjectId!, roundId: displayT0RoundId ?? "" },
    {
      enabled: enabled && Boolean(selectedProjectId && displayT0RoundId),
      refetchInterval: isT0Running ? 2000 : false,
    },
  );
  const t0RoundQuestionsQuery = trpc.geo.roundQuestions.listByRound.useQuery(
    { projectId: selectedProjectId!, roundId: displayT0RoundId ?? "" },
    { enabled: enabled && Boolean(selectedProjectId && displayT0RoundId) },
  );
  const t0QuestionTypeById = useMemo(() => {
    const map = new Map<number, string>();
    for (const link of t0RoundQuestionsQuery.data ?? []) {
      if (!link || typeof link.questionId !== "number") continue;
      const questionType = link.question?.questionType;
      if (typeof questionType === "string" && questionType.trim()) {
        map.set(link.questionId, questionType);
      }
    }
    return map;
  }, [t0RoundQuestionsQuery.data]);
  const visualizationRoundId = latestCompletedT0Round?.id ?? null;
  const canReuseVisualizationRuns =
    visualizationRoundId != null && displayT0Round?.id === visualizationRoundId;
  const vizRunsQuery = trpc.geo.aiTestRuns.listByRound.useQuery(
    { projectId: selectedProjectId!, roundId: visualizationRoundId! },
    {
      enabled: enabled && Boolean(selectedProjectId && visualizationRoundId && !canReuseVisualizationRuns),
    },
  );
  const vizRoundQuestionsQuery = trpc.geo.roundQuestions.listByRound.useQuery(
    { projectId: selectedProjectId!, roundId: visualizationRoundId! },
    {
      enabled: enabled && Boolean(selectedProjectId && visualizationRoundId && !canReuseVisualizationRuns),
    },
  );
  const t0Runs = t0RunsQuery.data ?? [];
  const visualizationRuns = canReuseVisualizationRuns ? t0Runs : (vizRunsQuery.data ?? []);
  const visualizationQuestionTypeById = useMemo(() => {
    if (canReuseVisualizationRuns) return t0QuestionTypeById;
    const map = new Map<number, string>();
    for (const link of vizRoundQuestionsQuery.data ?? []) {
      if (!link || typeof link.questionId !== "number") continue;
      const questionType = link.question?.questionType;
      if (typeof questionType === "string" && questionType.trim()) {
        map.set(link.questionId, questionType);
      }
    }
    return map;
  }, [canReuseVisualizationRuns, t0QuestionTypeById, vizRoundQuestionsQuery.data]);
  const diagnosisVisualization = useMemo(() => {
    if (!visualizationRoundId || visualizationRuns.length === 0) return null;
    return buildT0DiagnosisVisualization(
      visualizationRuns.map(run => ({
        questionId: run.questionId,
        platform: run.platform,
        mentionedCompany: run.mentionedCompany,
        recommendedCompany: run.recommendedCompany,
        competitorMentioned: run.competitorMentioned,
        hasSourceLinks: run.hasSourceLinks,
      })),
      visualizationQuestionTypeById,
    );
  }, [visualizationRoundId, visualizationRuns, visualizationQuestionTypeById]);
  const t0ResultsDisplay = useMemo(() => {
    if (displayT0Round?.status !== "completed") return null;
    return buildT0DiagnosisResultsDisplay(
      t0Runs.map(run => ({
        questionId: run.questionId,
        platform: run.platform,
        mentionedCompany: run.mentionedCompany,
        recommendedCompany: run.recommendedCompany,
        competitorMentioned: run.competitorMentioned,
        competitorNames: run.competitorNames ?? [],
      })),
      t0QuestionTypeById,
    );
  }, [displayT0Round?.status, t0Runs, t0QuestionTypeById]);
  const t0Progress = useMemo(() => {
    if (!displayT0Round || displayT0Round.status !== "running") return null;
    const expectedRunsPerQuestion =
      (displayT0Round.runsPerQuestion ?? 3) * (displayT0Round.platforms?.length ?? T0_DEFAULT_PLATFORMS.length);
    return computeT0QuestionProgress(
      t0Runs.map(run => ({ questionId: run.questionId })),
      displayT0Round.questionsCount,
      expectedRunsPerQuestion,
    );
  }, [displayT0Round, t0Runs]);
  const pageError = customerErrorMessage(
    assetSummaryQuery.error?.message || questionsQuery.error?.message || analysisQuery.error?.message || scoreQuery.error?.message || tasksQuery.error?.message,
  );
  const canOperate = Boolean(selectedProjectId && hasProfile);
  const complete = analyses.length > 0 && Boolean(scoreQuery.data) && tasks.length > 0;
  const [gapsExpanded, setGapsExpanded] = useState(false);
  const [questionsExpanded, setQuestionsExpanded] = useState(false);
  const [consoleQuestionsExpanded, setConsoleQuestionsExpanded] = useState(false);
  const t0CompletionHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (runningT0Round?.id && !activeT0RoundId) {
      setActiveT0RoundId(runningT0Round?.id);
    }
  }, [runningT0Round, activeT0RoundId]);

  useEffect(() => {
    if (!selectedProjectId || !displayT0Round?.id) return;
    const terminal = displayT0Round.status === "completed" || displayT0Round.status === "failed";
    if (!terminal) return;
    if (t0CompletionHandledRef.current === displayT0Round?.id) return;
    t0CompletionHandledRef.current = displayT0Round?.id;

    void Promise.all([
      utils.geo.testRounds.list.invalidate({ projectId: selectedProjectId }),
      utils.geo.aiTestRuns.listByRound.invalidate({
        projectId: selectedProjectId,
        roundId: displayT0Round?.id,
      }),
      utils.geo.roundQuestions.listByRound.invalidate({
        projectId: selectedProjectId,
        roundId: displayT0Round?.id,
      }),
    ]);

    if (displayT0Round.status === "completed") {
      setT0Message("T0 基线检测已完成，以下为真实 AI 平台实测结果。");
      setT0Error(undefined);
    } else {
      setT0Error("T0 基线检测未成功完成，请稍后重试或联系支持。");
    }
  }, [displayT0Round?.id, displayT0Round?.status, selectedProjectId, utils]);

  const gapCount = useMemo(() => countDiagnosisGaps(analyses as DiagnosisAnalysisRow[]), [analyses]);
  const gapCardsPreview = useMemo(() => topDiagnosisGapCards(analyses as DiagnosisAnalysisRow[], 5), [analyses]);
  const gapCardsAll = useMemo(() => topDiagnosisGapCards(analyses as DiagnosisAnalysisRow[], 50), [analyses]);
  const questionCardsPreview = useMemo(
    () => topTargetQuestionCards(targetQuestions as DiagnosisQuestionRow[], TARGET_QUESTION_PREVIEW_COUNT),
    [targetQuestions],
  );
  const questionCardsAll = useMemo(() => topTargetQuestionCards(targetQuestions as DiagnosisQuestionRow[], 50), [targetQuestions]);
  const consoleQuestionPreview = useMemo(() => {
    const list = targetQuestions as DiagnosisQuestionRow[];
    const limit = consoleQuestionsExpanded ? list.length : TARGET_QUESTION_PREVIEW_COUNT;
    return list.slice(0, limit);
  }, [targetQuestions, consoleQuestionsExpanded]);
  const lastDiagnosisLabel = useMemo(
    () =>
      resolveAiDiagnosisLastTestLabel({
        analysisTimestamps: (analyses as DiagnosisAnalysisRow[]).flatMap(row => (row ? [row.updatedAt, row.createdAt] : [])),
        t0FinishedAt: displayT0Round?.finishedAt ?? null,
        runTestedAtList: t0Runs.map(run => run.testedAt),
      }),
    [analyses, displayT0Round?.finishedAt, t0Runs],
  );
  const mentionPctDisplay = useMemo(() => {
    if (scoreQuery.data?.aiVisibilityScore != null) return scoreQuery.data.aiVisibilityScore;
    if (t0ResultsDisplay) return Math.round(t0ResultsDisplay.mentionRate * 100);
    return null;
  }, [scoreQuery.data?.aiVisibilityScore, t0ResultsDisplay]);
  const recommendPctDisplay = useMemo(() => {
    if (scoreQuery.data?.aiRecommendationScore != null) return scoreQuery.data.aiRecommendationScore;
    if (t0ResultsDisplay) return Math.round(t0ResultsDisplay.recommendRate * 100);
    return null;
  }, [scoreQuery.data?.aiRecommendationScore, t0ResultsDisplay]);
  const hasAiTestMetrics = mentionPctDisplay != null || recommendPctDisplay != null;
  const mentionRateHint = useMemo(
    () => diagnosisMentionRateHint(mentionPctDisplay, hasAiTestMetrics),
    [mentionPctDisplay, hasAiTestMetrics],
  );
  const recommendRateHint = useMemo(
    () => diagnosisRecommendRateHint(recommendPctDisplay, hasAiTestMetrics),
    [recommendPctDisplay, hasAiTestMetrics],
  );
  const t0CompletedAtLabel = useMemo(() => {
    if (!displayT0Round?.finishedAt) return null;
    return formatAiDiagnosisDateTime(displayT0Round.finishedAt);
  }, [displayT0Round?.finishedAt]);
  const platformCards = useMemo(
    () =>
      T0_AI_ENGINE_OPTIONS.map(option => {
        const stats = t0ResultsDisplay?.byPlatform.find(group => group.platform === option.id);
        const viz = diagnosisVisualization?.platformComparison.find(item => item.platform === option.id);
        const sampleCount = stats?.totalRuns ?? viz?.sampleCount ?? 0;
        const mentionPct = stats ? Math.round(stats.mentionRate * 100) : (viz?.percent ?? null);
        const recommendPct = stats ? Math.round(stats.recommendRate * 100) : null;
        const tested = sampleCount > 0;
        return {
          id: option.id,
          name: option.label,
          icon:
            option.id === "doubao"
              ? "🤖"
              : option.id === "kimi"
                ? "🔍"
                : option.id === "deepseek"
                  ? "🧠"
                  : option.id === "qwen"
                    ? "💡"
                    : "📝",
          tested,
          sampleCount,
          mentionPct,
          recommendPct,
        };
      }),
    [diagnosisVisualization?.platformComparison, t0ResultsDisplay?.byPlatform],
  );
  const headline = useMemo(() => buildDiagnosisHeadlineLine(scoreQuery.data ?? null, gapCount), [scoreQuery.data, gapCount]);
  const scoreDisplay =
    scoreQuery.data && typeof scoreQuery.data.totalScore === "number" ? `${scoreQuery.data.totalScore} 分` : "暂无数据";
  const stepActiveIndex = complete ? 3 : analyses.length > 0 ? 2 : targetQuestions.length > 0 ? 1 : hasProfile ? 0 : 0;
  const diagnoseBtnLabel = running
    ? "正在运行 AI 实测诊断"
    : analyses.length > 0
      ? "重新诊断"
      : "开始 AI 内容诊断";
  const visibleGapCards = gapsExpanded ? gapCardsAll : gapCardsPreview;
  const visibleQuestionCards = questionsExpanded ? questionCardsAll : questionCardsPreview;

  async function executeDiagnosisPipeline(projectId: number) {
    setDiagnosisProgressErrorCategory(undefined);
    diagnosisProgress.reset();
    diagnosisProgress.start();
    try {
      diagnosisProgress.setStage(10);
      diagnosisProgress.setStage(20);
      diagnosisProgress.setStage(35);
      diagnosisProgress.setStage(55);
      diagnosisProgress.allowOptimisticUpTo(90);
      await runAnalysis.mutateAsync({ projectId });
      diagnosisProgress.setStage(70);
      diagnosisProgress.allowOptimisticUpTo(92);
      await calculateScore.mutateAsync({ projectId });
      diagnosisProgress.setStage(85);
      await generateTasks.mutateAsync({ projectId });
      diagnosisProgress.setStage(95);
      await Promise.all([
        utils.geo.questions.list.invalidate({ projectId }),
        utils.geo.analysis.list.invalidate({ projectId }),
        utils.geo.scores.latest.invalidate({ projectId }),
        utils.geo.tasks.list.invalidate({ projectId }),
      ]);
      diagnosisProgress.complete();
      setMessage("内容诊断已完成。下一步：进入内容生产，根据优化任务生成本周内容计划。");
      window.setTimeout(() => diagnosisProgress.reset(), 5000);
    } catch (err) {
      const raw =
        err instanceof TRPCClientError ? err.message : err instanceof Error ? err.message : "运行内容诊断失败";
      setDiagnosisProgressErrorCategory(mapGeoDiagnosisErrorCategory(raw));
      diagnosisProgress.fail();
      throw err;
    }
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
      const genHint = buildTargetQuestionGenerateMessage(result);
      if (readyTargets.length === 0) {
        setMessage(`${genHint} 但列表暂未同步到可用的「指定问题」，请刷新页面或点击「运行内容诊断」重试。`);
        return;
      }
      setMessage(`${genHint} 正在自动运行内容诊断…`);
      try {
        await executeDiagnosisPipeline(selectedProjectId);
      } catch (diagErr) {
        const raw =
          diagErr instanceof TRPCClientError
            ? diagErr.message
            : diagErr instanceof Error
              ? diagErr.message
              : "运行内容诊断失败";
        setDiagnosisProgressErrorCategory(mapGeoDiagnosisErrorCategory(raw));
        diagnosisProgress.fail();
        setError(customerErrorMessage(raw));
        setMessage(`${genHint} 但自动诊断未完成，请点击「运行内容诊断」重试。`);
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
      const raw =
        err instanceof TRPCClientError ? err.message : err instanceof Error ? err.message : "运行内容诊断失败";
      if (diagnosisProgress.status === "idle") {
        setDiagnosisProgressErrorCategory(mapGeoDiagnosisErrorCategory(raw));
        diagnosisProgress.fail();
      }
      setError(customerErrorMessage(raw));
    }
  }

  const t0ExportProjectName = selectedProject?.enterpriseName ?? "当前企业";
  const hasT0BaselineToReset = testRounds.some(
    round => round.roundType === "T0_BASELINE" && round.status !== "running",
  );

  async function handleResetT0Baseline() {
    if (!selectedProjectId) return;
    try {
      const result = await resetT0Baseline.mutateAsync({ projectId: selectedProjectId });
      t0CompletionHandledRef.current = null;
      setActiveT0RoundId(null);
      setT0Message(undefined);
      setT0Error(undefined);
      await utils.geo.testRounds.list.invalidate({ projectId: selectedProjectId });
      toast.success(
        result.deletedRoundCount > 0
          ? `已重置 T0 检测（清除 ${result.deletedRoundCount} 轮记录）`
          : "当前没有可清除的 T0 检测记录",
      );
    } catch (err) {
      const raw =
        err instanceof TRPCClientError ? err.message : err instanceof Error ? err.message : "重置 T0 检测失败";
      toast.error(customerErrorMessage(raw));
    }
  }

  function handleExportT0ResultsCsv() {
    if (t0RunsQuery.isLoading || t0RoundQuestionsQuery.isLoading) {
      toast.message("T0 检测结果加载中，请稍后再导出");
      return;
    }
    const questionTextById = new Map<number, string>();
    for (const link of t0RoundQuestionsQuery.data ?? []) {
      if (!link || typeof link.questionId !== "number") continue;
      const text = link.question?.questionText?.trim();
      if (text) questionTextById.set(link.questionId, text);
    }
    const rows = t0Runs.map(run => ({
      questionText: questionTextById.get(run.questionId) ?? `问题 #${run.questionId}`,
      questionType: t0QuestionTypeById.get(run.questionId) ?? "指定问题",
      platform: run.platform,
      mentionedBrand: run.mentionedCompany,
      recommendedBrand: run.recommendedCompany,
      competitorNames: run.competitorNames ?? [],
      testedAt: run.testedAt,
    }));
    downloadT0ResultsCsv({ projectName: t0ExportProjectName, rows });
    toast.success(rows.length > 0 ? "T0 检测结果 CSV 已开始下载" : "已导出空表（暂无检测记录）");
  }

  async function handleStartT0Baseline() {
    if (!selectedProjectId) {
      setT0Error("请先选择项目。");
      return;
    }
    if (!hasProfile) {
      setT0Error("当前项目还没有企业档案，请先完成建档后再启动 T0 基线检测。");
      return;
    }
    setT0Message(undefined);
    setT0Error(undefined);
    try {
      const createResult = await createT0WithQuestions.mutateAsync({
        projectId: selectedProjectId,
        platforms:
          selectedT0Platforms.length > 0
            ? (selectedT0Platforms as T0AiEngineId[])
            : [...T0_DEFAULT_PLATFORMS],
        runsPerQuestion: 3,
      });
      const roundId = createResult.round?.id;
      if (!roundId) {
        setT0Error("T0 轮次创建失败，请刷新后重试。");
        return;
      }
      t0CompletionHandledRef.current = null;
      setActiveT0RoundId(roundId);
      await utils.geo.testRounds.list.invalidate({ projectId: selectedProjectId });
      const startResult = await startT0Execution.mutateAsync({
        projectId: selectedProjectId,
        roundId,
      });
      if (startResult.status !== "running") {
        setT0Error("T0 基线检测未能启动，请刷新后重试。");
        return;
      }
      await utils.geo.testRounds.get.invalidate({ projectId: selectedProjectId, id: roundId });
      setT0Message("T0 基线检测已启动，正在后台执行，请稍候…");
    } catch (err) {
      if (handleSubscriptionLimitMutationError(err)) {
        setT0Error((err instanceof TRPCClientError ? err.message : err instanceof Error ? err.message : "当前套餐已达 T0 检测上限，请升级套餐。"));
        return;
      }
      const raw =
        err instanceof TRPCClientError ? err.message : err instanceof Error ? err.message : "启动 T0 基线检测失败";
      setT0Error(customerErrorMessage(raw));
    }
  }

  if (!enabled && !projectsLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center max-w-md shadow-sm">
          <Brain className="mx-auto h-10 w-10 text-blue-600" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">AI 实测诊断</h2>
          <p className="mt-2 text-sm text-gray-500">请先选择一个企业项目，再进行 AI 搜索可见性诊断。</p>
          <Button className="mt-5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLocation("/clients")}>前往企业项目</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-gray-500">
        <Spinner className="size-6 text-blue-600" />
        <p className="text-sm">正在加载 AI 实测诊断数据…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DangerousActionConfirmDialog {...dangerousConfirm.dialogProps} />
      {/* --- 页面标题区 --- */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 实测诊断</h1>
        <p className="mt-1 text-sm text-gray-500">
          检测企业在豆包、Kimi、DeepSeek、通义千问、文心一言等 AI 平台中的品牌提及、推荐和内容引用情况
        </p>
      </div>

      <FirstUseHintBanner
        storageKey={FIRST_USE_HINT_KEYS.aiDiagnosis}
        message="点击「启动T0基线检测」开始检测AI是否认识你的品牌"
        data-testid="first-use-hint-ai-diagnosis"
      />

      {/* --- 诊断状态 + 最近实测时间 --- */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
          complete ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
          analyses.length > 0 ? "bg-blue-50 text-blue-700 border border-blue-200" :
          "bg-gray-100 text-gray-600 border border-gray-200"
        }`}>
          {complete ? "诊断已完成" : analyses.length > 0 ? "部分完成" : "未诊断"}
        </span>
        <span className="text-xs text-gray-500">最近实测：{lastDiagnosisLabel}</span>
      </div>

      {/* --- 核心指标卡 --- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="ai-diagnosis-mention-rate">
          <p className="text-xs font-medium text-gray-500">品牌提及率</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{mentionPctDisplay != null ? `${mentionPctDisplay}%` : "--"}</p>
          <p className="mt-1 text-xs text-gray-400">AI 回答中提到品牌的比例</p>
          {mentionRateHint ? (
            <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900">
              {mentionRateHint}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="ai-diagnosis-recommend-rate">
          <p className="text-xs font-medium text-gray-500">AI 推荐率</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{recommendPctDisplay != null ? `${recommendPctDisplay}%` : "--"}</p>
          <p className="mt-1 text-xs text-gray-400">AI 主动推荐品牌的比例</p>
          {recommendRateHint ? (
            <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2 text-xs leading-relaxed text-blue-900">
              {recommendRateHint}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">内容覆盖评分</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{scoreDisplay}</p>
          <p className="mt-1 text-xs text-gray-400">综合可见性评分</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">覆盖问题数</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{targetQuestions.length > 0 ? `${targetQuestions.length}` : "--"}</p>
          <p className="mt-1 text-xs text-gray-400">已纳入诊断的目标问题</p>
        </div>
      </div>

      {diagnosisVisualization ? (
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
          <T0DiagnosisVisualizationPanel visualization={diagnosisVisualization} />
        </div>
      ) : null}

      {/* --- 覆盖平台卡片 --- */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="ai-diagnosis-platform-cards">
        <h2 className="text-sm font-semibold text-gray-900">五大 AI 平台实测结果</h2>
        <p className="mt-1 text-xs text-gray-500">基于 T0 基线检测真实调用；未纳入本轮的平台显示为未实测。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {platformCards.map(p => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
              data-testid={`ai-diagnosis-platform-${p.id}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{p.icon}</span>
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
              </div>
              {p.tested ? (
                <div className="space-y-0.5 text-xs text-gray-600">
                  <p>提及率 {p.mentionPct ?? 0}% · 推荐率 {p.recommendPct ?? 0}%</p>
                  <p className="text-gray-400">样本 {p.sampleCount} 次</p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">本轮未实测</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* --- 无数据空状态 --- */}
      {!loading && analyses.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <Brain className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-700">暂无 AI 实测结果</p>
          <p className="mt-1 text-xs text-gray-500">完成品牌资产建档后，可以发起首次 AI 搜索可见性诊断。</p>
        </div>
      )}

      {/* --- 操作状态提示 --- */}
      {(message || error || pageError) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          (error || pageError) ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {error || pageError || message}
          {(error || pageError) ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void Promise.all([
                    questionsQuery.refetch(),
                    assetSummaryQuery.refetch(),
                    analysisQuery.refetch(),
                    scoreQuery.refetch(),
                    tasksQuery.refetch(),
                  ]);
                }}
              >
                重试加载
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* --- AI 实测诊断进度 --- */}
      {diagnosisProgress.status !== "idle" ? (
        <AiTaskProgressCard
          testId="ai-diagnosis-progress"
          title="正在运行 AI 实测诊断"
          stepLabel={diagnosisProgress.stepLabel}
          percent={diagnosisProgress.percent}
          elapsedSec={diagnosisProgress.elapsedSec}
          hint30s={AI_DIAGNOSIS_PROGRESS_HINT_30S}
          hint60s={AI_DIAGNOSIS_PROGRESS_HINT_60S}
          status={
            diagnosisProgress.isFailed ? "failed" : diagnosisProgress.isSuccess ? "success" : "running"
          }
          errorCategory={diagnosisProgressErrorCategory}
          errorMessage={error}
        />
      ) : null}

      {/* --- 建档未完成提醒 --- */}
      {selectedProjectId && !hasProfile && !assetSummaryQuery.isLoading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          当前项目还没有完成品牌资产建档，请先前往建档页补齐核心信息后再运行诊断。
        </div>
      )}

      {/* --- 诊断流程控制台（浅色版） --- */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">诊断流程</h2>
        <p className="mt-1 text-xs text-gray-500">按步骤完成输入与诊断</p>

        {/* 步骤指示器 */}
        <div className="mt-5 flex items-center gap-1">
          {DIAGNOSIS_CONSOLE_STEPS.map((step, idx) => (
            <div key={step.title} className="flex items-center gap-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                idx <= stepActiveIndex ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
              }`}>{idx + 1}</div>
              <span className={`hidden text-xs sm:inline ${idx <= stepActiveIndex ? "text-gray-900 font-medium" : "text-gray-400"}`}>{step.title}</span>
              {idx < DIAGNOSIS_CONSOLE_STEPS.length - 1 && <div className={`mx-1 h-px w-4 sm:w-8 ${idx < stepActiveIndex ? "bg-blue-600" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {/* 操作区 */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* 目标客户问题 */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500">Step 2 · 目标客户问题</p>
                <p className="mt-1 text-xs text-gray-400">基于企业档案生成客户会在 AI 中搜索的问题</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleGenerateTargetQuestions()}
                disabled={!canOperate || generatingQuestions || running}
                variant="outline"
                className="shrink-0 border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                {generatingQuestions ? "正在生成…" : "重新生成"}
              </Button>
            </div>
            {targetQuestions.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">暂无问题，点击「重新生成」</p>
            ) : (
              <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                {consoleQuestionPreview.map(q => {
                  if (!q || typeof q?.id !== "number") return null;
                  const meta = parseStoredQuestionMeta(q.targetKeyword ?? null);
                  const typeLabel = targetQuestionIntentLabel(meta.intent, meta.disadvantaged);
                  return (
                    <div key={q?.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.disadvantaged ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{typeLabel}</span>
                      <p className="mt-1 text-sm text-gray-700">{q.questionText}</p>
                    </div>
                  );
                })}
                {targetQuestions.length > TARGET_QUESTION_PREVIEW_COUNT && (
                  <button type="button" className="text-xs text-blue-600 hover:text-blue-700" onClick={() => setConsoleQuestionsExpanded(v => !v)}>
                    {consoleQuestionsExpanded ? "收起" : `展开全部（${targetQuestions.length}）`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 运行诊断 */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500">Step 4 · 运行 AI 实测诊断</p>
            <div className="mt-3 grid gap-2 grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <p className="text-[10px] text-gray-400">已准备问题</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{targetQuestions.length > 0 ? `${targetQuestions.length} 个` : "--"}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <p className="text-[10px] text-gray-400">诊断将产出</p>
                <p className="mt-1 text-xs text-gray-600">结论 + 缺口 + 任务</p>
              </div>
            </div>
            <Button
              type="button"
              className="mt-4 h-11 w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!canOperate || targetQuestions.length === 0 || running || generatingQuestions}
              onClick={() => void handleRunDiagnosis()}
            >
              {diagnoseBtnLabel}
            </Button>
          </div>
        </div>
      </div>

      {/* --- T0 基线真实检测（独立入口，不替换原有 analysis.run 诊断） --- */}
      <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm" data-testid="ai-diagnosis-t0-baseline">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">T0 基线真实检测</h2>
            <p className="mt-1 text-xs text-gray-500">
              调用真实 AI 平台实测，写入 test_rounds 与 ai_test_runs，与上方合成诊断入口并行保留。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasT0BaselineToReset ? (
              <Button
                type="button"
                variant="outline"
                className="shrink-0 border-red-200 text-red-700 hover:bg-red-50"
                disabled={!canOperate || isT0Running || resetT0Baseline.isPending}
                data-testid="ai-diagnosis-reset-t0"
                onClick={() =>
                  dangerousConfirm.requestConfirm(DANGEROUS_ACTION_LABELS.resetT0Detection, () =>
                    handleResetT0Baseline(),
                  )
                }
              >
                {resetT0Baseline.isPending ? "正在重置…" : "重置T0检测"}
              </Button>
            ) : null}
            <Button
              type="button"
              className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={
                !canOperate ||
                isT0Running ||
                running ||
                generatingQuestions ||
                selectedT0Platforms.length === 0
              }
              onClick={() => void handleStartT0Baseline()}
              data-testid="ai-diagnosis-start-t0"
            >
              {t0StartingMutation ? "正在启动 T0 检测…" : isT0Running ? "T0 检测进行中…" : "启动T0基线检测"}
            </Button>
          </div>
        </div>

        <div className="mt-4" data-testid="ai-diagnosis-t0-platform-select">
          <p className="text-xs font-medium text-gray-500">实测平台（多选）</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {T0_AI_ENGINE_OPTIONS.map(option => {
              const checked = selectedT0Platforms.includes(option?.id);
              return (
                <label
                  key={option?.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={checked}
                    disabled={isT0Running || t0StartingMutation}
                    onChange={() => {
                      setSelectedT0Platforms(prev => {
                        if (checked) {
                          const next = prev.filter(id => id !== option?.id);
                          return next.length > 0 ? next : prev;
                        }
                        return [...prev, option?.id];
                      });
                    }}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-400">通义千问需 QWEN_API_KEY，文心一言需 WENXIN_API_KEY。</p>
        </div>

        {(t0Message || t0Error) &&
          (t0Error && isSubscriptionLimitMessage(t0Error) ? (
            <SubscriptionUpgradePrompt className="mt-4" message={t0Error} testId="ai-diagnosis-t0-limit-error" />
          ) : (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                t0Error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {t0Error || t0Message}
            </div>
          ))}

        {isT0Running && t0Progress ? (
          <div
            className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800"
            data-testid="ai-diagnosis-t0-progress"
          >
            正在检测第{t0Progress.currentQuestion}题，共{t0Progress.totalQuestions}题
          </div>
        ) : null}

        {displayT0Round?.status === "completed" && t0ResultsDisplay ? (
          <div className="mt-5 space-y-4" data-testid="ai-diagnosis-t0-results">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">检测结果汇总</p>
                {t0CompletedAtLabel ? (
                  <p className="mt-1 text-xs text-gray-500" data-testid="ai-diagnosis-t0-completed-at">
                    实测完成时间：{t0CompletedAtLabel}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                data-testid="ai-diagnosis-t0-export-csv"
                disabled={t0RunsQuery.isLoading || !selectedProjectId}
                onClick={handleExportT0ResultsCsv}
              >
                导出检测结果
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">总测试次数</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{t0ResultsDisplay.totalRuns}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">品牌提及</p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {t0ResultsDisplay.mentionedCount} 次 · {formatT0Rate(t0ResultsDisplay.mentionRate)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">品牌推荐</p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {t0ResultsDisplay.recommendedCount} 次 · {formatT0Rate(t0ResultsDisplay.recommendRate)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">竞品出现</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{t0ResultsDisplay.competitorAppearances} 次</p>
                {t0ResultsDisplay.competitorNames.length > 0 ? (
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                    {t0ResultsDisplay.competitorNames.join("、")}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">暂未提及竞品</p>
                )}
              </div>
            </div>

            {(Math.round(t0ResultsDisplay.mentionRate * 100) === 0 || Math.round(t0ResultsDisplay.recommendRate * 100) === 0) && (
              <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-xs leading-relaxed text-amber-950">
                {Math.round(t0ResultsDisplay.mentionRate * 100) === 0 ? (
                  <p data-testid="ai-diagnosis-t0-mention-hint">{diagnosisMentionRateHint(0, true)}</p>
                ) : null}
                {Math.round(t0ResultsDisplay.recommendRate * 100) === 0 ? (
                  <p data-testid="ai-diagnosis-t0-recommend-hint">{diagnosisRecommendRateHint(0, true)}</p>
                ) : null}
              </div>
            )}

            {t0ResultsDisplay.byPlatform.some(group => group.totalRuns > 0) ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4" data-testid="ai-diagnosis-t0-by-platform">
                <h3 className="text-sm font-semibold text-gray-900">分平台实测结果</h3>
                <div className="mt-3 space-y-2">
                  {t0ResultsDisplay.byPlatform.map(group => (
                    <div
                      key={group.platform}
                      className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-gray-900">{group.label}</span>
                      <span className="text-xs text-gray-500">
                        {group.totalRuns > 0
                          ? `测试 ${group.totalRuns} 次 · 提及 ${formatT0Rate(group.mentionRate)} · 推荐 ${formatT0Rate(group.recommendRate)}`
                          : "本轮未实测"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {t0ResultsDisplay.byQuestionType.length > 0 ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">按问题类型分组</h3>
                <div className="mt-3 space-y-2">
                  {t0ResultsDisplay.byQuestionType.map(group => (
                    <div
                      key={group.questionType}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700"
                    >
                      <p className="font-medium text-gray-900">{group.label}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        测试 {group.totalRuns} 次 · 提及 {group.mentionedCount} 次（{formatT0Rate(group.mentionRate)}）
                        · 推荐 {group.recommendedCount} 次（{formatT0Rate(group.recommendRate)}）
                        · 竞品出现 {group.competitorAppearances} 次
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : displayT0Round?.status === "completed" && !t0ResultsDisplay ? (
          <p className="mt-4 text-sm text-gray-500">T0 检测已完成，但暂无可展示的实测记录。</p>
        ) : null}
      </div>

      {/* --- 核心诊断结论 --- */}
      {(analyses.length > 0 || scoreQuery.data) && (
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">核心诊断结论</h2>
          <p className="mt-3 text-base font-medium leading-relaxed text-gray-800">{headline}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">内容覆盖评分</p>
              <p className="mt-1 text-xl font-bold text-blue-600">{scoreDisplay}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">内容缺口数</p>
              <p className="mt-1 text-xl font-bold text-amber-600">{analyses.length > 0 ? String(gapCount) : "--"}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">推荐生成方向</p>
              <p className="mt-1 text-xl font-bold text-purple-600">{tasks.length > 0 ? String(tasks.length) : "--"}</p>
            </div>
          </div>
        </div>
      )}

      {/* --- 内容缺口与目标问题 --- */}
      {analyses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">内容缺口</h3>
            {gapCardsPreview.length === 0 ? (
              <p className="mt-3 text-sm text-gray-400">暂无内容缺口</p>
            ) : (
              <div className="mt-3 space-y-2">
                {visibleGapCards.map(card => (
                  <div key={card?.id} className="rounded-lg border-l-4 border-l-amber-400 border border-gray-100 bg-gray-50 p-3">
                    <p className="text-sm font-medium text-gray-800 line-clamp-1">{card.title}</p>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{card.detail}</p>
                  </div>
                ))}
                {gapCardsAll.length > 5 && (
                  <button type="button" className="text-xs text-blue-600 hover:text-blue-700" onClick={() => setGapsExpanded(v => !v)}>
                    {gapsExpanded ? "收起" : `查看全部（${gapCardsAll.length}）`}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">目标问题</h3>
            {questionCardsPreview.length === 0 ? (
              <p className="mt-3 text-sm text-gray-400">暂无目标问题</p>
            ) : (
              <div className="mt-3 space-y-2">
                {visibleQuestionCards.map(card => (
                  <div key={card?.id} className="rounded-lg border-l-4 border-l-blue-400 border border-gray-100 bg-gray-50 p-3">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${card.disadvantaged ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{card.intentLabel}</span>
                    <p className="mt-1 text-sm text-gray-700">{card.title}</p>
                  </div>
                ))}
                {targetQuestions.length > TARGET_QUESTION_PREVIEW_COUNT && (
                  <button type="button" className="text-xs text-blue-600 hover:text-blue-700" onClick={() => setQuestionsExpanded(v => !v)}>
                    {questionsExpanded ? "收起" : `展开全部（${targetQuestions.length}）`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- 下一步动作 --- */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">下一步内容资产动作</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {DIAGNOSIS_NEXT_ACTIONS.map((action, idx) => (
            <div key={action.title} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs text-gray-400">动作 {idx + 1}</p>
              <p className="mt-2 text-sm font-medium text-gray-800">{action.title}</p>
              <p className="mt-1 text-xs text-gray-500">{action.hint}</p>
            </div>
          ))}
        </div>
        {complete && (
          <p className="mt-4 text-sm text-emerald-600">诊断已完成，可以进入内容资产生产。</p>
        )}
        <Button
          type="button"
          className="mt-4 h-11 bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!complete}
          onClick={() => selectedProjectId && setLocation(buildProjectUrl("/weekly", selectedProjectId))}
        >
          去生成内容资产
        </Button>
      </div>

      {/* --- 完整诊断明细（折叠） --- */}
      {analyses.length > 0 && (
        <details className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-gray-600 hover:text-gray-900 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <ChevronDown className="h-4 w-4" />
              完整诊断明细
            </span>
          </summary>
          <div className="space-y-6 border-t border-gray-100 px-5 pb-6 pt-4">
            <div>
              <h3 className="font-semibold text-gray-900">内容覆盖评分</h3>
              {scoreQuery.data ? (
                <div className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
                  <p>
                    总分 {scoreQuery.data.totalScore} · 等级 {scoreQuery.data.visibilityLevel} · AI 提及{" "}
                    {scoreQuery.data.aiVisibilityScore} · AI 推荐 {scoreQuery.data.aiRecommendationScore}
                  </p>
                  <p>{scoreReason(scoreQuery.data)}</p>
                  <p>{scoreFactors(scoreQuery.data)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-400">当前还没有生成内容覆盖评分。</p>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-gray-900">诊断结果</h3>
              <div className="mt-3 space-y-3">
                {analyses.map(item => {
                  if (!item || typeof item?.id !== "number") return null;
                  const detail = diagnosisJson(item) as Record<string, unknown>;
                  const v12 = diagnosisV12DisplayFields(detail);
                  return (
                    <div key={item?.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                      <p className="font-medium text-gray-800">客户问题：{diagnosisText(detail.questionText, "未关联客户问题")}</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <p>AI 是否提及品牌：{yesNo(item.mentionsEnterprise)}</p>
                        <p>AI 是否推荐品牌：{yesNo(item.recommendsEnterprise)}</p>
                        <p>竞品：{listText(item.recommendedCompetitors)}</p>
                        <p>用户意图：{diagnosisText(detail.userIntent)}</p>
                      </div>
                      <p className="mt-2">内容缺口：{item.contentGap || "暂无"}</p>
                      <p>优化建议：{item.optimizationSuggestion || "暂无"}</p>
                      {v12.suggestedTitle && (
                        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                          <p className="text-xs text-blue-600">建议标题：《{v12.suggestedTitle}》</p>
                          {v12.coreTheses.length > 0 && (
                            <ul className="mt-1 list-disc pl-5 text-xs text-gray-600">
                              {v12.coreTheses.map((t, idx) => <li key={idx}>{t}</li>)}
                            </ul>
                          )}
                          {v12.recommendedPlatforms.length > 0 && (
                            <p className="mt-1 text-xs text-gray-500">推荐平台：{v12.recommendedPlatforms.join("、")}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900">优化任务</h3>
              {tasks.length === 0 ? (
                <p className="mt-2 text-sm text-gray-400">当前还没有优化任务。请先运行诊断。</p>
              ) : (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {tasks.map(task => {
                    if (!task || typeof task?.id !== "number") return null;
                    const card = parseGeoTaskCard(task.executionSuggestion);
                    return (
                      <div key={task?.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                        <p className="font-medium text-gray-800">{task.taskName}</p>
                        <p className="mt-1 text-blue-600 text-xs">优先级：{task.priority || "待评估"}</p>
                        <p className="text-xs">解决问题：{task.generationReason || "补齐诊断发现的内容缺口"}</p>
                        {card && (
                          <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 space-y-1">
                            <p className="text-xs"><span className="text-gray-400">建议标题：</span>《{card.articleTitle}》</p>
                            <p className="text-xs"><span className="text-gray-400">关键词：</span>{card.targetKeywords.join("、")}</p>
                            <p className="text-xs"><span className="text-gray-400">平台：</span>{card.recommendedPlatform.join("、")}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function ContentGenerationFlowInner({ selection }: { selection: ReturnType<typeof useProjectSelection> }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { projects, selectedProjectId, selectedProject, projectInput, enabled } = selection;
  const assetSummaryQuery = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled });
  const analysisQuery = trpc.geo.analysis.list.useQuery(projectInput, { enabled });
  const tasksQuery = trpc.geo.tasks.list.useQuery(projectInput, { enabled });
  const topicsQuery = trpc.geo.articles.topics.list.useQuery(projectInput, { enabled });
  const articlesQuery = trpc.geo.articles.list.useQuery(projectInput, { enabled });
  const scoresQuery = trpc.geo.articles.latestQualityScores.useQuery(projectInput, { enabled });
  const contentPlanQuery = trpc.geo.contentPlans.latest.useQuery(projectInput, { enabled });
  const subscriptionUsageQuery = trpc.geo.subscription.usage.useQuery();
  const contentLimitReached = subscriptionUsageQuery.data?.atLimit.contentArticle ?? false;
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
  const analyses = (analysisQuery.data ?? []) as DiagnosisAnalysisRow[];
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
  const pageError = contentGenerationErrorMessage(
    assetSummaryQuery.error?.message || analysisQuery.error?.message || tasksQuery.error?.message || topicsQuery.error?.message || articlesQuery.error?.message || scoresQuery.error?.message || contentPlanQuery.error?.message,
  );
  const selectedTask = tasks.find(task => task?.id === selectedTaskId);
  const planTaskIdSet = new Set(contentPlan.taskIds);
  const visibleTopics =
    planTaskIdSet.size > 0
      ? topics.filter(t => t.optimizationTaskId != null && planTaskIdSet.has(t.optimizationTaskId))
      : topics;
  const visibleTopicIdsKey = useMemo(() => visibleTopics.map(t => t?.id).join(","), [visibleTopics]);
  const articleIdsKey = useMemo(() => articles.map(a => a?.id).join(","), [articles]);
  const stableTaskIdsKey = useMemo(() => tasks.map(t => t?.id).join(","), [tasks]);
  const selectedTopic = topics.find(topic => topic?.id === selectedTopicId);
  const selectedArticle = articles.find(article => article?.id === selectedArticleId) ?? (selectedTopicId ? articles.find(article => article.topicId === selectedTopicId) : articles[0]);
  /** 与列表同源的文章行，用于发布标题等字段，避免展示对象与 articles 缓存不一致 */
  const articleRowFromList = useMemo(() => {
    if (!selectedArticle?.id) return null;
    return articles.find(a => a?.id === selectedArticle?.id) ?? selectedArticle;
  }, [articles, selectedArticle]);
  const publishBodyMarkdown = useMemo(
    () => stripLeadingMarkdownH1Line(selectedArticle?.markdownContent),
    [selectedArticle?.id, selectedArticle?.markdownContent],
  );
  const currentEnterpriseName = useMemo(() => projects.find(p => p?.id === selectedProjectId)?.enterpriseName ?? "", [projects, selectedProjectId]);
  const selectedQuality = selectedArticle ? scores.find(score => score.articleId === selectedArticle?.id) : undefined;
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

    const valid = new Set(tasks.map(t => t?.id));
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
    const picked = tasks.slice(0, Math.min(3, tasks.length)).map(t => t?.id);
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
    const ids = new Set(visibleTopics.map(t => t?.id));
    if (!selectedTopicId || !ids.has(selectedTopicId)) startTransition(() => setSelectedTopicId(first));
  }, [selectedProjectId, selectedTopicId, visibleTopicIdsKey]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const first = articles[0]?.id;
    if (!first) return;
    const ids = new Set(articles.map(a => a?.id));
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
      const validTaskIds = new Set(tasks.map(t => t?.id));
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
      setError(toUserFacingErrorFromUnknown(err, "保存内容生产计划失败"));
    }
  }

  async function handleGenerateTopics() {
    let projectId: number;
    try {
      projectId = requireValidProjectId(selectedProjectId);
    } catch {
      setError("项目未选择，请从客户管理台进入当前企业后再试。");
      return;
    }
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
      await generateTopics.mutateAsync({ projectId });
      const refreshedTopics = await topicsQuery.refetch();
      const refreshed = (refreshedTopics.data ?? []) as TopicLike[];
      const nextTopic = refreshed.find(topic => topic.optimizationTaskId && contentPlan.taskIds.includes(topic.optimizationTaskId)) ?? refreshed[0];
      if (!nextTopic?.id) throw new Error("没有可用于生成文章的选题，请先完成 内容诊断和优化任务。");
      startTransition(() => setSelectedTopicId(nextTopic?.id));
      setMessage("已根据优化任务同步内容选题，请选择一个选题生成 1 篇文章。");
    } catch (err) {
      setError(toUserFacingErrorFromUnknown(err, "生成内容选题失败"));
    }
  }

  async function generateOneArticleAndPersist(topicId: number) {
    const projectId = requireValidProjectId(selectedProjectId);
    const planId = latestPlan?.id;
    if (!planId) throw new Error("请先保存本周内容生产计划，再生成文章。");
    const result = await generateArticle.mutateAsync({ topicId });
    if (!result.articleId) throw new Error("生成未返回文章 ID");
    const topicIndex = Math.max(visibleTopics.findIndex(topic => topic?.id === topicId), 0);
    const topicForItem = visibleTopics.find(t => t?.id === topicId) ?? topics.find(t => t?.id === topicId);
    if (!topicForItem) throw new Error("选题不存在");
    const repeatHint = topicRepeatHint(topicForItem, visibleTopics);
    await addContentPlanItem.mutateAsync({
      projectId,
      planId,
      topicId,
      articleId: result.articleId,
      targetPlatform: cyclePick(contentPlan.targetPlatforms, topicIndex, "目标平台待确认"),
      contentType: cyclePick(contentPlan.contentTypes, topicIndex, topicForItem.articleType || "内容"),
      status: result.finalStatus === "质检通过" ? "质检通过" : "已生成",
      differentiationAngle: "基于已选优化任务和目标平台生成，生成时已自动完成质量检查与轻量差异度检查。",
      duplicateRisk: repeatHint.includes("较高") ? "高" : repeatHint.includes("集中") ? "中" : "低",
    });
    await Promise.all([
      utils.geo.articles.list.invalidate({ projectId }),
      utils.geo.articles.topics.list.invalidate({ projectId }),
      utils.geo.articles.latestQualityScores.invalidate({ projectId }),
      utils.geo.contentPlans.latest.invalidate({ projectId }),
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
      if (handleSubscriptionLimitMutationError(err)) {
        setError(SUBSCRIPTION_LIMIT_CONTENT_MESSAGE);
        return;
      }
      setError(contentGenerationErrorMessage(err instanceof Error ? err.message : "生成内容失败") ?? "生成内容失败");
    }
  }

  async function handleGenerateAllArticles() {
    if (!latestPlan?.id) {
      setError("请先保存本周内容生产计划，再生成文章。");
      return;
    }
    try {
      requireValidProjectId(selectedProjectId);
    } catch {
      setError("项目未选择，请从客户管理台进入当前企业后再试。");
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
        if (!topic?.id) continue;
        setBatchProgress({ current: i + 1, total });
        try {
          const result = await generateOneArticleAndPersist(topic?.id);
          ok += 1;
          if (result.articleId) startTransition(() => setSelectedArticleId(result.articleId));
          startTransition(() => setSelectedTopicId(topic?.id));
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
      const result = await qualityCheck.mutateAsync({ articleId: selectedArticle?.id });
      await Promise.all([
        utils.geo.articles.list.invalidate({ projectId: selectedProjectId }),
        utils.geo.articles.latestQualityScores.invalidate({ projectId: selectedProjectId }),
      ]);
      setMessage(formatQualityCheckMessage(result as { quality?: QualityScoreLike; autoRewriteCount?: number; finalStatus?: string }));
    } catch (err) {
      setError(toUserFacingErrorFromUnknown(err, "文章质量检查失败"));
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
    <div className="space-y-6 text-gray-900">
      <GeoStatusGuide stage="内容生产计划" completion={reviewPassed ? 88 : reviewComplete ? 80 : contentComplete ? 72 : topics.length > 0 ? 58 : planConfigured ? 44 : hasTasks ? 32 : 18} nextAction={reviewPassed ? "进入发布记录，连接内容发布渠道" : reviewComplete ? "查看质量检查结果并确认是否发布" : contentComplete ? "等待质量检查结果" : topics.length > 0 ? "选择选题并生成 1 篇内容" : planConfigured ? "生成本周内容选题" : "保存本周内容生产计划"} why="根据 内容诊断结果和优化任务，制定本周内容计划，并生成可用于发布前质量检查的内容资产。" risk="本页不做平台授权、不发布、不写发布记录。" ctaLabel="进入发布记录" ctaPath="/content-publishing" />
      <Card className="border-gray-200 bg-white/[0.04] text-gray-900">
        <CardHeader>
          <CardTitle className="text-white">内容生产计划</CardTitle>
          <CardDescription className="text-blue-600">本步骤用于根据 内容诊断结果和优化任务，制定本周内容计划，并生成可用于发布前质量检查的内容资产。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <BusinessPageProjectHeader projectName={selectedProject?.enterpriseName} testId="content-gen-project-header" />
          {contentLimitReached ? (
            <SubscriptionUpgradePrompt
              message={SUBSCRIPTION_LIMIT_CONTENT_MESSAGE}
              testId="content-generation-article-limit"
            />
          ) : null}
          <ActionState message={message} error={error || pageError} />
          {pageLoading ? <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">正在读取项目、企业资料、诊断结果、优化任务、内容计划、选题、文章和已有质量分...</div> : null}
          {projects.length === 0 ? <EmptyStep title="暂无项目" description="请先在客户管理台新建或选择客户项目，再完成内容诊断后生成内容。" /> : null}
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

          <section className="ai-glass-panel p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold text-white">1. 配置本周内容生产计划</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">保存后会写入数据库，刷新页面仍可读回，用于后续复盘本周选题、文章和质量检查结果。</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs ${planConfigured ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>{planConfigured ? "内容计划已保存" : "内容计划待保存"}</span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.7fr_0.5fr]">
              <label className="space-y-2 text-sm text-gray-600">
                <span className="font-medium text-gray-900">计划名称</span>
                <span className="block text-xs text-gray-500">给本周内容计划起一个名字，方便后续复盘。示例：5月第2周 内容计划</span>
                <input value={contentPlan.name} onChange={event => setContentPlan(plan => ({ ...plan, name: event.target.value }))} className={aiInput} />
              </label>
              <label className="space-y-2 text-sm text-gray-600">
                <span className="font-medium text-gray-900">周期开始日期</span>
                <span className="block text-xs text-gray-500">选择本周内容计划的开始时间。</span>
                <input type="date" value={contentPlan.weekStart} onChange={event => setContentPlan(plan => ({ ...plan, weekStart: event.target.value }))} className={aiInput} />
              </label>
              <label className="space-y-2 text-sm text-gray-600">
                <span className="font-medium text-gray-900">本周计划生成篇数</span>
                <span className="block text-xs text-gray-500">建议 3-5 篇，不建议一次生成过多。</span>
                <input type="number" min={1} max={10} value={contentPlan.weeklyCount} onChange={event => setContentPlan(plan => ({ ...plan, weeklyCount: Number(event.target.value) || 1 }))} className={aiInput} />
              </label>
            </div>
            <div className="mt-5">
              <p className="text-sm font-medium text-white">目标发布平台</p>
              <p className="mt-1 text-sm text-gray-400">选择本周内容将优先适配的平台。本页只配置内容计划，不连接平台、不发布。</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {platformMatrix.map(platform => (
                  <button key={platform.name} type="button" onClick={() => togglePlanValue("targetPlatforms", platform.name)} className={contentPlan.targetPlatforms.includes(platform.name) ? aiChipActive : aiChipIdle}>
                    <p className="font-medium text-white">{platformDisplayName(platform.name)}</p>
                    <p className="mt-1 text-blue-600">{platform.priority}</p>
                    <p className="mt-1">{platform.capability}</p>
                    <p className="mt-2 text-gray-400">{platform.geoValue}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5">
              <p className="text-sm font-medium text-white">内容类型</p>
              <p className="mt-1 text-sm text-gray-400">选择本周要补齐的内容资产类型，让内容围绕诊断缺口和优化任务展开。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {contentTypeOptions.map(type => (
                  <button key={type} type="button" onClick={() => togglePlanValue("contentTypes", type)} className={`rounded-full border px-3 py-2 text-sm ${contentPlan.contentTypes.includes(type) ? "border-blue-300 bg-blue-50 text-blue-800" : "border-gray-200 bg-white text-gray-600 hover:bg-white/[0.06]"}`}>{type}</button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-400">{latestPlan ? `已保存计划：${latestPlan.planName}。内容计划明细 ${contentPlanItems.length} 条。` : "保存计划后才能生成本周内容选题。"}</p>
              <Button onClick={handleSaveContentPlan} disabled={!selectedProjectId || !planFormComplete || savingPlan} variant="ai">{savingPlan ? "正在保存内容计划" : latestPlan ? "更新内容计划" : "保存内容计划"}</Button>
            </div>
          </section>

          <section className="ai-glass-panel p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold text-white">2. 选择优化任务进入内容计划</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">可以选择一个或多个任务进入本周计划；生成文章时会选择其中一个任务对应的选题。</p>
              </div>
              <Button onClick={() => selectedProjectId && setLocation(buildProjectUrl("/ai-diagnosis", selectedProjectId))} variant="outline" className="border-gray-200 text-blue-700 hover:bg-white/10">查看 内容诊断</Button>
            </div>
            {tasks.length === 0 ? <EmptyStep title="暂无优化任务" description="完成 内容诊断并生成任务后，才能基于任务生成内容。" /> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{tasks.map(task => {
              const card = parseGeoTaskCard(task.executionSuggestion);
              return (
                <button key={task?.id} type="button" onClick={() => togglePlanTask(task?.id)} className={contentPlan.taskIds.includes(task?.id) ? aiChipActive : aiChipIdle}>
                  <p className="font-medium text-white">{contentPlan.taskIds.includes(task?.id) ? "已纳入计划：" : ""}{task.taskName}</p>
                  <p className="mt-1 text-blue-600">{task.taskType || "内容任务"} · {task.priority || "优先级未标注"}</p>
                  <p className="mt-2 text-gray-400">{task.generationReason || "该任务来自 内容诊断后的内容缺口判断。"}</p>
                  {card ? (
                    <div className="mt-2 space-y-1 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left text-xs text-gray-600">
                      <p><span className="text-gray-500">建议标题</span><span className="mt-0.5 block text-sm text-blue-700">《{card.articleTitle}》</span></p>
                      <p><span className="text-gray-500">核心论点</span><span className="mt-0.5 block">{card.keyPoints.join("；")}</span></p>
                      <p><span className="text-gray-500">关键词</span><span className="mt-0.5 block">{card.targetKeywords.join("、")}</span></p>
                      <p><span className="text-gray-500">平台</span><span className="mt-0.5 block">{card.recommendedPlatform.join("、")}</span></p>
                    </div>
                  ) : null}
                </button>
              );
            })}</div>}
          </section>

          <section className="ai-glass-panel p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold text-white">3. 生成并选择本周内容选题</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">选题与优化任务一一对应，标题与类型来自任务卡片。点击按钮从任务同步选题列表。重复风险仅为轻量规则提示。</p>
              </div>
              <Button onClick={handleGenerateTopics} disabled={!pageReady || generatingTopics || contentGenerating} variant="ai">{generatingTopics ? "正在生成本周内容选题" : "生成本周内容选题"}</Button>
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
                    if (!topic?.id) return null;
                    const taskForTopic = tasks.find(t => t?.id === topic.optimizationTaskId);
                    const topicCard = parseGeoTaskCard(taskForTopic?.executionSuggestion ?? null);
                    const platformLine = topicCard?.recommendedPlatform?.length ? topicCard.recommendedPlatform.join("、") : "—";
                    const contentTypeLine = topicCard?.contentType || topic.articleType || "—";
                    return (
                      <button key={topic?.id} type="button" onClick={() => setSelectedTopicId(topic?.id)} className={selectedTopicId === topic?.id ? aiChipActive : aiChipIdle}>
                        <p className="font-medium text-white">{topic.title}</p>
                        <p className="mt-2 text-gray-400">优化任务：{taskForTopic?.taskName ?? "—"}</p>
                        {topicCard?.keyPoints?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {topicCard.keyPoints.map((kp, i) => (
                              <span key={i} className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-blue-700">{kp}</span>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-2 text-xs text-gray-500">目标关键词：{topicCard?.targetKeywords?.length ? topicCard.targetKeywords.join("、") : "—"}</p>
                        <p className="mt-1 text-xs text-gray-500">推荐平台：{platformLine}</p>
                        <p className="mt-1 text-xs text-gray-500">内容类型：{contentTypeLine}</p>
                        <p className="mt-2 text-xs text-amber-100">重复风险提示：{topicRepeatHint(topic, topics)}</p>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </section>

          <section className="ai-glass-panel p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold text-white">4. 生成内容</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">可针对当前选中选题生成 1 篇，或按当前选题列表顺序串行生成全部；每篇完成后自动质量检查，结果在下方列表与质量检查区实时更新。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleGenerateArticle}
                  disabled={!selectedTopicId || generatingTopics || contentGenerating || checkingQuality}
                  variant="ai"
                >
                  {generatingArticle && !batchGeneratingAll ? "生成中…" : "生成 1 篇文章"}
                </Button>
                <Button
                  onClick={() => void handleGenerateAllArticles()}
                  disabled={visibleTopics.length === 0 || generatingTopics || contentGenerating || checkingQuality}
                  variant="outline"
                  className="border-gray-200 text-blue-700 hover:bg-white/10"
                >
                  {batchGeneratingAll && batchProgress
                    ? `生成中（${batchProgress.current}/${batchProgress.total}）…`
                    : `一键生成全部（${visibleTopics.length}篇）`}
                </Button>
              </div>
            </div>
            {!selectedTopic ? <EmptyStep title="尚未选择选题" description="请先生成并选择一个内容选题。" /> : (() => {
              const stTask = tasks.find(t => t?.id === selectedTopic.optimizationTaskId);
              const stCard = parseGeoTaskCard(stTask?.executionSuggestion ?? null);
              return (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-6 text-gray-600">
                  <p className="font-medium text-white">当前选题：{selectedTopic.title}</p>
                  <p className="mt-1">优化任务：{stTask?.taskName ?? "—"}</p>
                  <p className="mt-1">推荐平台：{stCard?.recommendedPlatform?.length ? stCard.recommendedPlatform.join("、") : "—"}</p>
                  <p className="mt-1">内容类型：{stCard?.contentType ?? selectedTopic.articleType ?? "—"}</p>
                </div>
              );
            })()}
            {articlesSorted.length > 0 ? (
              <div className={`mt-4 p-4 ${aiSubPanel}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">已生成文章</p>
                <p className="mt-1 text-xs text-gray-400">按生成时间倒序；点击一行可查看正文与下方质量检查详情。</p>
                <ul className="mt-3 divide-y divide-white/10">
                  {articlesSorted.map(article => {
                    const q = scores.find(s => s.articleId === article?.id);
                    const pass = articleQualityPassesGate(article, q);
                    const scoreLabel = q?.totalScore != null ? `${q.totalScore} 分` : "—";
                    return (
                      <li key={article?.id}>
                        <button
                          type="button"
                          onClick={() => {
                            startTransition(() => {
                              setSelectedArticleId(article?.id);
                              if (article.topicId != null) setSelectedTopicId(article.topicId);
                            });
                          }}
                          className={`flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left text-sm transition hover:bg-white/[0.04] ${selectedArticleId === article?.id ? "text-blue-700" : "text-gray-700"}`}
                        >
                          <span className="min-w-0 flex-1 font-medium text-white">
                            #{article?.id} · {article.title || "无标题"}
                          </span>
                          <span className="shrink-0 text-xs text-gray-400">质量 {scoreLabel}</span>
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
                <div className="rounded-3xl border border-gray-200 bg-white p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm text-blue-600">文章 #{selectedArticle?.id} · {cyclePick(contentPlan.targetPlatforms, 0, "目标平台待确认")} · {cyclePick(contentPlan.contentTypes, 0, selectedArticle.articleType || "内容")}</p>
                      <p className="mt-2 text-xs text-gray-500">模型原标题：{articleRowFromList?.title ?? selectedArticle.title}</p>
                    </div>
                    <span className="rounded-full border border-gray-200 bg-white/[0.04] px-3 py-1 text-xs text-gray-700">{selectedArticle.status || (selectedQuality ? "已检查" : "生成中")}</span>
                  </div>
                  <div className="mt-5 space-y-4">
                    <div className="ai-glass-panel p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">发布标题</p>
                      <p className="mt-1 text-xs text-gray-500">已按企业简称处理工商全称，可直接微调后复制。</p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                        <input
                          value={publishTitleEdit}
                          onChange={event => setPublishTitleEdit(event.target.value)}
                          className={`${aiInput} min-h-10 flex-1 py-2`}
                          placeholder="发布用标题"
                          aria-label="发布标题"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 border-gray-200 text-blue-700 hover:bg-white/10 sm:w-28"
                          onClick={() => void copyPublishField(publishTitleEdit, "title")}
                        >
                          {copyFeedback === "title" ? "已复制" : "复制标题"}
                        </Button>
                      </div>
                    </div>
                    <div className="ai-glass-panel p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">正文（Markdown）</p>
                          <p className="mt-1 text-xs text-gray-500">完整正文，复制后到平台编辑器粘贴。</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 border-gray-200 text-blue-700 hover:bg-white/10 sm:w-28"
                          onClick={() => void copyPublishField(publishBodyMarkdown, "body")}
                        >
                          {copyFeedback === "body" ? "已复制" : "复制正文"}
                        </Button>
                      </div>
                      <textarea
                        readOnly
                        value={publishBodyMarkdown}
                        className={`mt-3 max-h-[520px] min-h-[240px] w-full resize-y p-3 font-mono text-sm leading-6 text-gray-700 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/30 ${aiInput}`}
                        aria-label="文章 Markdown 正文"
                      />
                    </div>
                    <p className="text-center text-sm text-gray-400">复制后前往对应平台粘贴发布</p>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="ai-glass-panel p-4 text-sm leading-6 text-gray-600">
                      <p className="font-medium text-white">优化任务</p>
                      <p className="mt-2">{textValue(basis.optimizationTask ?? selectedTask?.taskName)}</p>
                    </div>
                    <div className="ai-glass-panel p-4 text-sm leading-6 text-gray-600">
                      <p className="font-medium text-white">目标问题</p>
                      <p className="mt-2">{textValue(basis.customerQuestion)}</p>
                    </div>
                    <div className="ai-glass-panel p-4 text-sm leading-6 text-gray-600">
                      <p className="font-medium text-white">本周计划归属</p>
                      <p className="mt-2">计划：{contentPlan.name || "未命名计划"}</p>
                      <p className="mt-1">目标平台：{cyclePick(contentPlan.targetPlatforms, 0, "未选择目标平台")}</p>
                      <p className="mt-1">内容类型：{cyclePick(contentPlan.contentTypes, 0, selectedArticle.articleType || "内容")}</p>
                    </div>
                    <div className="ai-glass-panel p-4 text-sm leading-6 text-gray-600">
                      <p className="font-medium text-white">企业资料依据</p>
                      {enterpriseMaterials.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5">{enterpriseMaterials.slice(0, 4).map((item, index) => <li key={index}>{textValue(item.name ?? item.title ?? item.sourceName, "企业资料")}：{textValue(item.summary ?? item.content ?? item.evidence, "已纳入生成依据")}</li>)}</ul> : assetSources.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5">{assetSources.slice(0, 4).map((source, index) => <li key={index}>{source.title || source.sourceType || `资料来源 ${index + 1}`}</li>)}</ul> : <p className="mt-2">企业资料依据较少，发布前建议补充来源和案例。</p>}
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 text-sm text-gray-600 md:grid-cols-3">
                    <span className="ai-glass-panel px-4 py-3">质量状态：{selectedQuality ? `${selectedQuality.totalScore} 分` : "生成后自动质量检查"}</span>
                    <span className="ai-glass-panel px-4 py-3">差异度：{selectedArticle ? duplicateRiskLabel(antiDuplication.similarityRisk) : "待检查"}</span>
                    <span className="ai-glass-panel px-4 py-3">发布准备：{reviewPassed ? "可进入人工确认" : reviewComplete ? "需修订或复核" : "待生成"}</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="ai-glass-panel p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="font-semibold text-white">5. 文章质量检查</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">生成文章后会自动完成质量检查与差异度检查；下方展示分数、合规阻断（如有）与发布前可优化建议。</p>
              </div>
              {canReQualityCheck ? (
                <Button onClick={handleQualityReview} disabled={!selectedArticle || checkingQuality || generatingTopics || contentGenerating} variant="outline" className="border-gray-200 text-blue-700 hover:bg-white/10">{checkingQuality ? "重新检查中…" : "重新检查"}</Button>
              ) : null}
            </div>
            {!selectedArticle ? <EmptyStep title="文章为空" description="请先生成 1 篇文章，系统会自动完成质量检查并在此展示结果。" /> : null}
            {selectedArticle && !selectedQuality && !contentGenerating ? <EmptyStep title="等待质量检查结果" description="文章已生成，正在等待质量检查结果回写；若长时间无结果，可点击「重新检查」。" /> : null}
            {contentGenerating ? (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                {batchGeneratingAll && batchProgress
                  ? `正在批量生成：第 ${batchProgress.current} / ${batchProgress.total} 篇（串行执行生成与质量检查）…`
                  : "正在生成正文并执行 质量检查…"}
              </div>
            ) : null}
            {selectedQuality ? <div className="mt-4 space-y-4">
              <div className={`rounded-3xl border p-5 ${reviewBlocked ? "border-amber-300/20 bg-amber-400/10 text-amber-50" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-50"}`}>
                <p className="text-sm text-blue-700">质量总分</p>
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
                <div className="rounded-3xl border border-gray-200 bg-white p-5 text-sm leading-6 text-gray-600">
                  <h3 className="font-semibold text-white">阻断原因（仅合规）</h3>
                  {qualityBlocked && stringList(selectedQuality.blockReasons).length > 0 ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5">{stringList(selectedQuality.blockReasons).map((reason, index) => <li key={index}>{reason}</li>)}</ul>
                  ) : (
                    <p className="mt-3 text-emerald-100">未发现合规类阻断。</p>
                  )}
                </div>
                <div className="rounded-3xl border border-gray-200 bg-white p-5 text-sm leading-6 text-gray-600">
                  <h3 className="font-semibold text-white">发布前可优化的建议（非必须）</h3>
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                  {stringList((selectedQuality as any).optimizationSuggestions ?? []).map((suggestion, index) => <li key={`s-${index}`}>{suggestion}</li>)}
                    {stringList(consistencyCheck.suggestions).map((suggestion, index) => <li key={`c-${index}`}>{suggestion}</li>)}
                    {antiDuplication.blocked ? <li>与历史内容高度重复，建议调整标题或差异化角度后再发布。</li> : null}
                    <li>{antiDuplication.rewriteSuggestion}</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 text-sm leading-6 text-gray-600">
                <h3 className="font-semibold text-white">与历史文章差异度</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <p>标题是否重复：{antiDuplication.titleRepeated ? "是" : "否"}</p>
                  <p>选题是否重复：{antiDuplication.topicRepeated ? "是" : "否"}</p>
                  <p>内容结构是否重复：{antiDuplication.structureRepeated ? "是" : "否"}</p>
                  <p>核心观点是否重复：{antiDuplication.viewpointRepeated ? "是" : "否"}</p>
                  <p>同一优化任务下是否连续相似：{antiDuplication.sameTaskRepeated ? "是" : "否"}</p>
                  <p>同周是否重复覆盖同一问题：{antiDuplication.sameWeekRepeated ? "是" : "否"}</p>
                </div>
                <p className="mt-3 text-blue-700">内容重复风险：{duplicateRiskStatus(antiDuplication.similarityRisk)}（轻量规则，不作为合规阻断）。</p>
                <p className="mt-2">差异化角度建议：{antiDuplication.differentiationAngle}</p>
                {antiDuplication.similarArticles.length > 0 ? <div className="mt-3"><p className="font-medium text-white">相似历史文章</p><ul className="mt-2 list-disc space-y-1 pl-5">{antiDuplication.similarArticles.map((item, index) => <li key={item?.id ?? `similar-${index}`}>{item?.title ?? "无标题"}</li>)}</ul></div> : <p className="mt-3 text-emerald-100">未发现明显相似历史文章。</p>}
                <p className="mt-3 text-amber-100">差异度结果当前为轻量规则计算，未写入数据库；不是复杂语义向量相似度。</p>
              </div>
            </div> : null}
          </section>

          {reviewPassed ? <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">内容已完成生成和 质量检查（达到参考分或已通过）。下一步：进入发布记录，连接内容发布渠道，并进行人工确认发布。</div> : reviewComplete && selectedQuality && !qualityBlocked ? <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">内容已生成；当前为「建议修订后发布，也可直接发布」。可按下方建议优化，或进入发布记录人工复核。</div> : reviewComplete && qualityBlocked ? <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">需要修改：请先处理合规类问题后再继续发布流程。</div> : contentComplete ? <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">内容已生成。系统正在或即将完成质量检查，请稍候查看结果。</div> : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={() => selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))} disabled={!reviewComplete} variant="outline" className="border-gray-200 text-blue-700 hover:bg-white/10">进入发布记录</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** 外层持有项目选择状态；内层按 selectedProjectId 为 key 重挂载，避免跨项目本地状态与 Fiber 不一致 */
export function ContentGenerationFlowPage() {
  const selection = useProjectSelection();
  if (!selection.enabled && !selection.isLoading) {
    return (
      <AiPageShell>
        <ProjectContextEmptyState />
      </AiPageShell>
    );
  }
  return <ContentGenerationFlowInner key={String(selection.selectedProjectId ?? "none")} selection={selection} />;
}

function AiMentionBadge({
  status,
  monitoringId,
  projectId,
  onNavigate,
}: {
  status: string | null;
  monitoringId: number | null;
  projectId: number;
  onNavigate: (path: string) => void;
}) {
  const handleClick = () => {
    const params = new URLSearchParams({ projectId: String(projectId) });
    if (monitoringId) params.set("recordId", String(monitoringId));
    onNavigate(`/inclusion-monitoring?${params.toString()}`);
  };

  if (!status || status === "未检测") {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        className="ml-2 inline-flex cursor-pointer items-center rounded px-2 py-0.5 text-xs bg-gray-700 text-gray-400 hover:bg-gray-600"
        title="点击查看收录监测详情"
      >
        未检测
      </span>
    );
  }

  if (status === "已提及") {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        className="ml-2 inline-flex cursor-pointer items-center rounded px-2 py-0.5 text-xs bg-green-900 text-green-400 hover:bg-green-800"
        title="点击查看收录监测详情"
      >
        ✓ AI已提及
      </span>
    );
  }

  if (status === "未提及") {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        className="ml-2 inline-flex cursor-pointer items-center rounded px-2 py-0.5 text-xs bg-yellow-900 text-yellow-400 hover:bg-yellow-800"
        title="点击查看收录监测详情"
      >
        AI未提及
      </span>
    );
  }

  return null;
}

export { ContentPublishingCenterPage as ContentPublishingFlowPage } from "./ContentPublishingCenterPage";

export function InclusionMonitoringFlowPage() {
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const selection = useProjectSelection();
  const { projects, selectedProjectId, selectedProject, projectInput, enabled, isLoading: projectsLoading } = selection;
  const workspaceSummaryQuery = trpc.geo.workspace.summary.useQuery(
    { projectId: selectedProjectId! },
    { enabled: Boolean(selectedProjectId) },
  );
  const monitoringQuery = trpc.geo.articles.inclusionMonitoringRecords.useQuery(projectInput, { enabled });
  const publishRecordsQuery = trpc.geo.articles.publishRecords.useQuery(projectInput, { enabled });
  const records = (monitoringQuery.data ?? []).filter(
    record => record != null && typeof record?.id === "number",
  ) as MonitoringRecordLike[];
  const publishRecords = (publishRecordsQuery.data ?? []) as PublishRecordLike[];
  const publishRecordCount = publishRecords.length;
  const publishRecordsWithLink = publishRecords.filter(record => Boolean(recordPublicLink(record)));
  const missingPublicLinkCount = Math.max(0, publishRecordCount - publishRecordsWithLink.length);
  const hasPublishRecords = publishRecordCount > 0;
  const hasPublicLinks = publishRecordsWithLink.length > 0;
  const loading = monitoringQuery.isLoading || publishRecordsQuery.isLoading;
  const [runningRecordId, setRunningRecordId] = useState<number | null>(null);
  const [selectedTestStage, setSelectedTestStage] = useState<AiTestStage>("manual_check");
  const [linkCheckTriggered, setLinkCheckTriggered] = useState(false);

  const checkPublishLinks = trpc.geo.inclusionMonitoring.checkPublishLinks.useMutation({
    onSuccess: async () => {
      if (selectedProjectId) {
        await utils.geo.articles.inclusionMonitoringRecords.invalidate({ projectId: selectedProjectId });
      }
      await monitoringQuery.refetch();
    },
  });

  useEffect(() => {
    setLinkCheckTriggered(false);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || records.length === 0 || linkCheckTriggered || checkPublishLinks.isPending) return;
    setLinkCheckTriggered(true);
    checkPublishLinks.mutate({ projectId: selectedProjectId });
  }, [selectedProjectId, records.length, linkCheckTriggered, checkPublishLinks.isPending]);

  const urlParams = useMemo(() => {
    const search = location.includes("?") ? location.slice(location.indexOf("?")) : window.location.search;
    return new URLSearchParams(search);
  }, [location]);
  const targetRecordId = urlParams.get("recordId");

  useEffect(() => {
    if (!targetRecordId || records.length === 0) return;
    const el = document.getElementById(`monitoring-record-${targetRecordId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.outline = "2px solid #3b82f6";
    const timer = window.setTimeout(() => {
      el.style.outline = "";
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [targetRecordId, records]);

  const backfillMonitoring = trpc.geo.inclusionMonitoring.backfill.useMutation({
    onSuccess: async data => {
      toast.success(data.backfilled > 0 ? `已补录 ${data.backfilled} 条监测记录` : "暂无需要补录的发布记录");
      if (selectedProjectId) {
        await utils.geo.articles.inclusionMonitoringRecords.invalidate({ projectId: selectedProjectId });
        await utils.geo.publishRecords.listWithStatus.invalidate({ projectId: selectedProjectId });
      }
      await monitoringQuery.refetch();
    },
    onError: e => toast.error(toUserFacingErrorFromUnknown(e, "补录监测记录失败")),
  });

  const runCheck = trpc.geo.aiMentionCheck.run.useMutation({
    onSuccess: async (data, variables) => {
      const stageLabel = MONITORING_TEST_STAGE_DONE_LABEL[variables.testStage ?? "manual_check"];
      toast.success(
        `${stageLabel}已更新（已保留其他阶段测试结果）：提及率 ${Math.round(data.mentionRate * 100)}%，推荐率 ${Math.round(data.recommendRate * 100)}%`,
      );
      if (selectedProjectId) {
        await utils.geo.articles.inclusionMonitoringRecords.invalidate({ projectId: selectedProjectId });
        await utils.geo.publishRecords.listWithStatus.invalidate({ projectId: selectedProjectId });
      }
      await monitoringQuery.refetch();
    },
    onError: e => toast.error(toUserFacingErrorFromUnknown(e, "监测检测失败")),
    onSettled: () => setRunningRecordId(null),
  });

  const aiAggregate = useMemo(
    () =>
      aggregateAiTestEvidence(
        records.map(record => ({
          monitoringRecordId: record.id,
          results: Array.isArray(record.aiTestResults) ? record.aiTestResults : [],
        })),
      ),
    [records],
  );
  const aiEngineRows = useMemo(() => {
    const rows = records.flatMap(record => (Array.isArray(record.aiTestResults) ? record.aiTestResults : []));
    const map = new Map<
      string,
      { engine: string; mention: number; recommend: number; cited: number; total: number }
    >();
    for (const row of rows) {
      const key = row.engineName || row.engine || "未知引擎";
      const prev = map.get(key) ?? { engine: key, mention: 0, recommend: 0, cited: 0, total: 0 };
      const mentioned = row.mentionsBrand ?? row.mentionedBrand ?? false;
      const recommended = row.recommendsBrand ?? row.recommendedBrand ?? false;
      const cited = Array.isArray(row.citedUrls) ? row.citedUrls.length > 0 : false;
      prev.total += 1;
      if (mentioned) prev.mention += 1;
      if (recommended) prev.recommend += 1;
      if (cited) prev.cited += 1;
      map.set(key, prev);
    }
    return Array.from(map.values());
  }, [records]);
  const baselineMentionRate = workspaceSummaryQuery.data?.brandMentionRate ?? null;
  const baselineRecommendRate = workspaceSummaryQuery.data?.recommendRate ?? null;
  const mentionDelta =
    baselineMentionRate != null && aiAggregate.questionCount > 0
      ? aiAggregate.mentionRate - baselineMentionRate
      : null;
  const recommendDelta =
    baselineRecommendRate != null && aiAggregate.questionCount > 0
      ? aiAggregate.recommendRate - baselineRecommendRate
      : null;

  if (!enabled && !projectsLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center max-w-md shadow-sm">
          <RadioTower className="mx-auto h-10 w-10 text-blue-600" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">收录监测</h2>
          <p className="mt-2 text-sm text-gray-500">请先选择一个企业项目，再查看收录监测状态。</p>
          <Button className="mt-5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLocation("/clients")}>前往企业项目</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-gray-500">
        <Spinner className="size-6 text-blue-600" />
        <p className="text-sm">正在加载收录监测数据…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* --- 页面标题区 --- */}
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">收录监测</h1>
        <p className="text-sm text-gray-500">
          以发布记录为主线跟踪收录与复测。先完成发布与公开链接回填，再执行 T1/T2/T3 复测并对比 T0 基线。
        </p>
        <span className="sr-only">跟踪已发布内容的收录状态与 AI 搜索实测结果</span>
      </header>

      <FirstUseHintBanner
        storageKey={FIRST_USE_HINT_KEYS.inclusionMonitoring}
        message="发布内容后在这里追踪AI是否收录了你的内容"
        data-testid="first-use-hint-inclusion-monitoring"
      />

      {hasPublicLinks ? <RetestPlanPanel plan={workspaceSummaryQuery.data?.retestPlan} /> : null}

      {workspaceSummaryQuery.data?.retestDueReminder && selectedProjectId ? (
        <RetestDueReminderCard
          reminder={workspaceSummaryQuery.data.retestDueReminder}
          testId="inclusion-monitoring-retest-due-reminder"
          onGoRetest={() =>
            setLocation(
              buildProjectUrl(
                workspaceSummaryQuery.data!.retestDueReminder!.ctaPath,
                selectedProjectId,
              ),
            )
          }
        />
      ) : null}

      {/* --- 收录概览卡 --- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">监测记录数</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{records.length > 0 ? records.length : "0"}</p>
          <p className="mt-1 text-xs text-gray-400">已创建的监测卡片</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">已完成实测</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{records.filter(r => r.lastAiTestedAt).length > 0 ? records.filter(r => r.lastAiTestedAt).length : "0"}</p>
          <p className="mt-1 text-xs text-gray-400">已执行 AI 搜索实测</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">发布记录数</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{publishRecordCount > 0 ? publishRecordCount : "0"}</p>
          <p className="mt-1 text-xs text-gray-400">含人工登记与 Agent 发布</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500">待检测</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{records.filter(r => !r.lastAiTestedAt).length > 0 ? records.filter(r => !r.lastAiTestedAt).length : "0"}</p>
          <p className="mt-1 text-xs text-gray-400">尚未执行 AI 实测</p>
        </div>
      </div>

      {!hasPublishRecords ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <RadioTower className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-700">暂无可监测内容</p>
          <p className="mt-1 text-xs text-gray-500">请先完成平台适配发布并登记发布记录，再进入收录监测与复测。</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))}
            >
              去发布内容
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gray-200 text-gray-700 hover:bg-gray-50"
              onClick={() => selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))}
            >
              回填公开链接
            </Button>
          </div>
        </div>
      ) : null}

      {hasPublishRecords && !hasPublicLinks ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm font-semibold text-amber-900">已有发布记录，但缺少公开链接。请先回填公开链接，系统才能安排复测。</p>
          <p className="mt-1 text-xs text-amber-800">当前缺少公开链接：{missingPublicLinkCount} 条</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))}
            >
              去发布内容
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-amber-300 text-amber-900 hover:bg-amber-100"
              onClick={() => selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))}
            >
              回填公开链接
            </Button>
          </div>
        </div>
      ) : null}

      {/* --- 操作区：补录 + 前往发布 --- */}
      {selectedProjectId && publishRecordCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            disabled={backfillMonitoring.isPending}
            onClick={() => backfillMonitoring.mutate({ projectId: selectedProjectId })}
          >
            {backfillMonitoring.isPending ? "补录中…" : "补录监测记录"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-gray-200 text-gray-700 hover:bg-gray-50"
            onClick={() => selectedProjectId && setLocation(buildProjectUrl("/content-publishing", selectedProjectId))}
          >
            前往平台适配发布
          </Button>
        </div>
      ) : null}

      {/* --- 空状态 --- */}
      {hasPublishRecords && hasPublicLinks && records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <RadioTower className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-700">暂无可监测内容</p>
          <p className="mt-1 text-xs text-gray-500">
            当前项目已有发布记录与公开链接，可点击「补录监测记录」生成复测卡片。
          </p>
          {selectedProjectId ? (
            <Button
              type="button"
              className="mt-5 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={backfillMonitoring.isPending}
              onClick={() => backfillMonitoring.mutate({ projectId: selectedProjectId })}
            >
              {backfillMonitoring.isPending ? "补录中…" : "为已有发布记录补录监测"}
            </Button>
          ) : null}
        </div>
      ) : hasPublishRecords && hasPublicLinks ? (
        /* --- 监测记录列表 --- */
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">T1 / T2 / T3 复测计划</h2>
            <p className="mt-1 text-xs text-gray-500">T1：发布后 7 天，T2：发布后 30 天，T3：发布后 90 天（P0 为手动复测）。</p>
          </div>
          {aiAggregate.questionCount > 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">AI 搜索复测结果（含 T0 对比）</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">是否被提及</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {Math.round(aiAggregate.mentionRate * 100)}%
                    {mentionDelta != null ? `（较 T0 ${mentionDelta >= 0 ? "+" : ""}${Math.round(mentionDelta * 100)}%）` : ""}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">是否被推荐</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {Math.round(aiAggregate.recommendRate * 100)}%
                    {recommendDelta != null ? `（较 T0 ${recommendDelta >= 0 ? "+" : ""}${Math.round(recommendDelta * 100)}%）` : ""}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">是否被引用</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {aiEngineRows.reduce((sum, row) => sum + row.cited, 0)} / {aiEngineRows.reduce((sum, row) => sum + row.total, 0)}
                  </p>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2 pr-4">平台</th>
                      <th className="py-2 pr-4">提及</th>
                      <th className="py-2 pr-4">推荐</th>
                      <th className="py-2 pr-4">引用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiEngineRows.map(row => (
                      <tr key={row.engine} className="border-t border-gray-100 text-gray-800">
                        <td className="py-2 pr-4">{row.engine}</td>
                        <td className="py-2 pr-4">{row.mention > 0 ? "是" : "否"}（{row.mention}/{row.total}）</td>
                        <td className="py-2 pr-4">{row.recommend > 0 ? "是" : "否"}（{row.recommend}/{row.total}）</td>
                        <td className="py-2 pr-4">{row.cited > 0 ? "是" : "否"}（{row.cited}/{row.total}）</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <h2 className="text-base font-semibold text-gray-900">监测记录</h2>
          <p className="text-xs text-gray-500">选择测试阶段后点击「执行AI实测」，将向豆包 / DeepSeek / Kimi 提问并更新提及与推荐状态。</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {records.map(record => {
              if (!record?.id) return null;
              const recordId = record?.id;
              return (
              <div
                id={`monitoring-record-${recordId}`}
                key={recordId}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {record.articleTitle?.trim() ? record.articleTitle : `文章 #${record.articleId}`}
                    </p>
                    {record.gapLinkDisplay ? (
                      <p className="mt-1 text-xs text-gray-700" data-testid={`monitoring-gap-link-${recordId}`}>
                        {record.gapLinkDisplay}
                      </p>
                    ) : record.linkedDetectionQuestion ? (
                      <p className="mt-1 text-xs text-gray-600">
                        关联检测问题：{record.linkedDetectionQuestion}
                      </p>
                    ) : null}
                    {record.questionMentionRateChange?.summaryLine ? (
                      <p className="mt-1 text-xs text-blue-800" data-testid={`monitoring-mention-rate-${recordId}`}>
                        {record.questionMentionRateChange.summaryLine}
                      </p>
                    ) : null}
                    {toAbsoluteUrl(record.publicUrl) ? (
                      <a
                        className="mt-1 inline-block text-sm text-blue-600 hover:underline truncate max-w-full"
                        href={toAbsoluteUrl(record.publicUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看公开链接
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-gray-400">公开链接未回填</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      链接可访问性：{publishLinkAccessLabel(record.linkAccess)}
                      {record.linkAccess?.checkedAt
                        ? `（检测于 ${formatTime(record.linkAccess.checkedAt)}）`
                        : checkPublishLinks.isPending
                          ? "（检测中…）"
                          : ""}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      最近检测：{formatTime(record.lastCheckedAt) === "未记录" ? "未检测" : formatTime(record.lastCheckedAt)}
                    </p>
                    {record.lastAiTestedAt ? (
                      <p className="mt-0.5 text-xs text-gray-400">
                        AI 实测：{formatTime(record.lastAiTestedAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <RadioTower className="h-5 w-5 text-blue-500" />
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-blue-600 px-3 text-xs hover:bg-blue-700 text-white shadow-sm"
                      disabled={!selectedProjectId || runCheck.isPending}
                      onClick={() => {
                        if (!selectedProjectId) return;
                        if (record.nextAction === "查看实测结果") {
                          const detail = document.getElementById(`monitoring-ai-results-${recordId}`);
                          detail?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                          return;
                        }
                        setRunningRecordId(recordId);
                        runCheck.mutate({
                          projectId: selectedProjectId,
                          recordId,
                          engines: ["doubao", "deepseek", "kimi"],
                          testStage: selectedTestStage,
                        });
                      }}
                    >
                      {runCheck.isPending && runningRecordId === recordId
                        ? "实测中…"
                        : record.nextAction === "查看实测结果"
                          ? "查看实测结果"
                          : "执行AI实测"}
                    </Button>
                  </div>
                </div>

                {/* 状态指标 */}
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[11px] font-medium text-gray-500">收录状态</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-900">{record.inclusionStatus || "未检测"}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[11px] font-medium text-gray-500">AI 提及</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-900">{record.aiMentionStatus || "未检测"}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-[11px] font-medium text-gray-500">AI 推荐</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-900">{record.aiRecommendStatus || "未检测"}</p>
                  </div>
                </div>

                {/* 当前建议 */}
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  建议操作：{record.nextAction ?? "执行AI实测"}
                </p>
                <p className="mt-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  优化建议：{record.currentSuggestion ?? "保持监测并更新客户报告。"}
                </p>

                {/* 测试阶段 + 实测按钮 */}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm text-gray-700">
                    <span className="text-xs font-medium text-gray-500">测试阶段</span>
                    <select
                      value={selectedTestStage}
                      onChange={e => setSelectedTestStage(e.target.value as AiTestStage)}
                      disabled={runCheck.isPending}
                      className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    >
                      {MONITORING_TEST_STAGE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    disabled={!selectedProjectId || runCheck.isPending}
                    onClick={() => {
                      if (!selectedProjectId) return;
                      setRunningRecordId(recordId);
                      runCheck.mutate({
                        projectId: selectedProjectId,
                        recordId,
                        engines: ["doubao", "deepseek", "kimi"],
                        testStage: selectedTestStage,
                      });
                    }}
                  >
                    {runCheck.isPending && runningRecordId === recordId ? "实测中…" : "执行AI实测"}
                  </Button>
                </div>

                {/* 实测明细 */}
                {record.aiTestResults && record.aiTestResults.length > 0 ? (
                  <div
                    id={`monitoring-ai-results-${recordId}`}
                    className="mt-4 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3"
                  >
                    <p className="text-xs font-medium text-gray-600">实测明细</p>
                    {record.aiTestResults.map((r, i) => (
                      <div
                        key={`${r.engine}-${i}`}
                        className="rounded-lg bg-white border border-gray-100 px-3 py-2 text-xs text-gray-700"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{r.engineName ?? r.engine}</span>
                            <span className={`${(r.mentionedBrand ?? r.mentionsBrand) ? "text-emerald-600" : "text-gray-400"}`}>
                              {(r.mentionedBrand ?? r.mentionsBrand) ? "提及" : "未提及"}
                            </span>
                            <span className={`${(r.recommendedBrand ?? r.recommendsBrand) ? "text-blue-600" : "text-gray-400"}`}>
                              {(r.recommendedBrand ?? r.recommendsBrand) ? "推荐" : "—"}
                            </span>
                            {r.sentiment ? (
                              <span className="text-gray-500">{sentimentLabelCn(r.sentiment as "positive" | "neutral" | "negative")}</span>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => setLocation(buildEvidenceDetailPath(recordId, i))}
                          >
                            查看证据
                          </Button>
                        </div>
                        <p className="mt-1 line-clamp-2 text-gray-500">{r.question}</p>
                        {!(r.mentionedBrand ?? r.mentionsBrand) && isAiTestMissReason(r.missReason) ? (
                          <p className="mt-2 text-xs leading-relaxed text-amber-700">
                            未提及原因：{missReasonLabelCn(r.missReason)}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
            })}
          </div>
        </div>
      ) : null}

      {/* --- 下一步建议 --- */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">下一步建议</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          {records.length === 0 ? (
            <li className="text-gray-500">完成平台适配发布并回填公开链接后，可在此执行 AI 搜索实测。</li>
          ) : records.filter(r => !r.lastAiTestedAt).length > 0 ? (
            <li>对 {records.filter(r => !r.lastAiTestedAt).length} 条未实测记录执行 AI 搜索实测，获取品牌提及与推荐状态。</li>
          ) : (
            <li>所有记录已完成实测，可进入交付报告查看汇总结果。</li>
          )}
          <li className="text-xs text-gray-400">监测结果来自有限样本，不代表全网绝对排名。</li>
        </ul>
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            onClick={() => selectedProjectId && setLocation(buildProjectUrl("/delivery-reports", selectedProjectId))}
            disabled={records.length === 0}
          >
            进入交付报告
          </Button>
        </div>
      </div>
    </div>
  );
}

const CONFIRM_DISABLE_CUSTOMER_REPORT_LINK =
  "确定要禁用当前客户报告链接吗？禁用后，客户将无法通过原链接查看报告和证据。";
const CONFIRM_REGENERATE_CUSTOMER_REPORT_LINK =
  "确定要重新生成客户报告链接吗？重新生成后，旧链接将立即失效，请将新链接发送给对应客户。";

export { DeliveryReportsCenterPage as DeliveryReportsFlowPage } from "./DeliveryReportsCenterPage";
