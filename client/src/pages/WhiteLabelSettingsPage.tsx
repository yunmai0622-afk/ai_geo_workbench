import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_WHITE_LABEL_CONFIG, whiteLabel } from "@/lib/whiteLabel";
import {
  buildSystemSubdomain,
  normalizeDomain,
  validateCustomDomain,
  validateSubdomainSlug,
  WHITE_LABEL_SETTINGS_DRAFT_KEY,
} from "@shared/whiteLabelSettings";
import { AlertTriangle, CheckCircle2, Copy, Globe2, Palette } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Draft = {
  agencyName: string;
  systemName: string;
  logoUrl: string;
  brandColor: string;
  supportContact: string;
  poweredByVisible: boolean;
  loginTitle: string;
  loginSubtitle: string;
  loginLogoUrl: string;
  loginBrandColor: string;
  reportBrandName: string;
  reportLogoUrl: string;
  reportFooterText: string;
  subdomainSlug: string;
  customDomain: string;
};

const runtimeDraft = (): Draft => ({
  agencyName: whiteLabel.agencyName,
  systemName: whiteLabel.systemName,
  logoUrl: whiteLabel.brandLogoUrl ?? "",
  brandColor: whiteLabel.brandColor ?? "",
  supportContact: whiteLabel.supportContact ?? "",
  poweredByVisible: whiteLabel.poweredByVisible,
  loginTitle: whiteLabel.loginTitle,
  loginSubtitle: whiteLabel.loginSubtitle,
  loginLogoUrl: whiteLabel.loginLogoUrl ?? "",
  loginBrandColor: whiteLabel.loginBrandColor ?? "",
  reportBrandName: whiteLabel.reportBrandName,
  reportLogoUrl: whiteLabel.reportLogoUrl ?? "",
  reportFooterText: whiteLabel.reportFooterText ?? "",
  subdomainSlug: whiteLabel.subdomainSlug ?? "",
  customDomain: whiteLabel.customDomain ?? "",
});

function loadDraft(): Draft {
  if (typeof window === "undefined") return runtimeDraft();
  try {
    const stored = window.localStorage.getItem(WHITE_LABEL_SETTINGS_DRAFT_KEY);
    return stored ? { ...runtimeDraft(), ...JSON.parse(stored) } : runtimeDraft();
  } catch {
    return runtimeDraft();
  }
}

const envValue = (value: string) => value.trim().replace(/\r?\n/g, " ");

export default function WhiteLabelSettingsPage() {
  const { user, loading } = useAuth();
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [draftSaved, setDraftSaved] = useState(false);
  const isAdmin = user?.role === "admin";
  const slugError = validateSubdomainSlug(draft.subdomainSlug);
  const domainError = validateCustomDomain(draft.customDomain);
  const generatedSubdomain = buildSystemSubdomain(draft.subdomainSlug, whiteLabel.baseDomain);
  const cnameTarget = typeof window === "undefined" ? "当前平台生产域名" : window.location.host;

  const envText = useMemo(() => [
    `OEM_AGENCY_NAME=${envValue(draft.agencyName)}`,
    `OEM_SYSTEM_NAME=${envValue(draft.systemName)}`,
    `OEM_LOGO_URL=${envValue(draft.logoUrl)}`,
    `OEM_BRAND_COLOR=${envValue(draft.brandColor)}`,
    `OEM_LOGIN_TITLE=${envValue(draft.loginTitle)}`,
    `OEM_LOGIN_SUBTITLE=${envValue(draft.loginSubtitle)}`,
    `OEM_LOGIN_LOGO_URL=${envValue(draft.loginLogoUrl)}`,
    `OEM_LOGIN_BRAND_COLOR=${envValue(draft.loginBrandColor)}`,
    `OEM_REPORT_BRAND_NAME=${envValue(draft.reportBrandName)}`,
    `OEM_REPORT_LOGO_URL=${envValue(draft.reportLogoUrl)}`,
    `OEM_REPORT_FOOTER_TEXT=${envValue(draft.reportFooterText)}`,
    `OEM_SUPPORT_CONTACT=${envValue(draft.supportContact)}`,
    `OEM_POWERED_BY_VISIBLE=${draft.poweredByVisible}`,
    `OEM_BASE_DOMAIN=${whiteLabel.baseDomain ?? ""}`,
    `OEM_SUBDOMAIN_SLUG=${envValue(draft.subdomainSlug)}`,
    `OEM_CUSTOM_DOMAIN=${envValue(normalizeDomain(draft.customDomain))}`,
  ].join("\n"), [draft]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
    setDraftSaved(false);
  };

  if (loading) return <p className="p-6 text-sm text-gray-500">正在加载设置…</p>;
  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-xl" data-testid="white-label-settings-forbidden">
        <CardHeader><CardTitle>贴牌设置</CardTitle><CardDescription>仅系统管理员和运营公司管理员使用。</CardDescription></CardHeader>
        <CardContent className="text-sm text-gray-600">当前账号没有修改全局贴牌配置的权限。</CardContent>
      </Card>
    );
  }

  const saveDraft = () => {
    if (slugError || domainError) return toast.error("请先修正域名格式");
    window.localStorage.setItem(WHITE_LABEL_SETTINGS_DRAFT_KEY, JSON.stringify(draft));
    setDraftSaved(true);
    toast.success("草稿已保存到当前浏览器");
  };

  const fields = (items: Array<[keyof Draft, string, string?]>) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map(([key, label, placeholder]) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={`white-label-${key}`}>{label}</Label>
          <Input id={`white-label-${key}`} value={String(draft[key])} placeholder={placeholder} onChange={event => update(key, event.target.value as never)} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12" data-testid="white-label-settings-page">
      <header className="space-y-2">
        <p className="text-xs font-semibold text-blue-700">运营后台 · 仅管理员</p>
        <h1 className="text-2xl font-semibold text-gray-950">贴牌设置</h1>
        <p className="text-sm text-gray-500">配置运营公司的品牌、登录页、报告展示和访问域名。</p>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <p className="font-semibold">当前为无数据库迁移的安全版本</p>
        <p>保存只保留当前浏览器草稿；复制环境变量并由部署管理员更新 Railway 后，配置才会在所有用户端生效。</p>
      </div>

      <Card data-testid="white-label-brand-section">
        <CardHeader><CardTitle>1. 品牌信息</CardTitle><CardDescription>服务方品牌独立于客户项目名称，不会把“海豚知道”等客户名覆盖掉。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {fields([["agencyName", "运营公司名称"], ["systemName", "系统名称"], ["logoUrl", "Logo 地址", "https://…"], ["brandColor", "品牌主色", "#2563EB"], ["supportContact", "服务联系人或客服信息"]])}
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={draft.poweredByVisible} onChange={event => update("poweredByVisible", event.target.checked)} />显示技术支持</label>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4" data-testid="white-label-brand-preview">
            <p className="text-xs text-gray-500">品牌预览</p>
            <div className="mt-3 flex items-center gap-3">
              {draft.logoUrl ? <img src={draft.logoUrl} alt="Logo 预览" className="size-10 rounded-lg object-contain" /> : <span className="flex size-10 items-center justify-center rounded-lg bg-blue-600 text-white" style={draft.brandColor ? { backgroundColor: draft.brandColor } : undefined}><Palette className="size-5" /></span>}
              <div><p className="font-semibold text-gray-950">{draft.systemName || DEFAULT_WHITE_LABEL_CONFIG.systemName}</p><p className="text-sm text-gray-500">服务方：{draft.agencyName || DEFAULT_WHITE_LABEL_CONFIG.agencyName}</p></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="white-label-login-section">
        <CardHeader><CardTitle>2. 登录页设置</CardTitle><CardDescription>留空 Logo 或主色时复用品牌信息。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {fields([["loginTitle", "登录页标题"], ["loginSubtitle", "登录页副标题"], ["loginLogoUrl", "登录页 Logo", "留空复用品牌 Logo"], ["loginBrandColor", "登录页主色", "留空复用品牌主色"]])}
          <div className="rounded-xl border border-gray-200 p-5" style={draft.loginBrandColor || draft.brandColor ? { borderColor: draft.loginBrandColor || draft.brandColor } : undefined} data-testid="white-label-login-preview"><p className="text-lg font-semibold">{draft.loginTitle}</p><p className="mt-1 text-sm text-gray-500">{draft.loginSubtitle}</p></div>
        </CardContent>
      </Card>

      <Card data-testid="white-label-report-section">
        <CardHeader><CardTitle>3. 交付报告设置</CardTitle><CardDescription>报告同时显示服务方和客户项目，二者不会混淆。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {fields([["reportBrandName", "报告服务方名称"], ["reportLogoUrl", "报告 Logo", "留空复用品牌 Logo"], ["reportFooterText", "报告页脚文字"]])}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4" data-testid="white-label-report-preview"><p className="text-xs text-gray-500">服务方</p><p className="font-semibold">{draft.reportBrandName}</p><p className="mt-3 text-xs text-gray-500">服务对象（示例）</p><p className="font-semibold">海豚知道</p>{draft.reportFooterText ? <p className="mt-4 text-xs text-gray-500">{draft.reportFooterText}</p> : null}</div>
        </CardContent>
      </Card>

      <Card data-testid="white-label-domain-section">
        <CardHeader><CardTitle>4. 域名设置</CardTitle><CardDescription>本阶段只准备配置与 DNS 指引，不自动修改 DNS，也不承诺 SSL 已完成。</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2"><Globe2 className="size-4 text-blue-600" /><h3 className="font-semibold">系统子域名</h3></div>
            <div className="space-y-2"><Label htmlFor="white-label-subdomainSlug">subdomainSlug</Label><Input id="white-label-subdomainSlug" value={draft.subdomainSlug} placeholder="abcagency" onChange={event => update("subdomainSlug", event.target.value.toLowerCase())} />{slugError ? <p className="text-xs text-red-600">{slugError}</p> : null}</div>
            {!whiteLabel.baseDomain ? <p className="flex items-center gap-2 text-sm text-amber-800"><AlertTriangle className="size-4" />未配置 OEM_BASE_DOMAIN，请先由部署管理员配置。</p> : generatedSubdomain ? <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="size-4" />生成结果：{generatedSubdomain}（待 DNS 配置和启用）</p> : <p className="text-sm text-gray-500">填写后将生成 子域名.OEM_BASE_DOMAIN。</p>}
          </section>

          <section className="space-y-3 border-t border-gray-100 pt-5">
            <h3 className="font-semibold">自定义域名</h3>
            <div className="space-y-2"><Label htmlFor="white-label-customDomain">customDomain</Label><Input id="white-label-customDomain" value={draft.customDomain} placeholder="geo.customer.com" onChange={event => update("customDomain", event.target.value)} />{domainError ? <p className="text-xs text-red-600">{domainError}</p> : null}</div>
            {draft.customDomain && !domainError ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6" data-testid="white-label-dns-guide">
                <p className="font-semibold">状态：待配置 DNS</p>
                <p>CNAME：{normalizeDomain(draft.customDomain)} → {cnameTarget}</p>
                <p>TXT 验证：暂未接入自动验证，请由部署管理员提供验证值。</p>
              </div>
            ) : null}
            <Button type="button" variant="outline" disabled={!draft.customDomain || Boolean(domainError)} onClick={() => toast.message("暂未接入自动检测，请人工确认 DNS 与 Railway 自定义域名状态")}>我已配置 DNS，检查状态</Button>
          </section>
        </CardContent>
      </Card>

      <Card data-testid="white-label-deployment-config">
        <CardHeader><CardTitle>部署配置</CardTitle><CardDescription>配置优先级：当前浏览器草稿仅用于预览；运行时仍为环境变量 → 默认值。</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <pre className="max-h-80 overflow-auto rounded-xl bg-gray-950 p-4 text-xs leading-5 text-gray-100">{envText}</pre>
          <div className="flex flex-wrap gap-3"><Button type="button" onClick={saveDraft}>{draftSaved ? "草稿已保存" : "保存草稿"}</Button><Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(envText).then(() => toast.success("环境变量配置已复制"))}><Copy className="mr-2 size-4" />复制环境变量</Button><Button type="button" variant="ghost" onClick={() => { setDraft(runtimeDraft()); setDraftSaved(false); window.localStorage.removeItem(WHITE_LABEL_SETTINGS_DRAFT_KEY); }}>恢复当前运行配置</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
