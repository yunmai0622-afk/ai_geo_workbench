import type { AiTestEvidenceAggregate, AiTestEvidenceItem, AiTestSentiment } from "./aiTestEvidence";
import { parseStatusLabelCn, testStageLabelCn } from "./aiTestEvidence";
import type { DeliveryReportCompetitorComparison } from "./deliveryReportCompetitor";

/** 匿名报告「本轮发布内容」客户安全字段 */
export type DeliveryReportPublicPublishedItem = {
  title: string;
  platform: string;
  publishedAt: string | null;
  url: string;
};

/** 匿名客户报告页只读数据（无工程字段、无用户敏感信息） */
/** 客户报告分享链接默认有效天数 */
export const DELIVERY_REPORT_SHARE_VALIDITY_DAYS = 30;

/** 到期前多少天在内部页面显示续期提醒 */
export const DELIVERY_REPORT_SHARE_RENEWAL_REMINDER_DAYS = 7;

export const DELIVERY_REPORT_SHARE_RENEWAL_CTA_LABEL = "一键续期";

export type DeliveryReportShareRenewalReminder = {
  message: string;
  ctaLabel: string;
  daysRemaining: number;
};

export function computeDeliveryReportShareExpiresAt(from: Date = new Date()): Date {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + DELIVERY_REPORT_SHARE_VALIDITY_DAYS);
  return expiresAt;
}

export function formatDeliveryReportShareExpiryLabel(expiresAt: string | Date | null | undefined): string {
  if (!expiresAt) return "链接长期有效";
  const date = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(date.getTime())) return "—";
  return `有效期至 ${date.toLocaleString("zh-CN", { dateStyle: "long", timeStyle: "short" })}`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function resolveDeliveryReportShareRenewalReminder(
  shareExpiresAt: string | Date | null | undefined,
  now: Date = new Date(),
): DeliveryReportShareRenewalReminder | null {
  if (!shareExpiresAt) return null;
  const expiry = typeof shareExpiresAt === "string" ? new Date(shareExpiresAt) : shareExpiresAt;
  if (Number.isNaN(expiry.getTime())) return null;

  const msRemaining = expiry.getTime() - now.getTime();
  if (msRemaining <= 0) return null;

  const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
  if (daysRemaining > DELIVERY_REPORT_SHARE_RENEWAL_REMINDER_DAYS) return null;

  const expiryDateLabel = expiry.toLocaleString("zh-CN", { dateStyle: "long", timeStyle: "short" });
  return {
    message: `客户报告链接将于 ${daysRemaining} 天后过期（${expiryDateLabel}），建议续期后继续使用同一链接，无需重新发给客户。`,
    ctaLabel: DELIVERY_REPORT_SHARE_RENEWAL_CTA_LABEL,
    daysRemaining,
  };
}

export type DeliveryReportPublicSharePayload = {
  brandName: string;
  enterpriseName: string;
  reportGeneratedAt: string | null;
  /** 与 conclusionLine 一致：内容覆盖总分 totalScore */
  visibilityScore: number | null;
  conclusionLine: string;
  /** 分享 token 过期时间（ISO）；null 表示未设置过期 */
  shareExpiresAt: string | null;
  aiTest: AiTestEvidenceAggregate;
  publishedContent: DeliveryReportPublicPublishedItem[];
  /** 竞品对比（ai_test_runs + competitor_profiles） */
  competitorComparison: DeliveryReportCompetitorComparison | null;
};

export type DeliveryReportShareLinkStatus = {
  hasActiveLink: boolean;
  sharePath: string | null;
  shareExpiresAt: string | null;
};

export function mapRecordsToPublicPublishedContent(
  records: Array<{
    publishTitle: string | null;
    publishChannel: string;
    publishUrl: string;
    publishedAt: Date;
    articleTitle?: string | null;
  }>,
): DeliveryReportPublicPublishedItem[] {
  return records.map(record => ({
    title: record.publishTitle?.trim() || record.articleTitle?.trim() || "未命名内容",
    platform: record.publishChannel,
    publishedAt: record.publishedAt ? record.publishedAt.toISOString() : null,
    url: record.publishUrl,
  }));
}

export const DELIVERY_REPORT_SHARE_INVALID_MESSAGE =
  "报告链接无效或已失效，请联系服务人员重新获取";

export function buildDeliveryReportPublicPath(token: string) {
  return `/delivery-reports/public/${token}`;
}

export const DELIVERY_REPORT_EVIDENCE_INVALID_MESSAGE =
  "证据链接无效或已失效，请联系服务人员重新获取";

/** 匿名 / 客户化证据详情（无工程字段名） */
export type DeliveryReportPublicEvidencePayload = {
  brandName: string;
  enterpriseName: string;
  question: string;
  engineName: string;
  stageLabel: string;
  testedAt: string;
  aiAnswerText: string;
  mentionedBrand: boolean;
  recommendedBrand: boolean;
  brandRank: number | null;
  sentiment: AiTestSentiment;
  competitorMentions: Array<{ name: string; mentioned: boolean; rank: number | null; context?: string }>;
  citedUrls: string[];
  parseStatusLabel: string;
  parseNeedsAttention: boolean;
  evidenceSummary?: string;
  competitorConfigured: boolean;
  brandMentionExcerpt: string;
};

export function buildDeliveryReportPublicEvidencePath(shareToken: string, recordId: number, resultIndex: number) {
  return `/delivery-reports/public/${shareToken}/evidence/${recordId}/${resultIndex}`;
}

export function mapItemToPublicEvidence(
  item: AiTestEvidenceItem,
  meta: { brandName: string; enterpriseName: string; competitorConfigured: boolean },
): DeliveryReportPublicEvidencePayload {
  const aiAnswerText = item.answer || item.rawAnswer;
  const brandMentionExcerpt = item.mentionedBrand
    ? aiAnswerText.slice(0, 280) + (aiAnswerText.length > 280 ? "…" : "")
    : "回答中未出现本品牌名称，系统判定为未提及。";
  return {
    brandName: meta.brandName,
    enterpriseName: meta.enterpriseName,
    question: item.question,
    engineName: item.engineName,
    stageLabel: testStageLabelCn(item.testStage),
    testedAt: item.testedAt,
    aiAnswerText,
    mentionedBrand: item.mentionedBrand,
    recommendedBrand: item.recommendedBrand,
    brandRank: item.brandRank,
    sentiment: item.sentiment,
    competitorMentions: item.competitorMentions.map(c => ({
      name: c.name,
      mentioned: c.mentioned,
      rank: c.rank ?? null,
      context: c.context,
    })),
    citedUrls: [...item.citedUrls],
    parseStatusLabel: parseStatusLabelCn(item.parseStatus),
    parseNeedsAttention: item.parseStatus === "partial" || item.parseStatus === "failed",
    evidenceSummary: item.evidenceSummary,
    competitorConfigured: meta.competitorConfigured,
    brandMentionExcerpt,
  };
}
