const ZHIHU_WRITE_DISPLAY_URL = "https://zhuanlan.zhihu.com/write";

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

/** 客户可读时间：2026/5/25 15:46 */
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
  const row = `[${new Date().toLocaleTimeString()}] ${line}\n`;
  el.textContent = row + el.textContent.slice(0, 8000);
  if (isErr) el.classList.add("err");
}

/** 打开发布页结果展示（含目标 URL、404 层、manual_required） */
function formatOpenWriteResult(r, sourceLabel) {
  const url = r.data?.url ?? "";
  const layer = r.data?.layer ?? "zhihu";
  const head = sourceLabel ? `[${sourceLabel} · ${layer}] ` : `[${layer}] `;
  const tried =
    r.data?.triedUrls?.length > 0 ? `\n已尝试：${r.data.triedUrls.join(" → ")}` : "";
  const logHint = r.data?.logPath ? `\n日志：${r.data.logPath}` : "";
  if (r.ok) {
    const msg = r.message || "已打开知乎发布页";
    return `${head}${msg}\n目标：${ZHIHU_WRITE_DISPLAY_URL}\n实际：${url}${tried}${logHint}`;
  }
  const et = r.errorType ?? r.step ?? "unknown";
  if (et === "manual_required") {
    return `${head}${r.message || "未能自动进入专栏写作页，已打开知乎首页，请手动进入发布页"}\n目标：${ZHIHU_WRITE_DISPLAY_URL}\n实际：${url}${tried}${logHint}`;
  }
  if (et === "write_page_404") {
    return `${head}知乎发布页打开失败（页面 404）\n目标：${ZHIHU_WRITE_DISPLAY_URL}\n实际：${url}${tried}${logHint}`;
  }
  if (et === "login_required" || et === "session_expired") {
    return `${head}知乎发布页打开失败，请先打开登录窗口完成登录\n目标：${ZHIHU_WRITE_DISPLAY_URL}\n实际：${url}${logHint}`;
  }
  if (
    et === "write_page_not_found" ||
    et === "editor_not_found" ||
    et === "page_load_timeout"
  ) {
    return `${head}知乎发布页打开失败，请确认账号已登录或手动进入发布页\n目标：${ZHIHU_WRITE_DISPLAY_URL}\n实际：${url}${tried}${logHint}`;
  }
  return `${head}知乎发布页打开失败，请确认账号已登录或手动进入发布页\n[${et}] ${r.message}\n实际：${url}${logHint}`;
}

function openWriteIsError(r) {
  return !r.ok && r.errorType !== "manual_required";
}

async function refresh() {
  try {
    dashboard = await window.agentApi.getDashboard();
    renderOverview();
    renderAccounts();
    renderTasks();
    renderLogSelect();
    if (selectedLogTaskId) renderLogDetail(selectedLogTaskId);
    const cfg = dashboard.config;
    $("#hdr-version").textContent = `v${dashboard.appVersion}`;
    $("#hdr-poll").textContent = dashboard.polling.isPolling ? "轮询运行中" : "轮询已停止";
    $("#hdr-poll").className = dashboard.polling.isPolling ? "badge ok" : "badge muted";
    $("#set-server-url").value = cfg.serverUrl;
    $("#set-agent-id").value = cfg.localAgentId;
    $("#set-poll-sec").value = String(cfg.pollIntervalSeconds);
    $("#set-max-tasks").value = String(cfg.maxTasksPerCycle);
    $("#set-log-days").value = String(cfg.logRetentionDays);
    $("#set-auto-poll").checked = cfg.autoStartPolling;
    $("#set-data-dir").value = dashboard.dataDir;
  } catch (e) {
    appendLiveLog(e instanceof Error ? e.message : String(e), true);
  }
}

function renderOverview() {
  const d = dashboard;
  const connOk = d.serverConnected;
  const lh = d.localHttp ?? { ok: false, url: "http://127.0.0.1:39888", error: "未知", agentId: null, startedAt: null, startupError: null };
  const localOk = lh.ok && !lh.startupError;
  $("#overview-metrics").innerHTML = `
    <div class="metric"><span>客户端状态</span><strong>${localOk ? "运行中" : "异常"}</strong></div>
    <div class="metric"><span>localAgentId</span><strong class="small">${lh.agentId ?? d.config.localAgentId}</strong></div>
    <div class="metric"><span>GEO 服务端</span><strong>${connOk ? "已连接" : "未连接"}</strong></div>
    <div class="metric"><span>服务地址</span><strong class="small">${d.config.serverUrl}</strong></div>
    <div class="metric"><span>账号总数</span><strong>${d.accountTotal}</strong></div>
    <div class="metric"><span>登录有效</span><strong>${d.accountActive}</strong></div>
    <div class="metric"><span>待处理</span><strong>${d.pendingTaskCount}</strong></div>
    <div class="metric"><span>今日任务</span><strong>${d.todayTaskCount}</strong></div>
  `;
  const localMsg = localOk
    ? `本地 HTTP 已启动 · ${lh.url} · 启动 ${fmtTime(lh.startedAt)} · v${lh.version ?? d.appVersion}`
    : `本地 HTTP 未就绪：${lh.startupError ?? lh.error ?? "请重新启动客户端"}`;
  $("#overview-local-http").textContent = localMsg;
  $("#overview-local-http").className = localOk ? "conn-line ok" : "conn-line err";
  $("#overview-conn").textContent = connOk
    ? `GEO 服务端连接正常 · 最近轮询 ${fmtTime(d.polling.lastPollAt)}`
    : `GEO 服务端连接异常：${d.serverError ?? "未知"}`;
  $("#overview-conn").className = connOk ? "conn-line ok" : "conn-line err";
  if (d.recentFailure) {
    $("#overview-failure").textContent = `#${d.recentFailure.taskId} ${PLATFORM_LABELS[d.recentFailure.platform] ?? d.recentFailure.platform} · ${STATUS_LABELS[d.recentFailure.status] ?? d.recentFailure.status} · ${d.recentFailure.message ?? ""}`;
  } else {
    $("#overview-failure").textContent = "暂无失败记录";
  }
}

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
      block.innerHTML += `<p class="account-empty">暂无账号环境，请点击上方「+ ${PLATFORM_LABELS[platform]}」创建本地登录环境。</p>`;
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
            <div class="acc-meta-row"><dt>本地环境</dt><dd>已绑定</dd></div>
          </dl>
          <p class="acc-security-hint">该账号登录态保存在本机发布客户端中，不保存密码，不上传 Cookie。</p>
          <details class="acc-tech-details">
            <summary>查看技术信息</summary>
            <dl class="acc-tech-grid">
              <div class="acc-meta-row"><dt>profileId</dt><dd><code>${escapeHtml(acc.profileId)}</code></dd></div>
              ${
                profilePath
                  ? `<div class="acc-meta-row"><dt>profilePath</dt><dd><code class="tech-path">${profilePath}</code><span class="tech-note">仅本机路径，不上传服务端</span></dd></div>`
                  : ""
              }
              ${
                localAgentId
                  ? `<div class="acc-meta-row"><dt>localAgentId</dt><dd><code>${escapeHtml(localAgentId)}</code></dd></div>`
                  : ""
              }
              ${
                lastErr
                  ? `<div class="acc-meta-row"><dt>lastError</dt><dd class="tech-error">${escapeHtml(lastErr)}</dd></div>`
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
          const detail = r.ok
            ? r.message
            : `[${r.step ?? "account_not_detected"}] ${r.message}`;
          appendLiveLog(detail, !r.ok);
          await refresh();
        });
        mk("发布页", async () => {
          appendLiveLog(`正在打开发布页（${accountCardTitle(acc)}）…`, false);
          const r = await window.agentApi.openWritePage(acc.profileId, "accounts_publish_page_button");
          appendLiveLog(formatOpenWriteResult(r, "账号环境·发布页"), openWriteIsError(r));
          await refresh();
        });
        mk("重新登录", async () => {
          const r = await window.agentApi.markRelogin(acc.profileId);
          appendLiveLog(r.message, false);
          await refresh();
        });
        mk("删除环境", async () => {
          if (!confirm(`确定删除本地环境 ${acc.profileId}？\n不会自动删除 Web 企业档案绑定，删除后需重新登录该平台。`)) return;
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

function renderTasks() {
  const tbody = $("#tasks-table tbody");
  tbody.innerHTML = "";
  if (!dashboard.serverTasks.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted center">暂无发布任务</td>`;
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
      <td>${fmtTime(t.createdAt)}</td>
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
      document.querySelector('.tab[data-tab="logs"]').click();
      renderLogDetail(t.id);
    });
    mk("重试", async () => {
      if (t.status !== "pending_agent") {
        appendLiveLog("仅 pending_agent 状态会被自动拉取；失败任务请在 Web 重新创建或人工处理", true);
      }
      const r = await window.agentApi.pollOnce();
      appendLiveLog(r.message, false);
      await refresh();
    });
    if (t.localProfileId) {
      mk("打开平台", async () => {
        appendLiveLog(`正在打开发布页（任务 #${t.id}）…`, false);
        const r = await window.agentApi.openWritePage(t.localProfileId, "tasks_open_platform_button");
        appendLiveLog(formatOpenWriteResult(r, `任务 #${t.id}·打开平台`), openWriteIsError(r));
      });
    }
    tbody.appendChild(tr);
  }
}

function renderLogSelect() {
  const sel = $("#log-task-select");
  const prev = selectedLogTaskId;
  sel.innerHTML = '<option value="">选择任务</option>';
  if (!dashboard.localTaskLogs.length) {
    $("#log-detail").textContent = "暂无执行日志";
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
  $("#log-task-select").value = String(taskId);
  const log = await window.agentApi.getTaskLog(taskId);
  if (!log) {
    $("#log-detail").textContent = "本地无该任务日志";
    return;
  }
  const lines = log.logs
    .map((l) => `${l.createdAt}  ${l.step}  [${l.status}]  ${l.message ?? ""}  ${l.selector ?? ""}`)
    .join("\n");
  $("#log-detail").textContent = `任务 #${log.taskId} ${log.platform} ${log.finalStatus ?? ""}\n${log.errorMessage ?? ""}\n\n${lines}`;
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
      panel.hidden = false;
      panel.classList.add("active");
    };
  });
}

$("#btn-test-conn").onclick = () =>
  void window.agentApi.testServerConnection().then((r) => {
    appendLiveLog(r.message, !r.ok);
    refresh();
  });

$("#btn-start-poll").onclick = () => void window.agentApi.startPolling().then(() => refresh());
$("#btn-stop-poll").onclick = () => void window.agentApi.stopPolling().then(() => refresh());
$("#btn-poll-once").onclick = () =>
  void window.agentApi.pollOnce().then((r) => {
    appendLiveLog(r.message, false);
    refresh();
  });

document.querySelectorAll("[data-create]").forEach((btn) => {
  btn.onclick = () =>
    void window.agentApi.createPlatformProfile(btn.getAttribute("data-create")).then((r) => {
      appendLiveLog(r.message ?? "已创建", !r.ok);
      refresh();
    });
});

$("#log-task-select").onchange = () => {
  const v = $("#log-task-select").value;
  if (v) renderLogDetail(Number(v));
};

$("#btn-copy-logs").onclick = () => {
  const text = $("#log-detail").textContent;
  navigator.clipboard.writeText(text).then(() => appendLiveLog("已复制日志到剪贴板", false));
};

$("#btn-save-settings").onclick = () =>
  void window.agentApi
    .saveConfig({
      serverUrl: $("#set-server-url").value.trim(),
      agentApiKey: $("#set-api-key").value,
      pollIntervalSeconds: Number($("#set-poll-sec").value),
      maxTasksPerCycle: Number($("#set-max-tasks").value),
      logRetentionDays: Number($("#set-log-days").value),
      autoStartPolling: $("#set-auto-poll").checked,
    })
    .then(() => {
      $("#settings-msg").textContent = "设置已保存";
      refresh();
    });

$("#btn-open-data").onclick = () => void window.agentApi.openDataDir();
$("#btn-export-diag").onclick = () =>
  void window.agentApi.exportDiagnostics().then((r) => {
    $("#settings-msg").textContent = r.message;
  });

function bindOpenGeoWeb(buttonId, target, label) {
  const el = document.getElementById(buttonId);
  if (!el) return;
  el.onclick = () =>
    void window.agentApi.openGeoWeb(target).then((r) => {
      appendLiveLog(r.ok ? `已在浏览器打开：${r.url ?? label}` : r.message ?? "打开 GEO Web 失败", !r.ok);
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
