#!/usr/bin/env node
/**
 * GEO-RealRun-1：查库验证（需 DATABASE_URL、可选 REALRUN1_TASK_ID / REALRUN1_ARTICLE_ID / REALRUN1_PROJECT_ID）
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifacts = path.join(root, "artifacts");

const projectId = Number(process.env.REALRUN1_PROJECT_ID ?? "72");
const articleId = Number(process.env.REALRUN1_ARTICLE_ID ?? "52");
const taskId = process.env.REALRUN1_TASK_ID ? Number(process.env.REALRUN1_TASK_ID) : null;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("需要 DATABASE_URL");
  process.exit(1);
}

const conn = await mysql.createConnection(url);
const out = {
  phase: "GEO-RealRun-1",
  verifiedAt: new Date().toISOString(),
  projectId,
  articleId,
  taskId,
  publishTask: null,
  article: null,
  reviewQueue: [],
  rewritePool: [],
  platformAccountsZhihu: [],
  security: {
    passwordFieldsInPlatformAccounts: false,
    cookieFieldsInPlatformAccounts: false,
    profilePathInPlatformAccounts: false,
  },
  notes: [],
};

try {
  if (taskId) {
    const [tasks] = await conn.query("SELECT * FROM publish_tasks WHERE id = ?", [taskId]);
    out.publishTask = tasks[0] ?? null;
  } else {
    const [tasks] = await conn.query(
      "SELECT * FROM publish_tasks WHERE articleId = ? AND platform = 'zhihu' ORDER BY id DESC LIMIT 1",
      [articleId],
    );
    out.publishTask = tasks[0] ?? null;
  }

  const [articles] = await conn.query(
    "SELECT id, projectId, title, status, lifecycleStatus, lifecycleEvents, publicPath FROM geo_articles WHERE id = ?",
    [articleId],
  );
  out.article = articles[0] ?? null;

  const [reviews] = await conn.query(
    "SELECT * FROM geo_review_queue WHERE articleId = ? ORDER BY id DESC LIMIT 5",
    [articleId],
  );
  out.reviewQueue = reviews;

  const [rewrites] = await conn.query(
    "SELECT * FROM geo_rewrite_pool WHERE articleId = ? ORDER BY id DESC LIMIT 5",
    [articleId],
  );
  out.rewritePool = rewrites;

  const [accounts] = await conn.query(
    "SELECT id, projectId, platform, accountName, localAgentId, localProfileId, verificationStatus, sessionStatus, lastSessionCheckedAt FROM project_platform_accounts WHERE projectId = ? AND platform = 'zhihu'",
    [projectId],
  );
  out.platformAccountsZhihu = accounts;

  for (const row of accounts) {
    const keys = Object.keys(row);
    if (keys.some(k => /password/i.test(k) && row[k])) out.security.passwordFieldsInPlatformAccounts = true;
    if (keys.some(k => /cookie/i.test(k) && row[k])) out.security.cookieFieldsInPlatformAccounts = true;
    if (keys.some(k => /profilePath/i.test(k) && row[k])) out.security.profilePathInPlatformAccounts = true;
  }

  const [colCheck] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_platform_accounts' AND COLUMN_NAME IN ('password','cookie','profilePath')`,
  );
  if (colCheck.length) {
    out.notes.push(`platform_accounts 表含敏感列名: ${colCheck.map(c => c.COLUMN_NAME).join(", ")}（值应为空）`);
  }
} finally {
  await conn.end();
}

if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });
const outPath = path.join(artifacts, "realrun1-db-verification.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log("written", outPath);
console.log(JSON.stringify(out, null, 2));
