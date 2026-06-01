import {
  dismissFirstUseHint,
  isFirstUseHintDismissed,
  type FirstUseHintKey,
} from "@/lib/firstUseHints";
import { useCallback, useState } from "react";

export function useFirstUseHint(storageKey: FirstUseHintKey) {
  const [visible, setVisible] = useState(() => !isFirstUseHintDismissed(storageKey));

  const dismiss = useCallback(() => {
    dismissFirstUseHint(storageKey);
    setVisible(false);
  }, [storageKey]);

  return { visible, dismiss };
}
