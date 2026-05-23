/**
 * C3-D-Fix 截图验收
 */
import { spawnSync } from "node:child_process";
import { renameSync } from "node:fs";
import { resolve } from "node:path";

const script = resolve(process.cwd(), "scripts/c3d_ui_visual_acceptance.mjs");
const r = spawnSync("node", [script], { env: process.env, stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);

const art = resolve(process.cwd(), "artifacts");
const map = [
  ["c3d-dashboard.png", "c3d-fix-dashboard.png"],
  ["c3d-diagnosis.png", "c3d-fix-diagnosis.png"],
  ["c3d-weekly-content.png", "c3d-fix-weekly-content.png"],
  ["c3d-publish-records.png", "c3d-fix-publish-records.png"],
  ["c3d-progress.png", "c3d-fix-progress.png"],
  ["c3d-report.png", "c3d-fix-report.png"],
  ["c3d-public-report.png", "c3d-fix-public-report.png"],
  ["c3d-mobile-report-375.png", "c3d-fix-mobile-report-375.png"],
  ["c3d-mobile-report-390.png", "c3d-fix-mobile-report-390.png"],
  ["c3d-mobile-report-414.png", "c3d-fix-mobile-report-414.png"],
];
for (const [from, to] of map) {
  renameSync(resolve(art, from), resolve(art, to));
  console.log(`[ok] artifacts/${to}`);
}
console.log("C3-D-Fix 截图完成。");
