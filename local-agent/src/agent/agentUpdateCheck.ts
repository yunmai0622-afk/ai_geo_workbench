import { AGENT_VERSION } from "./agentMeta";
import { buildGeoWebUrl } from "./geoWebNavigation";
import { readAgentConfig } from "./agentConfig";
import { isLocalAgentClientOutdated } from "./localAgentVersionCompare";

export type LocalAgentDownloadManifest = {
  version?: string;
  macZipUrl?: string | null;
  macDmgUrl?: string | null;
  winZipUrl?: string | null;
  winSetupUrl?: string | null;
};

export type AgentUpdateNotice = {
  clientVersion: string;
  manifestVersion: string;
  downloadUrl: string;
};

function isValidDownloadUrl(url: string | null | undefined): url is string {
  if (!url?.trim()) return false;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  return url.startsWith("/downloads/");
}

function pickDownloadUrl(manifest: LocalAgentDownloadManifest, platform: NodeJS.Platform): string | null {
  const macZip = manifest.macZipUrl;
  const macDmg = manifest.macDmgUrl;
  const winSetup = manifest.winSetupUrl;
  const winZip = manifest.winZipUrl;

  if (platform === "win32") {
    if (isValidDownloadUrl(winSetup)) return winSetup;
    if (isValidDownloadUrl(winZip)) return winZip;
    if (isValidDownloadUrl(macZip)) return macZip;
    if (isValidDownloadUrl(macDmg)) return macDmg;
    return null;
  }

  if (isValidDownloadUrl(macZip)) return macZip;
  if (isValidDownloadUrl(macDmg)) return macDmg;
  if (isValidDownloadUrl(winSetup)) return winSetup;
  if (isValidDownloadUrl(winZip)) return winZip;
  return null;
}

function resolveDownloadHref(serverUrl: string, href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  return buildGeoWebUrl(serverUrl, href);
}

export async function fetchAgentUpdateNotice(): Promise<AgentUpdateNotice | null> {
  const { serverUrl } = readAgentConfig();
  const base = serverUrl.trim();
  if (!base) return null;

  try {
    const manifestUrl = buildGeoWebUrl(base, "/downloads/manifest.json");
    const res = await fetch(manifestUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const manifest = (await res.json()) as LocalAgentDownloadManifest;
    const manifestVersion = manifest.version?.trim();
    if (!manifestVersion || !isLocalAgentClientOutdated(AGENT_VERSION, manifestVersion)) {
      return null;
    }
    const rawHref = pickDownloadUrl(manifest, process.platform);
    if (!rawHref) return null;
    return {
      clientVersion: AGENT_VERSION,
      manifestVersion,
      downloadUrl: resolveDownloadHref(base, rawHref),
    };
  } catch {
    return null;
  }
}
