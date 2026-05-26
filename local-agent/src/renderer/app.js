const PLATFORM_LABELS = {
  zhihu: "知乎",
  sohu: "搜狐号",
  baijiahao: "百家号",
  toutiao: "头条号",
};

const STATUS_LABELS = {
  pending_agent: "等待处理",
  agent_processing: "处理中",
  draft_saved: "已存草稿",
  completed: "已发布",
  manual_required: "需人工确认",
  session_expired: "登录失效",
  failed: "失败",
};

let dashboard = null;
let selectedLogTaskId = null;

function $(sel) {
  return document.querySelector(sel);
}

function fmtTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("zh-CN");
}

function fmtDateShort(v) {
  if (!v) return "暂无";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "暂无";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${h}:${m}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function accountCardTitle(acc) {
  return acc.accountName ? acc.accountName : "未检测到账号昵称";
}

function sessionStatusLabel(status) {
  if (status === "active") return "有效";
  if (status === "expired") return "已失效";
  return "未检测";
}

function isDetectFailure(acc) {
  if (acc.sessionStatus === "active") return false;
  const msg = (acc.lastDetectMessage ?? "").trim();
  if (!msg) return acc.sessionStatus === "unknown";
  if (/^检测成功/.test(msg)) return false;
  return true;
}

function sessionBadge(acc) {
  if (acc.sessionStatus === "active") {
    return '<span class="pill ok">登录有效</span>';
  }
  if (acc.sessionStatus === "expired") {
    return '<span class="pill danger">登录失效</span>';
  }
  if (isDetectFailure(acc)) {
    return '<span class="pill fail">检测失败</span>';
  }
  return '<span class="pill muted">未检测</span>';
}

function techLastError(acc) {
  const msg = (acc.lastDetectMessage ?? "").trim();
  if (!msg || /^检测成功/.test(msg)) return "";
  return msg;
}

function appendLiveLog(line, isErr) {
  const el = $("#live-log");
  if (!el) return;
  const row = `[${new Date().toLocaleTimeString()}] ${line}\n`;
  el.textContent = row + el.textContent.slice(0, 8000);
  if (isErr) el.classList.add("err");
}

/** 打开发布页结果展示 */
function formatOpenWriteResult(r, sourceLabel) {
  const head = sourceLabel ? `[${sourceLabel}] ` : "";
  if (r.ok) {
    return `${head}${r.message || "已打开发布页"}`;
  }
  const et = r.errorType ?? r.step ?? "unknown";
  if (et === "manual_required") {
    return `${head}${r.message || "未能自动进入发布页，已打开平台首页，请手动进入"}`;
  }
  if (et === "login_required" || et === "session_expired") {
    return `${head}发布页打开失败，请先完成登录`;
  }
  return `${head}发布页打开失败：${r.message || "请确认账号已登录"}`;
}

function openWriteIsError(r) {
  return !r.ok && r.errorType !== "manual_required";
}

/* ===== 状态判断 ===== */
function computeOverallStatus(d) {
  const localOk = d.localHttp?.ok && !d.localHttp?.startupError;
  const serverOk = d.serverConnected;
  const hasAccounts = d.accountTotal > 0;
  const hasActive = d.accountActive > 0;
  const isPolling = d.polling?.isPolling;

  if (!localOk) {
    return { status: "error", title: "客户端异常", desc: "本地服务未正常启动，请尝试重启客户端" };
  }
  if (!serverOk) {
    return { status: "warning", title: "服务端未连接", desc: "无法连接 GEO 服务端，请检查网络或联系管理员" };
  }
  if (!hasAccounts) {
    return { status: "idle", title: "等待配置", desc: "请先添加平台账号环境，完成登录后即可接收发布任务" };
  }
  if (!hasActive) {
    return { status: "warning", title: "账号需登录", desc: "所有账号登录已失效，请重新登录后再接收任务" };
  }
  if (isPolling) {
    return { status: "running", title: "正在运行", desc: "客户端正在自动接收并执行发布任务" };
  }
  return { status: "ready", title: "准备就绪", desc: "所有条件已满足，可以开始接收发布任务" };
}

/* ===== 发布准备流程 ===== */
function computePrepSteps(d) {
  const localOk = d.localHttp?.ok && !d.localHttp?.startupError;
  const serverOk = d.serverConnected;
  const hasAccounts = d.accountTotal > 0;
  const hasActive = d.accountActive > 0;
  const isPolling = d.polling?.isPolling;

  return [
    {
      title: "启动客户端",
      desc: "本地服务正常运行",
      state: localOk ? "done" : "active",
    },
    {
      title: "连接服务端",
      desc: "与 GEO 服务端通信正常",
      state: !localOk ? "pending" : serverOk ? "done" : "active",
    },
    {
      title: "添加账号",
      desc: "至少添加一个平台账号",
      state: !serverOk ? "pending" : hasAccounts ? "done" : "active",
    },
    {
      title: "登录有效",
      desc: "至少一个账号登录有效",
      state: !hasAccounts ? "pending" : hasActive ? "done" : "active",
    },
    {
      title: "开始接收",
      desc: "自动接收发布任务",
      state: !hasActive ? "pending" : isPolling ? "done" : "active",
    },
  ];
}

/* ===== Render: Overview ===== */
function renderOverview() {
  const d = dashboard;
  const overall = computeOverallStatus(d);

  // Header badge
  const hdrStatus = $("#hdr-status");
  hdrStatus.textContent = overall.title;
  hdrStatus.setAttribute("data-status", overall.status === "idle" ? "warning" : overall.status);

  // Hero card
  const heroEl = $("#status-hero");
  const statusClass = overall.status === "idle" ? "status-idle" : `status-${overall.status}`;
  heroEl.innerHTML = `
    <div class="hero-card ${statusClass}">
      <p class="hero-title">${escapeHtml(overall.title)}</p>
      <p class="hero-desc">${escapeHtml(overall.desc)}</p>
      <div class="hero-metrics">
        <div class="hero-metric"><span class="hero-metric-label">账号总数</span><span class="hero-metric-value">${d.accountTotal}</span></div>
        <div class="hero-metric"><span class="hero-metric-label">登录有效</span><span class="hero-metric-value">${d.accountActive}</span></div>
        <div class="hero-metric"><span class="hero-metric-label">待处理任务</span><span class="hero-metric-value">${d.pendingTaskCount}</span></div>
        <div class="hero-metric"><span class="hero-metric-label">今日已处理</span><span class="hero-metric-value">${d.todayTaskCount}</span></div>
      </div>
    </div>
  `;

  // Prep steps
  const steps = computePrepSteps(d);
  const stepsEl = $("#prep-steps");
  stepsEl.innerHTML = steps
    .map(
      (s, i) => `
    <div class="prep-step ${s.state}">
      <span class="prep-step-num">${s.state === "done" ? "✓" : i + 1}</span>
      <span class="prep-step-title">${escapeHtml(s.title)}</span>
      <span class="prep-step-desc">${escapeHtml(s.desc)}</span>
    </div>
  `
    )
    .join("");

  // Recent activity
  const actEl = $("#recent-activity");
  const activities = [];
  if (d.recentFailure) {
    activities.push({
      time: d.recentFailure.createdAt || d.recentFailure.updatedAt,
      text: `${PLATFORM_LABELS[d.recentFailure.platform] ?? d.recentFailure.platform} · ${STATUS_LABELS[d.recentFailure.status] ?? d.recentFailure.status}${d.recentFailure.message ? " · " + d.recentFailure.message : ""}`,
    });
  }
  if (d.polling?.lastPollAt) {
    activities.push({
      time: d.polling.lastPollAt,
      text: "最近一次任务拉取",
    });
  }
  if (activities.length === 0) {
    actEl.innerHTML = '<p class="activity-empty">暂无动态，客户端启动后将自动记录</p>';
  } else {
    actEl.innerHTML = activities
      .map(
        (a) =>
          `<div class="activity-item"><span class="activity-time">${fmtDateShort(a.time)}</span><span class="activity-text">${escapeHtml(a.text)}</span></div>`
      )
      .join("");
  }
}

/* ===== Render: Diagnostics ===== */
function renderDiagnostics() {
  const d = dashboard;
  const lh = d.localHttp ?? { ok: false, url: "—", error: "未知", agentId: null, startedAt: null, startupError: null };
  const localOk = lh.ok && !lh.startupError;
  const connOk = d.serverConnected;

  const localMsg = localOk
    ? `本地服务正常 · 启动于 ${fmtTime(lh.startedAt)} · v${lh.version ?? d.appVersion}`
    : `本地服务异常：${lh.startupError ?? lh.error ?? "请重新启动客户端"}`;
  const diagLocal = $("#diag-local-http");
  if (diagLocal) {
    diagLocal.textContent = localMsg;
    diagLocal.className = localOk ? "conn-line ok" : "conn-line err";
  }

  const serverMsg = connOk
    ? `GEO 服务端连接正常 · 最近轮询 ${fmtTime(d.polling.lastPollAt)}`
    : `GEO 服务端连接异常：${d.serverError ?? "未知"}`;
  const diagServer = $("#diag-server-conn");
  if (diagServer) {
    diagServer.textContent = serverMsg;
    diagServer.className = connOk ? "conn-line ok" : "conn-line err";
  }

  // Settings
  const cfg = d.config;
  const setServer = $("#set-server-url");
  if (setServer) setServer.value = cfg.serverUrl;
  const setAgent = $("#set-agent-id");
  if (setAgent) setAgent.value = cfg.localAgentId;
  const setPoll = $("#set-poll-sec");
  if (setPoll) setPoll.value = String(cfg.pollIntervalSeconds);
  const setMax = $("#set-max-tasks");
  if (setMax) setMax.value = String(cfg.maxTasksPerCycle);
  const setLog = $("#set-log-days");
  if (setLog) setLog.value = String(cfg.logRetentionDays);
  const setAuto = $("#set-auto-poll");
  if (setAuto) setAuto.checked = cfg.autoStartPolling;
  const setData = $("#set-data-dir");
  if (setData) setData.value = d.dataDir;
}

/* ===== Render: Accounts ===== */
function renderAccounts() {
  const root = $("#accounts-root");
  root.innerHTML = "";
  const localAgentId = dashboard.config.localAgentId ?? "";
  const order = ["zhihu", "sohu", "baijiahao", "toutiao"];
  for (const platform of order) {
    const list = dashboard.accounts.filter((a) => a.platform === platform);
    const block = document.createElement("section");
    block.className = "platform-block";
    block.innerHTML = `<h3>${PLATFORM_LABELS[platform]}</h3>`;
    if (list.length === 0) {
      block.innerHTML += `<p class="account-empty">暂无${PLATFORM_LABELS[platform]}账号环境，请点击上方「+ ${PLATFORM_LABELS[platform]}」创建。</p>`;
    } else {
      for (const acc of list) {
        const card = document.createElement("div");
        card.className = "account-card";
        const title = escapeHtml(accountCardTitle(acc));
        const lastErr = techLastError(acc);
        const profilePath = acc.profilePath ? escapeHtml(acc.profilePath) : "";
        card.innerHTML = `
          <div class="acc-head">
            <div class="acc-title-wrap">
              <span class="acc-kicker">账号昵称</span>
              <strong class="acc-title ${acc.accountName ? "" : "warn-text"}">${title}</strong>
            </div>
            ${sessionBadge(acc)}
          </div>
          <dl class="acc-meta-grid">
            <div class="acc-meta-row"><dt>平台</dt><dd>${PLATFORM_LABELS[platform] ?? platform}</dd></div>
            <div class="acc-meta-row"><dt>登录状态</dt><dd>${sessionStatusLabel(acc.sessionStatus)}</dd></div>
            <div class="acc-meta-row"><dt>最近检测</dt><dd>${fmtDateShort(acc.lastCheckedAt)}</dd></div>
            <div class="acc-meta-row"><dt>最近发布</dt><dd>${fmtDateShort(acc.lastPublishAt)}</dd></div>
          </dl>
          <p class="acc-security-hint">该账号登录态保存在本机，不保存密码，不上传 Cookie。</p>
          <details class="acc-tech-details">
            <summary>▶ 技术信息</summary>
            <dl class="acc-tech-grid">
              <div class="acc-meta-row"><dt>profileId</dt><dd><code>${escapeHtml(acc.profileId)}</code></dd></div>
              ${
                profilePath
                  ? `<div class="acc-meta-row"><dt>本地路径</dt><dd><code class="tech-path">${profilePath}</code><span class="tech-note">仅本机路径，不上传服务端</span></dd></div>`
                  : ""
              }
              ${
                localAgentId
                  ? `<div class="acc-meta-row"><dt>设备标识</dt><dd><code>${escapeHtml(localAgentId)}</code></dd></div>`
                  : ""
              }
              ${
                lastErr
                  ? `<div class="acc-meta-row"><dt>最近错误</dt><dd class="tech-error">${escapeHtml(lastErr)}</dd></div>`
                  : ""
              }
            </dl>
          </details>
          <div class="btn-row compact acc-actions"></div>
        `;
        const actions = card.querySelector(".acc-actions");
        const mk = (label, fn) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          b.onclick = () => void fn();
          actions.appendChild(b);
        };
        mk("打开登录", async () => {
          const r = await window.agentApi.openLoginWindow(acc.profileId);
          appendLiveLog(r.message, !r.ok);
          await refresh();
        });
        mk("检测账号", async () => {
          const r = await window.agentApi.detectAccount(acc.profileId);
          const detail = r.ok ? r.message : `${r.message}`;
          appendLiveLog(detail, !r.ok);
          await refresh();
        });
        mk("发布页", async () => {
          appendLiveLog(`正在打开发布页（${accountCardTitle(acc)}）…`, false);
          const r = await window.agentApi.openWritePage(acc.profileId, "accounts_publish_page_button");
          appendLiveLog(formatOpenWriteResult(r, accountCardTitle(acc)), openWriteIsError(r));
        });
        mk("重新登录", async () => {
          const r = await window.agentApi.markRelogin(acc.profileId);
          appendLiveLog(r.message, false);
          await refresh();
        });
        mk("删除环境", async () => {
          if (!confirm(`确定删除「${accountCardTitle(acc)}」的本地环境？\n删除后需重新登录该平台。`)) return;
          const r = await window.agentApi.deleteProfile(acc.profileId);
          appendLiveLog(r.message, !r.ok);
          await refresh();
        });
        block.appendChild(card);
      }
    }
    root.appendChild(block);
  }
}

/* ===== Render: Tasks ===== */
function renderTasks() {
  const tbody = $("#tasks-table tbody");
  tbody.innerHTML = "";
  if (!dashboard.serverTasks.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted center">暂无发布任务，任务由 GEO Web 服务端自动下发</td>`;
    tbody.appendChild(tr);
    return;
  }
  for (const t of dashboard.serverTasks) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.id}</td>
      <td>${PLATFORM_LABELS[t.platform] ?? t.platform}</td>
      <td>${t.expectedAccountName ?? "—"}</td>
      <td title="${(t.articleTitle || "").replace(/"/g, "&quot;")}">${(t.articleTitle || "").slice(0, 24)}</td>
      <td>${STATUS_LABELS[t.status] ?? t.status}</td>
      <td>${fmtDateShort(t.createdAt)}</td>
      <td class="actions-cell"></td>
    `;
    const cell = tr.querySelector(".actions-cell");
    const mk = (label, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.className = "linkish";
      b.onclick = () => void fn();
      cell.appendChild(b);
    };
    mk("日志", () => {
      selectedLogTaskId = t.id;
      document.querySelector('.tab[data-tab="diagnostics"]').click();
      renderLogDetail(t.id);
    });
    mk("重试", async () => {
      const r = await window.agentApi.pollOnce();
      appendLiveLog(r.message, false);
      await refresh();
    });
    if (t.localProfileId) {
      mk("打开平台", async () => {
        appendLiveLog(`正在打开发布页（任务 #${t.id}）…`, false);
        const r = await window.agentApi.openWritePage(t.localProfileId, "tasks_open_platform_button");
        appendLiveLog(formatOpenWriteResult(r, `任务 #${t.id}`), openWriteIsError(r));
      });
    }
    tbody.appendChild(tr);
  }
}

/* ===== Render: Log ===== */
function renderLogSelect() {
  const sel = $("#log-task-select");
  if (!sel) return;
  const prev = selectedLogTaskId;
  sel.innerHTML = '<option value="">选择任务查看日志</option>';
  if (!dashboard.localTaskLogs.length) {
    const logDetail = $("#log-detail");
    if (logDetail) logDetail.textContent = "暂无执行日志";
    return;
  }
  for (const log of dashboard.localTaskLogs) {
    const opt = document.createElement("option");
    opt.value = String(log.taskId);
    opt.textContent = `#${log.taskId} ${PLATFORM_LABELS[log.platform] ?? log.platform} · ${log.finalStatus ?? "进行中"}`;
    sel.appendChild(opt);
  }
  if (prev) sel.value = String(prev);
}

async function renderLogDetail(taskId) {
  selectedLogTaskId = taskId;
  const sel = $("#log-task-select");
  if (sel) sel.value = String(taskId);
  const log = await window.agentApi.getTaskLog(taskId);
  const logDetail = $("#log-detail");
  if (!logDetail) return;
  if (!log) {
    logDetail.textContent = "本地无该任务日志";
    return;
  }
  const lines = log.logs
    .map((l) => `${fmtTime(l.createdAt)}  ${l.step}  [${l.status}]  ${l.message ?? ""}`)
    .join("\n");
  logDetail.textContent = `任务 #${log.taskId} ${PLATFORM_LABELS[log.platform] ?? log.platform} ${log.finalStatus ?? ""}\n${log.errorMessage ?? ""}\n\n${lines}`;
}

/* ===== Main refresh ===== */
async function refresh() {
  try {
    dashboard = await window.agentApi.getDashboard();
    renderOverview();
    renderAccounts();
    renderTasks();
    renderLogSelect();
    renderDiagnostics();
    if (selectedLogTaskId) renderLogDetail(selectedLogTaskId);
    $("#hdr-version").textContent = `v${dashboard.appVersion}`;
  } catch (e) {
    appendLiveLog(e instanceof Error ? e.message : String(e), true);
  }
}

/* ===== Tabs ===== */
function initTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => {
        p.hidden = true;
        p.classList.remove("active");
      });
      btn.classList.add("active");
      const id = btn.getAttribute("data-tab");
      const panel = $(`#panel-${id}`);
      if (panel) {
        panel.hidden = false;
        panel.classList.add("active");
      }
    };
  });
}

/* ===== Event bindings ===== */
const btnTestConn = $("#btn-test-conn");
if (btnTestConn) {
  btnTestConn.onclick = () =>
    void window.agentApi.testServerConnection().then((r) => {
      appendLiveLog(r.message, !r.ok);
      refresh();
    });
}

const btnStartPoll = $("#btn-start-poll");
if (btnStartPoll) btnStartPoll.onclick = () => void window.agentApi.startPolling().then(() => refresh());

const btnStopPoll = $("#btn-stop-poll");
if (btnStopPoll) btnStopPoll.onclick = () => void window.agentApi.stopPolling().then(() => refresh());

const btnPollOnce = $("#btn-poll-once");
if (btnPollOnce) {
  btnPollOnce.onclick = () =>
    void window.agentApi.pollOnce().then((r) => {
      appendLiveLog(r.message, false);
      refresh();
    });
}

document.querySelectorAll("[data-create]").forEach((btn) => {
  btn.onclick = () =>
    void window.agentApi.createPlatformProfile(btn.getAttribute("data-create")).then((r) => {
      appendLiveLog(r.message ?? "已创建", !r.ok);
      refresh();
    });
});

const logSelect = $("#log-task-select");
if (logSelect) {
  logSelect.onchange = () => {
    const v = logSelect.value;
    if (v) renderLogDetail(Number(v));
  };
}

const btnCopyLogs = $("#btn-copy-logs");
if (btnCopyLogs) {
  btnCopyLogs.onclick = () => {
    const text = ($("#log-detail") || {}).textContent || "";
    navigator.clipboard.writeText(text).then(() => appendLiveLog("已复制日志到剪贴板", false));
  };
}

const btnSaveSettings = $("#btn-save-settings");
if (btnSaveSettings) {
  btnSaveSettings.onclick = () =>
    void window.agentApi
      .saveConfig({
        serverUrl: ($("#set-server-url") || {}).value?.trim() ?? "",
        agentApiKey: ($("#set-api-key") || {}).value ?? "",
        pollIntervalSeconds: Number(($("#set-poll-sec") || {}).value ?? 30),
        maxTasksPerCycle: Number(($("#set-max-tasks") || {}).value ?? 1),
        logRetentionDays: Number(($("#set-log-days") || {}).value ?? 7),
        autoStartPolling: ($("#set-auto-poll") || {}).checked ?? true,
      })
      .then(() => {
        const msg = $("#settings-msg");
        if (msg) msg.textContent = "设置已保存";
        refresh();
      });
}

const btnOpenData = $("#btn-open-data");
if (btnOpenData) btnOpenData.onclick = () => void window.agentApi.openDataDir();

const btnExportDiag = $("#btn-export-diag");
if (btnExportDiag) {
  btnExportDiag.onclick = () =>
    void window.agentApi.exportDiagnostics().then((r) => {
      const msg = $("#settings-msg");
      if (msg) msg.textContent = r.message;
    });
}

function bindOpenGeoWeb(buttonId, target, label) {
  const el = document.getElementById(buttonId);
  if (!el) return;
  el.onclick = () =>
    void window.agentApi.openGeoWeb(target).then((r) => {
      appendLiveLog(r.ok ? `已在浏览器打开：${label}` : r.message ?? "打开失败", !r.ok);
    });
}

bindOpenGeoWeb("btn-open-geo-publish", "publishRecords", "发布记录");
bindOpenGeoWeb("btn-open-geo-bind", "platformAccounts", "绑定发布账号");
bindOpenGeoWeb("btn-open-geo-weekly", "contentProduction", "内容生产");
bindOpenGeoWeb("btn-tasks-open-geo-publish", "publishRecords", "发布记录");

initTabs();
window.agentApi.onStateChanged(() => refresh());
window.agentApi.onLogLine(({ line, isErr }) => appendLiveLog(line, isErr));
refresh();
setInterval(() => refresh(), 5000);
