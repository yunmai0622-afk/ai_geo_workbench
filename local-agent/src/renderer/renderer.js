/** @typedef {import('../preload').AgentApiResult} AgentApiResult */

const $ = (id) => document.getElementById(id);

const PLATFORM_LABELS = {
  zhihu: "知乎",
  sohu: "搜狐号",
  baijiahao: "百家号",
  toutiao: "头条号",
};

const PLATFORM_ORDER = ["zhihu", "sohu", "baijiahao", "toutiao"];

let selectedProfileId = null;
let selectedPlatform = null;

function log(msg, isErr = false) {
  const el = $("log");
  const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  el.textContent = line + el.textContent;
  $("status-line").textContent = msg;
  $("status-line").className = isErr ? "status err" : "status ok";
}

function setCurrent(account) {
  selectedProfileId = account?.profileId ?? null;
  selectedPlatform = account?.platform ?? null;
  $("current-platform").textContent = account?.platform ? (PLATFORM_LABELS[account.platform] ?? account.platform) : "—";
  $("current-profile-id").textContent = account?.profileId ?? "—";
  $("current-account-name").textContent = account?.accountName ?? "—";
  $("current-session-status").textContent = account?.sessionStatus ?? "—";
}

async function refreshList() {
  const data = await window.agentApi.listAccounts();
  const root = $("accounts-by-platform");
  root.innerHTML = "";

  for (const platform of PLATFORM_ORDER) {
    const accounts = data.accounts.filter((a) => a.platform === platform);
    const section = document.createElement("section");
    section.className = "platform-group";
    section.innerHTML = `<h3>${PLATFORM_LABELS[platform]}</h3>`;
    if (accounts.length === 0) {
      section.innerHTML += `<p class="empty">暂无账号</p>`;
    } else {
      const table = document.createElement("table");
      table.innerHTML = `<thead><tr><th>profileId</th><th>昵称</th><th>session</th><th>检测时间</th><th>操作</th></tr></thead>`;
      const tbody = document.createElement("tbody");
      for (const acc of accounts) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${acc.profileId}</td>
          <td>${acc.accountName ?? "—"}</td>
          <td>${acc.sessionStatus}</td>
          <td>${acc.lastCheckedAt ?? "—"}</td>
          <td class="actions"></td>
        `;
        const actions = tr.querySelector(".actions");
        const mk = (label, fn) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = label;
          b.onclick = fn;
          actions.appendChild(b);
        };
        mk("选中", () => {
          setCurrent(acc);
          log(`已选中 [${PLATFORM_LABELS[platform]}] ${acc.profileId}`);
        });
        mk("登录", () => void run(() => window.agentApi.openLoginWindow(acc.profileId)));
        mk("发布页", () => void run(() => window.agentApi.openZhihuWritePage(acc.profileId)));
        mk("检测", () => void run(() => window.agentApi.detectZhihuAccount(acc.profileId)));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      section.appendChild(table);
    }
    root.appendChild(section);
  }

  if (selectedProfileId) {
    const cur = data.accounts.find((a) => a.profileId === selectedProfileId);
    if (cur) setCurrent(cur);
  } else if (data.accounts.length > 0) {
    setCurrent(data.accounts[data.accounts.length - 1]);
  }
}

async function run(fn) {
  try {
    const result = await fn();
    const step = result.step ? ` [${result.step}]` : "";
    log(`${result.message ?? JSON.stringify(result)}${step}`, !result.ok);
    await refreshList();
    return result;
  } catch (e) {
    log(e instanceof Error ? e.message : String(e), true);
    throw e;
  }
}

function requireProfile() {
  if (!selectedProfileId) {
    log("请先创建或选中一个账号 profile", true);
    return null;
  }
  return selectedProfileId;
}

function initCreateButtons() {
  const row = $("platform-create-buttons");
  for (const platform of PLATFORM_ORDER) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `创建${PLATFORM_LABELS[platform]}环境`;
    b.onclick = () =>
      void run(async () => {
        const r = await window.agentApi.createPlatformProfile(platform);
        if (r.account) setCurrent(r.account);
        return { ok: true, message: `已创建 ${r.account?.profileId}` };
      });
    row.appendChild(b);
  }
}

$("btn-write").onclick = () => {
  const id = requireProfile();
  if (!id) return;
  void run(() => window.agentApi.openZhihuWritePage(id));
};

$("btn-fill").onclick = () => {
  const id = requireProfile();
  if (!id) return;
  const title = $("draft-title").value.trim();
  const content = $("draft-content").value.trim();
  void run(() => window.agentApi.fillZhihuDraft(id, title, content));
};

async function loadConfigUi() {
  const cfg = await window.agentApi.getConfig();
  $("cfg-server-url").value = cfg.serverUrl ?? "";
  $("cfg-agent-id").value = cfg.localAgentId ?? "";
  $("cfg-api-key").value = cfg.agentApiKey ?? "";
  $("cfg-auto-poll").checked = Boolean(cfg.autoPoll);
  $("cfg-status").textContent = `Agent: ${cfg.localAgentId ?? "—"}`;
}

$("btn-save-config").onclick = () =>
  void run(async () => {
    const next = await window.agentApi.saveConfig({
      serverUrl: $("cfg-server-url").value.trim(),
      localAgentId: $("cfg-agent-id").value.trim(),
      agentApiKey: $("cfg-api-key").value.trim(),
      autoPoll: $("cfg-auto-poll").checked,
    });
    $("cfg-status").textContent = `已保存 · ${next.localAgentId}`;
    return { ok: true, message: "配置已保存" };
  });

$("btn-test-server").onclick = () =>
  void run(async () => {
    const r = await window.agentApi.testServerConnection();
    return r;
  });

$("btn-poll-once").onclick = () =>
  void run(async () => {
    const r = await window.agentApi.pollTasksOnce();
    for (const line of r.logs ?? []) log(line);
    return { ok: true, message: `处理 ${r.processed} 个任务` };
  });

$("cfg-auto-poll").onchange = () => {
  const on = $("cfg-auto-poll").checked;
  void run(async () => {
    await window.agentApi.saveConfig({ autoPoll: on });
    if (on) await window.agentApi.startAutoPoll();
    else await window.agentApi.stopAutoPoll();
    return { ok: true, message: on ? "已开启自动轮询" : "已关闭自动轮询" };
  });
};

initCreateButtons();
loadConfigUi().catch((e) => log(String(e), true));
refreshList().catch((e) => log(String(e), true));
