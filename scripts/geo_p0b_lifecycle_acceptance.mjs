/**
 * GEO-P0-B 文章生命周期与发布任务状态打通 — 静态验收
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const read = p => readFileSync(resolve(root, p), "utf8");

const errors = [];

function mustContain(file, patterns, label) {
  const text = read(file);
  for (const p of patterns) {
    if (typeof p === "string") {
      if (!text.includes(p)) errors.push(`${label}: ${file} 缺少「${p}」`);
    } else if (!p.test(text)) {
      errors.push(`${label}: ${file} 未匹配 ${p}`);
    }
  }
}

function mustNotContain(file, patterns, label) {
  const text = read(file);
  for (const p of patterns) {
    if (typeof p === "string" ? text.includes(p) : p.test(text)) {
      errors.push(`${label}: ${file} 不应包含 ${p}`);
    }
  }
}

// 1. articleLifecycle 定义完整
const lifecycle = read("shared/articleLifecycle.ts");
const requiredStatuses = [
  "generated",
  "quality_checked",
  "confirmed",
  "pending_publish",
  "agent_processing",
  "manual_required",
  "draft_saved",
  "published",
  "failed",
  "needs_revision",
];
for (const s of requiredStatuses) {
  if (!lifecycle.includes(`"${s}"`)) errors.push(`shared/articleLifecycle.ts 缺少状态 ${s}`);
}
if (!lifecycle.includes("lifecycleEvents")) errors.push("shared/articleLifecycle.ts 缺少 lifecycleEvents 解析");
if (!lifecycle.includes("isFakePublishedLifecycle")) errors.push("shared/articleLifecycle.ts 缺少 fake published 检测");

// 2–4. 服务与发布任务写 lifecycleEvents
mustContain(
  "server/articleLifecycleService.ts",
  ["appendArticleLifecycleEvent", "syncLifecycleFromAgentPublishTask", "manual_required", "failed"],
  "生命周期服务",
);
mustContain(
  "server/publishTasksRouter.ts",
  ["pending_publish", "appendArticleLifecycleEvent"],
  "发布任务创建",
);
mustContain("server/agentPublishTasks.ts", ["agent_processing", "appendArticleLifecycleEvent"], "Agent claim");
mustContain("server/agentArticleLifecycle.ts", ["syncLifecycleFromAgentPublishTask"], "Agent 回传");

// 5–6. 前端卡片 + 无 fake published
mustContain("client/src/components/ArticleLifecyclePanel.tsx", ["article-lifecycle-panel", "状态时间线", "下一步"], "生命周期面板");
mustContain("client/src/pages/WeeklyContentPage.tsx", ["ArticleLifecyclePanel"], "内容资产页");
mustContain("client/src/components/ArticleAssetEditorSheet.tsx", ["ArticleLifecyclePanel"], "编辑抽屉");
mustContain("server/routers.ts", ["lifecycleTimeline", "resolveArticleLifecycleView"], "列表与时间线 API");

if (/case\s+["']manual_required["'][\s\S]{0,200}target\s*=\s*["']published["']/.test(read("server/articleLifecycleService.ts"))) {
  errors.push("syncLifecycle: manual_required 分支不得赋值 published");
}
mustContain("server/articleLifecycleService.ts", ["skippedPublished", "publicUrl"], "completed 需 publicUrl");

// schema
mustContain("drizzle/schema.ts", ["lifecycleStatus", "lifecycleEvents"], "schema 生命周期列");

if (errors.length) {
  console.error("GEO-P0-B lifecycle acceptance FAILED:\n");
  for (const e of errors) console.error("  -", e);
  process.exit(1);
}

console.log("GEO-P0-B lifecycle acceptance OK");
const screenshots = [
  "artifacts/geo-p0b-article-lifecycle-card.png",
  "artifacts/geo-p0b-lifecycle-timeline.png",
  "artifacts/geo-p0b-pending-publish.png",
  "artifacts/geo-p0b-manual-required-state.png",
];
const missingShots = screenshots.filter(p => !existsSync(resolve(root, p)));
if (missingShots.length) {
  console.warn("截图未齐（实机验收后补齐）:", missingShots.join(", "));
}
