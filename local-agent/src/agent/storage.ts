import fs from "fs";
import path from "path";
import { getAgentRoot } from "./agentPaths";

export type SessionStatus = "unknown" | "active" | "expired";

export type StoredPlatform = "zhihu" | "sohu" | "baijiahao" | "toutiao" | "netease";

export type StoredAccount = {
  profileId: string;
  platform: StoredPlatform;
  projectId?: number | null;
  accountRole?: string | null;
  accountGroup?: string | null;
  accountName: string | null;
  profilePath: string;
  sessionStatus: SessionStatus;
  createdAt: string;
  lastCheckedAt: string | null;
  lastOpenedAt: string | null;
  lastPublishAt?: string | null;
  /** 最近一次检测账号的说明（成功或失败原因） */
  lastDetectMessage?: string | null;
};

export type AccountsFile = {
  accounts: StoredAccount[];
};

const AGENT_ROOT = getAgentRoot();
export const DATA_DIR = path.join(AGENT_ROOT, "data");
export const PROFILES_DIR = path.join(AGENT_ROOT, "profiles");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getAccountsFilePath(): string {
  return ACCOUNTS_FILE;
}

export function readAccounts(): AccountsFile {
  ensureDataDir();
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    return { accounts: [] };
  }
  const raw = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
  const parsed = JSON.parse(raw) as AccountsFile;
  if (!Array.isArray(parsed.accounts)) return { accounts: [] };
  return parsed;
}

export function writeAccounts(data: AccountsFile): void {
  ensureDataDir();
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function getAccountByProfileId(profileId: string): StoredAccount | null {
  return readAccounts().accounts.find(a => a.profileId === profileId) ?? null;
}

export function upsertAccount(account: StoredAccount): StoredAccount {
  const data = readAccounts();
  const idx = data.accounts.findIndex(a => a.profileId === account.profileId);
  if (idx >= 0) data.accounts[idx] = account;
  else data.accounts.push(account);
  writeAccounts(data);
  return account;
}

export function updateAccount(
  profileId: string,
  patch: Partial<Omit<StoredAccount, "profileId" | "platform">>,
): StoredAccount | null {
  const existing = getAccountByProfileId(profileId);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  upsertAccount(next);
  return next;
}

export function removeAccount(profileId: string): boolean {
  const data = readAccounts();
  const next = data.accounts.filter(a => a.profileId !== profileId);
  if (next.length === data.accounts.length) return false;
  writeAccounts({ accounts: next });
  return true;
}
