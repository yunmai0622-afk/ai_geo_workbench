const PLATFORM_LABELS = {
  zhihu: "知乎",
  xiaohongshu: "小红书",
  sohu: "搜狐号",
  baijiahao: "百家号",
  toutiao: "头条号",
  wechat: "公众号",
};

/** 与 BINDING_PUBLISH_PLATFORMS 对齐 */
const CREATABLE_PLATFORMS = new Set(["zhihu", "sohu", "baijiahao", "toutiao", "netease"]);
const PENDING_PLATFORMS = new Set(["xiaohongshu", "wechat"]);

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
let selectedLogDetail = null;

const TaskLogDisplay = () => globalThis.PublishTaskLogDisplay ?? {};

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

function taskFinalStatusLabel(status) {
  const labels = TaskLogDisplay().FINAL_STATUS_LABELS ?? {};
  return labels[status] ?? STATUS_LABELS[status] ?? status ?? "进行中";
}

function accountCardTitle(acc) {
  if (acc.platform === "zhihu") {
    if (acc.displayNameVerified === true && acc.accountName) return acc.accountName;
    if (acc.sessionStatus === "active") return "知乎账号（昵称待识别）";
    return "未检测到账号昵称";
  }
  if (acc.accountName && acc.displayNameVerified === true) return acc.accountName;
  if (acc.sessionStatus === "active") return `${acc.platform || "平台"}账号（昵称待识别）`;
  return "未检测到账号昵称";
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
    const errHint = TaskLogDisplay().customerizeTaskError
      ? TaskLogDisplay().customerizeTaskError(d.recentFailure.message)
      : d.recentFailure.message;
    activities.push({
      time: d.recentFailure.createdAt || d.recentFailure.updatedAt,
      text: `${PLATFORM_LABELS[d.recentFailure.platform] ?? d.recentFailure.platform} · ${taskFinalStatusLabel(d.recentFailure.status)}${errHint ? " · " + errHint : ""}`,
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
    ? `GEO 服务端连接正常 · 最近同步 ${fmtTime(d.polling.lastPollAt)}`
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

/* ===== Render: Accounts (Left-Right Layout) ===== */
let selectedPlatform = "zhihu";

function renderAccounts() {
  const order = ["zhihu", "xiaohongshu", "sohu", "baijiahao", "toutiao", "wechat"];
  // Render left sidebar
  const platformListEl = $("#platform-list");
  if (!platformListEl) return;
  platformListEl.innerHTML = "";
  for (const platform of order) {
    const list = dashboard.accounts.filter((a) => a.platform === platform);
    const count = list.length;
    const hasActive = list.some((a) => a.sessionStatus === "active");
    let statusText = "未绑定";
    let statusClass = "status-unbound";
    if (count > 0 && hasActive) {
      statusText = "已绑定";
      statusClass = "status-bound";
    } else if (count > 0 && !hasActive) {
      statusText = "需重新登录";
      statusClass = "status-relogin";
    }
    const li = document.createElement("li");
    li.className = `platform-item ${platform === selectedPlatform ? "active" : ""}`;
    li.setAttribute("data-platform", platform);
    const pendingTag = PENDING_PLATFORMS.has(platform)
      ? '<span class="platform-item-pending">暂未接入</span>'
      : "";
    li.innerHTML = `
      <span class="platform-item-name">${PLATFORM_LABELS[platform]}</span>
      <span class="platform-item-count">${count} 个账号</span>
      <span class="platform-item-status ${statusClass}">${statusText}</span>
      ${pendingTag}
    `;
    li.onclick = () => {
      selectedPlatform = platform;
      renderAccounts();
    };
    platformListEl.appendChild(li);
  }

  // Render right side
  renderAccountsMain();
}

function renderAccountsMain() {
  const headerEl = $("#accounts-main-header");
  const contentEl = $("#accounts-main-content");
  if (!headerEl || !contentEl) return;

  const platform = selectedPlatform;
  const label = PLATFORM_LABELS[platform] ?? platform;
  const list = dashboard.accounts.filter((a) => a.platform === platform);
  const canCreate = CREATABLE_PLATFORMS.has(platform);
  const isPending = PENDING_PLATFORMS.has(platform);

  headerEl.innerHTML = `
    <div class="accounts-main-title-row">
      <div>
        <h3 class="accounts-main-title">${label}账号环境</h3>
        <p class="accounts-main-desc">在这里管理本机${label}登录环境。登录状态仅保存在本机，不上传密码或 Cookie。</p>
        ${
          isPending
            ? `<p class="accounts-main-desc warn-text">平台「${label}」暂未接入账号环境创建。</p>`
            : ""
        }
      </div>
      <button type="button" data-create="${platform}" class="btn-create-right" ${
        canCreate ? "" : "disabled"
      }>创建${label}账号环境</button>
    </div>
  `;
  const createBtn = headerEl.querySelector(".btn-create-right");
  if (createBtn && canCreate) {
    createBtn.onclick = () => void handleCreatePlatformProfile(platform);
  }

  contentEl.innerHTML = "";
  if (list.length === 0) {
    contentEl.innerHTML = `
      <div class="accounts-empty-state">
        <p class="accounts-empty-title">暂无${label}账号环境</p>
        <p class="accounts-empty-desc">请点击上方按钮创建${label}账号环境，并在打开的浏览器窗口中完成登录。</p>
      </div>
    `;
    return;
  }

  for (const acc of list) {
    const card = document.createElement("div");
    card.className = "account-card";
    const title = escapeHtml(accountCardTitle(acc));
    card.innerHTML = `
      <div class="acc-head">
        <div class="acc-title-wrap">
          <strong class="acc-title ${acc.accountName ? "" : "warn-text"}">${title}</strong>
        </div>
        ${sessionBadge(acc)}
      </div>
      <dl class="acc-meta-grid">
        <div class="acc-meta-row"><dt>登录状态</dt><dd>${sessionStatusLabel(acc.sessionStatus)}</dd></div>
        <div class="acc-meta-row"><dt>最近检测</dt><dd>${fmtDateShort(acc.lastCheckedAt)}</dd></div>
        <div class="acc-meta-row"><dt>最近发布</dt><dd>${fmtDateShort(acc.lastPublishAt)}</dd></div>
      </dl>
      <div class="btn-row compact acc-actions"></div>
    `;
    const actions = card.querySelector(".acc-actions");
    const mk = (label, cls, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (cls) b.className = cls;
      b.onclick = () => void fn();
      actions.appendChild(b);
    };
    mk("打开账号环境", "primary", async () => {
      const r = await window.agentApi.openLoginWindow(acc.profileId);
      appendLiveLog(r.message, !r.ok);
      await refresh();
    });
    mk("重新检测", "", async () => {
      const r = await window.agentApi.detectAccount(acc.profileId);
      appendLiveLog(r.ok ? r.message : r.message, !r.ok);
      await refresh();
    });
    mk("删除", "danger-btn", async () => {
      if (!confirm(`确定删除「${accountCardTitle(acc)}」的本地环境？\n删除后需重新登录该平台。`)) return;
      const r = await window.agentApi.deleteProfile(acc.profileId);
      appendLiveLog(r.message, !r.ok);
      await refresh();
    });
    contentEl.appendChild(card);
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
    mk("执行记录", () => {
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
    opt.textContent = `#${log.taskId} ${PLATFORM_LABELS[log.platform] ?? log.platform} · ${taskFinalStatusLabel(log.finalStatus)}`;
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
  const logDetailRaw = $("#log-detail-raw");
  selectedLogDetail = log;
  if (!logDetail) return;
  if (!log) {
    selectedLogDetail = null;
    logDetail.textContent = "本地无该任务记录";
    if (logDetailRaw) logDetailRaw.textContent = "";
    return;
  }
  const platformLabel = PLATFORM_LABELS[log.platform] ?? log.platform ?? "平台";
  const display = TaskLogDisplay();
  logDetail.textContent = display.formatPublishTaskLogsForCustomer
    ? display.formatPublishTaskLogsForCustomer(log, platformLabel)
    : `任务 #${log.taskId}`;
  if (logDetailRaw) {
    logDetailRaw.textContent = display.formatPublishTaskLogsRaw
      ? display.formatPublishTaskLogsRaw(log)
      : "";
  }
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
function switchToTab(tabId) {
  const btn = document.querySelector(`.tab[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

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

async function handleCreatePlatformProfile(platform) {
  if (!window.agentApi?.createPlatformProfile) {
    appendLiveLog("客户端 API 未就绪，请重启本地发布客户端", true);
    return;
  }
  const label = PLATFORM_LABELS[platform] ?? platform;
  if (PENDING_PLATFORMS.has(platform)) {
    appendLiveLog(`平台「${label}」暂未接入账号环境创建，请等待后续版本`, true);
    return;
  }
  if (!CREATABLE_PLATFORMS.has(platform)) {
    appendLiveLog(`不支持的平台：${label}`, true);
    return;
  }
  appendLiveLog(`正在创建${label}账号环境…`, false);
  try {
    const r = await window.agentApi.createPlatformProfile(platform);
    appendLiveLog(r.message || (r.ok ? "已创建账号环境" : "创建失败"), !r.ok);
    await refresh();
  } catch (e) {
    appendLiveLog(`创建账号环境失败：${e instanceof Error ? e.message : String(e)}`, true);
  }
}

/* ===== Event bindings ===== */
const btnTestConn = $("#btn-test-conn");
if (btnTestConn) {
  btnTestConn.onclick = () =>
    void window.agentApi.testServerConnection().then((r) => {
      appendLiveLog(r.message, !r.ok);
      if (r.diagnosticDetail && r.diagnosticDetail !== r.message) {
        appendLiveLog(`[诊断] ${r.diagnosticDetail}`, true);
      }
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

// data-create buttons now use inline onclick in renderAccountsMain()

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
    if (!selectedLogDetail) {
      appendLiveLog("请先选择一条任务", true);
      return;
    }
    const platformLabel = PLATFORM_LABELS[selectedLogDetail.platform] ?? selectedLogDetail.platform ?? "平台";
    const display = TaskLogDisplay();
    const text = display.formatPublishTaskLogCopyText
      ? display.formatPublishTaskLogCopyText(selectedLogDetail, platformLabel)
      : ($("#log-detail") || {}).textContent || "";
    navigator.clipboard.writeText(text).then(() => appendLiveLog("已复制日志（含客户说明与技术详情）", false));
  };
}

const btnSaveSettings = $("#btn-save-settings");
if (btnSaveSettings) {
  btnSaveSettings.onclick = () =>
    void window.agentApi
      .saveConfig({
        serverUrl: ($("#set-server-url") || {}).value?.trim() ?? "",
        serverUrlUserConfigured: true,
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

const btnResetServerOnline = $("#btn-reset-server-online");
if (btnResetServerOnline) {
  btnResetServerOnline.onclick = () =>
    void window.agentApi.resetServerUrlToOnline().then(() => {
      const msg = $("#settings-msg");
      if (msg) msg.textContent = "已恢复为线上 GEO 服务地址";
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
const btnOpenGeoBind = document.getElementById("btn-open-geo-bind");
if (btnOpenGeoBind) {
  const labelEl = btnOpenGeoBind.querySelector(".action-label");
  if (labelEl) labelEl.textContent = "配置账号环境";
  const descEl = btnOpenGeoBind.querySelector(".action-desc");
  if (descEl) descEl.textContent = "在本机创建平台登录环境（不上传 Cookie）";
  btnOpenGeoBind.onclick = () => switchToTab("accounts");
}
bindOpenGeoWeb("btn-open-geo-weekly", "contentProduction", "内容生产");
bindOpenGeoWeb("btn-tasks-open-geo-publish", "publishRecords", "发布记录");

initTabs();
if (window.agentApi.onFocusTab) {
  window.agentApi.onFocusTab((tab) => {
    if (tab === "accounts") switchToTab("accounts");
  });
}
window.agentApi.onStateChanged(() => refresh());
window.agentApi.onLogLine(({ line, isErr }) => appendLiveLog(line, isErr));
refresh();
setInterval(() => refresh(), 5000);
