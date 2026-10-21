import { useEffect, useRef, useState, type RefObject } from 'react';

interface Placement { host: HTMLElement; inline: boolean; left: number; top: number; maxHeight: number }
const EDGE = 12;
/** Measures the entire card against the visual viewport, including an on-screen keyboard. */
export function useGuidePlacement(ref: RefObject<HTMLElement | null>, target: string | undefined, active: boolean) {
  const [placement, setPlacement] = useState<Placement>({ host: document.body, inline: false, left: EDGE, top: EDGE, maxHeight: window.innerHeight - EDGE * 2 });
  const focused = useRef('');
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const measure = () => {
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
      const element = target ? document.querySelector<HTMLElement>(target) : null;
      const dialog = element?.closest<HTMLElement>('.gk-dialog') ?? null;
      const rect = element?.getBoundingClientRect();
      const card = ref.current?.getBoundingClientRect();
      const cardWidth = Math.min(344, width - EDGE * 2), cardHeight = Math.min(card?.height ?? 280, height - EDGE * 2);
      const spaceRight = rect ? left + width - rect.right : width;
      const spaceLeft = rect ? rect.left - left : width;
      // A narrow dialog gives the guide its own row, keeping the task and its controls separate.
      const inline = Boolean(dialog && Math.max(spaceLeft, spaceRight) < cardWidth + EDGE * 2);
      let x = left + width - cardWidth - EDGE, y = top + height - cardHeight - (width < 641 ? 76 : EDGE);
      if (rect) {
        if (spaceRight >= cardWidth + EDGE * 2) { x = rect.right + EDGE; y = rect.top; }
        else if (spaceLeft >= cardWidth + EDGE * 2) { x = rect.left - cardWidth - EDGE; y = rect.top; }
        else if (rect.top - top > cardHeight + EDGE * 2) y = rect.top - cardHeight - EDGE;
        else if (top + height - rect.bottom > cardHeight + EDGE * 2) y = rect.bottom + EDGE;
      }
      x = Math.max(left + EDGE, Math.min(x, left + width - cardWidth - EDGE));
      y = Math.max(top + EDGE, Math.min(y, top + height - cardHeight - EDGE));
      const next = { host: dialog ?? document.body, inline, left: x, top: y, maxHeight: inline ? Math.max(156, height * .46) : height - EDGE * 2 };
      if (dialog && inline) {
        dialog.style.setProperty('--gk-guide-viewport', `${height - EDGE}px`);
        dialog.dataset.guided = 'true';
      }
      setPlacement(previous => previous.host === next.host && previous.inline === next.inline && Math.abs(previous.left - x) < 1 && Math.abs(previous.top - y) < 1 && previous.maxHeight === next.maxHeight ? previous : next);
      const identity = `${target}:${dialog ? 'dialog' : 'page'}`;
      if (element && focused.current !== identity) {
        focused.current = identity;
        element.scrollIntoView?.({ block: 'center', behavior: 'instant' });
        const field = element.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])');
        field?.focus({ preventScroll: true });
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const resize = new ResizeObserver(schedule);
    if (ref.current) resize.observe(ref.current);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule);
      document.querySelectorAll<HTMLElement>('[data-guided]').forEach(dialog => { delete dialog.dataset.guided; dialog.style.removeProperty('--gk-guide-viewport'); });
    };
  }, [ref, target, active]);
  return placement;
}
