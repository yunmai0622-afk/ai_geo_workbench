#!/usr/bin/env node
/**
 * GEO-V1.1 生产 Local Agent 状态只读审计
 * 用法：
 *   PROJECT_ID=90001 node scripts/audit_production_local_agent_state.mjs
 *   GEO_WEB_BASE_URL=https://aigeoworkbench00-production.up.railway.app PROJECT_ID=90001 node scripts/audit_production_local_agent_state.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const HEARTBEAT_WINDOW_MS = 5 * 60 * 1000;
const projectId = Number(process.env.PROJECT_ID ?? "90001");
const geoWebBaseUrl = (process.env.GEO_WEB_BASE_URL ?? "https://aigeoworkbench00-production.up.railway.app").replace(
  /\/$/,
  "",
);

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

function resolveState(input, now = Date.now()) {
  const heartbeat = inferServerHeartbeat(input.platformAccounts, now);
  const serverRecent =
    heartbeat.connected &&
    (heartbeat.lastActivityAt == null || isRecent(heartbeat.lastActivityAt, now));
  const activeServerSession = input.platformAccounts.some(rowIndicatesHeartbeat);
  const serverOnline = serverRecent || activeServerSession || heartbeat.connected;
  const localOk = input.localHttpCheckResult === true;
  if (serverOnline && localOk) return "CONNECTED_CONFIRMED";
  if (serverOnline) return "CONNECTED_BY_SERVER_HEARTBEAT";
  if (localOk) return "CONNECTED_BY_LOCAL_HTTP";
  if (input.localHttpCheckResult === false) return "DISCONNECTED";
  return "UNKNOWN_NEEDS_CHECK";
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

function explainWebDisplay(resolvedState, readyCount, heartbeat, accountRows, serverProxyHealth) {
  if (resolvedState.startsWith("CONNECTED") && readyCount > 0) {
    return { display: "connected", blockReason: null };
  }
  if (resolvedState.startsWith("CONNECTED") && readyCount === 0) {
    return {
      display: "pending-sync",
      blockReason: "agent_online_but_project_has_no_ready_accounts",
    };
  }
  if (serverProxyHealth?.ok === false && accountRows.length === 0) {
    return {
      display: "disconnected",
      blockReason:
        "server_proxy_health_false_and_no_db_accounts; browser_must_use_direct_127.0.0.1:39888_not_server_proxy",
    };
  }
  return {
    display: "disconnected",
    blockReason: `resolved=${resolvedState}; heartbeat=${heartbeat.connected}; accounts=${accountRows.length}`,
  };
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    try {
      return { status: res.status, ok: res.ok, json: JSON.parse(text), raw: text.slice(0, 200) };
    } catch {
      return { status: res.status, ok: res.ok, json: null, raw: text.slice(0, 200) };
    }
  } catch (error) {
    return { status: 0, ok: false, json: null, error: error instanceof Error ? error.message : String(error) };
  }
}

const productionApiAudit = {
  geoWebBaseUrl,
  endpoints: [],
};

const serverProxyHealth = await fetchJson(`${geoWebBaseUrl}/api/local-agent/health`);
productionApiAudit.endpoints.push({
  name: "GET /api/local-agent/health (server-side proxy)",
  requestParams: null,
  responseSummary: {
    httpStatus: serverProxyHealth.status,
    ok: serverProxyHealth.json?.ok ?? null,
    note: "远端 Manus 上此接口探测的是服务器 127.0.0.1:39888，不代表用户本机 Agent",
  },
});

const manifest = await fetchJson(`${geoWebBaseUrl}/downloads/manifest.json`);
productionApiAudit.endpoints.push({
  name: "GET /downloads/manifest.json",
  requestParams: null,
  responseSummary: {
    version: manifest.json?.version ?? null,
    geoWebBaseUrl: manifest.json?.geoWebBaseUrl ?? null,
  },
});

productionApiAudit.endpoints.push({
  name: "GET geo.platformAccounts.list",
  requestParams: { projectId },
  responseSummary: {
    note: "需登录 cookie；未授权时返回 UNAUTHORIZED",
    unauthenticatedProbe: await fetchJson(
      `${geoWebBaseUrl}/api/trpc/geo.platformAccounts.list?batch=1&input=${encodeURIComponent(
        JSON.stringify({ 0: { json: { projectId } } }),
      )}`,
    ).then(r => ({
      httpStatus: r.status,
      message: r.json?.[0]?.error?.json?.message ?? r.raw ?? r.error ?? null,
    })),
  },
});

let dbAudit = null;
const url = process.env.DATABASE_URL;
if (url) {
  const conn = await mysql.createConnection(url);
  try {
    const [projectRows] = await conn.query(
      "SELECT id, ownerUserId, enterpriseName FROM projects WHERE id = ? LIMIT 1",
      [projectId],
    );
    const project = projectRows[0] ?? null;
    const [accountRows] = await conn.query(
      `SELECT id, projectId, platform, accountName, localAgentId, localProfileId,
              sessionStatus, lastSessionCheckedAt, updatedAt, isEnabled
       FROM project_platform_accounts WHERE projectId = ? ORDER BY platform, id`,
      [projectId],
    );
    let otherProjectActive = [];
    if (project?.ownerUserId) {
      const [crossRows] = await conn.query(
        `SELECT ppa.projectId, ppa.platform, ppa.accountName, ppa.localAgentId, ppa.sessionStatus, ppa.lastSessionCheckedAt
         FROM project_platform_accounts ppa
         INNER JOIN projects p ON p.id = ppa.projectId
         WHERE p.ownerUserId = ? AND ppa.projectId != ? AND ppa.sessionStatus = 'active'
         ORDER BY ppa.updatedAt DESC LIMIT 10`,
        [project.ownerUserId, projectId],
      );
      otherProjectActive = crossRows;
    }
    const [taskRows] = await conn.query(
      "SELECT id, projectId, platform, status, articleId FROM publish_tasks WHERE projectId = ? ORDER BY id DESC LIMIT 5",
      [projectId],
    );
    const heartbeat = inferServerHeartbeat(accountRows);
    const readyCount = accountRows.filter(isPublishReady).length;
    const resolvedInput = {
      platformAccounts: accountRows,
      localHttpCheckResult: null,
      serverProxyHealthOk: serverProxyHealth.json?.ok ?? false,
    };
    const resolvedState = resolveState(resolvedInput);
    const latestActive = accountRows.find(rowIndicatesHeartbeat) ?? accountRows[0] ?? null;
    const lastCheckedAt = latestActive?.lastSessionCheckedAt ?? latestActive?.updatedAt ?? null;
    const lastCheckedAgeSec =
      parseTs(lastCheckedAt) != null ? Math.round((Date.now() - parseTs(lastCheckedAt)) / 1000) : null;

    dbAudit = {
      projectExists: Boolean(project),
      ownerUserId: project?.ownerUserId ?? null,
      enterpriseName: project?.enterpriseName ?? null,
      platformAccountRows: accountRows.length,
      validAccountRows: readyCount,
      latestLocalAgentId: latestActive?.localAgentId ? `${latestActive.localAgentId.slice(0, 8)}…` : null,
      latestLocalProfileId: latestActive?.localProfileId ? `${latestActive.localProfileId.slice(0, 8)}…` : null,
      lastCheckedAt: lastCheckedAt ? new Date(lastCheckedAt).toISOString() : null,
      lastCheckedAtAgeSeconds: lastCheckedAgeSec,
      withinHeartbeatWindow: isRecent(lastCheckedAt),
      resolvedLocalAgentConnectionStateInput: resolvedInput,
      resolvedLocalAgentConnectionStateOutput: resolvedState,
      webDisplay: explainWebDisplay(resolvedState, readyCount, heartbeat, accountRows, serverProxyHealth.json),
      otherProjectsWithActiveAccounts: otherProjectActive.map(r => ({
        projectId: r.projectId,
        platform: r.platform,
        accountName: r.accountName,
      })),
      recentPublishTasks: taskRows.map(r => ({
        id: r.id,
        platform: r.platform,
        status: r.status,
        articleId: r.articleId,
      })),
      accounts: accountRows.map(r => ({
        platform: r.platform,
        accountName: r.accountName,
        sessionStatus: r.sessionStatus,
        localAgentId: r.localAgentId ? `${r.localAgentId.slice(0, 8)}…` : null,
        localProfileId: r.localProfileId ? `${r.localProfileId.slice(0, 8)}…` : null,
        lastCheckedAt: r.lastSessionCheckedAt ? new Date(r.lastSessionCheckedAt).toISOString() : null,
        withinHeartbeatWindow: isRecent(r.lastSessionCheckedAt ?? r.updatedAt),
        isPublishReady: isPublishReady(r),
      })),
    };
  } finally {
    await conn.end();
  }
} else {
  dbAudit = { skipped: true, reason: "DATABASE_URL not set" };
}

console.log(
  JSON.stringify(
    {
      phase: "GEO-V1.1-LocalAgent-Production-API-Forensic-P0",
      auditedAt: new Date().toISOString(),
      projectId,
      productionApiAudit,
      dbAudit,
      forensicConclusion: {
        serverProxyHealthAlwaysFalseOnRemoteHost: serverProxyHealth.json?.ok === false,
        browserMustUseDirectLocalhost39888: true,
        recommendedApis: [
          "browser GET http://127.0.0.1:39888/health",
          "geo.platformAccounts.list (authenticated)",
          "geo.platformAccounts.syncLocalAgentSnapshot",
        ],
      },
    },
    null,
    2,
  ),
);
