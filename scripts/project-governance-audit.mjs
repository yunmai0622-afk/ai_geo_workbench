import mysql from "mysql2/promise";

const warnings = [];

function env(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function requireEnv(name) {
  const value = env(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInt(name, fallback) {
  const value = Number(env(name) || fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function quoteIdent(name) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Unsafe identifier: ${name}`);
  }
  return `\`${name}\``;
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    customerRole: row.customerRole ?? null,
    companyId: row.companyId ?? null,
    loginMethod: row.loginMethod,
    userStatus: row.userStatus,
    hasPasswordHash: Boolean(row.hasPasswordHash),
  };
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function warning(table, operation, error) {
  const message = error instanceof Error ? error.message : String(error);
  warnings.push({
    table,
    operation,
    message: message.replace(/https?:\/\/\S+/g, "[url]").slice(0, 240),
  });
}

async function tableExists(conn, table) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS count
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function scalarCount(conn, table, whereSql = "", params = []) {
  try {
    if (!(await tableExists(conn, table))) return null;
    const sql = `SELECT COUNT(*) AS count FROM ${quoteIdent(table)}${whereSql ? ` WHERE ${whereSql}` : ""}`;
    const [rows] = await conn.execute(sql, params);
    return Number(rows[0]?.count ?? 0);
  } catch (error) {
    warning(table, "count", error);
    return null;
  }
}

async function maxColumn(conn, table, column, whereSql, params) {
  try {
    if (!(await tableExists(conn, table))) return null;
    if (!(await columnExists(conn, table, column))) return null;
    const [rows] = await conn.execute(
      `SELECT MAX(${quoteIdent(column)}) AS value FROM ${quoteIdent(table)} WHERE ${whereSql}`,
      params,
    );
    return rows[0]?.value ? new Date(rows[0].value).toISOString() : null;
  } catch (error) {
    warning(table, `max:${column}`, error);
    return null;
  }
}

async function groupCounts(conn, table, column, whereSql, params) {
  try {
    if (!(await tableExists(conn, table))) return [];
    if (!(await columnExists(conn, table, column))) return [];
    const [rows] = await conn.execute(
      `SELECT ${quoteIdent(column)} AS value, COUNT(*) AS count
       FROM ${quoteIdent(table)}
       WHERE ${whereSql}
       GROUP BY ${quoteIdent(column)}
       ORDER BY count DESC, value ASC
       LIMIT 20`,
      params,
    );
    return rows.map(row => ({ value: row.value, count: Number(row.count ?? 0) }));
  } catch (error) {
    warning(table, `group:${column}`, error);
    return [];
  }
}

async function safeQuery(conn, table, sql, params = []) {
  try {
    if (!(await tableExists(conn, table))) return [];
    const [rows] = await conn.execute(sql, params);
    return rows;
  } catch (error) {
    warning(table, "query", error);
    return [];
  }
}

const projectScopedTables = [
  ["enterpriseProfiles", "enterprise_geo_profiles"],
  ["questions", "questions"],
  ["aiResponses", "ai_responses"],
  ["analysisResults", "analysis_results"],
  ["testRounds", "test_rounds"],
  ["aiTestRuns", "ai_test_runs"],
  ["monthlyOptimizationPlans", "monthly_optimization_plans"],
  ["monthlyOptimizationTasks", "monthly_optimization_tasks"],
  ["optimizationTasks", "optimization_tasks"],
  ["geoArticleTopics", "geo_article_topics"],
  ["geoArticles", "geo_articles"],
  ["publishTasks", "publish_tasks"],
  ["geoPublishRecords", "geo_publish_records"],
  ["geoInclusionMonitoringRecords", "geo_inclusion_monitoring_records"],
  ["reports", "reports"],
  ["deliveryReportShareTokens", "delivery_report_share_tokens"],
  ["brandSourceRecords", "brand_source_records"],
  ["trustEvidenceItems", "trust_evidence_items"],
  ["customerCases", "customer_cases"],
  ["competitorProfiles", "competitor_profiles"],
  ["geoAssetSources", "geo_asset_sources"],
  ["publishStrategies", "publish_strategies"],
  ["projectPlatformAccounts", "project_platform_accounts"],
  ["platformAuthorizationConfigs", "platform_authorization_configs"],
];

async function loadProject(conn, projectId) {
  const rows = await safeQuery(
    conn,
    "projects",
    `SELECT
       p.id,
       p.enterpriseName,
       p.industry,
       p.website,
       p.region,
       p.status,
       p.archivedAt,
       p.ownerUserId,
       p.createdAt,
       p.updatedAt,
       u.id AS userId,
       u.email,
       u.name,
       u.role,
       u.customerRole,
       u.companyId,
       u.loginMethod,
       u.userStatus,
       (u.passwordHash IS NOT NULL AND u.passwordHash <> '') AS hasPasswordHash
     FROM projects p
     LEFT JOIN users u ON u.id = p.ownerUserId
     WHERE p.id = ?
     LIMIT 1`,
    [projectId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    enterpriseName: row.enterpriseName,
    industry: row.industry,
    website: row.website,
    region: row.region,
    status: row.status,
    archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    ownerUser: publicUser({
      id: row.userId,
      email: row.email,
      name: row.name,
      role: row.role,
      customerRole: row.customerRole,
      companyId: row.companyId,
      loginMethod: row.loginMethod,
      userStatus: row.userStatus,
      hasPasswordHash: row.hasPasswordHash,
    }),
  };
}

async function loadProjectCounts(conn, projectId) {
  const counts = {};
  const latest = {};
  for (const [key, table] of projectScopedTables) {
    counts[key] = await scalarCount(conn, table, "projectId = ?", [projectId]);
    latest[key] =
      (await maxColumn(conn, table, "updatedAt", "projectId = ?", [projectId])) ??
      (await maxColumn(conn, table, "createdAt", "projectId = ?", [projectId]));
  }

  return {
    counts,
    latest,
    statusBreakdowns: {
      questionsBySource: await groupCounts(conn, "questions", "source", "projectId = ?", [projectId]),
      questionsBySearchPoolType: await groupCounts(conn, "questions", "searchPoolType", "projectId = ?", [projectId]),
      monthlyTasksByStatus: await groupCounts(conn, "monthly_optimization_tasks", "status", "projectId = ?", [projectId]),
      monthlyTasksByType: await groupCounts(conn, "monthly_optimization_tasks", "taskType", "projectId = ?", [projectId]),
      geoArticlesByStatus: await groupCounts(conn, "geo_articles", "status", "projectId = ?", [projectId]),
      geoArticlesByLifecycleStatus: await groupCounts(conn, "geo_articles", "lifecycleStatus", "projectId = ?", [projectId]),
      publishTasksByStatus: await groupCounts(conn, "publish_tasks", "status", "projectId = ?", [projectId]),
      publishRecordsByStatus: await groupCounts(conn, "geo_publish_records", "publishStatus", "projectId = ?", [projectId]),
      inclusionByStatus: await groupCounts(conn, "geo_inclusion_monitoring_records", "inclusionMonitorStatus", "projectId = ?", [projectId]),
    },
  };
}

async function loadSamples(conn, projectId) {
  const questions = await safeQuery(
    conn,
    "questions",
    `SELECT id, LEFT(questionText, 160) AS questionText, questionType, source, enabled, searchPoolType, createdAt
     FROM questions
     WHERE projectId = ?
     ORDER BY id
     LIMIT 8`,
    [projectId],
  );
  const monthlyTasks = await safeQuery(
    conn,
    "monthly_optimization_tasks",
    `SELECT id, LEFT(title, 160) AS title, taskType, status, relatedQuestionId, actionUrl, createdAt
     FROM monthly_optimization_tasks
     WHERE projectId = ?
     ORDER BY id
     LIMIT 8`,
    [projectId],
  );
  const articles = await safeQuery(
    conn,
    "geo_articles",
    `SELECT id, LEFT(title, 160) AS title, status, lifecycleStatus, contentReviewStatus, targetQuestionId, createdAt
     FROM geo_articles
     WHERE projectId = ?
     ORDER BY id
     LIMIT 8`,
    [projectId],
  );
  const publishTasks = await safeQuery(
    conn,
    "publish_tasks",
    `SELECT id, platform, status, LEFT(articleTitle, 160) AS articleTitle, createdAt, updatedAt
     FROM publish_tasks
     WHERE projectId = ?
     ORDER BY id
     LIMIT 8`,
    [projectId],
  );
  return { questions, monthlyTasks, articles, publishTasks };
}

async function loadCompanyBindings(conn, projectIds) {
  if (!(await tableExists(conn, "company_projects"))) return [];
  const placeholders = projectIds.map(() => "?").join(",");
  const rows = await safeQuery(
    conn,
    "company_projects",
    `SELECT
       cp.projectId,
       cp.companyId,
       cp.projectName,
       cp.status AS bindingStatus,
       cc.companyName,
       cc.status AS companyStatus,
       cc.ownerUserId AS companyOwnerUserId,
       u.email AS companyOwnerEmail,
       u.name AS companyOwnerName,
       u.role AS companyOwnerRole,
       u.userStatus AS companyOwnerStatus,
       (u.passwordHash IS NOT NULL AND u.passwordHash <> '') AS companyOwnerHasPasswordHash
     FROM company_projects cp
     LEFT JOIN customer_companies cc ON cc.id = cp.companyId
     LEFT JOIN users u ON u.id = cc.ownerUserId
     WHERE cp.projectId IN (${placeholders})
     ORDER BY cp.projectId, cp.companyId`,
    projectIds,
  );
  return rows.map(row => ({
    projectId: row.projectId,
    companyId: row.companyId,
    projectName: row.projectName,
    bindingStatus: row.bindingStatus,
    companyName: row.companyName,
    companyStatus: row.companyStatus,
    companyOwner: publicUser({
      id: row.companyOwnerUserId,
      email: row.companyOwnerEmail,
      name: row.companyOwnerName,
      role: row.companyOwnerRole,
      userStatus: row.companyOwnerStatus,
      hasPasswordHash: row.companyOwnerHasPasswordHash,
    }),
  }));
}

async function loadCompanyUsers(conn, companyIds) {
  if (companyIds.length === 0 || !(await tableExists(conn, "users"))) return [];
  const placeholders = companyIds.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT
       id, email, name, role, customerRole, companyId, loginMethod, userStatus,
       (passwordHash IS NOT NULL AND passwordHash <> '') AS hasPasswordHash
     FROM users
     WHERE companyId IN (${placeholders})
     ORDER BY companyId, role, id
     LIMIT 50`,
    companyIds,
  );
  return rows.map(publicUser);
}

async function loadComparison(conn, targetId, compareId) {
  const questionRows = await safeQuery(
    conn,
    "questions",
    `SELECT projectId, questionText
     FROM questions
     WHERE projectId IN (?, ?)`,
    [targetId, compareId],
  );
  const articleRows = await safeQuery(
    conn,
    "geo_articles",
    `SELECT projectId, title
     FROM geo_articles
     WHERE projectId IN (?, ?)`,
    [targetId, compareId],
  );

  const splitSet = (rows, field, projectId) =>
    new Set(rows.filter(row => Number(row.projectId) === Number(projectId)).map(row => normalizeText(row[field])).filter(Boolean));

  const targetQuestions = splitSet(questionRows, "questionText", targetId);
  const compareQuestions = splitSet(questionRows, "questionText", compareId);
  const targetArticles = splitSet(articleRows, "title", targetId);
  const compareArticles = splitSet(articleRows, "title", compareId);

  const intersect = (a, b) => [...a].filter(value => b.has(value));
  return {
    questionOverlapCount: intersect(targetQuestions, compareQuestions).length,
    targetQuestionCount: targetQuestions.size,
    compareQuestionCount: compareQuestions.size,
    articleTitleOverlapCount: intersect(targetArticles, compareArticles).length,
    targetArticleTitleCount: targetArticles.size,
    compareArticleTitleCount: compareArticles.size,
  };
}

function dataPresence(counts) {
  const keys = [
    "enterpriseProfiles",
    "questions",
    "monthlyOptimizationPlans",
    "monthlyOptimizationTasks",
    "optimizationTasks",
    "geoArticles",
    "publishTasks",
    "geoPublishRecords",
    "geoInclusionMonitoringRecords",
    "reports",
    "deliveryReportShareTokens",
    "brandSourceRecords",
    "geoAssetSources",
  ];
  return Object.fromEntries(keys.map(key => [key, Number(counts[key] ?? 0) > 0]));
}

async function main() {
  const targetProjectId = positiveInt("AUDIT_PROJECT_ID", "180001");
  const compareProjectId = positiveInt("AUDIT_COMPARE_PROJECT_ID", "210001");
  const conn = await mysql.createConnection(requireEnv("DATABASE_URL"));
  try {
    const targetProject = await loadProject(conn, targetProjectId);
    const compareProject = await loadProject(conn, compareProjectId);
    const projectIds = [targetProjectId, compareProjectId];
    const companyBindings = await loadCompanyBindings(conn, projectIds);
    const companyIds = [...new Set(companyBindings.map(row => row.companyId).filter(Boolean))];
    const companyUsers = await loadCompanyUsers(conn, companyIds);
    const targetData = targetProject ? await loadProjectCounts(conn, targetProjectId) : null;
    const compareData = compareProject ? await loadProjectCounts(conn, compareProjectId) : null;
    const targetSamples = targetProject ? await loadSamples(conn, targetProjectId) : null;
    const compareSamples = compareProject ? await loadSamples(conn, compareProjectId) : null;
    const comparison =
      targetProject && compareProject ? await loadComparison(conn, targetProjectId, compareProjectId) : null;

    const targetBindings = companyBindings.filter(row => Number(row.projectId) === targetProjectId);
    const compareBindings = companyBindings.filter(row => Number(row.projectId) === compareProjectId);
    const fieldMatches =
      targetProject && compareProject
        ? {
            enterpriseName: targetProject.enterpriseName === compareProject.enterpriseName,
            industry: targetProject.industry === compareProject.industry,
            website: targetProject.website === compareProject.website,
            region: targetProject.region === compareProject.region,
            ownerUserId: targetProject.ownerUserId === compareProject.ownerUserId,
          }
        : null;

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "read-only",
          targetProjectId,
          compareProjectId,
          projects: {
            target: targetProject,
            compare: compareProject,
          },
          adminAccessModel: {
            projectPagesRequireOwnerUserId: true,
            targetOwnerCanLogin: Boolean(targetProject?.ownerUser?.hasPasswordHash),
            compareOwnerCanLogin: Boolean(compareProject?.ownerUser?.hasPasswordHash),
          },
          companyBindings: {
            target: targetBindings,
            compare: compareBindings,
            companyUsers,
          },
          dataPresence: {
            target: targetData ? dataPresence(targetData.counts) : null,
            compare: compareData ? dataPresence(compareData.counts) : null,
          },
          data: {
            target: targetData,
            compare: compareData,
          },
          samples: {
            target: targetSamples,
            compare: compareSamples,
          },
          duplicateSignals: {
            fieldMatches,
            ...comparison,
          },
          warnings,
          safety: {
            printedSecrets: false,
            printedPasswordHash: false,
            wroteDatabase: false,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await conn.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
