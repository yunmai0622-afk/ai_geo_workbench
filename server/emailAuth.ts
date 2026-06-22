import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { User } from "../drizzle/schema";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import {
  assertPasswordStrength,
  emailOpenId,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "./passwordAuth";

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = normalizeEmail(email);
  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return rows[0];
}

export async function registerEmailUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<User> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  }

  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请输入有效的邮箱地址" });
  }
  if (!name) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请填写姓名" });
  }
  try {
    assertPasswordStrength(input.password);
  } catch (e) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: e instanceof Error ? e.message : "密码不符合要求",
    });
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    throw new TRPCError({ code: "CONFLICT", message: "该邮箱已被注册，请直接登录" });
  }

  const passwordHash = await hashPassword(input.password);
  const openId = emailOpenId(email);

  await db.insert(users).values({
    openId,
    email,
    name,
    passwordHash,
    loginMethod: "email",
    role: "user",
    userStatus: "pending_review",
    lastSignedIn: new Date(),
  });

  const created = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (!created[0]) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "注册失败，请稍后重试" });
  }
  return created[0];
}

export async function loginEmailUser(input: { email: string; password: string }): Promise<User> {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请输入邮箱" });
  }

  const user = await getUserByEmail(email);
  if (!user?.passwordHash) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "邮箱或密码错误" });
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "邮箱或密码错误" });
  }

  const db = await getDb();
  if (db) {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  }

  return user;
}

export async function updateUserProfile(userId: number, input: { name: string }): Promise<User> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  }
  const name = input.name.trim();
  if (!name) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请填写姓名" });
  }
  await db.update(users).set({ name }).where(eq(users.id, userId));
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!rows[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
  }
  return rows[0];
}

export async function changeUserPassword(
  userId: number,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  }
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user?.passwordHash) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "当前账号未设置密码" });
  }
  const currentOk = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!currentOk) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "旧密码不正确" });
  }
  try {
    assertPasswordStrength(input.newPassword);
  } catch (e) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: e instanceof Error ? e.message : "密码不符合要求",
    });
  }
  const passwordHash = await hashPassword(input.newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}
