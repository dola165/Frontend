import { useEffect, useRef } from 'react';

/**
 * An editor in a box that closes because another box opened (or the page left edit mode) keeps what was typed:
 * a changed draft is saved as it goes, never dropped. Done and Cancel settle it first, so Cancel still discards.
 * Returns `settle`, to call before an explicit Done or Cancel.
 */
export function useKeepOnLeave<T>(draft: T, changed: (draft: T) => boolean, keep: (draft: T) => void) {
  const latest = useRef({ draft, changed, keep, settled: false });
  useEffect(() => { Object.assign(latest.current, { draft, changed, keep }); });
  useEffect(() => {
    const state = latest.current;
    state.settled = false;
    return () => { if (!state.settled && state.changed(state.draft)) { state.settled = true; state.keep(state.draft); } };
  }, []);
  return () => { latest.current.settled = true; };
}
