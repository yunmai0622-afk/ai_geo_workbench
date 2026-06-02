/**
 * GEO 本地发布助手 — 客户可读文案与状态逻辑（LocalAgentUx）
 * 禁止出现「自动发布」类表述；任务需在平台页面人工确认。
 */
(function initLocalAgentUx(global) {
  const HERO = {
    ready: {
      key: "ready",
      title: "准备就绪",
      desc: "本机服务与 GEO Web 已连通，账号可用。可在 GEO Web 将内容加入发布队列，由本客户端拉取并填充。",
      cssClass: "status-ready",
      hdrStatus: "ready",
    },
    action_needed: {
      key: "action_needed",
      title: "需要处理",
      desc: "请按下方准备流程完成账号登录或处理待办任务，然后再在 GEO Web 继续操作。",
      cssClass: "status-warning",
      hdrStatus: "warning",
    },
    disconnected: {
      key: "disconnected",
      title: "未连接",
      desc: "无法连接 GEO Web，请检查网络与服务地址（诊断与设置 → 高级配置）。",
      cssClass: "status-warning",
      hdrStatus: "warning",
    },
    error: {
      key: "error",
      title: "有错误",
      desc: "本地服务未正常启动，请完全退出后重新打开客户端。",
      cssClass: "status-error",
      hdrStatus: "error",
    },
  };

  const PREP_STEP_DEFS = [
    { id: "local", title: "启动客户端", descDone: "本地服务正常运行", descActive: "正在启动本地服务…", descPending: "等待本地服务就绪" },
    { id: "server", title: "连接 GEO Web", descDone: "与 GEO Web 通信正常", descActive: "请检查网络或服务地址", descPending: "需先完成上一步" },
    { id: "accounts", title: "配置账号环境", descDone: "已创建平台登录环境", descActive: "请添加至少一个平台账号环境", descPending: "需先连接 GEO Web" },
    { id: "login", title: "登录有效", descDone: "至少一个账号可发布", descActive: "请打开账号环境完成登录", descPending: "需先添加账号环境" },
    { id: "poll", title: "接收发布任务", descDone: "正在拉取 GEO Web 任务", descActive: "可在设置中开启启动后自动拉取", descPending: "登录有效后可拉取任务" },
  ];

  const SESSION_BADGE = {
    active: { text: "可发布", pillClass: "ok" },
    expired: { text: "需重新登录", pillClass: "danger" },
    unknown_detect_fail: { text: "需检测", pillClass: "fail" },
    unknown: { text: "未检测", pillClass: "muted" },
  };

  const PLATFORM_SIDEBAR = {
    pending: "暂未接入",
    unbound: "未配置",
    relogin: "需重新登录",
    ready: "已登录可发布",
  };

  const ACCOUNT_META = {
    webSync: "Web 同步",
    publishCap: "发布能力",
    webSyncSynced: "已同步到 GEO Web",
    webSyncPending: "登录有效后同步",
    webSyncOffline: "未连接 GEO Web",
    webSyncUnknown: "待检测后同步",
    publishReady: "可填充并进入发布页",
    publishBlocked: "需先完成登录",
    publishPending: "平台即将支持",
    refreshSyncBtn: "刷新并同步账号状态",
  };

  const TASKS_EMPTY = {
    title: "暂无发布任务",
    body: "任务由 GEO Web 下发到本机执行。客户端会填充标题与正文，最终是否在平台发布需你在浏览器中确认。",
    hint: "在 GEO Web 将内容加入发布队列后，点击「立即拉取任务」或等待自动拉取。",
    ctaPoll: "立即拉取任务",
    ctaGeo: "去 GEO Web 查看发布队列",
  };

  const SETTINGS = {
    autoPollLabel: "启动后自动拉取 GEO Web 下发的发布任务",
    autoPollHint:
      "开启后客户端会按间隔向 GEO Web 拉取待处理任务并填充内容，不会在未经确认的情况下替你在平台点击发布。",
    autoPollHintOff: "关闭后需手动点击「手动拉取任务」获取新任务。",
  };

  const HERO_ACTIONS = {
    ready: [{ id: "poll", label: "立即拉取任务", primary: true }],
    action_needed: [
      { id: "accounts", label: "去配置账号", primary: true },
      { id: "poll", label: "拉取任务", primary: false },
    ],
    disconnected: [{ id: "diag", label: "诊断连接", primary: true }],
    error: [{ id: "restart_hint", label: "查看诊断说明", primary: true }],
  };

  function localOk(d) {
    return Boolean(d?.localHttp?.ok && !d?.localHttp?.startupError);
  }

  function pendingTaskCount(d) {
    if (typeof d?.pendingTaskCount === "number") return d.pendingTaskCount;
    const tasks = d?.serverTasks ?? [];
    return tasks.filter((t) => t.status === "pending_agent").length;
  }

  function isDetectFailure(acc) {
    if (acc.sessionStatus === "active") return false;
    const msg = (acc.lastDetectMessage ?? "").trim();
    if (!msg) return acc.sessionStatus === "unknown";
    if (/^检测成功/.test(msg)) return false;
    return true;
  }

  function computeHeroStatus(d) {
    if (!localOk(d)) return { ...HERO.error };
    if (!d.serverConnected) {
      return {
        ...HERO.disconnected,
        desc: d.serverError
          ? `无法连接 GEO Web：${d.serverError}`
          : HERO.disconnected.desc,
      };
    }
    const pending = pendingTaskCount(d);
    const hasAccounts = (d.accountTotal ?? 0) > 0;
    const hasActive = (d.accountActive ?? 0) > 0;
    const polling = Boolean(d.polling?.isPolling);

    if (!hasAccounts) {
      return {
        ...HERO.action_needed,
        desc: "请先在「账号环境」创建平台登录环境，完成登录后再接收任务。",
      };
    }
    if (!hasActive) {
      return {
        ...HERO.action_needed,
        desc: "账号环境已创建，但登录已失效或未检测。请重新打开账号环境登录，并点击「刷新并同步账号状态」。",
      };
    }
    if (pending > 0) {
      return {
        ...HERO.action_needed,
        desc: `有 ${pending} 条待处理任务，请前往「发布任务」查看或立即拉取。`,
      };
    }
    if (d.recentFailure) {
      return {
        ...HERO.action_needed,
        desc: "最近有任务未成功完成，请在「发布任务」或诊断页查看详情。",
      };
    }
    if (!polling && d.config?.autoStartPolling === false) {
      return {
        ...HERO.ready,
        desc: "账号已就绪。当前未开启自动拉取，可在「诊断与设置」开启或手动拉取任务。",
      };
    }
    return {
      ...HERO.ready,
      desc: polling
        ? "正在按设定间隔拉取 GEO Web 任务并填充内容，请在平台页确认发布。"
        : HERO.ready.desc,
    };
  }

  function heroStatusCssClass(hero) {
    return hero?.cssClass ?? "status-idle";
  }

  function computePrepSteps(d) {
    const okLocal = localOk(d);
    const okServer = Boolean(d?.serverConnected);
    const hasAccounts = (d.accountTotal ?? 0) > 0;
    const hasActive = (d.accountActive ?? 0) > 0;
    const polling = Boolean(d.polling?.isPolling);

    const states = {
      local: okLocal ? "done" : "active",
      server: !okLocal ? "pending" : okServer ? "done" : "active",
      accounts: !okServer ? "pending" : hasAccounts ? "done" : "active",
      login: !hasAccounts ? "pending" : hasActive ? "done" : "active",
      poll: !hasActive ? "pending" : polling ? "done" : "active",
    };

    return PREP_STEP_DEFS.map((def) => {
      const state = states[def.id];
      const desc =
        state === "done" ? def.descDone : state === "active" ? def.descActive : def.descPending;
      return { title: def.title, desc, state };
    });
  }

  function sessionBadgeMeta(acc) {
    if (acc.sessionStatus === "active") return SESSION_BADGE.active;
    if (acc.sessionStatus === "expired") return SESSION_BADGE.expired;
    if (isDetectFailure(acc)) return SESSION_BADGE.unknown_detect_fail;
    return SESSION_BADGE.unknown;
  }

  function platformSidebarStatus(platform, list, isPendingPlatform) {
    if (isPendingPlatform) return PLATFORM_SIDEBAR.pending;
    const count = list.length;
    const hasActive = list.some((a) => a.sessionStatus === "active");
    if (count === 0) return PLATFORM_SIDEBAR.unbound;
    if (hasActive) return PLATFORM_SIDEBAR.ready;
    return PLATFORM_SIDEBAR.relogin;
  }

  function accountWebSyncLabel(acc, serverConnected) {
    if (!serverConnected) return ACCOUNT_META.webSyncOffline;
    if (acc.sessionStatus === "active") return ACCOUNT_META.webSyncSynced;
    if (acc.sessionStatus === "expired") return ACCOUNT_META.webSyncPending;
    return ACCOUNT_META.webSyncUnknown;
  }

  function accountPublishCapabilityLabel(acc, isPendingPlatform) {
    if (isPendingPlatform) return ACCOUNT_META.publishPending;
    if (acc.sessionStatus === "active") return ACCOUNT_META.publishReady;
    return ACCOUNT_META.publishBlocked;
  }

  function buildDiagSummaryRows(d) {
    const lh = d?.localHttp ?? {};
    const localOkFlag = localOk(d);
    return [
      {
        label: "本地服务",
        value: localOkFlag
          ? `正常 · v${lh.version ?? d.appVersion ?? "—"}`
          : lh.startupError ?? lh.error ?? "异常",
        ok: localOkFlag,
      },
      {
        label: "GEO Web",
        value: d.serverConnected
          ? `已连接 · 最近拉取 ${formatDiagTime(d.polling?.lastPollAt)}`
          : d.serverError ?? "未连接",
        ok: Boolean(d.serverConnected),
      },
      {
        label: "账号环境",
        value: `${d.accountActive ?? 0} / ${d.accountTotal ?? 0} 可发布`,
        ok: (d.accountActive ?? 0) > 0,
      },
      {
        label: "待处理任务",
        value: String(pendingTaskCount(d)),
        ok: pendingTaskCount(d) === 0,
      },
      {
        label: "任务拉取",
        value: d.polling?.isPolling
          ? `运行中 · 间隔 ${d.config?.pollIntervalSeconds ?? "—"} 秒`
          : "未运行（可开启自动拉取或手动拉取）",
        ok: Boolean(d.polling?.isPolling),
      },
    ];
  }

  function buildDiagSummaryText(d) {
    return buildDiagSummaryRows(d)
      .map((r) => `${r.label}：${r.value}`)
      .join("\n");
  }

  function formatDiagTime(v) {
    if (!v) return "—";
    const date = new Date(v);
    if (Number.isNaN(date.getTime())) return String(v);
    return date.toLocaleString("zh-CN");
  }

  function headerMetricChips(d, hero) {
    return [
      { label: "状态", value: hero.title },
      { label: "可发布账号", value: String(d.accountActive ?? 0) },
      { label: "待处理", value: String(pendingTaskCount(d)) },
      { label: "GEO Web", value: d.serverConnected ? "已连接" : "未连接" },
    ];
  }

  function heroActionsFor(hero) {
    return HERO_ACTIONS[hero.key] ?? HERO_ACTIONS.action_needed;
  }

  function settingsAutoPollHint(enabled) {
    return enabled ? SETTINGS.autoPollHint : SETTINGS.autoPollHintOff;
  }

  global.LocalAgentUx = {
    HERO,
    PREP_STEP_DEFS,
    SESSION_BADGE,
    PLATFORM_SIDEBAR,
    ACCOUNT_META,
    TASKS_EMPTY,
    SETTINGS,
    HERO_ACTIONS,
    localOk,
    pendingTaskCount,
    computeHeroStatus,
    heroStatusCssClass,
    computePrepSteps,
    sessionBadgeMeta,
    platformSidebarStatus,
    accountWebSyncLabel,
    accountPublishCapabilityLabel,
    buildDiagSummaryRows,
    buildDiagSummaryText,
    headerMetricChips,
    heroActionsFor,
    settingsAutoPollHint,
    isDetectFailure,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
