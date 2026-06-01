/**
 * GEO 增长周报：每周一自动生成上一自然周规则周报，写入 system_notifications。
 */
import { runWeeklyGrowthReport } from "./weeklyGrowthReport";

export async function tryRunWeeklyGrowthReportOnMonday() {
  const now = new Date();
  if (now.getDay() !== 1) return;
  await runWeeklyGrowthReport(now);
}

export function startWeeklyGrowthReportScheduler() {
  setTimeout(() => {
    void tryRunWeeklyGrowthReportOnMonday();
    setInterval(() => void tryRunWeeklyGrowthReportOnMonday(), 24 * 60 * 60 * 1000);
  }, 5 * 60 * 1000);

  console.log("[增长周报] 调度器已启动：启动 5 分钟后首次检查，之后每 24 小时检查；周一执行");
}
