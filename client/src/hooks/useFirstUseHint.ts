import {
  dismissFirstUseHint,
  isFirstUseHintDismissed,
  type FirstUseHintKey,
} from "@/lib/firstUseHints";
import { useCallback, useEffect, useState } from "react";

export function useFirstUseHint(storageKey: FirstUseHintKey) {
  const [visible, setVisible] = useState(() => !isFirstUseHintDismissed(storageKey));

  useEffect(() => {
    setVisible(!isFirstUseHintDismissed(storageKey));
  }, [storageKey]);

  const dismiss = useCallback(() => {
    dismissFirstUseHint(storageKey);
    setVisible(false);
  }, [storageKey]);

  return { visible, dismiss };
}
