export type LocalAgentDownloadManifest = {
  version?: string;
  macZipUrl?: string | null;
  macDmgUrl?: string | null;
  winZipUrl?: string | null;
  winSetupUrl?: string | null;
};

function isValidDownloadUrl(url: string | null | undefined): url is string {
  if (!url?.trim()) return false;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  return url.startsWith("/downloads/");
}

function isMacZipDownloadUrl(url: string | null | undefined): url is string {
  if (!isValidDownloadUrl(url)) return false;
  return /\.zip(\?|$)/i.test(url);
}

function isMacDmgDownloadUrl(url: string | null | undefined): url is string {
  if (!isValidDownloadUrl(url)) return false;
  return /\.dmg(\?|$)/i.test(url);
}

function pickMacHref(manifest: LocalAgentDownloadManifest | null): string | null {
  const zip = manifest?.macZipUrl;
  if (isMacZipDownloadUrl(zip)) return zip;
  const dmg = manifest?.macDmgUrl;
  if (isMacDmgDownloadUrl(dmg)) return dmg;
  return null;
}

function pickWinHref(manifest: LocalAgentDownloadManifest | null): string | null {
  const setup = manifest?.winSetupUrl;
  const zip = manifest?.winZipUrl;
  if (isValidDownloadUrl(setup)) return setup;
  if (isValidDownloadUrl(zip)) return zip;
  return null;
}

/** 按当前环境优先 Mac / Windows，否则回退到任一可用安装包 */
export function pickLocalAgentDownloadHref(
  manifest: LocalAgentDownloadManifest | null,
  platformHint?: string,
): string | null {
  const hint = platformHint ?? (typeof navigator !== "undefined" ? navigator.platform : "");
  const isWin = /win/i.test(hint);
  if (isWin) {
    return pickWinHref(manifest) ?? pickMacHref(manifest);
  }
  return pickMacHref(manifest) ?? pickWinHref(manifest);
}

export async function fetchLocalAgentDownloadManifest(): Promise<LocalAgentDownloadManifest | null> {
  try {
    const res = await fetch("/downloads/manifest.json", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as LocalAgentDownloadManifest;
  } catch {
    return null;
  }
}
