import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import mysql from "mysql2/promise";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEYLEN = 64;

function env(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function requireEnv(name) {
  const value = env(name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function hashPassword(plain) {
  const salt = randomBytes(16);
  const derived = await scrypt(plain, salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString("base64")}:${Buffer.from(derived).toString("base64")}`;
}

function assertStrongPassword(password) {
  if (password.length < 16) {
    throw new Error("ADMIN_PASSWORD must be at least 16 characters");
  }
  const checks = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  if (checks.filter(Boolean).length < 3) {
    throw new Error("ADMIN_PASSWORD must include at least 3 of: lowercase, uppercase, number, symbol");
  }
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    loginMethod: row.loginMethod,
    userStatus: row.userStatus,
    hasPasswordHash: Boolean(row.hasPasswordHash),
  };
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const mode = env("ADMIN_MODE") || "check";
  const projectId = Number(env("ADMIN_PROJECT_ID") || env("PROJECT_ID") || "210001");

  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error("ADMIN_PROJECT_ID must be a positive integer");
  }
  if (mode !== "check" && mode !== "set-password") {
    throw new Error("ADMIN_MODE must be check or set-password");
  }

  const conn = await mysql.createConnection(databaseUrl);
  try {
    const [projectRows] = await conn.execute(
      `SELECT
         p.id,
         p.enterpriseName,
         p.ownerUserId,
         u.id AS userId,
         u.email,
         u.name,
         u.role,
         u.loginMethod,
         u.userStatus,
         (u.passwordHash IS NOT NULL AND u.passwordHash <> '') AS hasPasswordHash
       FROM projects p
       LEFT JOIN users u ON u.id = p.ownerUserId
       WHERE p.id = ?
       LIMIT 1`,
      [projectId],
    );

    const project = projectRows[0];
    if (!project) {
      console.log(JSON.stringify({ ok: false, projectId, projectExists: false }, null, 2));
      process.exitCode = 1;
      return;
    }

    const targetEmail = normalizeEmail(env("ADMIN_EMAIL") || String(project.email || ""));
    const result = {
      ok: true,
      mode,
      project: {
        id: project.id,
        enterpriseName: project.enterpriseName,
        ownerUserId: project.ownerUserId,
      },
      ownerUser: publicUser({
        id: project.userId,
        email: project.email,
        name: project.name,
        role: project.role,
        loginMethod: project.loginMethod,
        userStatus: project.userStatus,
        hasPasswordHash: project.hasPasswordHash,
      }),
      targetEmail: targetEmail || null,
    };

    if (mode === "check") {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (!targetEmail) {
      throw new Error("ADMIN_EMAIL is required when project owner email is empty");
    }
    const password = requireEnv("ADMIN_PASSWORD");
    assertStrongPassword(password);

    const [userRows] = await conn.execute(
      `SELECT
         id,
         email,
         name,
         role,
         loginMethod,
         userStatus,
         (passwordHash IS NOT NULL AND passwordHash <> '') AS hasPasswordHash
       FROM users
       WHERE LOWER(email) = LOWER(?)
       LIMIT 1`,
      [targetEmail],
    );
    const user = userRows[0];
    if (!user) {
      throw new Error(`No user found for ADMIN_EMAIL=${targetEmail}`);
    }
    if (Number(user.id) !== Number(project.ownerUserId)) {
      throw new Error(
        `ADMIN_EMAIL user id ${user.id} does not own project ${projectId}; refusing to update password`,
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          action: "set-password",
          project: result.project,
          updatingUser: publicUser(user),
        },
        null,
        2,
      ),
    );

    const passwordHash = await hashPassword(password);
    await conn.execute(
      `UPDATE users
       SET passwordHash = ?, loginMethod = COALESCE(loginMethod, 'email'), userStatus = 'active'
       WHERE id = ? AND LOWER(email) = LOWER(?)
       LIMIT 1`,
      [passwordHash, user.id, targetEmail],
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          action: "password-updated",
          userId: user.id,
          email: targetEmail,
          printedSecret: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await conn.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
