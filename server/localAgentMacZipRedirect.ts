import fs from "fs";
import path from "path";

const RELEASE_BASE =
  "https://github.com/yunmai0622-afk/geo-local-agent-releases/releases/download";

function readAgentVersion(cwd: string): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, "local-agent/package.json"), "utf-8"),
    ) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : "1.0.0";
  } catch {
    return "1.0.0";
  }
}

/** 从 manifest 解析 Mac zip 外链；无 manifest 时按 local-agent 版本拼 Release URL */
export function readMacZipRedirectUrl(cwd = process.cwd()): string {
  const candidates = [
    path.join(cwd, "dist/public/downloads/manifest.json"),
    path.join(cwd, "client/public/downloads/manifest.json"),
  ];
  for (const manifestPath of candidates) {
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
        macZipUrl?: string | null;
      };
      const url = manifest.macZipUrl?.trim();
      if (url && /^https?:\/\//i.test(url)) return url;
    } catch {
      // try next candidate
    }
  }
  const version = readAgentVersion(cwd);
  return `${RELEASE_BASE}/geo-local-agent-v${version}/geo-local-agent-mac.zip`;
}
