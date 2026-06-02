import { readAgentConfig, writeAgentConfig } from "./agentConfig";
import { formatGeoServerConnectionError } from "./localAgentServerUrl";
import { pruneOldTaskLogs } from "./taskLogStore";
import { pollTasks, type PollTaskItem } from "./taskClient";
import { runPublishTask } from "./publishWorker";

export type WorkerLogFn = (line: string, isError?: boolean) => void;

export type PollingState = {
  isPolling: boolean;
  isExecuting: boolean;
  lastPollAt: string | null;
  lastConnectionOk: boolean | null;
  lastConnectionError: string | null;
  lastCycleProcessed: number;
  lastCycleMessage: string | null;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let executing = false;
let state: PollingState = {
  isPolling: false,
  isExecuting: false,
  lastPollAt: null,
  lastConnectionOk: null,
  lastConnectionError: null,
  lastCycleProcessed: 0,
  lastCycleMessage: null,
};

let logFn: WorkerLogFn = line => console.log(line);

export function setWorkerLogger(fn: WorkerLogFn) {
  logFn = fn;
}

function log(line: string, isError = false) {
  logFn(line, isError);
}

export function getPollingState(): PollingState {
  return { ...state };
}

function setConnectionResult(ok: boolean, message: string | null) {
  state.lastConnectionOk = ok;
  state.lastConnectionError = ok ? null : message;
}

async function executeTask(task: PollTaskItem, localAgentId: string): Promise<void> {
  log(`领取任务 #${task.taskId}（${task.platform}）`);
  if (!task.localProfileId) {
    log(`任务 #${task.taskId} 缺少 localProfileId`, true);
    return;
  }
  const outcome = await runPublishTask(task, localAgentId);
  log(`任务 #${task.taskId} [${task.platform}] 结果：${outcome.status}`);
}

/** 单次轮询，默认每轮最多处理 maxTasksPerCycle 条（配置项，默认 1） */
export async function pollOnce(): Promise<{ processed: number; message: string }> {
  if (executing) {
    return { processed: 0, message: "正在执行任务，跳过本轮" };
  }
  executing = true;
  state.isExecuting = true;
  let processed = 0;
  try {
    pruneOldTaskLogs();
    const cfg = readAgentConfig();
    state.lastPollAt = new Date().toISOString();

    let tasks: PollTaskItem[];
    try {
      const res = await pollTasks(cfg.localAgentId);
      tasks = res.tasks.slice(0, cfg.maxTasksPerCycle);
      setConnectionResult(true, null);
    } catch (e) {
      const { userMessage, diagnosticDetail } = formatGeoServerConnectionError(e, cfg.serverUrl);
      setConnectionResult(false, userMessage);
      log(`连接服务端失败：${userMessage}`, true);
      if (diagnosticDetail !== userMessage) {
        log(`[诊断] ${diagnosticDetail}`, true);
      }
      state.lastCycleMessage = userMessage;
      return { processed: 0, message: userMessage };
    }

    if (tasks.length === 0) {
      state.lastCycleMessage = "暂无待处理任务";
      return { processed: 0, message: "暂无待处理任务" };
    }

    for (const task of tasks) {
      try {
        await executeTask(task, cfg.localAgentId);
        processed += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`任务 #${task.taskId} 异常：${msg}`, true);
        try {
          const { reportPublishOutcome } = await import("./publishWorker");
          await reportPublishOutcome({
            task,
            localAgentId: cfg.localAgentId,
            outcome: {
              status: "failed",
              errorType: "worker_error",
              errorMessage: msg,
              logs: [
                {
                  step: "worker_exception",
                  status: "failed",
                  message: msg,
                  createdAt: new Date().toISOString(),
                },
                {
                  step: "report_result",
                  status: "failed",
                  message: "failed",
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          });
        } catch {
          log(`任务 #${task.taskId} 回传失败`, true);
        }
      }
    }

    state.lastCycleProcessed = processed;
    state.lastCycleMessage = `本轮处理 ${processed} 个任务`;
    return { processed, message: state.lastCycleMessage };
  } finally {
    executing = false;
    state.isExecuting = false;
  }
}

export type StartPollingOptions = {
  /** 轮询已在运行时再次开启，记录中断原因（如连接异常、配置变更） */
  restartReason?: string;
};

function createPollTick() {
  return () => {
    void pollOnce().catch(e => {
      const msg = e instanceof Error ? e.message : String(e);
      setConnectionResult(false, msg);
      log(msg, true);
    });
  };
}

export function startPolling(options?: StartPollingOptions): void {
  const wasActive = pollTimer !== null;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  const cfg = readAgentConfig();
  writeAgentConfig({ autoStartPolling: true });
  state.isPolling = true;
  const tick = createPollTick();
  tick();
  pollTimer = setInterval(tick, cfg.pollIntervalSeconds * 1000);
  const intervalHint = `（每 ${cfg.pollIntervalSeconds}s，每轮最多 ${cfg.maxTasksPerCycle} 条）`;
  if (options?.restartReason && wasActive) {
    log(`${options.restartReason}，正在重连...${intervalHint}`);
  } else {
    log(`已开启轮询${intervalHint}`);
  }
}

export function stopPolling(options?: { log?: boolean }): void {
  const wasActive = pollTimer !== null;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  writeAgentConfig({ autoStartPolling: false });
  state.isPolling = false;
  if (options?.log !== false && wasActive) {
    log("已停止轮询");
  }
}

/** 连接异常等场景下重启轮询，并输出原因 */
export function restartPolling(reason: string): void {
  if (!state.isPolling && !pollTimer) return;
  startPolling({ restartReason: reason });
}

export function resumePollingIfEnabled(): void {
  const cfg = readAgentConfig();
  if (cfg.autoStartPolling) startPolling();
}

/** @deprecated */
export const runPublishCycleOnce = pollOnce;
export const startAutoPoll = startPolling;
export const stopAutoPoll = stopPolling;
export const resumeAutoPollIfEnabled = resumePollingIfEnabled;
