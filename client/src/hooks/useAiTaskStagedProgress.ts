import { useCallback, useEffect, useRef, useState } from "react";
import {
  AI_TASK_PROGRESS_MAX_INCOMPLETE,
  clampIncompleteProgressPercent,
  formatElapsedSeconds,
  pickTimedOptimisticStage,
  type AiTaskProgressStage,
} from "@shared/aiTaskProgress";

export type AiTaskStagedProgressStatus = "idle" | "running" | "success" | "failed";

export type UseAiTaskStagedProgressOptions = {
  stages: AiTaskProgressStage[];
  maxIncompletePercent?: number;
};

export function useAiTaskStagedProgress({ stages, maxIncompletePercent = AI_TASK_PROGRESS_MAX_INCOMPLETE }: UseAiTaskStagedProgressOptions) {
  const [status, setStatus] = useState<AiTaskStagedProgressStatus>("idle");
  const [percent, setPercent] = useState(0);
  const [stepLabel, setStepLabel] = useState("");
  const [stepDescription, setStepDescription] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const manualStageRef = useRef<AiTaskProgressStage | null>(null);
  const optimisticCapRef = useRef(maxIncompletePercent);

  const reset = useCallback(() => {
    setStatus("idle");
    setPercent(0);
    setStepLabel("");
    setStepDescription("");
    setElapsedSec(0);
    startedAtRef.current = null;
    manualStageRef.current = null;
    optimisticCapRef.current = maxIncompletePercent;
  }, [maxIncompletePercent]);

  const start = useCallback(() => {
    const first = stages[0];
    startedAtRef.current = Date.now();
    manualStageRef.current = first ?? null;
    optimisticCapRef.current = maxIncompletePercent;
    setStatus("running");
    setPercent(first?.percent ?? 10);
    setStepLabel(first?.label ?? "");
    setStepDescription(first?.description ?? "");
    setElapsedSec(0);
  }, [stages, maxIncompletePercent]);

  const setStage = useCallback(
    (targetPercent: number, label?: string) => {
      const match =
        stages.find(s => s.percent === targetPercent) ??
        stages.filter(s => s.percent <= targetPercent).slice(-1)[0];
      const stage: AiTaskProgressStage = {
        percent: targetPercent,
        label: label ?? match?.label ?? stepLabel,
        description: match?.description,
      };
      manualStageRef.current = stage;
      const capped =
        status === "success"
          ? 100
          : clampIncompleteProgressPercent(stage.percent, optimisticCapRef.current);
      setPercent(capped);
      setStepLabel(stage.label);
      setStepDescription(stage.description ?? match?.description ?? "");
    },
    [stages, status, stepLabel],
  );

  const allowOptimisticUpTo = useCallback((cap: number) => {
    optimisticCapRef.current = clampIncompleteProgressPercent(cap, maxIncompletePercent);
  }, [maxIncompletePercent]);

  const complete = useCallback(() => {
    const done = stages.find(s => s.percent === 100) ?? { percent: 100, label: "完成" };
    manualStageRef.current = done;
    setStatus("success");
    setPercent(100);
    setStepLabel(done.label);
    setStepDescription(done.description ?? "");
  }, [stages]);

  const fail = useCallback(() => {
    setStatus("failed");
  }, []);

  useEffect(() => {
    if (status !== "running" || startedAtRef.current == null) return;
    const tick = () => {
      const elapsedMs = Date.now() - startedAtRef.current!;
      setElapsedSec(formatElapsedSeconds(elapsedMs));
      const manual = manualStageRef.current;
      if (manual) {
        const manualCap = clampIncompleteProgressPercent(manual.percent, optimisticCapRef.current);
        const timed = pickTimedOptimisticStage(stages, elapsedMs, optimisticCapRef.current);
        const nextPercent = Math.max(manualCap, timed.percent);
        const useTimed = nextPercent > manualCap;
        const nextLabel = useTimed ? timed.label : manual.label;
        const nextDescription = useTimed ? (timed.description ?? "") : (manual.description ?? "");
        setPercent(clampIncompleteProgressPercent(nextPercent, optimisticCapRef.current));
        setStepLabel(nextLabel);
        setStepDescription(nextDescription);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [status, stages]);

  return {
    status,
    percent,
    stepLabel,
    stepDescription,
    elapsedSec,
    start,
    reset,
    setStage,
    allowOptimisticUpTo,
    complete,
    fail,
    isRunning: status === "running",
    isSuccess: status === "success",
    isFailed: status === "failed",
  };
}
