import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

/**
 * 静默触发成熟度重算（建档、证据、信源、实测完成后自动调用）
 */
export function useMaturityAutoCalculate(projectId: number | null | undefined) {
  const utils = trpc.useUtils();
  const mutation = trpc.geo.maturity.calculateAndSave.useMutation({
    onSuccess: async () => {
      if (!projectId) return;
      await Promise.all([
        utils.geo.maturity.getMaturityReport.invalidate({ projectId }),
        utils.geo.maturity.getLatest.invalidate({ projectId }),
        utils.geo.maturity.getHistory.invalidate({ projectId }),
      ]);
    },
  });

  const triggerMaturityCalculate = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!projectId) return null;
      try {
        return await mutation.mutateAsync({ projectId });
      } catch (error) {
        if (!options?.silent) throw error;
        return null;
      }
    },
    [projectId, mutation],
  );

  return {
    triggerMaturityCalculate,
    isCalculating: mutation.isPending,
  };
}
