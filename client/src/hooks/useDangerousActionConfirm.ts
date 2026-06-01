import { useCallback, useState } from "react";

type PendingConfirm = {
  operationName: string;
  onConfirm: () => void | Promise<void>;
};

export function useDangerousActionConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [acting, setActing] = useState(false);

  const requestConfirm = useCallback((operationName: string, onConfirm: () => void | Promise<void>) => {
    setPending({ operationName, onConfirm });
  }, []);

  const close = useCallback(() => {
    if (acting) return;
    setPending(null);
  }, [acting]);

  const confirm = useCallback(async () => {
    if (!pending || acting) return;
    setActing(true);
    try {
      await pending.onConfirm();
      setPending(null);
    } finally {
      setActing(false);
    }
  }, [acting, pending]);

  return {
    requestConfirm,
    dialogProps: {
      open: pending != null,
      operationName: pending?.operationName ?? null,
      pending: acting,
      onOpenChange: (open: boolean) => {
        if (!open) close();
      },
      onConfirm: () => void confirm(),
    },
  };
}
