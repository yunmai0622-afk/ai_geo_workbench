import { Button } from "@/components/ui/button";
import { checkLocalAgentHealth } from "@/lib/localAgentClient";
import { Download, Loader2, RefreshCw, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type DownloadManifest = {
  macDmgUrl?: string | null;
  macZipUrl?: string | null;
  winZipUrl?: string | null;
  winSetupUrl?: string | null;
};

function isMacZipDownloadUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  return url.startsWith("/downloads/");
}

/** 优先 zip：支持相对路径或 AGENT_MAC_ZIP_URL 写入的绝对 URL */
function pickMacHref(manifest: DownloadManifest | null): string | null {
  const zip = manifest?.macZipUrl;
  const dmg = manifest?.macDmgUrl;
  if (isMacZipDownloadUrl(zip)) return zip;
  if (dmg?.startsWith("/downloads/")) return dmg;
  return null;
}

function pickMacDmgHref(manifest: DownloadManifest | null): string | null {
  const dmg = manifest?.macDmgUrl;
  return dmg?.startsWith("/downloads/") ? dmg : null;
}

function pickWinHref(manifest: DownloadManifest | null): string | null {
  const setup = manifest?.winSetupUrl;
  const zip = manifest?.winZipUrl;
  if (setup?.startsWith("/downloads/")) return setup;
  if (zip?.startsWith("/downloads/")) return zip;
  return null;
}

export function LocalAgentDownloadCard() {
  const [health, setHealth] = useState<Awaited<ReturnType<typeof checkLocalAgentHealth>>>(null);
  const [checking, setChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [manifest, setManifest] = useState<DownloadManifest | null>(null);
  const [macHref, setMacHref] = useState<string | null>(null);
  const [manifestLoaded, setManifestLoaded] = useState(false);

  const refreshHealth = useCallback(async () => {
    setChecking(true);
    try {
      const h = await checkLocalAgentHealth();
      setHealth(h);
      return h;
    } finally {
      setHasChecked(true);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    fetch("/downloads/manifest.json")
      .then(r => (r.ok ? r.json() : null))
      .then((m: DownloadManifest | null) => {
        setManifest(m);
        setMacHref(pickMacHref(m));
      })
      .catch(() => {
        setManifest(null);
        setMacHref(null);
      })
      .finally(() => setManifestLoaded(true));
  }, [refreshHealth]);

  const winHref = pickWinHref(manifest);
  const winOffered = Boolean(winHref);

  const handleDetect = async () => {
    const h = await refreshHealth();
    if (h) {
      toast.success("客户端已连接");
    } else {
      toast.error("未检测到本地发布客户端，请下载安装并启动后重试");
    }
  };

  const macOffered = Boolean(macHref);
  const macIsZip = Boolean(macHref && /\.zip(\?|$)/i.test(macHref));
  const macDmgHref = pickMacDmgHref(manifest);
  const macLabel = macIsZip ? "下载 Mac 客户端（推荐）" : "下载 Mac 客户端";

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      data-testid="local-agent-download-card"
    >
      {/* Header: title + status */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">下载 GEO 本地发布客户端</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-600">
            用于托管本机发布账号环境，自动接收 GEO Web 下发的发布任务。不保存平台密码，不上传 Cookie。
          </p>
        </div>
        {health ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700" data-testid="local-agent-connected">
            <CheckCircle2 className="size-3.5" />
            已连接
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700" data-testid="local-agent-offline">
            <AlertCircle className="size-3.5" />
            未连接
          </span>
        )}
      </div>

      {/* Connection detail */}
      <p className="mt-3 text-sm text-gray-600">
        {health ? (
          <span data-testid="local-agent-health-detail">
            客户端已连接 · v{health.version}
          </span>
        ) : (
          <span data-testid="local-agent-health-offline">
            {hasChecked
              ? "未检测到本地发布客户端，请下载安装并启动后重试"
              : "正在检测客户端…"}
          </span>
        )}
      </p>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {macOffered && macHref ? (
          <Button type="button" size="sm" className="bg-blue-600 text-white hover:bg-blue-700" asChild data-testid="download-mac-agent">
            <a href={macHref} download>
              <Download className="mr-1.5 size-3.5" />
              {macLabel}
            </a>
          </Button>
        ) : (
          <Button type="button" size="sm" disabled data-testid="download-mac-agent">
            <Download className="mr-1.5 size-3.5" />
            下载 Mac 客户端
          </Button>
        )}
        {manifestLoaded && !macOffered ? (
          <p className="w-full text-xs text-amber-700" data-testid="mac-agent-download-unconfigured">
            安装包暂未配置，请联系管理员上传 Local Agent 安装包。
          </p>
        ) : null}
        {winOffered && winHref ? (
          <Button type="button" size="sm" variant="outline" asChild data-testid="download-win">
            <a href={winHref} download>
              下载 Windows 客户端
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled
            className="border-gray-200 text-gray-400"
            data-testid="download-win-soon"
          >
            Windows 客户端即将支持
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="detect-local-agent"
          disabled={checking}
          onClick={() => void handleDetect()}
        >
          {checking ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 size-3.5" />}
          检测客户端
        </Button>
      </div>

      {/* Mac install help - collapsible */}
      <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 text-sm" data-testid="mac-install-gatekeeper-hint">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium text-amber-800 [&::-webkit-details-marker]:hidden">
          <ChevronDown className="size-4 transition-transform [[open]>&]:rotate-180" />
          Mac 首次打开帮助
        </summary>
        <div className="border-t border-amber-200 px-4 pb-4 pt-3 text-amber-900">
          <p className="font-medium">如果系统提示「已损坏，无法打开」</p>
          <p className="mt-2 text-amber-800">
            这是 macOS 对<strong className="font-semibold">未签名</strong>安装包的常见安全限制，不代表安装包损坏。请按以下方式处理：
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-amber-800">
            <li>
              解压 zip 后，将「GEO本地发布客户端」拖入「应用程序」文件夹。
            </li>
            <li>
              在「应用程序」中找到该 App，<strong>按住 Control 键点击 → 打开</strong>，在弹窗中选择「打开」。
            </li>
            <li>
              如仍无法打开，打开终端执行：
              <code className="mt-1 block rounded border border-amber-300 bg-white px-2 py-1 text-xs text-gray-800">
                xattr -cr &quot;/Applications/GEO本地发布客户端.app&quot;
              </code>
            </li>
          </ol>
          {macDmgHref && macIsZip ? (
            <p className="mt-3 text-xs text-amber-700">
              若需要 dmg 安装包：
              <a href={macDmgHref} className="ml-1 font-medium underline" download>
                下载 Mac dmg 备用
              </a>
            </p>
          ) : null}
        </div>
      </details>

      {/* Technical info - collapsed by default */}
      {health ? (
        <details className="mt-3 text-xs text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1">
              <ChevronDown className="size-3 transition-transform [[open]>&]:rotate-180" />
              技术信息
            </span>
          </summary>
          <div className="mt-1 rounded border border-gray-100 bg-gray-50 px-3 py-2 font-mono text-[11px] text-gray-500">
            客户端 ID：{health.agentId} · 版本：v{health.version}
          </div>
        </details>
      ) : null}
    </div>
  );
}
