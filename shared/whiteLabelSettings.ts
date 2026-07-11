export const WHITE_LABEL_SETTINGS_DRAFT_KEY = "geo:white-label-settings-draft:v1";

export const SUBDOMAIN_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export const CUSTOM_DOMAIN_PATTERN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function validateSubdomainSlug(value: string): string | null {
  const slug = value.trim().toLowerCase();
  if (!slug) return null;
  if (!SUBDOMAIN_SLUG_PATTERN.test(slug)) {
    return "仅支持小写字母、数字和连字符，且不能以连字符开头或结尾。";
  }
  return null;
}

export function validateCustomDomain(value: string): string | null {
  const domain = normalizeDomain(value);
  if (!domain) return null;
  if (!CUSTOM_DOMAIN_PATTERN.test(domain)) {
    return "请输入完整域名，例如 geo.customer.com；不要包含协议、路径或端口。";
  }
  return null;
}

export function buildSystemSubdomain(slug: string, baseDomain: string | null): string | null {
  const normalizedSlug = slug.trim().toLowerCase();
  const normalizedBase = baseDomain ? normalizeDomain(baseDomain) : "";
  if (!normalizedSlug || !normalizedBase || validateSubdomainSlug(normalizedSlug)) return null;
  return `${normalizedSlug}.${normalizedBase}`;
}
