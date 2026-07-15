import mysql from "mysql2/promise";
const value = name => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
const projectId = Number(value("--project-id"));
const mode = value("--mode");
if (!Number.isInteger(projectId) || projectId <= 0) throw new Error("invalid projectId");
if (!["legacy_only", "shadow_read", "v2_primary", "v2_only"].includes(mode)) throw new Error("invalid --mode");
if (["v2_primary", "v2_only"].includes(mode) && process.env.AI_OBSERVATION_LEDGER_V2?.toLowerCase() !== "true") throw new Error("global v2 feature flag is disabled");
if (projectId === 210001 && !["legacy_only", "shadow_read"].includes(mode)) throw new Error("210001 is restricted to legacy_only or shadow_read");
if (process.env.ALLOW_UNDERSTAND_ROLLOUT_CHANGE !== "true") throw new Error("rollout change requires explicit opt-in");
const writePath = mode === "v2_primary" || mode === "v2_only" ? "v2" : "legacy";
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await db.query(`INSERT INTO understanding_rollout_configs (projectId,readMode,writePath,reason)
    VALUES (?,?,?,'operator switch') ON DUPLICATE KEY UPDATE readMode=VALUES(readMode),writePath=VALUES(writePath),reason=VALUES(reason)`, [projectId, mode, writePath]);
  console.log(JSON.stringify({ status: "passed", projectId, mode, writePath }));
} finally { await db.end(); }
