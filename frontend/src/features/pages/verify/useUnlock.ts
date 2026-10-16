import { useState } from 'react';
import type { PageView } from '../api';
import { isLocked, type LockedAction } from '../model/kinds';

/**
 * "Verification unlocks, it never blocks": a locked action on an unverified page opens the unlock sheet instead of
 * running; everything else runs as it would. `attempt` returns true when the action may go ahead.
 */
export function useUnlock(page: PageView | null) {
  const [asking, setAsking] = useState<LockedAction | null>(null);
  const attempt = (action: LockedAction) => {
    if (!page || !isLocked(action, page.verification)) return true;
    setAsking(action);
    return false;
  };
  return { asking, attempt, dismiss: () => setAsking(null) };
}
