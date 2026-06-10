import { buildProjectScopedPath } from "./geoWebPaths";
import type { WorkspaceSummaryMetrics } from "./workspaceStateMachine";

export type WorkspaceTodayTaskStatus = "blocked" | "todo" | "ready" | "done";

export type WorkspaceTodayTask = {
  key: string;
  title: string;
  count: number;
  status: WorkspaceTodayTaskStatus;
  reason: string;
  actionLabel: string;
  targetPath: string;
};

const DIAGNOSIS_TTL_MS = 30 * 86400000;

export type BuildWorkspaceTodayTasksInput = WorkspaceSummaryMetrics & {
  projectId: number;
  lastDiagnosisAt?: Date | string | null;
  pendingPublishContentCount: number;
};

function parseTime(value: Date | string | null | undefined): number {
  if (value == null) return NaN;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? NaN : t;
}

export function isDiagnosisExpired(lastDiagnosisAt: Date | string | null | undefined): boolean {
  const t = parseTime(lastDiagnosisAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t > DIAGNOSIS_TTL_MS;
}

export function hasAnyDiagnosis(input: Pick<
  BuildWorkspaceTodayTasksInput,
  "hasAnalysis" | "hasGeoScore" | "hasCompletedT0Baseline"
>): boolean {
  return input.hasAnalysis || input.hasGeoScore || input.hasCompletedT0Baseline;
}

export function needsAiDiagnosis(input: Pick<
  BuildWorkspaceTodayTasksInput,
  "hasAnalysis" | "hasGeoScore" | "hasCompletedT0Baseline" | "lastDiagnosisAt"
>): boolean {
  if (!hasAnyDiagnosis(input)) return true;
  return isDiagnosisExpired(input.lastDiagnosisAt);
}

export function resolveLastDiagnosisTimestamp(input: {
  analysisTimestamps: Array<Date | string | null | undefined>;
  completedRoundFinishedAt: Array<Date | string | null | undefined>;
}): Date | null {
  let max = NaN;
  for (const value of [...input.analysisTimestamps, ...input.completedRoundFinishedAt]) {
    const t = parseTime(value);
    if (!Number.isNaN(t)) max = Number.isNaN(t) ? t : Math.max(max, t);
  }
  return Number.isNaN(max) ? null : new Date(max);
}

export function buildWorkspaceTodayTasks(input: BuildWorkspaceTodayTasksInput): WorkspaceTodayTask[] {
  const { projectId } = input;
  const tasks: WorkspaceTodayTask[] = [];

  if (!input.p0ProfileComplete) {
    tasks.push({
      key: "complete_profile",
      title: "补齐品牌资料",
      count: Math.max(1, 100 - Math.round(input.profileCompletionPercent)),
      status: "ready",
      reason: "品牌资料完整度不足，或核心字段尚未补齐。",
      actionLabel: "去建档",
      targetPath: buildProjectScopedPath("/enterprise-profile", projectId),
    });
  }

  if (input.p0ProfileComplete && needsAiDiagnosis(input)) {
    const expired = hasAnyDiagnosis(input) && isDiagnosisExpired(input.lastDiagnosisAt);
    tasks.push({
      key: "start_ai_diagnosis",
      title: "开始 AI 实测诊断",
      count: 1,
      status: "ready",
      reason: expired
        ? "上次诊断已超过 30 天，建议重新实测以获取最新 AI 表现。"
        : "尚未完成 AI 实测诊断，无法识别内容缺口与推荐方向。",
      actionLabel: "去 AI 诊断",
      targetPath: buildProjectScopedPath("/ai-diagnosis", projectId),
    });
  }

  if (input.pendingPublishContentCount > 0) {
    tasks.push({
      key: "process_pending_content",
      title: "处理待发布内容",
      count: input.pendingPublishContentCount,
      status: input.p0ProfileComplete && hasAnyDiagnosis(input) ? "ready" : "blocked",
      reason: "已有生成内容尚未进入发布流程，需先处理后再安排发布。",
      actionLabel: "去处理内容",
      targetPath: buildProjectScopedPath("/weekly", projectId),
    });
  }

  if (input.waitingPublicLinkCount > 0) {
    tasks.push({
      key: "fill_public_links",
      title: "回填公开链接",
      count: input.waitingPublicLinkCount,
      status: input.publishRecordCount > 0 ? "ready" : "todo",
      reason: "发布任务已完成，但尚未回填公开链接，系统无法安排发布后复测。",
      actionLabel: "去回填链接",
      targetPath: `${buildProjectScopedPath("/content-publishing", projectId)}&filter=waiting_links`,
    });
  }

  const retestDueCount = Math.max(input.retestPendingCount, input.showT1RetestAutoTriggerReminder ? 1 : 0);
  const needsRetest =
    input.publishRecordWithPublicUrlCount > 0 &&
    (!input.hasCompletedT1Retest || retestDueCount > 0 || Boolean(input.retestDueReminder));
  if (needsRetest) {
    tasks.push({
      key: "run_inclusion_retest",
      title: "执行收录/AI复测",
      count: Math.max(retestDueCount, input.publishRecordWithPublicUrlCount),
      status: "ready",
      reason: "已有公开链接的内容尚未完成发布后复测，需进入收录监测执行。",
      actionLabel: "去收录复测",
      targetPath: buildProjectScopedPath("/inclusion-monitoring", projectId),
    });
  }

  const hasDeliveryInputs =
    hasAnyDiagnosis(input) ||
    input.publishRecordCount > 0 ||
    input.retestComparisonCount > 0 ||
    input.monitoringRecordCount > 0;
  if (hasDeliveryInputs) {
    tasks.push({
      key: "generate_delivery_report",
      title: "生成交付报告",
      count: Math.max(input.reportCount, 1),
      status: input.reportCount > 0 ? "done" : "ready",
      reason:
        input.reportCount > 0
          ? "本轮已有诊断、发布或复测结果，可更新客户交付报告。"
          : "本轮已有诊断、发布或复测结果，可整理交付报告。",
      actionLabel: "生成交付报告",
      targetPath: buildProjectScopedPath("/delivery-reports", projectId),
    });
  }

  return tasks.filter(task => task.status !== "done");
}
