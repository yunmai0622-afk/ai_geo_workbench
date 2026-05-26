/**
 * GEO V1.0 视觉规范 Token（Manus 定稿 · 浅色专业 SaaS）
 *
 * HEX 视觉口径:
 *   主背景 #F6F8FB · 白卡 #FFFFFF · 主文字 #111827
 *   副文字 #6B7280 · 主蓝 #2563EB · 紫蓝 #7C3AED · 青色 #06B6D4
 *   边框 #E5E7EB · 成功 #16A34A · 提醒 #F59E0B · 风险 #DC2626
 *
 * 字体：Inter + Noto Sans SC
 * 卡片圆角：16px
 */

/* ─── 品牌色 ─── */
export const geoP0Brand = {
  /** 主按钮：品牌蓝 #2563EB 实心 */
  primary:
    "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20 transition-all duration-200 font-medium",
  /** 次要按钮：蓝色描边 */
  primaryOutline:
    "border border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 font-medium",
  /** 文字链接 */
  link: "text-blue-600 hover:text-blue-700 font-medium transition-colors",
  /** 焦点环 */
  ring: "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
  /** 成功 */
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  /** 警告 */
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  /** 危险 */
  danger: "bg-red-50 text-red-700 border-red-200",
} as const;

/* ─── 表面 / 容器 ─── */
export const geoP0Surfaces = {
  /** /clients 页面背景 */
  pageClients: "bg-[#F6F8FB] text-gray-900 min-h-screen",
  /** 项目内页面背景 */
  pageProject: "bg-[#F6F8FB] text-gray-900",
  /** 侧边栏 */
  sidebar: "bg-white border-r border-gray-200",
  /** 右侧面板 */
  panel: "bg-[#F6F8FB] border border-gray-200 rounded-2xl",
  /** 标准卡片 */
  card: "geo-card",
  /** 可交互卡片（hover 有提升效果） */
  cardInteractive: "geo-card-interactive",
  /** 强调卡片（有更强阴影） */
  cardElevated: "geo-card-elevated",
  /** 卡片内边距 */
  cardPadding: "p-5 sm:p-6",
  /** 顶部栏 */
  topBar: "h-14 min-h-[56px] border-b border-gray-200 bg-white/95 backdrop-blur-sm",
  /** Section 标题 */
  sectionTitle: "geo-section-title",
  /** 静默文字 */
  muted: "geo-body-text",
  /** 说明文字 */
  caption: "geo-caption",
} as const;

/* ─── 间距系统 ─── */
export const geoSpacing = {
  /** 页面顶部内边距 */
  pageTop: "pt-6 sm:pt-8",
  /** 页面水平内边距 */
  pageX: "px-4 sm:px-6 lg:px-8",
  /** Section 之间间距 */
  sectionGap: "space-y-8",
  /** 卡片网格间距 */
  cardGrid: "gap-4 sm:gap-5",
  /** 卡片内部间距 */
  cardInner: "space-y-3",
} as const;

/* ─── 排版 ─── */
export const geoTypography = {
  /** 页面主标题 */
  pageTitle: "text-2xl font-bold tracking-tight text-gray-900",
  /** 页面副标题 */
  pageSubtitle: "text-sm text-gray-500 mt-1",
  /** Section 标题 */
  sectionTitle: "text-base font-semibold text-gray-900",
  /** 卡片标题 */
  cardTitle: "text-[15px] font-semibold text-gray-900",
  /** 卡片描述 */
  cardDescription: "text-sm text-gray-500 leading-relaxed",
  /** 指标数值 */
  metricValue: "text-2xl font-bold tabular-nums tracking-tight text-gray-900",
  /** 指标标签 */
  metricLabel: "text-xs font-medium text-gray-500 uppercase tracking-wide",
  /** 提示文字 */
  hint: "text-xs text-gray-400",
} as const;

/* ─── 阶段徽标 ─── */
export function stageBadgeClass(stageLabel: string): string {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide";
  const tones: Record<string, string> = {
    待建档: `${base} bg-gray-100 text-gray-600 border border-gray-200`,
    建档中: `${base} bg-gray-100 text-gray-600 border border-gray-200`,
    待诊断: `${base} bg-blue-50 text-blue-700 border border-blue-200`,
    待生产: `${base} bg-blue-50 text-blue-700 border border-blue-200`,
    待发布: `${base} bg-amber-50 text-amber-700 border border-amber-200`,
    待复测: `${base} bg-violet-50 text-violet-700 border border-violet-200`,
    优化中: `${base} bg-emerald-50 text-emerald-700 border border-emerald-200`,
    "报告已生成": `${base} bg-blue-50 text-blue-700 border border-blue-200`,
  };
  return tones[stageLabel] ?? `${base} bg-blue-50 text-blue-700 border border-blue-200`;
}

/* ─── 状态色 ─── */
export const geoStatusColors = {
  success: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  warning: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  danger: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  info: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  neutral: {
    bg: "bg-gray-50",
    text: "text-gray-600",
    border: "border-gray-200",
    dot: "bg-gray-400",
  },
} as const;
