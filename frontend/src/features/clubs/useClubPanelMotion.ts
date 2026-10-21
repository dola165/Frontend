import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react';
import './club-motion.css';

/** Keep the dialog and its focus lock mounted until its exit has finished. */
export function useClubPanelMotion(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const requested = useRef(false), completed = useRef(false), callback = useRef(onClose);
  useEffect(() => { callback.current = onClose; }, [onClose]);
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    callback.current();
  }, []);
  const close = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finish();
    else setClosing(true);
  }, [finish]);
  useEffect(() => {
    if (!closing) return;
    // Also close when animations are suppressed, interrupted or never emit an event.
    const timer = window.setTimeout(finish, 260);
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const change = () => { if (preference?.matches) finish(); };
    change();
    preference?.addEventListener?.('change', change);
    return () => { window.clearTimeout(timer); preference?.removeEventListener?.('change', change); };
  }, [closing, finish]);
  const onAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    if (closing && event.target === event.currentTarget && ['club-panel-exit', 'club-dialog-exit'].includes(event.animationName)) finish();
  };
  return { closing, close, onAnimationEnd };
}
