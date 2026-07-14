import ProjectContextEmptyState from "@/components/ProjectContextEmptyState";
import { Button } from "@/components/ui/button";
import { useActiveProjectSelection } from "@/hooks/useActiveProjectSelection";
import { buildProjectUrl } from "@/lib/activeProject";
import { AI_BRAND_ASSET_DEFINITION, BRAND_ASSET_STATUS, getBrandAssets, SAMPLE_210001_ZHIHU_URL } from "@shared/brandAssets";
import { ArrowRight, ExternalLink, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

const statusClass = (status: string) => status === BRAND_ASSET_STATUS.COMPLETED ? "bg-emerald-50 text-emerald-700" : status === BRAND_ASSET_STATUS.IN_PROGRESS ? "bg-blue-50 text-blue-700" : status === BRAND_ASSET_STATUS.INSUFFICIENT ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600";

export default function BrandAssetsPage() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectedProject, projectsLoading } = useActiveProjectSelection();
  const assets = getBrandAssets(selectedProjectId);
  useEffect(() => { document.title = `${selectedProject?.enterpriseName || "企业"} - AI 品牌资产中心`; }, [selectedProject?.enterpriseName]);
  if (!selectedProjectId && !projectsLoading) return <ProjectContextEmptyState title="AI 品牌资产中心" description="请先选择项目，再查看品牌资产建设状态。" />;
  const isSample = selectedProjectId === 210001;
  return <div className="space-y-6 pb-10" data-testid="brand-assets-page">
    <header className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-blue-600">客户主流程 · AI 品牌资产</p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900">AI 品牌资产中心</h1>
      <p className="mt-2 max-w-3xl text-sm text-gray-600">把品牌资料、公开信源、内容证据和 AI 复测组织成可持续积累的品牌资产。</p>
    </header>
    <section className="rounded-2xl bg-slate-900 p-6 text-white" data-testid="brand-assets-overview">
      <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-sky-300"/><h2 className="font-semibold">AI 品牌资产总览</h2></div>
      <p className="mt-3 text-lg">{isSample ? "六类资产已进入持续建设；问题占位与公开内容已有第一条真实证据，可信信源和正式复测闭环仍是主要缺口。" : "当前正在把内部资料转化为公开、稳定、一致、可验证的品牌证据。"}</p>
      <p className="mt-3 text-sm text-slate-300">AI 品牌资产 = {AI_BRAND_ASSET_DEFINITION}</p>
    </section>
    <section className="grid gap-4 lg:grid-cols-2" data-testid="brand-assets-cards">
      {assets.map(asset => <article key={asset.key} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-900">{asset.name}</h2><p className="mt-1 text-sm text-gray-500">{asset.coreQuestion}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(asset.status)}`}>{asset.status}</span></div>
        <dl className="mt-4 space-y-2 text-sm leading-6"><div><dt className="inline font-medium">已有证据：</dt><dd className="inline text-gray-600">{asset.evidence}</dd></div><div><dt className="inline font-medium">当前缺口：</dt><dd className="inline text-gray-600">{asset.gap}</dd></div><div><dt className="inline font-medium">为什么影响 AI 推荐：</dt><dd className="inline text-gray-600">{asset.whyItMatters}</dd></div><div><dt className="inline font-medium">下一步：</dt><dd className="inline text-gray-600">{asset.nextAction}</dd></div><div><dt className="inline font-medium">验证方式：</dt><dd className="inline text-gray-600">{asset.verification}</dd></div><div><dt className="inline font-medium">公开证据：</dt><dd className="inline text-gray-600">{asset.hasPublicEvidence ? "已形成" : "尚未形成"} · AI 复测验证：{asset.verifiedByAiRetest ? "已有记录" : "待验证"}</dd></div></dl>
        <Button variant="outline" className="mt-4" onClick={() => selectedProjectId && setLocation(buildProjectUrl(asset.page, selectedProjectId))}>进入对应页面<ArrowRight className="ml-2 size-4"/></Button>
      </article>)}
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5" data-testid="brand-assets-top-gaps"><h2 className="font-semibold text-gray-900">当前 Top 3 资产缺口</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700"><li>官网缺少同主题定义页，公开表达一致性仍需增强。</li><li>第三方可信信源、案例与客户背书不足。</li><li>推荐类问题尚未完成占位，正式 T2/T3 效果闭环待执行。</li></ol></div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5" data-testid="brand-assets-monthly-actions"><h2 className="font-semibold text-gray-900">本月资产建设动作</h2><ul className="mt-3 space-y-2 text-sm text-gray-700"><li>统一品牌与业务定义表达。</li><li>围绕“海豚知道是什么？”建设一条公开定义型证据。</li><li>回填真实 URL，并进入收录观察与分阶段 AI 复测。</li></ul></div>
    </section>
    {isSample && <section className="rounded-2xl border border-emerald-200 bg-white p-5" data-testid="brand-assets-public-evidence"><h2 className="font-semibold text-gray-900">已形成公开证据</h2><p className="mt-2 text-sm text-gray-600">知乎文章对应：业务定义资产 + AI 问题占位资产。公开发布是证据建设动作，不代表已收录、已被引用、已推荐或效果已提升。</p><a className="mt-3 inline-flex items-center text-sm font-medium text-blue-700 hover:underline" href={SAMPLE_210001_ZHIHU_URL} target="_blank" rel="noreferrer">查看真实知乎 URL<ExternalLink className="ml-1 size-4"/></a></section>}
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm leading-6 text-gray-700" data-testid="brand-assets-value-rules"><h2 className="font-semibold text-gray-900">资产判断原则</h2><p className="mt-2">品牌资料录入不等于品牌资产完成；只有公开、稳定、一致、可验证的信息才是 AI 可识别资产。内容是建设公开证据的载体，收录和 AI 复测用于验证资产是否被 AI 看见，报告则是资产建设过程的证明。</p></section>
  </div>;
}
