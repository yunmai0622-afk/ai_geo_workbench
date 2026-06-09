export type ApiDocProcedureType = "query" | "mutation";

export type ApiDocAuth = "public" | "protected" | "admin";

export type ApiDocEntry = {
  path: string;
  type: ApiDocProcedureType;
  auth: ApiDocAuth;
  summary: string;
};

export type ApiDocSection = {
  id: string;
  title: string;
  description: string;
  entries: ApiDocEntry[];
};

/** GEO-V1.1 主要 tRPC 接口清单（路径相对 /api/trpc）。 */
export const API_DOC_SECTIONS: ApiDocSection[] = [
  {
    id: "auth",
    title: "认证",
    description: "用户注册、登录、会话与账号设置。",
    entries: [
      { path: "auth.me", type: "query", auth: "public", summary: "当前登录用户（未登录时为 null）" },
      { path: "auth.register", type: "mutation", auth: "public", summary: "邮箱注册并写入会话 Cookie" },
      { path: "auth.loginWithEmail", type: "mutation", auth: "public", summary: "邮箱密码登录" },
      { path: "auth.devLogin", type: "mutation", auth: "public", summary: "本地开发一键登录（仅非 production）" },
      { path: "auth.logout", type: "mutation", auth: "public", summary: "退出登录并清除会话" },
      { path: "auth.updateProfile", type: "mutation", auth: "protected", summary: "更新用户姓名" },
      { path: "auth.changePassword", type: "mutation", auth: "protected", summary: "修改登录密码" },
      { path: "system.health", type: "query", auth: "public", summary: "系统健康检查（tRPC）" },
    ],
  },
  {
    id: "projects",
    title: "项目管理",
    description: "客户项目 CRUD、工作台概览与平台账号绑定。",
    entries: [
      { path: "geo.projects.list", type: "query", auth: "protected", summary: "列出当前用户未归档项目" },
      { path: "geo.projects.create", type: "mutation", auth: "protected", summary: "创建项目" },
      { path: "geo.projects.update", type: "mutation", auth: "protected", summary: "更新项目基础信息" },
      { path: "geo.projects.archive", type: "mutation", auth: "protected", summary: "归档项目" },
      { path: "geo.projects.unarchive", type: "mutation", auth: "protected", summary: "取消归档" },
      { path: "geo.projects.delete", type: "mutation", auth: "protected", summary: "删除项目及关联数据" },
      { path: "geo.workspace.summary", type: "query", auth: "protected", summary: "企业工作台摘要" },
      { path: "geo.onboarding.getCompletenessReport", type: "query", auth: "protected", summary: "8 步建档完整度标准报告" },
      { path: "geo.maturity.calculateAndSave", type: "mutation", auth: "protected", summary: "计算并保存 AI 品牌成熟度 6 维评分" },
      { path: "geo.maturity.getLatest", type: "query", auth: "protected", summary: "读取项目最新成熟度评分记录" },
      { path: "geo.maturity.getMaturityReport", type: "query", auth: "protected", summary: "AI 品牌成熟度完整报告（含阶段与建议）" },
      { path: "geo.clientDashboard.listProjectsSummary", type: "query", auth: "protected", summary: "客户看板项目聚合摘要" },
      { path: "geo.assetLibrary.summary", type: "query", auth: "protected", summary: "企业资产库完成度与风险提示" },
      { path: "geo.platformAccounts.list", type: "query", auth: "protected", summary: "项目平台账号列表" },
      { path: "geo.platformAccounts.create", type: "mutation", auth: "protected", summary: "创建/绑定平台账号" },
      { path: "geo.platformAccounts.update", type: "mutation", auth: "protected", summary: "更新平台账号" },
      { path: "geo.platformAccounts.delete", type: "mutation", auth: "protected", summary: "删除平台账号" },
    ],
  },
  {
    id: "content",
    title: "内容生成",
    description: "问题库、诊断、选题、文章生成与内容计划。",
    entries: [
      { path: "geo.questions.list", type: "query", auth: "protected", summary: "问题列表" },
      { path: "geo.questions.generateTargetQuestions", type: "mutation", auth: "protected", summary: "基于企业档案生成目标检索问题" },
      { path: "geo.questions.generate", type: "mutation", auth: "protected", summary: "批量生成 AI 对话型问题" },
      { path: "geo.analysis.run", type: "mutation", auth: "protected", summary: "运行 GEO AI 诊断" },
      { path: "geo.tasks.generate", type: "mutation", auth: "protected", summary: "生成优化任务" },
      { path: "geo.articles.topics.generate", type: "mutation", auth: "protected", summary: "生成内容选题" },
      { path: "geo.articles.generate", type: "mutation", auth: "protected", summary: "生成文章正文（Markdown）" },
      { path: "geo.articles.list", type: "query", auth: "protected", summary: "文章列表" },
      { path: "geo.articles.generationHistory", type: "query", auth: "protected", summary: "内容生成历史（geo_articles 同行与 optimizationVersions）" },
      { path: "geo.articles.restoreGenerationHistory", type: "mutation", auth: "protected", summary: "恢复到指定生成历史版本" },
      { path: "geo.contentPlans.latest", type: "query", auth: "protected", summary: "最新内容生产计划" },
      { path: "geo.contentPlans.upsert", type: "mutation", auth: "protected", summary: "创建或更新内容计划" },
      { path: "geo.reports.generate", type: "mutation", auth: "protected", summary: "生成交付报告 Markdown" },
    ],
  },
  {
    id: "publish",
    title: "发布任务",
    description: "本地 Agent 发布队列、任务状态与扩展程序对接。",
    entries: [
      { path: "publishTasks.create", type: "mutation", auth: "protected", summary: "创建本地 Agent 发布任务" },
      {
        path: "publishTasks.reviewAndEnqueueArticle",
        type: "mutation",
        auth: "protected",
        summary: "人工审核通过并原子加入发布队列",
      },
      { path: "publishTasks.listRecentByProject", type: "query", auth: "protected", summary: "项目近期发布任务" },
      { path: "publishTasks.latestByArticle", type: "query", auth: "protected", summary: "文章最新发布任务" },
      { path: "publishTasks.retry", type: "mutation", auth: "protected", summary: "重试失败发布任务" },
      { path: "publishTasks.projectStats", type: "query", auth: "protected", summary: "项目发布统计" },
      { path: "publishTasks.getApiKey", type: "query", auth: "protected", summary: "获取扩展程序 API Key" },
      { path: "publishTasks.pending", type: "query", auth: "public", summary: "Agent 拉取待发布任务（apiKey）" },
      { path: "publishTasks.complete", type: "mutation", auth: "public", summary: "Agent 回报发布结果（apiKey）" },
      { path: "geo.publishRecords.listWithStatus", type: "query", auth: "protected", summary: "发布记录及收录监测状态" },
      { path: "geo.articles.createManualPublishRecord", type: "mutation", auth: "protected", summary: "创建人工发布记录" },
    ],
  },
  {
    id: "ai-check",
    title: "AI 检测",
    description: "品牌提及实测、检测轮次、T0 实测录入与复测对比。",
    entries: [
      { path: "geo.aiMentionCheck.run", type: "mutation", auth: "protected", summary: "对监测记录执行多引擎 AI 品牌提及检测" },
      { path: "geo.aiMentionCheck.results", type: "query", auth: "protected", summary: "监测记录 AI 检测结果" },
      { path: "geo.aiMentionCheck.evidenceDetail", type: "query", auth: "protected", summary: "单条实测证据详情" },
      { path: "geo.aiMentionCheck.runDaily", type: "mutation", auth: "protected", summary: "触发每日定时检测" },
      { path: "geo.inclusionMonitoring.checkPublishLinks", type: "mutation", auth: "protected", summary: "检测发布链接可访问性" },
      { path: "geo.inclusionMonitoring.backfill", type: "mutation", auth: "protected", summary: "为历史发布记录补建监测行" },
      { path: "geo.testRounds.create", type: "mutation", auth: "protected", summary: "创建检测轮次（T0/T1…）" },
      { path: "geo.testRounds.list", type: "query", auth: "protected", summary: "项目检测轮次列表" },
      { path: "geo.aiTestRuns.create", type: "mutation", auth: "protected", summary: "录入单条 AI 实测回答" },
      { path: "geo.aiTestRuns.listByRound", type: "query", auth: "protected", summary: "按轮次列出实测记录" },
      { path: "geo.retestComparisons.calculate", type: "mutation", auth: "protected", summary: "计算两轮复测对比指标" },
    ],
  },
];
