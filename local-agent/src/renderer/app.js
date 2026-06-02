const PLATFORM_LABELS = {
  zhihu: "知乎",
  xiaohongshu: "小红书",
  sohu: "搜狐号",
  baijiahao: "百家号",
  toutiao: "头条号",
  netease: "网易号",
  wechat: "公众号",
};

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

const LOG_DETAIL_EMPTY_TEXT = "暂无任务日志，选择一条发布任务查看执行详情";
const LOG_DETAIL_RAW_EMPTY_TEXT = "选择任务后可查看原始技术日志";
const LIVE_LOG_EMPTY_TEXT = "暂无实时输出";

const IDLE_LOG_KEYS = new Map([
  ["暂无待处理任务", "暂无任务"],
  ["正在执行任务，跳过本轮", "正在执行任务，跳过本轮"],
]);

let liveLogIdleLine = null;
let liveLogLines = [];

const TaskLogDisplay = () => globalThis.PublishTaskLogDisplay ?? {};
const Ux = () => globalThis.LocalAgentUx ?? {};

function $(sel) {
  return document.querySelector(sel);
}

function fmtTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("zh-CN");
}

function fmtDateShort(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
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
  if (acc.sessionStatus === "active") return `${PLATFORM_LABELS[acc.platform] ?? acc.platform}账号（昵称待识别）`;
  return "未检测到账号昵称";
}

function sessionStatusLabel(status) {
  if (status === "active") return "有效";
  if (status === "expired") return "已失效";
  return "未检测";
}

function heroStatusCssClass(hero) {
  const fn = Ux().heroStatusCssClass;
  return typeof fn === "function" ? fn(hero) : hero?.cssClass ?? "status-idle";
}

function pendingTaskCount(d) {
  const fn = Ux().pendingTaskCount;
  return typeof fn === "function" ? fn(d ?? dashboard) : (d ?? dashboard)?.pendingTaskCount ?? 0;
}

function buildDiagSummaryText(d) {
  const fn = Ux().buildDiagSummaryText;
  return typeof fn === "function" ? fn(d ?? dashboard) : "";
}

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

function formatLastCheckTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function idleLogSummary(line) {
  return IDLE_LOG_KEYS.get(String(line).trim()) ?? null;
}

function flushLiveLogView() {
  const el = $("#live-log");
  if (!el) return;
  const parts = [];
  if (liveLogIdleLine) parts.push(liveLogIdleLine);
  parts.push(...liveLogLines);
  if (parts.length === 0) {
    el.textContent = LIVE_LOG_EMPTY_TEXT;
    el.classList.add("is-empty");
  } else {
    el.textContent = `${parts.join("\n")}\n`;
    el.classList.remove("is-empty");
  }
}

function setLiveLogIdleStatus(at, summary) {
  liveLogIdleLine = `最后检查：${formatLastCheckTime(at)}，${summary}`;
  flushLiveLogView();
}

function syncLiveLogIdleFromDashboard(d) {
  if (!d?.polling) return;
  if (d.polling.lastCycleMessage === "暂无待处理任务" && d.polling.lastPollAt) {
    setLiveLogIdleStatus(d.polling.lastPollAt, "暂无任务");
  }
}

function appendLiveLog(line, isErr) {
  const el = $("#live-log");
  if (!el) return;
  const text = String(line ?? "").trim();
  if (!text) return;

  if (!isErr) {
    const idleSummary = idleLogSummary(text);
    if (idleSummary) {
      setLiveLogIdleStatus(new Date(), idleSummary);
      return;
    }
    if (liveLogLines.length > 0) {
      const last = liveLogLines[0];
      const m = last.match(/^\[[^\]]+\]\s+(.+)$/);
      if (m && m[1] === text) {
        liveLogLines[0] = `[${new Date().toLocaleTimeString()}] ${text}`;
        flushLiveLogView();
        return;
      }
    }
  }

  liveLogLines.unshift(`[${new Date().toLocaleTimeString()}] ${text}`);
  liveLogLines = liveLogLines.slice(0, 80);
  if (isErr) el.classList.add("err");
  else el.classList.remove("err");
  flushLiveLogView();
}

function setLogDetailEmpty(el, text) {
  if (!el) return;
  el.textContent = text;
  el.classList.add("is-empty");
}

function setLogDetailContent(el, text) {
  if (!el) return;
  el.textContent = text;
  el.classList.remove("is-empty");
}

function sessionBadge(acc) {
  const meta = Ux().sessionBadgeMeta?.(acc) ?? { text: "未检测", pillClass: "muted" };
  return `<span class="pill ${meta.pillClass}">${escapeHtml(meta.text)}</span>`;
}

function renderUpdateNotice(d) {
  const el = $("#update-notice");
  if (!el) return;
  const notice = d?.updateNotice;
  if (!notice) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = `
    <p class="update-notice-title">有新版本可用，建议更新客户端</p>
    <p class="update-notice-desc">当前 v${escapeHtml(notice.clientVersion)}，最新 v${escapeHtml(notice.manifestVersion)}</p>
    <button type="button" class="update-notice-download" id="btn-download-update">下载最新客户端</button>
  `;
  const btn = $("#btn-download-update");
  if (btn) {
    btn.onclick = () =>
      void window.agentApi.openExternalUrl(notice.downloadUrl).then((r) => {
        if (!r.ok) appendLiveLog(r.message ?? "打开下载链接失败", true);
      });
  }
}

function renderHeaderMetrics() {
  const el = $("#hdr-metrics");
  if (!el || !dashboard) return;
  const hero = Ux().computeHeroStatus?.(dashboard) ?? { title: "—" };
  const chips = Ux().headerMetricChips?.(dashboard, hero) ?? [];
  el.innerHTML = chips
    .map(
      (c) =>
        `<span class="hdr-metric-chip"><span class="hdr-metric-label">${escapeHtml(c.label)}</span><span class="hdr-metric-value">${escapeHtml(c.value)}</span></span>`,
    )
    .join("");
}

function bindHeroActionButton(btn, action) {
  btn.onclick = () => {
    if (action.id === "poll") {
      void window.agentApi.pollOnce().then((r) => {
        appendLiveLog(r.message, false);
        refresh();
      });
      return;
    }
    if (action.id === "accounts") {
      switchToTab("accounts");
      return;
    }
    if (action.id === "diag" || action.id === "restart_hint") {
      switchToTab("diag-settings");
    }
  };
}

function renderHeroActions(hero) {
  const el = $("#hero-actions");
  if (!el) return;
  const actions = Ux().heroActionsFor?.(hero) ?? [];
  el.innerHTML = "";
  for (const action of actions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = action.label;
    if (action.primary) btn.className = "primary";
    bindHeroActionButton(btn, action);
    el.appendChild(btn);
  }
}

function renderOverview() {
  const d = dashboard;
  renderUpdateNotice(d);
  const hero = Ux().computeHeroStatus?.(d) ?? { title: "检测中", desc: "", hdrStatus: "unknown", cssClass: "status-idle" };

  const hdrStatus = $("#hdr-status");
  if (hdrStatus) {
    hdrStatus.textContent = hero.title;
    hdrStatus.setAttribute("data-status", hero.hdrStatus ?? "unknown");
  }

  renderHeaderMetrics();

  const heroEl = $("#status-hero");
  if (heroEl) {
    const statusClass = heroStatusCssClass(hero);
    heroEl.innerHTML = `
    <div class="hero-card ${statusClass}">
      <p class="hero-title">${escapeHtml(hero.title)}</p>
      <p class="hero-desc">${escapeHtml(hero.desc)}</p>
      <div class="hero-metrics">
        <div class="hero-metric"><span class="hero-metric-label">账号总数</span><span class="hero-metric-value">${d.accountTotal}</span></div>
        <div class="hero-metric"><span class="hero-metric-label">可发布</span><span class="hero-metric-value">${d.accountActive}</span></div>
        <div class="hero-metric"><span class="hero-metric-label">待处理任务</span><span class="hero-metric-value">${pendingTaskCount(d)}</span></div>
        <div class="hero-metric"><span class="hero-metric-label">今日任务</span><span class="hero-metric-value">${d.todayTaskCount}</span></div>
      </div>
    </div>
  `;
  }

  renderHeroActions(hero);

  const steps = Ux().computePrepSteps?.(d) ?? [];
  const stepsEl = $("#prep-steps");
  if (stepsEl) {
    stepsEl.innerHTML = steps
      .map(
        (s, i) => `
    <div class="prep-step ${s.state}">
      <span class="prep-step-num">${s.state === "done" ? "✓" : i + 1}</span>
      <span class="prep-step-title">${escapeHtml(s.title)}</span>
      <span class="prep-step-desc">${escapeHtml(s.desc)}</span>
    </div>
  `,
      )
      .join("");
  }

  const actEl = $("#recent-activity");
  if (!actEl) return;
  const activities = [];
  if (d.recentFailure) {
    const errHint = TaskLogDisplay().customerizeTaskError
      ? TaskLogDisplay().customerizeTaskError(d.recentFailure.message)
      : d.recentFailure.message;
    activities.push({
      time: d.recentFailure.agentFinishedAt || d.recentFailure.createdAt,
      text: `${PLATFORM_LABELS[d.recentFailure.platform] ?? d.recentFailure.platform} · ${taskFinalStatusLabel(d.recentFailure.status)}${errHint ? " · " + errHint : ""}`,
    });
  }
  if (d.polling?.lastPollAt) {
    activities.push({
      time: d.polling.lastPollAt,
      text: "最近一次从 GEO Web 拉取任务",
    });
  }
  if (activities.length === 0) {
    actEl.innerHTML = '<p class="activity-empty">暂无动态，客户端运行后将在此显示</p>';
  } else {
    actEl.innerHTML = activities
      .map(
        (a) =>
          `<div class="activity-item"><span class="activity-time">${fmtDateShort(a.time)}</span><span class="activity-text">${escapeHtml(a.text)}</span></div>`,
      )
      .join("");
  }
}

function renderDiagSettings() {
  const d = dashboard;
  if (!d) return;
  syncLiveLogIdleFromDashboard(d);

  const grid = $("#diag-summary-grid");
  if (grid) {
    const rows = Ux().buildDiagSummaryRows?.(d) ?? [];
    grid.innerHTML = rows
      .map(
        (r) => `
      <div class="diag-summary-row">
        <dt>${escapeHtml(r.label)}</dt>
        <dd class="${r.ok ? "ok-text" : "warn-text"}">${escapeHtml(r.value)}</dd>
      </div>`,
      )
      .join("");
  }

  const meta = $("#diag-tech-meta");
  if (meta) {
    const lh = d.localHttp ?? {};
    meta.textContent = `设备 ${d.platformInfo?.hostname ?? "—"} · 本地 ${lh.url ?? "—"} · Agent ${d.config?.localAgentId ?? "—"}`;
  }
}

function renderSettings() {
  if (!dashboard) return;
  const d = dashboard;
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

  const labelEl = $("#set-auto-poll-label");
  if (labelEl && Ux().SETTINGS?.autoPollLabel) {
    labelEl.textContent = Ux().SETTINGS.autoPollLabel;
  }
  const hintEl = $("#set-auto-poll-hint");
  if (hintEl) {
    hintEl.textContent = Ux().settingsAutoPollHint?.(cfg.autoStartPolling) ?? "";
  }
}

let selectedPlatform = "zhihu";

function platformSidebarStatusClass(statusText) {
  if (statusText === Ux().PLATFORM_SIDEBAR?.ready) return "status-bound";
  if (statusText === Ux().PLATFORM_SIDEBAR?.relogin) return "status-relogin";
  if (statusText === Ux().PLATFORM_SIDEBAR?.pending) return "status-pending";
  return "status-unbound";
}

function renderAccounts() {
  const order = ["zhihu", "xiaohongshu", "sohu", "baijiahao", "toutiao", "netease", "wechat"];
  const platformListEl = $("#platform-list");
  if (!platformListEl) return;
  platformListEl.innerHTML = "";
  for (const platform of order) {
    const list = dashboard.accounts.filter((a) => a.platform === platform);
    const count = list.length;
    const isPendingPlatform = PENDING_PLATFORMS.has(platform);
    const statusText = Ux().platformSidebarStatus?.(platform, list, isPendingPlatform) ?? "未配置";
    const statusClass = platformSidebarStatusClass(statusText);
    const li = document.createElement("li");
    li.className = `platform-item ${platform === selectedPlatform ? "active" : ""}`;
    li.setAttribute("data-platform", platform);
    li.innerHTML = `
      <span class="platform-item-name">${PLATFORM_LABELS[platform]}</span>
      <span class="platform-item-count">${count} 个环境</span>
      <span class="platform-item-status ${statusClass}">${escapeHtml(statusText)}</span>
    `;
    li.onclick = () => {
      selectedPlatform = platform;
      renderAccounts();
    };
    platformListEl.appendChild(li);
  }
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
  const hasAccounts = list.length > 0;
  const createBtnLabel = hasAccounts ? `添加${label}环境` : `创建${label}账号环境`;

  headerEl.innerHTML = `
    <div class="accounts-main-title-row">
      <div>
        <h3 class="accounts-main-title">${label}账号环境</h3>
        <p class="accounts-main-desc">登录状态仅保存在本机。完成登录后请点击账号卡片上的「${escapeHtml(Ux().ACCOUNT_META?.refreshSyncBtn ?? "刷新并同步账号状态")}」。</p>
        ${
          isPending
            ? `<p class="accounts-main-desc warn-text">平台「${label}」${Ux().PLATFORM_SIDEBAR?.pending ?? "暂未接入"}，请等待后续版本。</p>`
            : ""
        }
      </div>
      <button type="button" data-create="${platform}" class="btn-create-right" ${
        canCreate ? "" : "disabled"
      }>${createBtnLabel}</button>
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
        <p class="accounts-empty-desc">请点击上方按钮创建环境，在浏览器窗口完成登录后刷新并同步账号状态。</p>
      </div>
    `;
    return;
  }

  const meta = Ux().ACCOUNT_META ?? {};
  for (const acc of list) {
    const card = document.createElement("div");
    card.className = "account-card";
    const title = escapeHtml(accountCardTitle(acc));
    const webSync = Ux().accountWebSyncLabel?.(acc, dashboard.serverConnected) ?? "—";
    const publishCap = Ux().accountPublishCapabilityLabel?.(acc, isPending) ?? "—";
    card.innerHTML = `
      <div class="acc-head">
        <div class="acc-title-wrap">
          <strong class="acc-title ${acc.accountName ? "" : "warn-text"}">${title}</strong>
        </div>
        ${sessionBadge(acc)}
      </div>
      <dl class="acc-meta-grid">
        <div class="acc-meta-row"><dt>${escapeHtml(meta.webSync ?? "Web 同步")}</dt><dd>${escapeHtml(webSync)}</dd></div>
        <div class="acc-meta-row"><dt>${escapeHtml(meta.publishCap ?? "发布能力")}</dt><dd>${escapeHtml(publishCap)}</dd></div>
        <div class="acc-meta-row"><dt>登录状态</dt><dd>${sessionStatusLabel(acc.sessionStatus)}</dd></div>
        <div class="acc-meta-row"><dt>最近检测</dt><dd>${fmtDateShort(acc.lastCheckedAt)}</dd></div>
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
    mk(meta.refreshSyncBtn ?? "刷新并同步账号状态", "primary", async () => {
      appendLiveLog("正在检测并同步账号状态…", false);
      const r = await window.agentApi.detectAccount(acc.profileId);
      appendLiveLog(r.message, !r.ok);
      await refresh();
    });
    mk("打开账号环境", "", async () => {
      const r = await window.agentApi.openLoginWindow(acc.profileId);
      appendLiveLog(r.message, !r.ok);
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

function renderTasksEmptyState() {
  const emptyEl = $("#tasks-empty");
  const wrapEl = $("#tasks-table-wrap");
  if (!emptyEl || !wrapEl) return;
  const empty = Ux().TASKS_EMPTY ?? {};
  const hasTasks = dashboard.serverTasks.length > 0;
  if (hasTasks) {
    emptyEl.hidden = true;
    wrapEl.hidden = false;
    return;
  }
  emptyEl.hidden = false;
  wrapEl.hidden = true;
  emptyEl.innerHTML = `
    <p class="tasks-empty-title">${escapeHtml(empty.title ?? "暂无发布任务")}</p>
    <p class="tasks-empty-body">${escapeHtml(empty.body ?? "")}</p>
    <p class="tasks-empty-hint muted">${escapeHtml(empty.hint ?? "")}</p>
    <div class="btn-row compact">
      <button type="button" id="btn-tasks-empty-poll" class="primary">${escapeHtml(empty.ctaPoll ?? "立即拉取任务")}</button>
      <button type="button" id="btn-tasks-empty-geo">${escapeHtml(empty.ctaGeo ?? "去 GEO Web")}</button>
    </div>
  `;
  const pollBtn = $("#btn-tasks-empty-poll");
  if (pollBtn) {
    pollBtn.onclick = () =>
      void window.agentApi.pollOnce().then((r) => {
        appendLiveLog(r.message, false);
        refresh();
      });
  }
  const geoBtn = $("#btn-tasks-empty-geo");
  if (geoBtn) {
    geoBtn.onclick = () =>
      void window.agentApi.openGeoWeb("publishRecords").then((r) => {
        appendLiveLog(r.ok ? "已在浏览器打开发布记录" : r.message ?? "打开失败", !r.ok);
      });
  }
}

function renderTasks() {
  renderTasksEmptyState();
  const tbody = $("#tasks-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!dashboard.serverTasks.length) return;

  for (const t of dashboard.serverTasks) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.id}</td>
      <td>${PLATFORM_LABELS[t.platform] ?? t.platform}</td>
      <td>${escapeHtml(t.expectedAccountName ?? "—")}</td>
      <td title="${escapeHtml(t.articleTitle || "")}">${escapeHtml((t.articleTitle || "").slice(0, 24))}</td>
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
      switchToTab("diag-settings");
      const fold = $("#diag-tech-fold");
      if (fold) fold.open = true;
      renderLogDetail(t.id);
    });
    mk("重试拉取", async () => {
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

function renderLogSelect() {
  const sel = $("#log-task-select");
  if (!sel) return;
  const prev = selectedLogTaskId;
  sel.innerHTML = '<option value="">选择任务查看日志</option>';
  if (!dashboard.localTaskLogs.length) {
    selectedLogTaskId = null;
    selectedLogDetail = null;
    setLogDetailEmpty($("#log-detail"), LOG_DETAIL_EMPTY_TEXT);
    setLogDetailEmpty($("#log-detail-raw"), LOG_DETAIL_RAW_EMPTY_TEXT);
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
    setLogDetailEmpty(logDetail, "本地无该任务记录");
    setLogDetailEmpty(logDetailRaw, LOG_DETAIL_RAW_EMPTY_TEXT);
    return;
  }
  const platformLabel = PLATFORM_LABELS[log.platform] ?? log.platform ?? "平台";
  const display = TaskLogDisplay();
  setLogDetailContent(
    logDetail,
    display.formatPublishTaskLogsForCustomer
      ? display.formatPublishTaskLogsForCustomer(log, platformLabel)
      : `任务 #${log.taskId}`,
  );
  if (logDetailRaw) {
    const raw = display.formatPublishTaskLogsRaw ? display.formatPublishTaskLogsRaw(log) : "";
    if (raw.trim()) setLogDetailContent(logDetailRaw, raw);
    else setLogDetailEmpty(logDetailRaw, LOG_DETAIL_RAW_EMPTY_TEXT);
  }
}

async function refresh() {
  try {
    dashboard = await window.agentApi.getDashboard();
    renderOverview();
    renderAccounts();
    renderTasks();
    renderLogSelect();
    renderDiagSettings();
    renderHeaderMetrics();
    renderSettings();
    if (selectedLogTaskId) renderLogDetail(selectedLogTaskId);
    else {
      setLogDetailEmpty($("#log-detail"), LOG_DETAIL_EMPTY_TEXT);
      setLogDetailEmpty($("#log-detail-raw"), LOG_DETAIL_RAW_EMPTY_TEXT);
    }
    const ver = $("#hdr-version");
    if (ver) ver.textContent = `v${dashboard.appVersion}`;
  } catch (e) {
    appendLiveLog(e instanceof Error ? e.message : String(e), true);
  }
}

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
    appendLiveLog(`平台「${label}」暂未接入，请等待后续版本`, true);
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

const btnPollOnce = $("#btn-poll-once");
if (btnPollOnce) {
  btnPollOnce.onclick = () =>
    void window.agentApi.pollOnce().then((r) => {
      appendLiveLog(r.message, false);
      refresh();
    });
}

const btnPollOnceDiag = $("#btn-poll-once-diag");
if (btnPollOnceDiag) {
  btnPollOnceDiag.onclick = () =>
    void window.agentApi.pollOnce().then((r) => {
      appendLiveLog(r.message, false);
      refresh();
    });
}

const btnCopyDiagSummary = $("#btn-copy-diag-summary");
if (btnCopyDiagSummary) {
  btnCopyDiagSummary.onclick = () => {
    const text = buildDiagSummaryText(dashboard);
    if (!text) {
      appendLiveLog("暂无诊断信息", true);
      return;
    }
    navigator.clipboard.writeText(text).then(() => appendLiveLog("已复制诊断摘要", false));
  };
}

const logSelect = $("#log-task-select");
if (logSelect) {
  logSelect.onchange = () => {
    const v = logSelect.value;
    if (v) void renderLogDetail(Number(v));
    else {
      selectedLogTaskId = null;
      selectedLogDetail = null;
      setLogDetailEmpty($("#log-detail"), LOG_DETAIL_EMPTY_TEXT);
      setLogDetailEmpty($("#log-detail-raw"), LOG_DETAIL_RAW_EMPTY_TEXT);
    }
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

const setAutoPoll = $("#set-auto-poll");
if (setAutoPoll) {
  setAutoPoll.onchange = () => {
    const hintEl = $("#set-auto-poll-hint");
    if (hintEl) hintEl.textContent = Ux().settingsAutoPollHint?.(setAutoPoll.checked) ?? "";
  };
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
bindOpenGeoWeb("btn-open-geo-weekly", "contentProduction", "内容生产");
bindOpenGeoWeb("btn-tasks-open-geo-publish", "publishRecords", "发布记录");

const btnOpenGeoBind = document.getElementById("btn-open-geo-bind");
if (btnOpenGeoBind) {
  btnOpenGeoBind.onclick = () => switchToTab("accounts");
}

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
