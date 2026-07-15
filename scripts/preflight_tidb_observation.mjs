import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log(JSON.stringify({ status: "environment verification pending", reason: "DATABASE_URL is not configured" }));
  process.exit(0);
}

const db = await mysql.createConnection(url);
try {
  const [rows] = await db.query("SELECT VERSION() AS version, @@version_comment AS versionComment");
  console.log(JSON.stringify({ status: "identified", version: rows[0] }, null, 2));
} finally {
  await db.end();
}
