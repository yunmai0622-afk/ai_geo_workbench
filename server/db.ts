import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, type User, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = {
    openId: user.openId,
  };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };

  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) {
    values.lastSignedIn = new Date();
  }

  if (Object.keys(updateSet).length === 0) {
    updateSet.lastSignedIn = new Date();
  }

  try {
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user with drizzle schema, try legacy SQL fallback:", error);
    await db.execute(sql`
      INSERT INTO users (openId, name, email, loginMethod, role, lastSignedIn)
      VALUES (
        ${values.openId},
        ${values.name ?? null},
        ${values.email ?? null},
        ${values.loginMethod ?? null},
        ${values.role ?? "user"},
        ${values.lastSignedIn ?? new Date()}
      )
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        email = VALUES(email),
        loginMethod = VALUES(loginMethod),
        role = VALUES(role),
        lastSignedIn = VALUES(lastSignedIn)
    `);
  }
}

function isUserRecord(value: unknown): value is User {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "number" && typeof row.openId === "string";
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  try {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to query user with drizzle schema, try legacy SQL fallback:", error);
    const fallback = await db.execute(sql`
      SELECT id, openId, name, email, passwordHash, loginMethod, role, createdAt, updatedAt, lastSignedIn
      FROM users
      WHERE openId = ${openId}
      LIMIT 1
    `);
    const rows = (fallback as unknown as Array<unknown>) ?? [];
    const first = rows[0];
    return isUserRecord(first) ? first : undefined;
  }
}

// KNOWN(GEO-V1.1): feature queries live in domain modules (geoArticleLogic, routers, etc.).
