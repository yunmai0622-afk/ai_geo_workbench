export const DISCOVERY_CANDIDATE_TYPES = ["source", "trust_evidence"] as const;
export type DiscoveryCandidateType = (typeof DISCOVERY_CANDIDATE_TYPES)[number];

export const DISCOVERY_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type DiscoveryConfidence = (typeof DISCOVERY_CONFIDENCE_LEVELS)[number];

export const DISCOVERY_CANDIDATE_STATUSES = ["pending", "accepted", "ignored"] as const;
export type DiscoveryCandidateStatus = (typeof DISCOVERY_CANDIDATE_STATUSES)[number];

export type DiscoveryDetectedSignals = {
  hasBrandName: boolean;
  likelyOfficial: boolean;
  likelyCustomerEvidence: boolean;
  likelyCompetitor: boolean;
};

export type DiscoveryProfileContext = {
  brandName: string;
  officialWebsite?: string | null;
  competitors?: string[];
};

const SOURCE_QUERY_SUFFIXES = [
  "官网",
  "知乎",
  "小红书",
  "公众号",
  "搜狐号",
  "企业信息",
  "百家号",
  "媒体",
] as const;

const TRUST_EVIDENCE_QUERY_SUFFIXES = [
  "客户案例",
  "媒体报道",
  "客户评价",
  "资质证书",
  "行业背书",
  "第三方评测",
] as const;

const CUSTOMER_EVIDENCE_KEYWORDS = ["案例", "成功", "合作", "评价", "测评", "测试"];

export function resolveDiscoveryBrandName(profile: {
  brandName?: string | null;
  enterpriseName?: string | null;
  shortName?: string | null;
}): string {
  return (profile.brandName ?? profile.enterpriseName ?? profile.shortName ?? "").trim();
}

export function buildSourceDiscoveryQueries(brandName: string): string[] {
  const name = brandName.trim();
  if (!name) return [];
  return SOURCE_QUERY_SUFFIXES.map(suffix => `${name} ${suffix}`);
}

export function buildTrustEvidenceDiscoveryQueries(brandName: string): string[] {
  const name = brandName.trim();
  if (!name) return [];
  return TRUST_EVIDENCE_QUERY_SUFFIXES.map(suffix => `${name} ${suffix}`);
}

export function extractUrlHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostnameMatchesOfficial(urlHostname: string, officialWebsite?: string | null): boolean {
  const officialHost = extractUrlHostname(officialWebsite ?? "");
  if (!officialHost || !urlHostname) return false;
  return urlHostname === officialHost || urlHostname.endsWith(`.${officialHost}`);
}

export function classifySourceRecordType(url: string, title: string, officialWebsite?: string | null): string {
  const lowerUrl = url.toLowerCase();
  const urlHost = extractUrlHostname(url);

  if (hostnameMatchesOfficial(urlHost, officialWebsite)) return "官网";
  if (lowerUrl.includes("zhihu.com")) return "知乎";
  if (lowerUrl.includes("xiaohongshu.com") || lowerUrl.includes("/xhs")) return "小红书";
  if (lowerUrl.includes("sohu.com")) return "搜狐号";
  if (lowerUrl.includes("baijiahao.baidu.com")) return "百家号";
  if (lowerUrl.includes("mp.weixin.qq.com")) return "公众号";
  if (title.includes("企业信息") || title.includes("工商")) return "企业信息";
  return "媒体平台";
}

export function classifyTrustEvidenceRecordType(title: string): string {
  if (/案例|成功|合作/.test(title)) return "客户案例";
  if (/报道|采访|专访/.test(title)) return "媒体报道";
  if (/评价|测评|测试/.test(title)) return "第三方评测";
  return "其他";
}

export function detectDiscoverySignals(input: {
  brandName: string;
  title: string;
  snippet: string;
  url: string;
  officialWebsite?: string | null;
  competitors?: string[];
  candidateType: DiscoveryCandidateType;
}): DiscoveryDetectedSignals {
  const haystack = `${input.title} ${input.snippet}`;
  const brandName = input.brandName.trim();
  const urlHost = extractUrlHostname(input.url);

  const hasBrandName = brandName.length > 0 && haystack.includes(brandName);
  const likelyOfficial = hostnameMatchesOfficial(urlHost, input.officialWebsite);
  const likelyCustomerEvidence = CUSTOMER_EVIDENCE_KEYWORDS.some(keyword => haystack.includes(keyword));
  const competitors = input.competitors ?? [];
  const likelyCompetitor = competitors.some(name => {
    const trimmed = name.trim();
    return trimmed.length > 0 && haystack.includes(trimmed);
  });

  return {
    hasBrandName,
    likelyOfficial,
    likelyCustomerEvidence,
    likelyCompetitor,
  };
}

export function resolveDiscoveryConfidence(signals: DiscoveryDetectedSignals): DiscoveryConfidence {
  if (signals.likelyCompetitor) return "low";
  if (signals.hasBrandName && (signals.likelyOfficial || signals.likelyCustomerEvidence)) return "high";
  if (signals.hasBrandName) return "medium";
  return "low";
}

export function extractSourceDomain(url: string): string {
  return extractUrlHostname(url);
}

/** 信源建议类型 → brand_source_records.platform */
export function mapSourceSuggestedTypeToPlatform(suggestedType: string): string {
  const map: Record<string, string> = {
    官网: "official_site",
    知乎: "zhihu",
    小红书: "xiaohongshu",
    公众号: "wechat",
    搜狐号: "sohu",
    百家号: "baijiahao",
    媒体平台: "media",
    企业信息: "other",
    媒体: "media",
  };
  return map[suggestedType] ?? "other";
}

/** 信任证据建议类型 → trust_evidence_items.evidenceType */
export function mapTrustEvidenceSuggestedTypeToEvidenceType(suggestedType: string): string {
  const map: Record<string, string> = {
    客户案例: "case",
    媒体报道: "media_coverage",
    客户评价: "customer_review",
    资质证书: "certificate",
    行业背书: "partnership",
    第三方评测: "other",
    其他: "other",
  };
  return map[suggestedType] ?? "other";
}

export function resolveDiscoveryConfidenceLabel(confidence: string): string {
  if (confidence === "high") return "高";
  if (confidence === "medium") return "中";
  return "低";
}

export function formatDiscoverySignals(signals: DiscoveryDetectedSignals): string[] {
  const labels: string[] = [];
  if (signals.hasBrandName) labels.push("含品牌名");
  if (signals.likelyOfficial) labels.push("疑似官网");
  if (signals.likelyCustomerEvidence) labels.push("含案例/评价信号");
  if (signals.likelyCompetitor) labels.push("疑似竞品");
  return labels;
}
