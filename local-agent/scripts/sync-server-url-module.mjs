#!/usr/bin/env node
/** 将 shared/localAgentServerUrl.ts 同步到 local-agent 编译单元（保持单一来源） */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "../../shared/localAgentServerUrl.ts");
const dest = path.join(here, "../src/agent/localAgentServerUrl.ts");

const header = `/** 由 scripts/sync-server-url-module.mjs 从 shared/localAgentServerUrl.ts 同步，请勿手改 */\n`;
const body = fs.readFileSync(src, "utf-8");
fs.writeFileSync(dest, header + body);
