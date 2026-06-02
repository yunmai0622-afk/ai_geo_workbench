#!/usr/bin/env node
/** 将 shared 模块同步到 local-agent 编译单元（保持单一来源） */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const agentDir = path.join(here, "../src/agent");

const header = (name) => `/** 由 scripts/sync-server-url-module.mjs 从 shared/${name} 同步，请勿手改 */\n`;

for (const name of ["localAgentServerUrl.ts", "localAgentVersionCompare.ts"]) {
  const src = path.join(here, "../../shared", name);
  const dest = path.join(agentDir, name);
  fs.writeFileSync(dest, header(name) + fs.readFileSync(src, "utf-8"));
}
