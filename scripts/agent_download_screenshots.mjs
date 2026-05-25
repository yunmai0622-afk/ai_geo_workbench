#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const agentRoot = path.join(root, "local-agent");

async function main() {
  const { chromium } = await import(path.join(agentRoot, "node_modules/playwright/index.mjs"));
  if (!fs.existsSync(artifacts)) fs.mkdirSync(artifacts, { recursive: true });

  const release = path.join(root, "local-agent/release");
  const pub = path.join(root, "client/public/downloads");
  const page = await chromium.launch({ headless: true }).then(b => b.newPage({ viewport: { width: 1400, height: 900 } }));

  await page.setContent(
    `<pre style="font:13px monospace;padding:20px">${[...fs.readdirSync(release).filter(f => !f.includes("blockmap") && !f.includes("unpacked")), ...fs.readdirSync(pub)].join("\n")}</pre>`,
  );
  await page.screenshot({ path: path.join(artifacts, "agent-dist-files.png") });

  await page.goto("http://127.0.0.1:3000/enterprise-profile", { waitUntil: "networkidle", timeout: 60000 }).catch(() => null);
  const login = page.getByRole("button", { name: /本地开发登录/ });
  if (await login.count()) await login.first().click();
  await page.waitForTimeout(1500);
  const card = page.locator("[data-testid=local-agent-download-card]");
  if (await card.count()) {
    await card.screenshot({ path: path.join(artifacts, "agent-download-card.png") });
    const offline = page.locator("[data-testid=local-agent-offline]");
    if (await offline.count()) await card.screenshot({ path: path.join(artifacts, "agent-download-offline.png") });
    await page.locator("[data-testid=detect-local-agent]").click().catch(() => {});
    await page.waitForTimeout(800);
    const connected = page.locator("[data-testid=local-agent-connected]");
    if (await connected.count()) await card.screenshot({ path: path.join(artifacts, "agent-download-connected.png") });
    else await card.screenshot({ path: path.join(artifacts, "agent-download-offline.png") });
  }

  await page.close();
  console.log("screenshots done");
}

main().catch(e => {
  console.warn(e.message);
  process.exit(0);
});
