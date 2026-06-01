/**
 * 检查 project_platform_accounts 唯一索引是否已从 (projectId, platform) 迁移到 (projectId, platform, accountName)
 * 用法：node scripts/check_platform_account_indexes.mjs
 */
import mysql from "mysql2/promise";

const OLD_INDEX = "project_platform_accounts_project_platform";
const NEW_INDEX = "project_platform_accounts_project_platform_name";

function env(name, fallback) {
  return process.env[name] ?? fallback;
}

async function main() {
  const conn = await mysql.createConnection({
    host: env("MYSQL_HOST", "127.0.0.1"),
    port: Number(env("MYSQL_PORT", "3306")),
    user: env("MYSQL_USER", "root"),
    password: env("MYSQL_PASSWORD", ""),
    database: env("MYSQL_DATABASE", env("DATABASE_URL", "").split("/").pop() || "geo_workbench"),
  });

  const [rows] = await conn.query(
    `SHOW INDEX FROM project_platform_accounts WHERE Key_name IN (?, ?)`,
    [OLD_INDEX, NEW_INDEX],
  );

  const byName = new Map();
  for (const r of rows) {
    const key = r.Key_name;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(r.Column_name);
  }

  const hasOld = byName.has(OLD_INDEX);
  const hasNew = byName.has(NEW_INDEX);

  console.log("=== project_platform_accounts 索引检查 ===");
  console.log(`旧索引 ${OLD_INDEX}: ${hasOld ? "存在（应迁移）" : "不存在（OK）"}`);
  if (hasOld) console.log(`  列: ${byName.get(OLD_INDEX).join(", ")}`);
  console.log(`新索引 ${NEW_INDEX}: ${hasNew ? "存在（OK）" : "不存在（需执行 drizzle/0025_platform_multi_accounts.sql）"}`);
  if (hasNew) console.log(`  列: ${byName.get(NEW_INDEX).join(", ")}`);

  await conn.end();

  if (hasOld && !hasNew) {
    process.exitCode = 1;
    console.error("\n[FAIL] 仍使用旧唯一约束，请运行迁移 0024");
  } else if (!hasNew) {
    process.exitCode = 1;
    console.error("\n[FAIL] 新唯一索引未创建");
  } else if (hasOld) {
    process.exitCode = 1;
    console.error("\n[FAIL] 新旧索引同时存在，请手动 DROP 旧索引");
  } else {
    console.log("\n[OK] 多账号唯一索引已就绪");
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
