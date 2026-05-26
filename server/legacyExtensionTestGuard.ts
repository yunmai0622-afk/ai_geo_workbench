import { existsSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

/** Legacy Chrome extension sources may be kept off-repo; skip file-based tests when absent. */
export function hasLegacyChromeExtensionSource(): boolean {
  return existsSync(resolve(repoRoot, "content-growth-publish-extension/manifest.json"));
}
