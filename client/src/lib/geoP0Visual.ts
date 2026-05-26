/** GEO V1.0 P0 视觉 token（Manus 定稿 · 浅色工作台） */

export const geoP0Brand = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  primaryOutline: "border-blue-200 text-blue-700 hover:bg-blue-50",
  link: "text-blue-600 hover:text-blue-700 font-medium",
  ring: "focus-visible:ring-blue-500",
} as const;

export const geoP0Surfaces = {
  pageClients: "bg-slate-50 text-slate-900",
  pageProject: "bg-white text-slate-900",
  sidebar: "bg-white border-slate-200 text-slate-700",
  panel: "bg-slate-50 border-slate-200",
  card: "rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow",
  cardPadding: "p-5",
  topBar: "h-14 min-h-[56px] border-b border-slate-200 bg-white shadow-sm",
  sectionTitle: "text-base font-semibold text-slate-900",
  muted: "text-sm text-slate-500",
} as const;

/** 阶段胶囊配色（客户可读文案 → Tailwind） */
export function stageBadgeClass(stageLabel: string): string {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  const tones: Record<string, string> = {
    待建档: `${base} bg-slate-500 text-white`,
    建档中: `${base} bg-slate-400 text-white`,
    待诊断: `${base} bg-indigo-600 text-white`,
    待生产: `${base} bg-cyan-600 text-white`,
    待发布: `${base} bg-amber-500 text-white`,
    待复测: `${base} bg-violet-600 text-white`,
    优化中: `${base} bg-emerald-600 text-white`,
    "报告已生成": `${base} bg-blue-600 text-white`,
  };
  return tones[stageLabel] ?? `${base} bg-blue-600 text-white`;
}
