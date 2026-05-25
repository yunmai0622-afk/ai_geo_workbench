#!/usr/bin/env node
/**
 * 在已运行的 Electron 客户端中截取当前窗口到仓库 artifacts/。
 * 用法：先 npm run dev，另开终端 node scripts/capture_ui_screenshots.mjs
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const shots = [
  "agent-ui-client-window.png",
  "agent-ui-overview-tab.png",
  "agent-ui-accounts-tab.png",
  "agent-ui-tasks-tab.png",
  "agent-ui-settings-tab.png",
];

const runner = `
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
app.whenReady().then(async () => {
  const wins = BrowserWindow.getAllWindows();
  const w = wins.find(x => x.getTitle().includes('GEO')) || wins[0];
  if (!w) { console.error('no window'); app.quit(1); return; }
  const outDir = path.join('${path.join(root, "..", "artifacts").replace(/'/g, "\\'")}');
  const fs = require('fs');
  fs.mkdirSync(outDir, { recursive: true });
  const names = ${JSON.stringify(shots)};
  for (const name of names) {
    const img = await w.capturePage();
    fs.writeFileSync(path.join(outDir, name), img.toPNG());
    console.log('wrote', name);
  }
  app.quit(0);
});
`;

// 附加到已运行实例较复杂；改为提示用户用 devtools 或手动截屏
console.log("[info] 请在已打开的「GEO 本地发布客户端」窗口中切换 Tab 后，在 DevTools Console 执行：");
console.log("  await window.agentApi.captureWindowPng('agent-ui-overview-tab.png')");
console.log("截图将写入仓库 artifacts/ 目录。");
console.log("[info] 或 macOS 全屏截图：Command+Shift+4 后点击窗口。");

process.exit(0);
