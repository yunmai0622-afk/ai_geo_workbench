/**
 * GEO-P0-C：发布后复测队列与重写池 — 静态验收
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const read = p => readFileSync(resolve(root, p), "utf8");

const errors = [];

function must(file, patterns, label) {
  const text = read(file);
  for (const p of patterns) {
    if (typeof p === "string" ? !text.includes(p) : !p.test(text)) {
      errors.push(`${label}: ${file} 缺少 ${p}`);
    }
  }
}

function mustNot(file, patterns, label) {
  const text = read(file);
  for (const p of patterns) {
    if (typeof p === "string" ? text.includes(p) : p.test(text)) {
      errors.push(`${label}: ${file} 不应包含 ${p}`);
    }
  }
}

must("shared/reviewQueue.ts", ["REVIEW_TYPES", "link_check", "inclusion_check", "ai_test", "rewrite_review", "assertNoMockReviewResult"], "reviewQueue 定义");
must("drizzle/schema.ts", ["geoReviewQueue", "geoRewritePool"], "schema 表");
must("server/reviewQueueService.ts", ["enqueueReviewAfterPublishSignal", "manual_required", "draft_saved"], "复测入队");
must("server/rewritePoolService.ts", ["addToRewritePool", "publish_failed", "session_expired", "quality_reject"], "重写池");
must("server/geoQualityReviewService.ts", ["geo_quality_reject"], "GEO reject 来源");
must("server/articleLifecycleService.ts", ["enqueueReviewAfterPublishSignal", "recordRewriteTriggersFromAgent"], "生命周期接线");
must("server/geoArticleQualityCheckFlow.ts", ["recordRewriteFromQualityReject"], "质检 reject 入池");
must("server/geoQualityReviewService.ts", ["recordRewriteFromQualityReject", "reject"], "GEO reject 入池");
must("server/routers.ts", ["triggerReview", "generateRewriteSuggestion", "postPublish"], "API");
must("client/src/pages/WeeklyContentPage.tsx", ["badge-pending-review", "badge-needs-rewrite", "生成新版内容建议"], "内容卡片");
mustNot("server/reviewQueueService.ts", ["mock_indexed", "mock_ai_cited", 'indexed: true', "ai_cited: true"], "禁止 mock 复测结果");

if (errors.length) {
  console.error("GEO-P0-C acceptance FAILED:\n");
  for (const e of errors) console.error("  -", e);
  process.exit(1);
}

console.log("GEO-P0-C review/rewrite acceptance OK");
const shots = [
  "artifacts/geo-p0c-review-queue.png",
  "artifacts/geo-p0c-rewrite-pool.png",
  "artifacts/geo-p0c-article-needs-revision.png",
  "artifacts/geo-p0c-next-content-suggestion.png",
];
const missing = shots.filter(p => !existsSync(resolve(root, p)));
if (missing.length) console.warn("截图未齐:", missing.join(", "));
