import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { projectPlatformAccounts } from "../drizzle/schema";
import { isBindingPublishPlatform } from "@shared/platformAccountVerify";
import { requireProjectAccessConn } from "./projectAccess";
import { logLocalAgentConnection } from "./localAgentConnectionLog";
import { bindLocalAgentAccount, requireDbConn } from "./projectPlatformAccounts";

type LocalAgentAccountStatusEntry = {
  platform: string;
  profileId: string;
  displayName: string | null;
  displayNameVerified: boolean;
  loginStatus: "valid" | "invalid" | "unknown";
  lastCheckedAt: string;
};

type LocalAgentAccountStatusPayload = {
  agentId: string;
  projectId?: number;
  accounts: LocalAgentAccountStatusEntry[];
};

function isLocalAgentAccountEntryValid(entry: LocalAgentAccountStatusEntry): boolean {
  return entry.loginStatus === "valid" && isBindingPublishPlatform(entry.platform);
}

function resolveSyncAccountDisplayName(entry: Pick<LocalAgentAccountStatusEntry, "displayName">): string {
  return entry.displayName?.trim() || "昵称待识别";
}

export const localAgentAccountStatusEntrySchema = z.object({
  platform: z.string().trim().min(1).max(32),
  profileId: z.string().trim().min(1).max(100),
  displayName: z.string().max(255).nullable(),
  displayNameVerified: z.boolean(),
  loginStatus: z.enum(["valid", "invalid", "unknown"]),
  lastCheckedAt: z.string().trim().min(1).max(64),
});

export const localAgentAccountStatusPayloadSchema = z.object({
  agentId: z.string().trim().min(1).max(100),
  projectId: z.number().int().positive().optional(),
  accounts: z.array(localAgentAccountStatusEntrySchema).max(50),
});

async function findAccountByLocalProfile(
  db: Awaited<ReturnType<typeof requireDbConn>>,
  projectId: number,
  localProfileId: string,
) {
  const rows = await db
    .select()
    .from(projectPlatformAccounts)
    .where(
      and(
        eq(projectPlatformAccounts.projectId, projectId),
        eq(projectPlatformAccounts.localProfileId, localProfileId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function syncLocalAgentAccountStatuses(
  ownerUserId: number,
  input: LocalAgentAccountStatusPayload,
): Promise<{ success: true; synced: number; projectId: number | null }> {
  const db = await requireDbConn();
  const projectId = input.projectId ?? null;
  if (!projectId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "缺少 projectId，无法同步账号状态" });
  }
  await requireProjectAccessConn(db, ownerUserId, projectId);

  let synced = 0;
  for (const entry of input.accounts) {
    if (!isBindingPublishPlatform(entry.platform)) continue;
    const platform = entry.platform;

    if (isLocalAgentAccountEntryValid(entry)) {
      await bindLocalAgentAccount(db, {
        projectId,
        platform,
        accountName: resolveSyncAccountDisplayName(entry),
        accountGroup: null,
        accountRole: null,
        localAgentId: input.agentId,
        localProfileId: entry.profileId,
        sessionStatus: "active",
        isEnabled: true,
        notes: entry.displayNameVerified ? null : "昵称待识别（由本地客户端同步）",
      });
      synced += 1;
      continue;
    }

    const existing = await findAccountByLocalProfile(db, projectId, entry.profileId);
    if (!existing) continue;
    const sessionStatus = entry.loginStatus === "invalid" ? "expired" : "unknown";
    await db
      .update(projectPlatformAccounts)
      .set({
        sessionStatus,
        lastSessionCheckedAt: new Date(entry.lastCheckedAt),
      })
      .where(eq(projectPlatformAccounts.id, existing.id));
  }

  logLocalAgentConnection("syncAccountStatuses", {
    projectId,
    userId: ownerUserId,
    accountCount: input.accounts.length,
    synced,
    hasLocalAgentId: Boolean(input.agentId?.trim()),
  });
  for (const entry of input.accounts) {
    logLocalAgentConnection("syncAccountEntry", {
      projectId,
      userId: ownerUserId,
      platform: entry.platform,
      hasLocalAgentId: Boolean(input.agentId?.trim()),
      hasLocalProfileId: Boolean(entry.profileId?.trim()),
      loginStatus: entry.loginStatus,
      lastCheckedAt: entry.lastCheckedAt,
      sessionStatus: isLocalAgentAccountEntryValid(entry) ? "active" : entry.loginStatus,
    });
  }

  return { success: true, synced, projectId } as const;
}

export function parseLocalAgentAccountStatusBody(body: unknown): LocalAgentAccountStatusPayload {
  return localAgentAccountStatusPayloadSchema.parse(body);
}
