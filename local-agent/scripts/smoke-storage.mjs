#!/usr/bin/env node
/** 不依赖 Electron：验证 profile 创建与 accounts.json 读写 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profilesDir = path.join(root, "profiles");
const dataDir = path.join(root, "data");
const accountsFile = path.join(dataDir, "accounts.json");

const profileId = `zhihu_${Date.now()}`;
const profilePath = path.join(profilesDir, profileId);
fs.mkdirSync(profilePath, { recursive: true });

const account = {
  profileId,
  platform: "zhihu",
  accountName: null,
  profilePath,
  sessionStatus: "unknown",
  createdAt: new Date().toISOString(),
  lastCheckedAt: null,
  lastOpenedAt: null,
};

let data = { accounts: [] };
if (fs.existsSync(accountsFile)) {
  data = JSON.parse(fs.readFileSync(accountsFile, "utf-8"));
}
data.accounts.push(account);
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(accountsFile, JSON.stringify(data, null, 2));

console.log("smoke ok", profileId, accountsFile);
