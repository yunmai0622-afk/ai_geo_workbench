import { AiStatusBadge } from "@/components/ai/ProductUi";
import { Button } from "@/components/ui/button";
import { checkLocalAgentHealth } from "@/lib/localAgentClient";
import { aiGlassPanel, aiOutlineBtn, aiPrimaryBtn } from "@/lib/aiProductUi";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/** 相对路径：本地 / 线上 Manus 均自动适配当前 origin */
const MAC_DOWNLOAD_ZIP = "/downloads/geo-local-agent-mac.zip";

type DownloadManifest = {
  macDmgUrl?: string | null;
  macZipUrl?: string | null;
  winZipUrl?: string | null;
  winSetupUrl?: string | null;
};

function pickMacHref(manifest: DownloadManifest | null): string {
  const zip = manifest?.macZipUrl;
  const dmg = manifest?.macDmgUrl;
  if (zip && zip.startsWith("/downloads/")) return zip;
  if (dmg && dmg.startsWith("/downloads/")) return dmg;
  return MAC_DOWNLOAD_ZIP;
}

export function LocalAgentDownloadCard() {
  const [health, setHealth] = useState<Awaited<ReturnType<typeof checkLocalAgentHealth>>>(null);
  const [checking, setChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [manifest, setManifest] = useState<DownloadManifest | null>(null);
  const [macHref, setMacHref] = useState(MAC_DOWNLOAD_ZIP);

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
        setMacHref(MAC_DOWNLOAD_ZIP);
      });
  }, [refreshHealth]);

  const winOffered = Boolean(manifest?.winSetupUrl || manifest?.winZipUrl);

  const handleDetect = async () => {
    const h = await refreshHealth();
    if (h) {
      toast.success("客户端已连接");
    } else {
      toast.error("未检测到本地发布客户端，请下载安装并启动后重试");
    }
  };

  const macLabel =
    macHref.endsWith(".dmg") ? "下载 Mac 客户端 (.dmg)" : "下载 Mac 客户端";

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
        <Button type="button" size="sm" className={aiPrimaryBtn} asChild data-testid="download-mac-agent">
          <a href={macHref} download>
            <Download className="mr-1 size-3.5" />
            {macLabel}
          </a>
        </Button>
        {winOffered ? (
          <Button type="button" size="sm" variant="outline" className={aiOutlineBtn} asChild data-testid="download-win">
            <a
              href={
                manifest?.winSetupUrl?.startsWith("/downloads/")
                  ? manifest.winSetupUrl
                  : manifest?.winZipUrl?.startsWith("/downloads/")
                    ? manifest.winZipUrl!
                    : "#"
              }
              download
            >
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
    </div>
  );
}
