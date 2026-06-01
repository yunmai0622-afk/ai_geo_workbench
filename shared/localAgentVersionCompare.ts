/** 去掉 v 前缀与首尾空白，便于比较 health.version 与 manifest.version */
export function normalizeLocalAgentVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

/** 解析 x.y.z（缺省段按 0）；无法解析时返回 null */
export function parseLocalAgentSemverParts(version: string): [number, number, number] | null {
  const core = normalizeLocalAgentVersion(version).split("-")[0] ?? "";
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(core);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

/**
 * 比较两个语义化版本号。
 * @returns -1 表示 a < b，0 相等，1 表示 a > b；无法解析时返回 null
 */
export function compareLocalAgentSemver(a: string, b: string): -1 | 0 | 1 | null {
  const left = parseLocalAgentSemverParts(a);
  const right = parseLocalAgentSemverParts(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) {
    if (left[i]! < right[i]!) return -1;
    if (left[i]! > right[i]!) return 1;
  }
  return 0;
}

/** 已连接客户端版本是否低于 manifest 中的最新版本 */
export function isLocalAgentClientOutdated(clientVersion: string, manifestVersion: string): boolean {
  return compareLocalAgentSemver(clientVersion, manifestVersion) === -1;
}
