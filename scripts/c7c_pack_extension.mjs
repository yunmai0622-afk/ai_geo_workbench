/**
 * 打包 content-growth-publish-extension 为 client/public/browser-extension.zip（v1.2.3）
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const extDir = resolve(process.cwd(), "content-growth-publish-extension");
const outZip = resolve(process.cwd(), "client/public/browser-extension.zip");

execSync(`cd "${extDir}" && zip -r "${outZip}" . -x "*.DS_Store"`, { stdio: "inherit" });
console.log(`[ok] ${outZip}`);
