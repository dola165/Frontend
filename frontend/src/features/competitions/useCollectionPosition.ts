import { useCallback, useLayoutEffect, useRef } from 'react';

/** Keep a pagination control under the user's hand, even when the last page is shorter.
 * Measure at commit time so scrolling while a request is in flight remains respected. */
export function useCollectionPosition(revision: unknown) {
  const anchor = useRef<HTMLElement | null>(null);
  const position = useRef<{ element: HTMLElement; top: number; scroller: HTMLElement } | null>(null);
  const remember = useCallback((element: HTMLElement | null) => { anchor.current = element; }, []);
  const beforeCommit = useCallback(() => {
    const element = anchor.current;
    anchor.current = null;
    if (!element?.isConnected) return;
    let scroller = element.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    scroller ??= document.scrollingElement as HTMLElement;
    const bounds = element.getBoundingClientRect();
    const viewport = scroller === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
    if (bounds.bottom > viewport.top && bounds.top < viewport.bottom) position.current = { element, top: bounds.top, scroller };
  }, []);
  useLayoutEffect(() => {
    const saved = position.current;
    position.current = null;
    if (!saved?.element.isConnected) return;
    const delta = saved.element.getBoundingClientRect().top - saved.top;
    // This is layout compensation before paint, not a navigation/animated scroll.
    if (Math.abs(delta) > 1) saved.scroller.scrollBy({ top: delta, behavior: 'instant' });
  }, [revision]);
  return { remember, beforeCommit };
}
