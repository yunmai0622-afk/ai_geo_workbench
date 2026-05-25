/**
 * 双用户 IDOR 复测（需 DATABASE_URL + projects.ownerUserId）
 */
import fs from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { projects, questions } from "../drizzle/schema";
import { getDb } from "../server/db";
import type { TrpcContext } from "../server/_core/context";
import {
  listAccessibleProjectIds,
  PROJECT_ACCESS_FORBIDDEN_MSG,
  requireProjectAccess,
  requireQuestionAccess,
} from "../server/projectAccess";

const artifactsDir = path.join(process.cwd(), "artifacts");
const outPath = path.join(artifactsDir, "tenant-isolation-idor-e2e.json");

type Check = { id: string; pass: boolean; detail: string };

function mockCtx(userId: number): TrpcContext {
  return {
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: {
      id: userId,
      openId: `e2e-user-${userId}`,
      name: `E2E ${userId}`,
      email: null,
      loginMethod: "e2e",
      role: "user",
      extensionApiKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

function isForbidden(err: unknown): boolean {
  return err instanceof TRPCError && err.code === "FORBIDDEN";
}

async function main() {
  const checks: Check[] = [];
  const startedAt = new Date().toISOString();

  const db = await getDb();
  if (!db) {
    const payload = {
      phase: "GEO-V1-H1",
      startedAt,
      mode: "skipped_no_db",
      pass: false,
      checks: [{ id: "database", pass: false, detail: "DATABASE_URL 不可用" }],
    };
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.error("[SKIP] 无数据库连接");
    process.exit(1);
  }

  const userProjectRows = await db
    .select({ ownerUserId: projects.ownerUserId, projectId: projects.id, enterpriseName: projects.enterpriseName })
    .from(projects)
    .orderBy(projects.id);

  const byOwner = new Map<number, number[]>();
  for (const row of userProjectRows) {
    const list = byOwner.get(row.ownerUserId) ?? [];
    list.push(row.projectId);
    byOwner.set(row.ownerUserId, list);
  }

  const owners = Array.from(byOwner.entries()).filter(([, ids]) => ids.length > 0);
  if (owners.length < 2) {
    const payload = {
      phase: "GEO-V1-H1",
      startedAt,
      mode: "skipped_need_two_owners",
      pass: false,
      checks: [
        {
          id: "two_owners",
          pass: false,
          detail: `需要至少 2 个不同 ownerUserId 的项目，当前 owner 数=${owners.length}`,
        },
      ],
    };
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.error("[SKIP] 需要两个不同用户的项目");
    process.exit(1);
  }

  const [userA, userB] = owners.slice(0, 2);
  const projectA = userA[1][0]!;
  const projectB = userB[1][0]!;
  const ctxA = mockCtx(userA[0]);
  const ctxB = mockCtx(userB[0]);

  const assertForbidden = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      checks.push({ id: label, pass: false, detail: "预期 FORBIDDEN 但成功" });
    } catch (e) {
      if (isForbidden(e)) {
        checks.push({ id: label, pass: true, detail: PROJECT_ACCESS_FORBIDDEN_MSG });
      } else {
        checks.push({ id: label, pass: false, detail: e instanceof Error ? e.message : String(e) });
      }
    }
  };

  const listA = await listAccessibleProjectIds(ctxA);
  checks.push({
    id: "user_a_list_only_own",
    pass: listA.every(id => userA[1].includes(id)) && listA.includes(projectA) && !listA.includes(projectB),
    detail: `A 可见项目: ${listA.join(",")}`,
  });

  const listB = await listAccessibleProjectIds(ctxB);
  checks.push({
    id: "user_b_list_only_own",
    pass: listB.every(id => userB[1].includes(id)) && listB.includes(projectB) && !listB.includes(projectA),
    detail: `B 可见项目: ${listB.join(",")}`,
  });

  await assertForbidden("a_access_b_project", () => requireProjectAccess(ctxA, projectB));
  await assertForbidden("b_access_a_project", () => requireProjectAccess(ctxB, projectA));

  const qB = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.projectId, projectB))
    .limit(1);
  if (qB[0]) {
    await assertForbidden("a_mutate_b_question", () => requireQuestionAccess(ctxA, qB[0]!.id));
    checks.push({ id: "b_question_exists", pass: true, detail: `questionId=${qB[0]!.id}` });
  } else {
    checks.push({ id: "b_question_exists", pass: true, detail: "项目 B 无问题行，跳过 question 变异测" });
  }

  try {
    await requireProjectAccess(ctxA, projectA);
    checks.push({ id: "a_access_own_project", pass: true, detail: "ok" });
  } catch (e) {
    checks.push({ id: "a_access_own_project", pass: false, detail: String(e) });
  }

  const crossOwnerCount = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.ownerUserId, userA[0]), eq(projects.id, projectB)));
  checks.push({
    id: "sql_owner_mismatch",
    pass: crossOwnerCount.length === 0,
    detail: "projects.ownerUserId 与 id 不一致时应查不到",
  });

  const pass = checks.every(c => c.pass);
  const payload = {
    phase: "GEO-V1-H1",
    startedAt,
    finishedAt: new Date().toISOString(),
    mode: "db_simulated_ctx",
    userA: { userId: userA[0], projectId: projectA },
    userB: { userId: userB[0], projectId: projectB },
    pass,
    checks,
  };

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

  for (const c of checks) {
    console.log(c.pass ? "[OK]" : "[FAIL]", c.id, c.detail);
  }
  console.log(`\nWrote ${outPath}`);
  process.exit(pass ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
