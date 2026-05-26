import { AiStatusBadge } from "@/components/ai/ProductUi";
import { Button } from "@/components/ui/button";
import { checkLocalAgentHealth } from "@/lib/localAgentClient";
import { aiGlassPanel, aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/** 相对路径：本地 / 线上部署均自动适配当前 origin */
const MAC_DOWNLOAD_ZIP = "/downloads/geo-local-agent-mac.zip";

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
  const [macHref, setMacHref] = useState<string | null>(MAC_DOWNLOAD_ZIP);

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
        setMacHref(pickMacHref(m) ?? MAC_DOWNLOAD_ZIP);
      })
      .catch(() => {
        setManifest(null);
        setMacHref(MAC_DOWNLOAD_ZIP);
      });
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
      className={`${aiGlassPanel} mb-4 border-cyan-400/20 p-4`}
      data-testid="local-agent-download-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">本地发布客户端</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
            用于托管本机发布账号环境，自动接收 GEO 发布任务。不保存平台密码，不上传 Cookie。
          </p>
        </div>
        {health ? (
          <AiStatusBadge tone="success" data-testid="local-agent-connected">
            已连接
          </AiStatusBadge>
        ) : (
          <AiStatusBadge tone="warning" data-testid="local-agent-offline">
            未连接
          </AiStatusBadge>
        )}
      </div>

      <p className="mt-3 text-sm text-slate-300">
        {health ? (
          <span data-testid="local-agent-health-detail">
            客户端已连接 · <span className="text-cyan-200">{health.agentId}</span> · v{health.version}
          </span>
        ) : (
          <span data-testid="local-agent-health-offline">
            {hasChecked
              ? "未检测到本地发布客户端，请下载安装并启动后重试"
              : "未检测到本地发布客户端"}
          </span>
        )}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {macOffered && macHref ? (
          <Button type="button" size="sm" className={aiPrimaryBtn} asChild data-testid="download-mac-agent">
            <a href={macHref} download>
              <Download className="mr-1 size-3.5" />
              {macLabel}
            </a>
          </Button>
        ) : (
          <Button type="button" size="sm" className={aiPrimaryBtn} disabled data-testid="download-mac-agent">
            <Download className="mr-1 size-3.5" />
            下载 Mac 客户端
          </Button>
        )}
        {winOffered && winHref ? (
          <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} asChild data-testid="download-win">
            <a href={winHref} download>
              下载 Windows 客户端
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={aiOutlineBtn}
            disabled
            data-testid="download-win-soon"
          >
            Windows 客户端即将支持
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={aiOutlineBtn}
          data-testid="detect-local-agent"
          disabled={checking}
          onClick={() => void handleDetect()}
        >
          {checking ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RefreshCw className="mr-1 size-3.5" />}
          检测客户端
        </Button>
      </div>

      <div
        className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm leading-relaxed text-amber-50"
        data-testid="mac-install-gatekeeper-hint"
      >
        <p className="font-medium text-amber-100">Mac 首次打开若提示「已损坏，无法打开」</p>
        <p className="mt-2 text-amber-50/90">
          这是 macOS 对<strong className="font-semibold">未签名</strong>安装包的常见拦截，不是安装包损坏。请按下面任一方式处理后再启动：
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-amber-50/90">
          <li>
            <strong>推荐</strong>：下载 <strong>zip</strong>，解压后将「GEO本地发布客户端」拖入「应用程序」，从启动台打开。
          </li>
          <li>
            在「应用程序」中找到该 App，<strong>按住 Control 键点击 → 打开</strong>，在弹窗中选择「打开」。
          </li>
          <li>
            系统设置 → 隐私与安全性 → 若出现「仍要打开」，点击允许。
          </li>
          <li>
            终端执行（将路径换成你实际安装位置）：
            <code className="mt-1 block rounded bg-black/30 px-2 py-1 text-xs text-amber-100">
              xattr -cr &quot;/Applications/GEO本地发布客户端.app&quot;
            </code>
          </li>
        </ol>
        {macDmgHref && macIsZip ? (
          <p className="mt-2 text-xs text-amber-100/80">
            若需要 dmg 安装包：
            <a href={macDmgHref} className="ml-1 underline" download>
              下载 Mac dmg 备用
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
