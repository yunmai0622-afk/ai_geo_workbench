import { desc, eq, like, or } from "drizzle-orm";
import { projects } from "../drizzle/schema";
import type { getDb } from "../server/db";

/** 海豚知道真实验收项目：匹配短名或「河南海豚知道…」等全名，避免重复创建项目。 */
export async function findDolphinAcceptanceProject(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const [row] = await db
    .select()
    .from(projects)
    .where(or(eq(projects.enterpriseName, "海豚知道"), like(projects.enterpriseName, "%海豚知道%")))
    .orderBy(desc(projects.createdAt))
    .limit(1);
  return row;
}
