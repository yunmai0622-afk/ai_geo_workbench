import mysql from "mysql2/promise";

function env(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function requireEnv(name) {
  const value = env(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInt(name, fallback) {
  const value = Number(env(name) || fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function boolValue(value) {
  return value === 1 || value === true || value === "1" || value === "true";
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    loginMethod: row.loginMethod,
    hasPasswordHash: boolValue(row.hasPasswordHash),
  };
}

const projectScopedTables = [
  "enterprise_geo_profiles",
  "questions",
  "monthly_optimization_plans",
  "monthly_optimization_tasks",
  "optimization_tasks",
  "geo_article_topics",
  "geo_articles",
  "publish_tasks",
  "geo_publish_records",
  "geo_inclusion_monitoring_records",
  "reports",
  "delivery_report_share_tokens",
  "brand_source_records",
  "trust_evidence_items",
  "customer_cases",
  "project_platform_accounts",
];

async function tableHasProjectId(conn, table) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'projectId'`,
    [table],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function projectCounts(conn, projectId) {
  const counts = {};
  for (const table of projectScopedTables) {
    if (!(await tableHasProjectId(conn, table))) {
      counts[table] = null;
      continue;
    }
    const [rows] = await conn.execute(`SELECT COUNT(*) AS count FROM \`${table}\` WHERE projectId = ?`, [
      projectId,
    ]);
    counts[table] = Number(rows[0]?.count ?? 0);
  }
  return counts;
}

async function loadProjectWithOwner(conn, projectId, lock = false) {
  const [rows] = await conn.execute(
    `SELECT
       p.id,
       p.enterpriseName,
       p.ownerUserId,
       p.archivedAt,
       u.id AS userId,
       u.email,
       u.name,
       u.role,
       u.loginMethod,
       (u.passwordHash IS NOT NULL AND u.passwordHash <> '') AS hasPasswordHash
     FROM projects p
     LEFT JOIN users u ON u.id = p.ownerUserId
     WHERE p.id = ?
     LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [projectId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    enterpriseName: row.enterpriseName,
    ownerUserId: row.ownerUserId,
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
    ownerUser: publicUser({
      id: row.userId,
      email: row.email,
      name: row.name,
      role: row.role,
      loginMethod: row.loginMethod,
      hasPasswordHash: row.hasPasswordHash,
    }),
  };
}

async function loadUser(conn, userId, email) {
  const [rows] = await conn.execute(
    `SELECT
       id,
       email,
       name,
       role,
       loginMethod,
       (passwordHash IS NOT NULL AND passwordHash <> '') AS hasPasswordHash
     FROM users
     WHERE id = ? AND LOWER(email) = LOWER(?)
     LIMIT 1`,
    [userId, email],
  );
  return publicUser(rows[0]);
}

async function loadUserById(conn, userId) {
  const [rows] = await conn.execute(
    `SELECT
       id,
       email,
       name,
       role,
       loginMethod,
       (passwordHash IS NOT NULL AND passwordHash <> '') AS hasPasswordHash
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );
  return publicUser(rows[0]);
}

function assertCountsUnchanged(before, after) {
  const changed = [];
  for (const key of Object.keys(before)) {
    if (before[key] !== after[key]) changed.push({ table: key, before: before[key], after: after[key] });
  }
  if (changed.length > 0) {
    throw new Error(`Data counts changed unexpectedly: ${JSON.stringify(changed)}`);
  }
}

async function main() {
  const mode = env("OWNER_MIGRATION_MODE") || "dry-run";
  const projectId = positiveInt("OWNER_MIGRATION_PROJECT_ID", "180001");
  const fromOwnerUserId = positiveInt("OWNER_MIGRATION_FROM_OWNER_USER_ID", "16740006");
  const toOwnerUserId = positiveInt("OWNER_MIGRATION_TO_OWNER_USER_ID", "1");
  const toOwnerEmail = requireEnv("OWNER_MIGRATION_TO_OWNER_EMAIL").toLowerCase();

  if (mode !== "dry-run" && mode !== "apply" && mode !== "rollback") {
    throw new Error("OWNER_MIGRATION_MODE must be dry-run, apply, or rollback");
  }
  if (projectId !== 180001) {
    throw new Error("This guarded migration only supports projectId=180001");
  }
  if (fromOwnerUserId !== 16740006) {
    throw new Error("Unexpected source owner; refusing migration");
  }
  if (toOwnerUserId !== 1 || toOwnerEmail !== "419052760@qq.com") {
    throw new Error("Unexpected target owner; refusing migration");
  }

  const conn = await mysql.createConnection(requireEnv("DATABASE_URL"));
  try {
    const beforeCounts = await projectCounts(conn, projectId);
    await conn.beginTransaction();
    try {
      const beforeProject = await loadProjectWithOwner(conn, projectId, true);
      const targetUser = await loadUser(conn, toOwnerUserId, toOwnerEmail);
      const rollbackUser = await loadUserById(conn, fromOwnerUserId);
      if (!beforeProject) throw new Error("Project 180001 not found");
      const expectedOwnerUserId = mode === "rollback" ? toOwnerUserId : fromOwnerUserId;
      const nextOwnerUserId = mode === "rollback" ? fromOwnerUserId : toOwnerUserId;
      if (Number(beforeProject.ownerUserId) !== expectedOwnerUserId) {
        throw new Error(
          `Project 180001 ownerUserId is ${beforeProject.ownerUserId}, expected ${expectedOwnerUserId}`,
        );
      }
      if (!targetUser) throw new Error("Target owner user not found");
      if (!targetUser.hasPasswordHash) throw new Error("Target owner user has no passwordHash");
      if (mode === "rollback" && !rollbackUser) throw new Error("Rollback owner user not found");

      if (mode === "apply" || mode === "rollback") {
        const [result] = await conn.execute(
          `UPDATE projects
           SET ownerUserId = ?
           WHERE id = ? AND ownerUserId = ?
           LIMIT 1`,
          [nextOwnerUserId, projectId, expectedOwnerUserId],
        );
        if (Number(result.affectedRows ?? 0) !== 1) {
          throw new Error(`Expected exactly 1 updated project row, got ${result.affectedRows ?? 0}`);
        }
      }

      await conn.commit();
      const afterProject = await loadProjectWithOwner(conn, projectId, false);
      const afterCounts = await projectCounts(conn, projectId);
      assertCountsUnchanged(beforeCounts, afterCounts);

      console.log(
        JSON.stringify(
          {
            ok: true,
            mode,
            projectId,
            before: beforeProject,
            targetUser,
            rollbackUser,
            after: afterProject,
            countsUnchanged: true,
            counts: afterCounts,
            updateScope:
              mode === "rollback"
                ? "projects.ownerUserId WHERE id=180001 AND ownerUserId=1"
                : "projects.ownerUserId WHERE id=180001 AND ownerUserId=16740006",
            rollback: {
              table: "projects",
              field: "ownerUserId",
              projectId,
              from: toOwnerUserId,
              to: fromOwnerUserId,
            },
            safety: {
              printedSecrets: false,
              printedPasswordHash: false,
              touchedLocalDevUser: false,
              touchedProject210001: false,
              touchedOnlyProjectsOwnerUserId: mode === "apply" || mode === "rollback",
            },
          },
          null,
          2,
        ),
      );
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  } finally {
    await conn.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
