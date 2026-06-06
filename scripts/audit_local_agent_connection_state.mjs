#!/usr/bin/env node
/**
 * GEO-V1.1 Local Agent 连接态只读审计
 * 用法：PROJECT_ID=90001 node scripts/audit_local_agent_connection_state.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const HEARTBEAT_WINDOW_MS = 5 * 60 * 1000;
const BINDING_PLATFORMS = new Set(["zhihu", "sohu", "toutiao", "baijiahao", "netease"]);

const projectId = Number(process.env.PROJECT_ID ?? "90001");
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("需要 DATABASE_URL 环境变量");
  process.exit(1);
}

function parseTs(value) {
  if (value == null) return null;
  const at = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(at) ? at : null;
}

function isRecent(value, now = Date.now()) {
  const at = parseTs(value);
  if (at == null) return true;
  return now - at <= HEARTBEAT_WINDOW_MS;
}

function rowIndicatesHeartbeat(row) {
  return Boolean(row.localAgentId?.trim()) && Boolean(row.localProfileId?.trim()) && row.sessionStatus === "active";
}

function inferServerHeartbeat(accounts, now = Date.now()) {
  let lastActivityAt = null;
  let connected = false;
  for (const row of accounts) {
    if (!rowIndicatesHeartbeat(row)) continue;
    const candidates = [row.lastSessionCheckedAt, row.updatedAt].map(parseTs);
    const rowActivity = candidates.find(v => v != null) ?? null;
    if (rowActivity != null) {
      lastActivityAt = lastActivityAt == null ? rowActivity : Math.max(lastActivityAt, rowActivity);
    }
    if (isRecent(row.lastSessionCheckedAt ?? row.updatedAt, now)) connected = true;
  }
  return {
    connected,
    lastActivityAt: lastActivityAt != null ? new Date(lastActivityAt).toISOString() : null,
  };
}

function resolveState({ platformAccounts, serverHeartbeatConnected, serverLastActivityAt, now = Date.now() }) {
  const heartbeat =
    serverHeartbeatConnected != null
      ? { connected: Boolean(serverHeartbeatConnected), lastActivityAt: serverLastActivityAt }
      : inferServerHeartbeat(platformAccounts, now);
  const serverRecent =
    heartbeat.connected &&
    (heartbeat.lastActivityAt == null || isRecent(heartbeat.lastActivityAt, now));
  const activeServerSession = platformAccounts.some(rowIndicatesHeartbeat);
  const serverOnline = serverRecent || activeServerSession || heartbeat.connected;
  if (serverOnline) return "CONNECTED_BY_SERVER_HEARTBEAT";
  return "DISCONNECTED";
}

function mapSessionToLoginStatus(sessionStatus) {
  if (sessionStatus === "active") return "valid";
  if (sessionStatus === "expired") return "invalid";
  return "unknown";
}

function isPublishReady(row) {
  return (
    (row.isEnabled === 1 || row.isEnabled === true) &&
    Boolean(row.accountName?.trim()) &&
    Boolean(row.localProfileId?.trim()) &&
    Boolean(row.localAgentId?.trim()) &&
    row.sessionStatus === "active"
  );
}

function explainWebJudgement(resolvedState, readyCount, heartbeat, accountRows) {
  if (resolvedState === "CONNECTED_BY_SERVER_HEARTBEAT" && readyCount > 0) {
    return { webWouldShow: "connected", blockReason: null };
  }
  if (resolvedState === "CONNECTED_BY_SERVER_HEARTBEAT" && readyCount === 0) {
    return {
      webWouldShow: "connected_account_not_synced",
      blockReason: "当前项目无 active 发布账号行；客户端可能在线但账号未同步到本项目",
    };
  }
  if (accountRows.length === 0) {
    return {
      webWouldShow: "disconnected",
      blockReason: "project_platform_accounts 无记录；应检查 geo.platformAccounts.list 与 syncLocalAgentSnapshot",
    };
  }
  return {
    webWouldShow: "disconnected",
    blockReason: `服务端心跳 connected=${heartbeat.connected}；最近 5 分钟无 active 会话`,
  };
}

const conn = await mysql.createConnection(url);

try {
  const [projectRows] = await conn.query(
    "SELECT id, ownerUserId, enterpriseName FROM projects WHERE id = ? LIMIT 1",
    [projectId],
  );
  const project = projectRows[0] ?? null;

  const [accountRows] = await conn.query(
    `SELECT id, projectId, platform, accountName, localAgentId, localProfileId,
            sessionStatus, lastSessionCheckedAt, updatedAt, isEnabled, verificationStatus
     FROM project_platform_accounts
     WHERE projectId = ?
     ORDER BY platform, id`,
    [projectId],
  );

  let otherProjectActive = [];
  if (project?.ownerUserId) {
    const [crossRows] = await conn.query(
      `SELECT ppa.projectId, ppa.platform, ppa.accountName, ppa.localAgentId, ppa.localProfileId,
              ppa.sessionStatus, ppa.lastSessionCheckedAt
       FROM project_platform_accounts ppa
       INNER JOIN projects p ON p.id = ppa.projectId
       WHERE p.ownerUserId = ? AND ppa.projectId != ? AND ppa.sessionStatus = 'active'
       ORDER BY ppa.updatedAt DESC
       LIMIT 20`,
      [project.ownerUserId, projectId],
    );
    otherProjectActive = crossRows;
  }

  const heartbeat = inferServerHeartbeat(accountRows);
  const resolvedState = resolveState({
    platformAccounts: accountRows,
    serverHeartbeatConnected: heartbeat.connected,
    serverLastActivityAt: heartbeat.lastActivityAt,
  });
  const readyCount = accountRows.filter(isPublishReady).length;
  const webJudgement = explainWebJudgement(resolvedState, readyCount, heartbeat, accountRows);

  const report = {
    phase: "GEO-V1.1-LocalAgent-Server-State-DataSource-Forensic-P0",
    auditedAt: new Date().toISOString(),
    projectId,
    projectExists: Boolean(project),
    projectOwnerUserId: project?.ownerUserId ?? null,
    enterpriseName: project?.enterpriseName ?? null,
    accountRowCount: accountRows.length,
    readyPublishAccountCount: readyCount,
    serverHeartbeat: heartbeat,
    resolvedState,
    webJudgement,
    suggestedApis: [
      "geo.platformAccounts.list",
      "geo.platformAccounts.syncLocalAgentSnapshot",
      "agent.syncAccountStatuses",
      "POST /api/local-agent/accounts/status",
    ],
    accounts: accountRows.map(row => ({
      id: row.id,
      platform: row.platform,
      accountName: row.accountName,
      localAgentId: row.localAgentId ? `${row.localAgentId.slice(0, 8)}…` : null,
      localProfileId: row.localProfileId ? `${row.localProfileId.slice(0, 8)}…` : null,
      sessionStatus: row.sessionStatus,
      loginStatus: mapSessionToLoginStatus(row.sessionStatus),
      displayNameVerified: row.verificationStatus === "verified",
      lastCheckedAt: row.lastSessionCheckedAt
        ? new Date(row.lastSessionCheckedAt).toISOString()
        : null,
      withinHeartbeatWindow: isRecent(row.lastSessionCheckedAt ?? row.updatedAt),
      isPublishReady: isPublishReady(row),
      bindingPlatform: BINDING_PLATFORMS.has(row.platform),
    })),
    otherProjectsWithActiveAccounts: otherProjectActive.map(row => ({
      projectId: row.projectId,
      platform: row.platform,
      accountName: row.accountName,
      localAgentId: row.localAgentId ? `${row.localAgentId.slice(0, 8)}…` : null,
      sessionStatus: row.sessionStatus,
      lastCheckedAt: row.lastSessionCheckedAt
        ? new Date(row.lastSessionCheckedAt).toISOString()
        : null,
    })),
    forensic: {
      likelyProjectIdMismatch: otherProjectActive.length > 0 && accountRows.length === 0,
      likelyAccountNotSyncedToProject: readyCount === 0 && otherProjectActive.length > 0,
      likelyNoWrite: accountRows.length === 0 && otherProjectActive.length === 0,
    },
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  await conn.end();
}
