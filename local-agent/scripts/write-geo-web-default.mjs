#!/usr/bin/env node
/** 构建时将 geoWebBaseUrl 写入 dist，供打包客户端读取默认线上地址 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(root, "client/public/downloads/manifest.json");
const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist/geoWebBaseUrl.json");

const fallback = "https://aigeoworkbench00-production.up.railway.app";
let geoWebBaseUrl = process.env.GEO_WEB_BASE_URL?.trim() || fallback;

if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (typeof manifest.geoWebBaseUrl === "string" && manifest.geoWebBaseUrl.trim()) {
      geoWebBaseUrl = manifest.geoWebBaseUrl.trim();
    }
  } catch {
    /* use fallback */
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ geoWebBaseUrl }, null, 2));
console.log(`[write-geo-web-default] ${geoWebBaseUrl}`);
