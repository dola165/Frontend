import { useEffect, useRef, useState, type RefObject } from 'react';

interface Placement { host: HTMLElement; inline: boolean; obscured: boolean; left: number; top: number; maxHeight: number }
const EDGE = 12;
/** Measures the entire card against the visual viewport, including an on-screen keyboard. */
export function useGuidePlacement(ref: RefObject<HTMLElement | null>, target: string | undefined, active: boolean) {
  const [placement, setPlacement] = useState<Placement>({ host: document.body, inline: false, obscured: false, left: EDGE, top: EDGE, maxHeight: window.innerHeight - EDGE * 2 });
  const focused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) return;
    let frame = 0, focusTimer = 0;
    let observed: HTMLElement | null = null;
    const measure = () => {
      if (ref.current !== observed) {
        if (observed) resize.unobserve(observed);
        observed = ref.current;
        if (observed) resize.observe(observed);
      }
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
      const element = target ? document.querySelector<HTMLElement>(target) : null;
      const dialog = element?.closest<HTMLElement>('.gk-dialog') ?? null;
      const modal = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')).filter(node => node.getClientRects().length && !node.closest('[inert]')).at(-1);
      const obscured = Boolean(modal && modal !== dialog && !modal.contains(dialog));
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
      const next = { host: dialog ?? document.body, inline, obscured, left: x, top: y, maxHeight: inline ? Math.max(156, height * .46) : height - EDGE * 2 };
      if (dialog && inline) {
        dialog.style.setProperty('--gk-guide-viewport', `${height - (width <= 640 ? EDGE : 32)}px`);
        dialog.dataset.guided = 'true';
        const layer = dialog.closest<HTMLElement>('.gk-dialog-layer');
        layer?.style.setProperty('--gk-guide-viewport', String(height) + 'px');
        layer?.style.setProperty('--gk-guide-top', String(top) + 'px');
        if (layer) layer.dataset.guideViewport = 'true';
      } else if (dialog) {
        delete dialog.dataset.guided; dialog.style.removeProperty('--gk-guide-viewport');
        const layer = dialog.closest<HTMLElement>('.gk-dialog-layer');
        if (layer) { delete layer.dataset.guideViewport; layer.style.removeProperty('--gk-guide-viewport'); layer.style.removeProperty('--gk-guide-top'); }
      }
      setPlacement(previous => previous.host === next.host && previous.inline === next.inline && previous.obscured === next.obscured && Math.abs(previous.left - x) < 1 && Math.abs(previous.top - y) < 1 && previous.maxHeight === next.maxHeight ? previous : next);

      if (!obscured && element && focused.current !== element) {
        focused.current = element;
        element.scrollIntoView?.({ block: 'center', behavior: 'instant' });
        clearTimeout(focusTimer);
        focusTimer = window.setTimeout(() => {
          const selector = 'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])';
          const field = ref.current?.querySelector<HTMLElement>(selector) ?? element.querySelector<HTMLElement>(selector);
          // The portal must enter the modal before focus, otherwise its trap sends focus to Close.
          const current = document.activeElement;
          if (current === document.body || current?.closest('.gk-dialog__head') || ref.current?.contains(current)) field?.focus({ preventScroll: true });
        }, 80);
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const resize = new ResizeObserver(schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame); clearTimeout(focusTimer); observer.disconnect(); resize.disconnect();
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule);
      document.querySelectorAll<HTMLElement>('[data-guided]').forEach(dialog => { delete dialog.dataset.guided; dialog.style.removeProperty('--gk-guide-viewport'); });
      document.querySelectorAll<HTMLElement>('[data-guide-viewport]').forEach(layer => {
        delete layer.dataset.guideViewport;
        layer.style.removeProperty('--gk-guide-viewport'); layer.style.removeProperty('--gk-guide-top');
      });
    };
  }, [ref, target, active]);
  return placement;
}

