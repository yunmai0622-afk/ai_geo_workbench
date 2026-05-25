import fs from "fs";
import path from "path";
import {
  PROFILES_DIR,
  getAccountByProfileId,
  removeAccount,
  type SessionStatus,
  type StoredAccount,
  type StoredPlatform,
  upsertAccount,
} from "./storage";
import { closeContext } from "./platforms/browserSession";

export function resolveProfilePath(profileId: string): string {
  return path.join(PROFILES_DIR, profileId);
}

export function createPlatformProfile(
  platform: StoredPlatform,
  input?: {
    projectId?: number;
    accountRole?: string | null;
    accountGroup?: string | null;
  },
): StoredAccount {
  if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });

  const profileId = `${platform}_${Date.now()}`;
  const profilePath = resolveProfilePath(profileId);
  fs.mkdirSync(profilePath, { recursive: true });

  const now = new Date().toISOString();
  const account: StoredAccount = {
    profileId,
    platform,
    projectId: input?.projectId ?? null,
    accountRole: input?.accountRole ?? null,
    accountGroup: input?.accountGroup ?? null,
    accountName: null,
    profilePath,
    sessionStatus: "unknown",
    createdAt: now,
    lastCheckedAt: null,
    lastOpenedAt: null,
  };

  upsertAccount(account);
  return account;
}

export function createZhihuProfile(input?: {
  projectId?: number;
  accountRole?: string | null;
  accountGroup?: string | null;
}): StoredAccount {
  return createPlatformProfile("zhihu", input);
}

export function requireAccount(profileId: string): StoredAccount {
  const account = getAccountByProfileId(profileId);
  if (!account) throw new Error(`profile_not_found: ${profileId}`);
  if (!fs.existsSync(account.profilePath)) {
    fs.mkdirSync(account.profilePath, { recursive: true });
  }
  return account;
}

export function touchAccountOpened(profileId: string, sessionStatus?: SessionStatus): StoredAccount {
  const account = requireAccount(profileId);
  return upsertAccount({
    ...account,
    lastOpenedAt: new Date().toISOString(),
    sessionStatus: sessionStatus ?? account.sessionStatus,
  });
}

/** 仅删除本机 profile 目录与 accounts.json 记录，不调用 Web 解绑 */
export async function deleteLocalProfile(profileId: string): Promise<{ ok: boolean; message: string }> {
  const account = getAccountByProfileId(profileId);
  if (!account) return { ok: false, message: "账号环境不存在" };
  await closeContext(profileId).catch(() => {});
  if (fs.existsSync(account.profilePath)) {
    fs.rmSync(account.profilePath, { recursive: true, force: true });
  }
  removeAccount(profileId);
  return { ok: true, message: "已删除本地账号环境（Web 绑定需在企业档案中另行处理）" };
}

export function markAccountNeedsRelogin(profileId: string): StoredAccount | null {
  const account = getAccountByProfileId(profileId);
  if (!account) return null;
  return upsertAccount({
    ...account,
    sessionStatus: "expired",
    lastCheckedAt: new Date().toISOString(),
  });
}
