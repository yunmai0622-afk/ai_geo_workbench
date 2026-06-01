import type { HealthOperationCheck } from "./healthOperations";

export type HealthOperationsSnapshot = {
  lastContentGeneration: HealthOperationCheck;
  lastPublish: HealthOperationCheck;
  queueTaskCount: number;
  /** 数据库不可用时为 false */
  queueAvailable: boolean;
};

export type HealthResponse = {
  ok: boolean;
  version: string;
  api: { ok: boolean };
  database: { ok: boolean; message?: string };
  llm: { ok: boolean; message?: string; provider?: string; model?: string };
  operations: HealthOperationsSnapshot;
};
