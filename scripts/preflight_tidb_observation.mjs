import mysql from "mysql2/promise";

const url = process.env.OBSERVATION_TIDB_PREFLIGHT_URL;
if (!url) {
  console.log(JSON.stringify({ status: "environment verification pending", reason: "OBSERVATION_TIDB_PREFLIGHT_URL is not configured" }));
  process.exit(0);
}

const parsed = new URL(url);
const safeTarget = { protocol: parsed.protocol, host: parsed.hostname, port: parsed.port || "default", database: parsed.pathname.replace(/^\//, "") };
const db = await mysql.createConnection(url);
try {
  const [rows] = await db.query("SELECT VERSION() AS version, @@version_comment AS versionComment, CURRENT_USER() AS currentUser");
  console.log(JSON.stringify({ status: "identified", target: safeTarget, identity: rows[0] }, null, 2));
} finally {
  await db.end();
}
