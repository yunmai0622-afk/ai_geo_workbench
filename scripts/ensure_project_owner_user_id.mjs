#!/usr/bin/env node
/**
 * 检查并回填 projects.ownerUserId（GEO-V1-H）
 * 用法: DEFAULT_OWNER_USER_ID=1 node scripts/ensure_project_owner_user_id.mjs
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[ABORT] DATABASE_URL 未设置，无法检查 ownerUserId");
  process.exit(1);
}

const DEFAULT_OWNER_USER_ID = process.env.DEFAULT_OWNER_USER_ID
  ? Number(process.env.DEFAULT_OWNER_USER_ID)
  : null;

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  try {
    const hasCol = await columnExists(conn, "projects", "ownerUserId");
    if (!hasCol) {
      console.error("[ABORT] projects.ownerUserId 列不存在，请先执行 drizzle/0031_projects_owner_user_id.sql");
      process.exit(1);
    }
    console.log("[OK] projects.ownerUserId 列已存在");

    const [nullRows] = await conn.query(
      "SELECT id, enterpriseName FROM projects WHERE ownerUserId IS NULL OR ownerUserId = 0",
    );
    const orphans = nullRows;
    if (orphans.length === 0) {
      console.log("[OK] 无 ownerUserId 为空的历史项目");
    } else {
      console.log(`[WARN] ${orphans.length} 个项目 ownerUserId 为空，需要回填`);
      const [users] = await conn.query("SELECT id, openId, email FROM users ORDER BY id ASC");
      if (users.length === 0) {
        console.error("[ABORT] users 表为空，无法回填");
        process.exit(1);
      }
      let targetUserId = DEFAULT_OWNER_USER_ID;
      if (targetUserId == null || !Number.isFinite(targetUserId)) {
        if (users.length === 1) {
          targetUserId = users[0].id;
          console.log(`[INFO] 仅一个用户，回填 ownerUserId=${targetUserId} (${users[0].openId})`);
        } else {
          console.error("[ABORT] 存在多个用户且未设置 DEFAULT_OWNER_USER_ID，禁止静默乱填");
          console.error("users:", users.map(u => ({ id: u.id, openId: u.openId, email: u.email })));
          process.exit(1);
        }
      } else {
        const found = users.some(u => u.id === targetUserId);
        if (!found) {
          console.error(`[ABORT] DEFAULT_OWNER_USER_ID=${targetUserId} 不存在于 users 表`);
          process.exit(1);
        }
        console.log(`[INFO] 使用 DEFAULT_OWNER_USER_ID=${targetUserId} 回填`);
      }
      await conn.query("UPDATE projects SET ownerUserId = ? WHERE ownerUserId IS NULL OR ownerUserId = 0", [
        targetUserId,
      ]);
      console.log(`[OK] 已回填 ${orphans.length} 条 projects.ownerUserId`);
    }

    const [stillNull] = await conn.query(
      "SELECT COUNT(*) AS c FROM projects WHERE ownerUserId IS NULL OR ownerUserId = 0",
    );
    if (Number(stillNull[0]?.c) > 0) {
      console.error("[ABORT] 回填后仍有空 ownerUserId");
      process.exit(1);
    }

    const [colMeta] = await conn.query(
      `SELECT IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'ownerUserId'`,
    );
    if (colMeta[0]?.IS_NULLABLE === "YES") {
      console.log("[INFO] 将 ownerUserId 设为 NOT NULL …");
      await conn.query("ALTER TABLE `projects` MODIFY COLUMN `ownerUserId` int NOT NULL");
      console.log("[OK] ownerUserId NOT NULL");
    } else {
      console.log("[OK] ownerUserId 已为 NOT NULL");
    }

    const [fkRows] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects'
         AND CONSTRAINT_NAME = 'fk_projects_owner_user'`,
    );
    if (Number(fkRows[0]?.c) === 0) {
      console.log("[INFO] 添加 FK fk_projects_owner_user …");
      await conn.query(
        "ALTER TABLE `projects` ADD CONSTRAINT `fk_projects_owner_user` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`)",
      );
      console.log("[OK] FK 已添加");
    } else {
      console.log("[OK] FK fk_projects_owner_user 已存在");
    }

    console.log("\n[done] ensure_project_owner_user_id 完成");
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
