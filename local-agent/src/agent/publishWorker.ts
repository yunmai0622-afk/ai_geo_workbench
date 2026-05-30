/** 发布任务执行与日志回传（轮询入口见 pollingManager.ts） */
import type { LocalPublishResult, LocalPublishTask } from "./platforms/basePublisher";
import { publishWithPlatform } from "./platforms/publisherFactory";
import { appendTaskLogStep, finishTaskLog, startTaskLog } from "./taskLogStore";
import { claimTask, reportTaskResult, type PollTaskItem } from "./taskClient";
import { updateAccount } from "./storage";

/** 服务端 reportTaskResult.errorMessage 上限 2000，截断避免回传失败 */
function truncateReportField(value: string | null | undefined, max = 1900): string | null | undefined {
  if (value == null) return value;
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** 将平台执行结果写入本地日志并回传服务端（含 report_result 步骤） */
export async function reportPublishOutcome(input: {
  task: PollTaskItem;
  localAgentId: string;
  outcome: LocalPublishResult;
}): Promise<void> {
  const { task, localAgentId, outcome } = input;

  startTaskLog({
    taskId: task.taskId,
    platform: task.platform,
    profileId: task.localProfileId,
    title: task.title,
    expectedAccountName: task.expectedAccountName ?? "",
  });
  for (const l of outcome.logs) {
    appendTaskLogStep(task.taskId, {
      step: l.step,
      status: l.status as "ok" | "failed" | "skipped",
      message: l.message,
      selector: l.selector,
      createdAt: l.createdAt,
    });
  }

  const reportOk =
    outcome.status === "manual_required" ||
    outcome.status === "draft_saved" ||
    outcome.status === "completed";
  appendTaskLogStep(task.taskId, {
    step: "report_result",
    status: reportOk ? "ok" : "failed",
    message: outcome.status,
  });

  finishTaskLog(task.taskId, {
    finalStatus: outcome.status,
    errorType: outcome.errorType,
    errorMessage: outcome.errorMessage,
  });

  const accountPatch: Parameters<typeof updateAccount>[1] = {
    lastPublishAt: new Date().toISOString(),
  };
  if (outcome.status === "session_expired") accountPatch.sessionStatus = "expired";
  if (outcome.status === "manual_required" || outcome.status === "draft_saved" || outcome.status === "completed") {
    accountPatch.sessionStatus = "active";
  }
  updateAccount(task.localProfileId, accountPatch);

  await reportTaskResult({
    taskId: task.taskId,
    localAgentId,
    status: outcome.status,
    draftUrl: outcome.draftUrl,
    publicUrl: outcome.publicUrl,
    errorType: truncateReportField(outcome.errorType ?? null, 50) ?? outcome.errorType,
    errorMessage: truncateReportField(outcome.errorMessage) ?? outcome.errorMessage,
    logs: [
      ...outcome.logs.map(l => {
        const message = l.message ?? "";
        return JSON.stringify({
          ...l,
          message: message.length > 500 ? `${message.slice(0, 500)}…` : message,
        });
      }),
      JSON.stringify({
        step: "report_result",
        status: reportOk ? "ok" : "failed",
        message: outcome.status,
        createdAt: new Date().toISOString(),
      }),
    ],
  });
}

export async function runPublishTask(task: PollTaskItem, localAgentId: string): Promise<LocalPublishResult> {
  await claimTask(task.taskId, localAgentId);

  if (
    task.platform !== "zhihu" &&
    task.platform !== "sohu" &&
    task.platform !== "baijiahao" &&
    task.platform !== "toutiao"
  ) {
    const outcome: LocalPublishResult = {
      status: "failed",
      errorType: "unsupported_platform",
      errorMessage: `暂不支持平台 ${task.platform}`,
      logs: [
        {
          step: "publisher_factory",
          status: "failed",
          message: "unsupported_platform",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    await reportPublishOutcome({ task, localAgentId, outcome });
    return outcome;
  }

  const publishTask: LocalPublishTask = {
    taskId: task.taskId,
    platform: task.platform,
    localProfileId: task.localProfileId,
    expectedAccountName: task.expectedAccountName ?? "",
    title: task.title,
    content: task.content,
    coverImageUrl: task.coverImageUrl,
    coverBase64: task.coverBase64,
    action: task.action === "save_draft" ? "save_draft" : "publish",
  };

  const outcome = await publishWithPlatform(publishTask);
  await reportPublishOutcome({ task, localAgentId, outcome });
  return outcome;
}

