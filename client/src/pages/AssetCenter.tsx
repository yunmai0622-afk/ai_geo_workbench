import { GeoStatusGuide } from "@/components/GeoStatusGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Building2, CheckCircle2, FileText, Globe2, ShieldCheck, Target, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const profileSections = [
  { key: "profile", title: "企业基础资料", icon: Building2, desc: "企业名称、行业、官网、区域和品牌实体信息。" },
  { key: "product", title: "产品服务资料", icon: FileText, desc: "产品服务说明、核心能力、服务流程和交付边界。" },
  { key: "cases", title: "客户案例", icon: Users, desc: "真实客户场景、可公开案例和待补充案例线索。" },
  { key: "competitors", title: "竞品资料", icon: Target, desc: "主要竞品、差异点和客户常见比较问题。" },
  { key: "compliance", title: "合规规则", icon: ShieldCheck, desc: "禁用词、不可承诺事项和需人工确认的信息。" },
  { key: "publishing", title: "发布策略", icon: Globe2, desc: "官网内容页与第三方平台素材的发布边界。" },
] as const;

function sectionStatus(summary: Record<string, unknown> | undefined, key: string) {
  if (!summary) return { label: "待读取", tone: "border-slate-500/20 bg-slate-500/10 text-slate-200" };
  const profile = summary.profile as Record<string, unknown> | undefined;
  const hasProfile = Boolean(profile?.enterpriseName && profile?.industry && profile?.officialWebsite);
  const hasProduct = Boolean(profile?.productServiceIntro || profile?.productIntro || profile?.coreSellingPoints);
  const counts = summary.counts as Record<string, number> | undefined;
  const value = key === "profile" ? hasProfile : key === "product" ? hasProduct : key === "cases" ? (counts?.customerCases ?? 0) > 0 : key === "competitors" ? (counts?.competitors ?? 0) > 0 : key === "compliance" ? (counts?.complianceRules ?? 0) > 0 : (counts?.publishStrategies ?? 0) > 0;
  return value ? { label: "已补齐", tone: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" } : { label: "待补齐", tone: "border-amber-300/20 bg-amber-400/10 text-amber-100" };
}

export default function AssetCenterPage() {
  const [, setLocation] = useLocation();
  const { data: projects = [] } = trpc.geo.projects.list.useQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const projectInput = useMemo(() => ({ projectId: selectedProjectId }), [selectedProjectId]);
  const { data: summary, isLoading } = trpc.geo.assetLibrary.summary.useQuery(projectInput, { enabled: Boolean(selectedProjectId) });
  const completionScore = summary?.completionScore ?? 0;
  const riskReminders = summary?.riskReminders?.length ? summary.riskReminders : ["资料不足时，系统不得编造案例、数据、价格和效果承诺。"];
  const primaryAction = completionScore >= 60 ? { label: "进入 AI 诊断", path: "/ai-diagnosis" } : { label: "补齐企业档案", path: "/projects" };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 text-slate-100 shadow-[0_0_34px_rgba(56,189,248,0.10)] backdrop-blur">
        <p className="text-sm font-medium text-cyan-200">AI GEO 增长工作台</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">企业档案</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">企业档案页只展示企业基础资料、产品服务资料、客户案例、竞品资料、合规规则、发布策略六个卡片，并根据资料状态给出一个主动作。</p>
      </div>
      <GeoStatusGuide stage="企业档案" completion={completionScore} nextAction={primaryAction.label} why="企业档案是 AI 诊断、内容生成和发布准入的事实来源。" risk="资料不足时不得编造案例、数据、价格和效果承诺。" ctaLabel={primaryAction.label} ctaPath={primaryAction.path} />

      <Card className="border-white/10 bg-white/[0.04] text-slate-100">
        <CardHeader>
          <CardDescription className="text-cyan-200">当前项目</CardDescription>
          <CardTitle className="text-white">企业资料状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <select value={selectedProjectId ?? ""} onChange={event => setSelectedProjectId(Number(event.target.value) || undefined)} className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:max-w-md">
            <option value="">请选择项目</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.enterpriseName}</option>)}
          </select>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {profileSections.map(section => {
              const Icon = section.icon;
              const status = sectionStatus(summary as Record<string, unknown> | undefined, section.key);
              return (
                <div key={section.key} className="rounded-3xl border border-white/10 bg-slate-950/56 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200"><Icon className="h-5 w-5" /></div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${status.tone}`}>{isLoading ? "读取中" : status.label}</span>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">{section.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{section.desc}</p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">资料完整度：{completionScore}%</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">当前页面只保留一个主动作，点击继续下一步，避免客户在复杂后台能力中迷路。</p>
            </div>
            <Button onClick={() => setLocation(primaryAction.path)} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">{primaryAction.label}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-300/15 bg-amber-400/10 text-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-50"><AlertTriangle className="h-5 w-5" /> 风险说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {riskReminders.slice(0, 4).map((item, index) => <p key={`${item}-${index}`} className="text-sm leading-6">{item}</p>)}
          <p className="text-sm leading-6"><CheckCircle2 className="mr-2 inline h-4 w-4" />不承诺保证收录、保证排名或保证被 AI 推荐。</p>
        </CardContent>
      </Card>
    </div>
  );
}
