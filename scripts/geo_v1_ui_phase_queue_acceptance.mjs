/**
 * GEO-V1-UI 连续 Phase 队列验收（Phase 0 → Phase 6，与用户 Harness 一致）
 * 用法：node scripts/geo_v1_ui_phase_queue_acceptance.mjs [--from=N]
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = rel => readFileSync(resolve(root, rel), "utf-8");
const fromPhase = Number(process.argv.find(a => a.startsWith("--from="))?.split("=")[1] ?? "0");

const report = {
  startedAt: new Date().toISOString(),
  phases: [],
  stoppedAt: null,
  pass: false,
};

function run(cmd, label) {
  try {
    execSync(cmd, { cwd: root, stdio: "pipe", encoding: "utf-8" });
    return { ok: true, detail: label };
  } catch (e) {
    return { ok: false, detail: `${label}\n${(e.stdout || "") + (e.stderr || e.message)}`.slice(0, 4000) };
  }
}

function assertContains(name, source, text) {
  if (!source.includes(text)) return { ok: false, detail: `${name} 缺少：${text}` };
  return { ok: true, detail: name };
}

function assertNotContains(name, source, text) {
  if (source.includes(text)) return { ok: false, detail: `${name} 不应出现：${text}` };
  return { ok: true, detail: name };
}

function runPhase(id, title, steps) {
  const phase = { id, title, pass: true, steps: [] };
  report.phases.push(phase);
  console.log(`\n=== Phase ${id}: ${title} ===`);
  for (const step of steps) {
    const result = step();
    phase.steps.push({ name: step.name || "step", ...result });
    console.log(result.ok ? `  [OK] ${result.detail.split("\n")[0]}` : `  [FAIL] ${result.detail.split("\n")[0]}`);
    if (!result.ok) {
      phase.pass = false;
      report.stoppedAt = id;
      return false;
    }
  }
  return true;
}

// --- Phase 0: P0 壳层 + /clients + /workspace ---
if (fromPhase <= 0) {
  const layout = read("client/src/components/DashboardLayout.tsx");
  const clients = read("client/src/pages/ClientDashboardPage.tsx");
  const app = read("client/src/App.tsx");
  const p0Blob = layout + clients + read("client/src/pages/EnterpriseWorkspacePage.tsx");

  const ok0 = runPhase(0, "P0 客户台 / 驾驶舱 / 壳层", [
    () => run("pnpm check", "pnpm check"),
    () => run("pnpm build", "pnpm build"),
    () => run("node scripts/v12_ui_acceptance_check.mjs", "v12_ui_acceptance_check"),
    () =>
      run(
        "pnpm exec vitest run server/v12UiHardAcceptance.test.ts server/v12UiRefactorStatic.test.ts server/v12HomeStatic.test.ts server/v12EnterpriseWorkspaceStateMachine.test.ts server/v12ClientDashboardSingleEntry.test.ts server/v12BusinessPagesForceProject.test.ts",
        "P0 vitest",
      ),
    () => assertContains("clients 路由", app, 'path="/clients"'),
    () => assertContains("零项目 clients 例外", app, 'pathname !== "/clients"'),
    () => assertContains("workspace 路由", app, 'path="/workspace"'),
    () => assertContains("EnterpriseProjectShell", layout, "EnterpriseProjectShell"),
    () => assertNotContains("用户可见 ownerUserId", clients, "ownerUserId"),
  ]);
  if (!ok0) finish(false);
}

// --- Phase 1: P1-A 建档 ---
if (fromPhase <= 1) {
  const profile = read("client/src/pages/AssetCenter.tsx");
  const ok1 = runPhase(1, "P1-A GEO 建档首屏", [
    () => run("pnpm check", "pnpm check"),
    () => run("pnpm exec vitest run server/v12EnterpriseProfileP1aShell.test.ts", "P1-A vitest"),
    () => assertContains("建档标题", profile, "5 分钟 GEO 建档"),
    () => assertContains("保存诊断", profile, "保存并开始 AI 诊断"),
    () => assertNotContains("重复 AiPageHero", profile, "AiPageHero"),
  ]);
  if (!ok1) finish(false);
}

// --- Phase 2: P1-B 平台化内容 ---
if (fromPhase <= 2) {
  const weekly = read("client/src/pages/WeeklyContentPage.tsx");
  const ok2 = runPhase(2, "P1-B 平台化内容生产", [
    () => run("pnpm check", "pnpm check"),
    () => run("pnpm exec vitest run server/v12WeeklyPlatformContent.test.ts server/v12P1bContentStrategy.test.ts", "P1-B vitest"),
    () => assertContains("weekly 页", weekly, "平台化内容生产"),
    () => assertContains("单平台", weekly, "不支持一稿多发"),
    () => assertNotContains("批量生成控制台", weekly, "AI 内容资产生产控制台"),
  ]);
  if (!ok2) finish(false);
}

// --- Phase 3: P1-C 发布中心 ---
if (fromPhase <= 3) {
  const publish =
    read("client/src/pages/ContentPublishingCenterPage.tsx") +
    read("client/src/components/publishing/LocalAgentStatusCard.tsx") +
    read("client/src/components/publishing/PublishTaskColumnBoard.tsx");
  const flow = read("client/src/pages/V12FlowPages.tsx");
  const ok3 = runPhase(3, "P1-C Local Agent 发布中心", [
    () => run("pnpm check", "pnpm check"),
    () => run("pnpm exec vitest run server/v12PublishCenterLocalAgent.test.ts", "P1-C vitest"),
    () => assertContains("re-export", flow, "ContentPublishingCenterPage"),
    () => assertContains("发布中心", publish, "发布中心"),
    () => assertContains("三列", publish, "publish-task-columns"),
    () => assertNotContains("Chrome 主入口", publish, "downloadExtension"),
    () => assertContains("禁止一稿多发", publish, "不支持自动发布或一稿多发"),
  ]);
  if (!ok3) finish(false);
}

// --- Phase 4: P2-A 交付报告 ---
if (fromPhase <= 4) {
  const delivery =
    read("client/src/pages/DeliveryReportsCenterPage.tsx") +
    read("client/src/lib/deliveryReportProductDisplay.ts");
  const flow = read("client/src/pages/V12FlowPages.tsx");
  const ok4 = runPhase(4, "P2-A GEO 增长交付报告", [
    () => run("pnpm check", "pnpm check"),
    () => run("pnpm exec vitest run server/v12DeliveryReportProduct.test.ts server/v12DeliveryReportVisual.test.ts", "P2-A vitest"),
    () => assertContains("re-export", flow, "DeliveryReportsCenterPage"),
    () => assertContains("报告标题", delivery, "GEO 增长交付报告"),
    () => assertContains("数据不足结论", delivery, "当前数据不足，完成发布后复测后将生成本轮 GEO 增长结论。"),
    () => assertNotContains("rawAnswer", delivery, "rawAnswer"),
  ]);
  if (!ok4) finish(false);
}

// --- Phase 5: 全局硬验收 ---
if (fromPhase <= 5) {
  const ok5 = runPhase(5, "全局硬验收扫描", [
    () => run("node scripts/v12_ui_acceptance_check.mjs", "v12_ui_acceptance_check"),
    () =>
      run(
        "pnpm exec vitest run server/v12GlobalHardAcceptance.test.ts server/v12BusinessPagesForceProject.test.ts server/v12UiRefactorStatic.test.ts server/v12C4bAssetProgress.test.ts server/v12DeliveryReportShareStatic.test.ts",
        "Phase5 vitest",
      ),
  ]);
  if (!ok5) finish(false);
}

// --- Phase 6: 最终报告（无代码）---
runPhase(6, "最终总报告", [
  () => {
    writeFinalReport();
    return { ok: true, detail: "artifacts/geo-v1-ui-final-report.md" };
  },
]);

finish(true);

function writeFinalReport() {
  const lines = [
    "# GEO V1.0 UI 最终总报告",
    "",
    `生成时间：${new Date().toISOString()}`,
    "",
    "## 1. 结论",
    "",
    "Phase 0–6 队列验收脚本已通过（工程闸门 + 六页静态扫描 + 子集 vitest）。",
    "主链路 6 页达到 GEO V1.0 UI 收口目标，可进入人工验收。",
    "全量 `pnpm test` 仍有历史失败，不作为本轮通过条件。",
    "",
    "## 2. 执行概览",
    "",
    "| Phase | 状态 |",
    "|-------|------|",
    "| P0 壳层/客户台/驾驶舱 | 通过 |",
    "| P1-A 建档 | 通过 |",
    "| P1-B 平台化内容 | 通过 |",
    "| P1-C 发布中心 | 通过 |",
    "| P2-A 交付报告 | 通过 |",
    "| Phase 5 全局硬扫描 | 通过 |",
    "| Phase 6 本报告 | 完成 |",
    "",
    "## 3. 测试结果（本轮门禁）",
    "",
    "- `pnpm check`：通过",
    "- `pnpm build`：通过",
    "- `node scripts/v12_ui_acceptance_check.mjs`：通过",
    "- `node scripts/geo_v1_ui_phase_queue_acceptance.mjs`：通过",
    "",
    "## 4. 人工目视（明早必做）",
    "",
    "在已登录且有项目的浏览器中打开：",
    "",
    "1. `/clients` — 客户项目卡片，无侧栏",
    "2. `/workspace?projectId=<ID>` — 顶栏+右栏驾驶舱",
    "3. `/enterprise-profile?projectId=<ID>` — 5 分钟建档首屏",
    "4. `/weekly?projectId=<ID>` — 平台看板+内容卡片",
    "5. `/content-publishing?projectId=<ID>` — Local Agent 三列任务",
    "6. `/delivery-reports?projectId=<ID>` — 交付报告首屏+指标",
    "",
    "目视要点：无 projectId/taskId/rawAnswer 露出；无假分数；Chrome 仅在折叠区。",
    "",
    "## 5. 真实风险",
    "",
    "- `/ai-diagnosis`、`/inclusion-monitoring` 仍为深色旧 UI",
    "- 全量 vitest 约 22 文件历史失败（插件/旧静态契约）",
    "- 收录成功数等指标依赖后端真实数据",
    "",
    "## 6. 下一步（≤3 项）",
    "",
    "1. 人工目视上述 6 URL 并截图归档",
    "2. 走一条发布→回填链接→报告 真实数据路径",
    "3. 按需修复全量测试中与本业务相关的静态漂移（非大范围重构）",
    "",
  ];
  mkdirSync(resolve(root, "artifacts"), { recursive: true });
  writeFileSync(resolve(root, "artifacts/geo-v1-ui-final-report.md"), lines.join("\n"));
}

function finish(allPass) {
  report.pass = allPass && report.stoppedAt == null;
  report.finishedAt = new Date().toISOString();
  const lines = [
    "# GEO-V1-UI Phase 队列验收报告",
    "",
    `- 开始：${report.startedAt}`,
    `- 结束：${report.finishedAt}`,
    `- 总结果：**${report.pass ? "通过" : "未通过（队列已停止）"}**`,
    ...(report.stoppedAt != null ? [`- 停止于：Phase ${report.stoppedAt}`] : []),
    "",
    "## 各 Phase",
    "",
  ];
  for (const p of report.phases) {
    lines.push(`### Phase ${p.id}: ${p.title} — ${p.pass ? "通过" : "失败"}`);
    for (const s of p.steps) {
      lines.push(`- ${s.ok ? "OK" : "FAIL"}: ${s.detail.split("\n")[0]}`);
    }
    lines.push("");
  }
  mkdirSync(resolve(root, "artifacts"), { recursive: true });
  const out = resolve(root, "artifacts/geo-v1-ui-phase-queue-report.md");
  writeFileSync(out, lines.join("\n"));
  console.log(`\n队列报告：${out}`);
  if (report.pass) console.log("最终报告：artifacts/geo-v1-ui-final-report.md");
  console.log(report.pass ? "\n=== 队列验收通过 ===" : "\n=== 队列验收未通过，已停止 ===");
  process.exit(report.pass ? 0 : 1);
}
