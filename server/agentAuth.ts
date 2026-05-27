import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { IncomingMessage } from "http";
import { users } from "../drizzle/schema";
import { getDb } from "./db";

export function readAgentApiKeyFromRequest(req: IncomingMessage): string {
  const raw = req.headers["x-agent-api-key"];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) return (raw[0] ?? "").trim();
  return "";
}

export async function assertAgentApiKeyUser(apiKey: string) {
  const key = apiKey.trim();
  if (!key) throw new TRPCError({ code: "UNAUTHORIZED", message: "缺少 Agent API 密钥" });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
  const rows = await db.select().from(users).where(eq(users.extensionApiKey, key)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "UNAUTHORIZED", message: "无效的 API 密钥" });
  return rows[0];
}
