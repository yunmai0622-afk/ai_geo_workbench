/**
 * electron-builder afterPack：打包进 dmg/zip 前清除隔离并 ad-hoc 签名，减轻 macOS「已损坏」误报。
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/** @param {import("app-builder-lib").AfterPackContext} context */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const apps = fs.readdirSync(context.appOutDir).filter(name => name.endsWith(".app"));
  for (const name of apps) {
    const appPath = path.join(context.appOutDir, name);
    try {
      execSync(`xattr -cr ${JSON.stringify(appPath)}`, { stdio: "inherit" });
      execSync(`codesign --force --deep --sign - ${JSON.stringify(appPath)}`, { stdio: "inherit" });
      console.log("[afterPack] ad-hoc signed:", appPath);
    } catch (err) {
      console.warn("[afterPack] sign skipped (non-fatal):", err instanceof Error ? err.message : err);
    }
  }
};
