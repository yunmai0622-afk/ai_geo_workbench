#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");

const schema = read("drizzle/schema.ts");
const routers = read("server/routers.ts");
const publishTasks = read("server/publishTasksRouter.ts");
const platformRouter = read("server/projectPlatformAccountsRouter.ts");
const projectAccess = read("server/projectAccess.ts");

let passed = 0;
let failed = 0;
function ok(m) {
  passed++;
  console.log("[OK]", m);
}
function fail(m) {
  failed++;
  console.error("[FAIL]", m);
}

const projectsBlock = schema.slice(
  schema.indexOf('export const projects = mysqlTable("projects"'),
  schema.indexOf("export const questions"),
);
if (/ownerUserId:\s*int\("ownerUserId"\)\.notNull\(\)/.test(projectsBlock)) ok("projects schema ownerUserId int notNull");
else fail("projects schema missing ownerUserId");

if (fs.existsSync(path.join(ROOT, "drizzle/0030_projects_owner_user_id.sql"))) ok("migration 0030 exists");
else fail("missing drizzle/0030_projects_owner_user_id.sql");

if (fs.existsSync(path.join(ROOT, "scripts/ensure_project_owner_user_id.mjs"))) ok("ensure script exists");
else fail("missing ensure_project_owner_user_id.mjs");

if (/export async function requireProjectAccess/.test(projectAccess)) ok("requireProjectAccess exists");
else fail("missing requireProjectAccess");

if (/export async function listAccessibleProjectIds/.test(projectAccess)) ok("listAccessibleProjectIds exists");
else fail("missing listAccessibleProjectIds");

const projectsList = routers.slice(routers.indexOf("projects: router"), routers.indexOf("questions: router"));
if (/eq\(projects\.ownerUserId,\s*userId\)/.test(projectsList)) ok("projects.list filters ownerUserId");
else fail("projects.list not filtered by owner");

if (/ownerUserId/.test(projectsList) && /insert\(projects\)/.test(projectsList) && /getCurrentUserId\(ctx\)/.test(projectsList)) {
  ok("projects.create writes ownerUserId");
} else fail("projects.create missing ownerUserId");

const dash = routers.slice(routers.indexOf("clientDashboard"), routers.indexOf("projects: router"));
if (/listAccessibleProjectIds\(ctx\)/.test(dash) && !/select\(\)\.from\(projects\)\)\.orderBy/.test(dash)) {
  ok("clientDashboard uses accessible project ids");
} else if (/inArray\(projects\.id,\s*accessibleIds\)/.test(dash)) {
  ok("clientDashboard uses accessible project ids");
} else {
  fail("clientDashboard still full-table pattern");
}

const requireCount = (routers.match(/requireProjectAccess\(ctx/g) ?? []).length;
if (requireCount >= 25) ok(`routers requireProjectAccess calls: ${requireCount}`);
else fail(`too few requireProjectAccess in routers: ${requireCount}`);

if (/requireProjectAccess/.test(platformRouter)) ok("platformAccounts router guarded");
else fail("platformAccounts router not guarded");

if (/requireProjectAccessConn/.test(publishTasks)) ok("publishTasks guarded");
else fail("publishTasks not guarded");

if (!/const getProjectOrThrow = async \(projectId/.test(routers)) ok("removed unguarded getProjectOrThrow");
else fail("legacy getProjectOrThrow still present");

if (!/read\("server\/agentRouter\.ts"\)[\s\S]*fail/.test("")) {
  const agent = read("server/agentRouter.ts");
  if (/publicProcedure/.test(agent) && !/ownerUserId/.test(agent)) ok("agent router unchanged (publicProcedure)");
  else fail("agent router unexpected change");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
