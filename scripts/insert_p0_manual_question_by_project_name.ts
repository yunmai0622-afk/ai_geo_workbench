/**
 * One-off: find P0 AI 诊断最小验收 project by name suffix, insert one manual「指定问题」.
 * Usage: pnpm exec tsx scripts/insert_p0_manual_question_by_project_name.ts
 */
import "dotenv/config";
import { and, eq, like } from "drizzle-orm";
import { projects, questions } from "../drizzle/schema";
import { getDb } from "../server/db";

const NAME_SUFFIX = "2026-05-14T10-52-38-438Z";
const QUESTION_TEXT = "做企业AI自动化系统，哪家公司适合服务中小企业？";

async function closeDatabase(db: Awaited<ReturnType<typeof getDb>>) {
  const client = (db as { $client?: { end?: () => Promise<unknown> | unknown } } | null)?.$client;
  if (client && typeof client.end === "function") await client.end();
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("Database is not available.");
    process.exit(1);
  }

  try {
    const bySuffix = await db
      .select()
      .from(projects)
      .where(like(projects.enterpriseName, `%${NAME_SUFFIX}%`));

    const p0 = bySuffix.filter(
      row => row.enterpriseName.includes("P0") && row.enterpriseName.includes("诊断最小验收"),
    );

    const exactUser =
      p0.find(row => row.enterpriseName === `P0 AI诊断最小验收 ${NAME_SUFFIX}`) ??
      p0.find(row => row.enterpriseName === `P0 AI 诊断最小验收 ${NAME_SUFFIX}`);

    const project = exactUser ?? p0[0] ?? bySuffix[0];
    if (!project) {
      console.error(`No project found with enterpriseName containing "${NAME_SUFFIX}".`);
      process.exit(1);
    }

    if (p0.length > 1 && !exactUser) {
      console.warn("Multiple P0 诊断 projects matched suffix; using first P0 match:", project.id, project.enterpriseName);
    }

    console.log("Resolved projectId:", project.id, "enterpriseName:", project.enterpriseName);

    const trimmed = QUESTION_TEXT.trim();
    const dup = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.projectId, project.id), eq(questions.questionText, trimmed)));

    if (dup.length > 0) {
      console.log("Skip insert: same questionText already exists for this project, question id:", dup[0].id);
      return;
    }

    await db.insert(questions).values({
      projectId: project.id,
      questionText: trimmed,
      questionType: "指定问题",
      targetKeyword: null,
      intentLevel: "高",
      businessValue: 5,
      source: "manual",
      enabled: 1,
    });

    console.log("Inserted questions row: projectId=%s source=manual questionType=指定问题", project.id);
  } finally {
    await closeDatabase(db);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
