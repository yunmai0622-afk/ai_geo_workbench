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
      const macOsDir = path.join(appPath, "Contents/MacOS");
      if (fs.existsSync(macOsDir)) {
        for (const entry of fs.readdirSync(macOsDir)) {
          const p = path.join(macOsDir, entry);
          if (fs.statSync(p).isFile()) fs.chmodSync(p, 0o755);
        }
      }
      const frameworksDir = path.join(appPath, "Contents/Frameworks");
      if (fs.existsSync(frameworksDir)) {
        for (const entry of fs.readdirSync(frameworksDir, { withFileTypes: true })) {
          if (!entry.isDirectory() || !entry.name.endsWith(".app")) continue;
          const helperMacOs = path.join(frameworksDir, entry.name, "Contents/MacOS");
          if (!fs.existsSync(helperMacOs)) continue;
          for (const h of fs.readdirSync(helperMacOs)) {
            const hp = path.join(helperMacOs, h);
            if (fs.statSync(hp).isFile()) fs.chmodSync(hp, 0o755);
          }
        }
      }
      execSync(`codesign --force --deep --sign - ${JSON.stringify(appPath)}`, { stdio: "inherit" });
      console.log("[afterPack] ad-hoc signed:", appPath);
    } catch (err) {
      console.warn("[afterPack] sign skipped (non-fatal):", err instanceof Error ? err.message : err);
    }
  }
};
