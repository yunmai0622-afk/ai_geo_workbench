#!/usr/bin/env node
/**
 * GEO-V1-G 多租户隔离静态审计（不执行 migration、不改业务逻辑）
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function has(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

const schema = read("drizzle/schema.ts");
const routers = read("server/routers.ts");
const publishTasks = read("server/publishTasksRouter.ts");
const platformAccounts = read("server/projectPlatformAccountsRouter.ts");
const agentRouter = read("server/agentRouter.ts");
const trpcCore = read("server/_core/trpc.ts");
const getProjectConn = read("server/projectPlatformAccounts.ts");

const ownerFieldPatterns = [
  /\bownerUserId\b/,
  /\bownerId\b/,
  /\borgId\b/,
  /\btenantId\b/,
];
const projectsTableBlock = schema.slice(schema.indexOf('export const projects = mysqlTable("projects"'), schema.indexOf("export const questions"));
const projectsHasOwnerField = ownerFieldPatterns.some(p => p.test(projectsTableBlock));

const projectsListFullTable =
  /projects:\s*router\(\{[\s\S]*?list:\s*protectedProcedure[\s\S]*?\.from\(projects\)[\s\S]*?orderBy\(desc\(projects\.createdAt\)\)/.test(
    routers,
  ) && !/ownerUserId|orgId|tenantId|project_members/.test(routers.slice(routers.indexOf("projects: router"), routers.indexOf("questions: router")));

const clientDashboardBlock = routers.slice(routers.indexOf("clientDashboard"), routers.indexOf("projects: router"));
const clientDashboardFullTable =
  /listProjectsSummary[\s\S]*?\.from\(projects\)/.test(clientDashboardBlock) &&
  !/listAccessibleProjectIds\(ctx\)|inArray\(projects\.id,\s*accessibleIds\)|eq\(projects\.ownerUserId/.test(clientDashboardBlock);

const getProjectOrThrowNoOwner =
  /const getProjectOrThrow = async \(projectId: number\)/.test(routers) &&
  !/requireProjectAccess/.test(routers);

const connIdx = getProjectConn.indexOf("getProjectOrThrowConn");
const getProjectConnBlock = getProjectConn.slice(Math.max(0, connIdx - 200), getProjectConn.indexOf("async function getAccountRowById"));
/** Agent 专用 getProjectOrThrowConn 允许保留（Web 路径已用 requireProjectAccess） */
const getProjectOrThrowConnNoOwner =
  /export async function getProjectOrThrowConn/.test(getProjectConn) &&
  !/Agent|插件内部|不校验 Web/.test(getProjectConnBlock);

const protectedOnlyAuth =
  /export const protectedProcedure = t\.procedure\.use\(requireUser\)/.test(trpcCore) &&
  !/projectAccess|ownerUserId/.test(trpcCore);

const projectCreateNoOwner =
  /projects:\s*router\(\{[\s\S]*?create:\s*protectedProcedure[\s\S]*?db\.insert\(projects\)/.test(routers) &&
  !/ownerUserId|ctx\.user/.test(routers.slice(routers.indexOf("create: protectedProcedure.input(projectInput)"), routers.indexOf("update: protectedProcedure")));

const platformAccountsNoOwnerGuard =
  /list: protectedProcedure[\s\S]*?listProjectPlatformAccountsForProject/.test(platformAccounts) &&
  !/requireProjectAccess/.test(platformAccounts);

const agentPublicNoUser =
  /export const agentRouter = router\(\{[\s\S]*publicProcedure/.test(agentRouter);

const publishTasksProjectScopedNoOwner =
  /listRecentByProject: protectedProcedure/.test(publishTasks) && !/requireProjectAccessConn|requireProjectAccess/.test(publishTasks);

const idorSampleEndpoints = [
  { router: "geo.projects.list", issue: "全表列出，无 owner 过滤" },
  { router: "geo.clientDashboard.listProjectsSummary", issue: "全表聚合，泄露全部企业指标" },
  { router: "geo.projects.update/delete", issue: "仅凭 project id，无归属校验" },
  { router: "geo.questions.list", issue: "仅 projectId 过滤，无 getProjectOrThrow/owner" },
  { router: "geo.articles.topics.list", issue: "仅 projectId 过滤，无 owner" },
  { router: "geo.articles.inclusionMonitoringRecords", issue: "仅 projectId 过滤，无 owner" },
  { router: "geo.articles.rewritePool / postPublishRetestQueue", issue: "仅 projectId，多数无 owner" },
  { router: "geo.platformAccounts.*", issue: "projectPlatformAccountsRouter 无归属校验" },
  { router: "geo.reports.createShareLink", issue: "登录即可为任意 projectId 生成分享 token" },
  { router: "publishTasks.listRecentByProject", issue: "无 owner guard" },
  { router: "agent.* (publicProcedure)", issue: "仅凭 localAgentId，与登录用户/项目归属脱节" },
];

const risks = [];

if (!projectsHasOwnerField) {
  risks.push({
    severity: "P0",
    id: "SCHEMA_NO_PROJECT_OWNER",
    title: "projects 表无 userId/orgId/tenantId 归属字段",
    impact: "无法在数据层表达租户边界，所有子表 projectId 均无法推导合法访问者",
    evidence: "drizzle/schema.ts projects 表仅含企业字段与 status",
  });
}

if (projectsListFullTable) {
  risks.push({
    severity: "P0",
    id: "ROUTER_PROJECTS_LIST_ALL",
    title: "geo.projects.list 全表可见",
    impact: "任意登录用户可见全部企业项目列表",
    evidence: "server/routers.ts projects.list → select().from(projects)",
  });
}

if (clientDashboardFullTable) {
  risks.push({
    severity: "P0",
    id: "ROUTER_CLIENT_DASHBOARD_ALL",
    title: "geo.clientDashboard.listProjectsSummary 全表聚合",
    impact: "客户管理台展示全部项目的文章/发布/诊断/评分指标",
    evidence: "server/routers.ts clientDashboard.listProjectsSummary",
  });
}

if (getProjectOrThrowNoOwner || getProjectOrThrowConnNoOwner) {
  risks.push({
    severity: "P0",
    id: "GET_PROJECT_NO_OWNER_GUARD",
    title: "getProjectOrThrow / getProjectOrThrowConn 仅校验存在性",
    impact: "知道 projectId 即可读写该企业下 profile/文章/报告/监测等（IDOR）",
    evidence: "server/routers.ts getProjectOrThrow；server/projectPlatformAccounts.ts getProjectOrThrowConn",
  });
}

if (projectCreateNoOwner) {
  risks.push({
    severity: "P0",
    id: "PROJECT_CREATE_NO_OWNER_WRITE",
    title: "projects.create 未写入 ownerUserId",
    impact: "新建项目无法绑定创建者，后续无法按用户过滤",
    evidence: "server/routers.ts projects.create insert 无 ctx.user",
  });
}

if (protectedOnlyAuth) {
  risks.push({
    severity: "P1",
    id: "AUTH_SESSION_ONLY",
    title: "protectedProcedure 仅校验登录，不校验项目归属",
    impact: "认证与授权混淆，全站默认「登录即全局」",
    evidence: "server/_core/trpc.ts requireUser middleware",
  });
}

if (platformAccountsNoOwnerGuard) {
  risks.push({
    severity: "P0",
    id: "PLATFORM_ACCOUNTS_IDOR",
    title: "platformAccounts router 无项目归属校验",
    impact: "可读写他人项目的平台账号与 Local Agent 绑定信息",
    evidence: "server/projectPlatformAccountsRouter.ts",
  });
}

if (agentPublicNoUser) {
  risks.push({
    severity: "P1",
    id: "AGENT_PUBLIC_LOCAL_AGENT_ID",
    title: "agent router 为 publicProcedure",
    impact: "发布任务拉取与回传与 Web 登录用户隔离，需 Phase H 明确 agent↔project↔user 链",
    evidence: "server/agentRouter.ts",
  });
}

if (publishTasksProjectScopedNoOwner) {
  risks.push({
    severity: "P0",
    id: "PUBLISH_TASKS_LIST_NO_OWNER",
    title: "publishTasks 按 project 查询无 owner guard",
    impact: "代运营/多客户场景下可查看他人发布任务队列",
    evidence: "server/publishTasksRouter.ts listRecentByProject",
  });
}

risks.push({
  severity: "P1",
  id: "NO_ORG_AGENCY_MODEL",
  title: "无 workspace/org 与代运营成员模型",
  impact: "无法区分直接企业客户与代运营公司；无法分配 operator/viewer",
  evidence: "schema 无 organizations / project_members",
});

risks.push({
  severity: "P2",
  id: "DELIVERY_SHARE_TOKEN_BY_PROJECT",
  title: "交付报告分享链按 project 生成，与登录用户未绑定",
  impact: "知情 projectId 的登录用户可创建/轮换他人项目分享 token（链接泄露为独立风险）",
  evidence: "geo.reports.createShareLink + delivery_report_share_tokens",
});

const checks = [
  {
    id: "projects_schema_missing_owner",
    pass: projectsHasOwnerField,
    detail: projectsHasOwnerField ? "projects 已含归属字段" : "projects 缺少 ownerUserId/orgId/tenantId",
  },
  {
    id: "projects_list_full_table",
    pass: !projectsListFullTable,
    detail: projectsListFullTable ? "projects.list 疑似全表查询" : "projects.list 已按归属过滤或不存在全表 list",
  },
  {
    id: "client_dashboard_full_table",
    pass: !clientDashboardFullTable,
    detail: clientDashboardFullTable ? "clientDashboard 疑似全表" : "clientDashboard 已按当前用户过滤",
  },
  {
    id: "get_by_project_id_no_owner_guard",
    pass: !(getProjectOrThrowNoOwner || getProjectOrThrowConnNoOwner),
    detail:
      getProjectOrThrowNoOwner || getProjectOrThrowConnNoOwner
        ? "getProjectOrThrow* 无 owner 校验"
        : "getProjectOrThrow* 含归属校验",
  },
];

const riskJson = {
  phase: "GEO-V1-G-Tenant-Isolation-Audit-Plan",
  auditedAt: new Date().toISOString(),
  schema: {
    projectsHasOwnerField,
    usersHasRole: /\brole:\s*mysqlEnum/.test(schema),
    childTablesWithProjectIdOnly: true,
    notes: "子表均仅有 projectId，无 userId；隔离完全依赖 projects 归属（当前缺失）",
  },
  routers: {
    projectsListFullTable,
    clientDashboardFullTable,
    getProjectOrThrowNoOwner,
    getProjectOrThrowConnNoOwner,
    projectCreateNoOwner,
    protectedOnlyAuth,
    platformAccountsNoOwnerGuard,
    agentPublicNoUser,
    publishTasksProjectScopedNoOwner,
  },
  idorSampleEndpoints,
  checks,
  risks,
  p0RiskCount: risks.filter(r => r.severity === "P0").length,
  recommendation: {
    p0: "projects.ownerUserId + requireProjectAccess + 全 list 过滤",
    phaseH: "Tenant Isolation P0 Migration + Router Guard",
  },
};

const artifactsDir = path.join(ROOT, "artifacts");
fs.mkdirSync(artifactsDir, { recursive: true });
fs.writeFileSync(path.join(artifactsDir, "tenant-isolation-risk.json"), `${JSON.stringify(riskJson, null, 2)}\n`);

let failed = 0;
for (const c of checks) {
  if (c.pass) console.log(`[OK] ${c.id}`);
  else {
    console.log(`[FAIL] ${c.id}: ${c.detail}`);
    failed++;
  }
}
console.log(`\nP0 risks: ${riskJson.p0RiskCount}`);
console.log(`Wrote artifacts/tenant-isolation-risk.json`);
process.exit(failed > 0 ? 1 : 0);
