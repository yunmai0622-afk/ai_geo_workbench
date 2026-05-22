import type { AiTestEvidenceAggregate, AiTestEvidenceItem, AiTestSentiment } from "./aiTestEvidence";
import { parseStatusLabelCn, testStageLabelCn } from "./aiTestEvidence";

/** 匿名报告「本轮发布内容」客户安全字段 */
export type DeliveryReportPublicPublishedItem = {
  title: string;
  platform: string;
  publishedAt: string | null;
  url: string;
};

/** 匿名客户报告页只读数据（无工程字段、无用户敏感信息） */
export type DeliveryReportPublicSharePayload = {
  brandName: string;
  enterpriseName: string;
  reportGeneratedAt: string | null;
  conclusionLine: string;
  aiTest: AiTestEvidenceAggregate;
  publishedContent: DeliveryReportPublicPublishedItem[];
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
