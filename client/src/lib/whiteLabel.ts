export type WhiteLabelEnv = Record<string, string | boolean | undefined>;

export type WhiteLabelConfig = {
  agencyName: string;
  brandLogoUrl: string | null;
  brandColor: string | null;
  loginTitle: string;
  loginSubtitle: string;
  reportBrandName: string;
  supportContact: string | null;
  poweredByVisible: boolean;
};

export const DEFAULT_WHITE_LABEL_CONFIG: WhiteLabelConfig = {
  agencyName: "GEO 代运营交付系统",
  brandLogoUrl: null,
  brandColor: null,
  loginTitle: "AI 可见度服务系统",
  loginSubtitle: "持续提升企业在 AI 搜索中的识别、信任与推荐",
  reportBrandName: "GEO 服务团队",
  supportContact: null,
  poweredByVisible: true,
};

const safeText = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const safeOptionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const safeColor = (value: unknown) => {
  if (typeof value !== "string") return null;
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : null;
};

const booleanValue = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string" || !value.trim()) return fallback;
  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
};

export function resolveWhiteLabelConfig(env: WhiteLabelEnv): WhiteLabelConfig {
  return {
    agencyName: safeText(env.OEM_AGENCY_NAME, DEFAULT_WHITE_LABEL_CONFIG.agencyName),
    brandLogoUrl: safeOptionalText(env.OEM_LOGO_URL),
    brandColor: safeColor(env.OEM_BRAND_COLOR),
    loginTitle: safeText(env.OEM_LOGIN_TITLE, DEFAULT_WHITE_LABEL_CONFIG.loginTitle),
    loginSubtitle: safeText(env.OEM_LOGIN_SUBTITLE, DEFAULT_WHITE_LABEL_CONFIG.loginSubtitle),
    reportBrandName: safeText(env.OEM_REPORT_BRAND_NAME, DEFAULT_WHITE_LABEL_CONFIG.reportBrandName),
    supportContact: safeOptionalText(env.OEM_SUPPORT_CONTACT),
    poweredByVisible: booleanValue(
      env.OEM_POWERED_BY_VISIBLE,
      DEFAULT_WHITE_LABEL_CONFIG.poweredByVisible,
    ),
  };
}

export const whiteLabel = resolveWhiteLabelConfig(import.meta.env as WhiteLabelEnv);

export const whiteLabelPrimaryStyle = whiteLabel.brandColor
  ? { backgroundColor: whiteLabel.brandColor, borderColor: whiteLabel.brandColor }
  : undefined;
