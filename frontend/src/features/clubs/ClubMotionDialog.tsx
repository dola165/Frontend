import { useRef, type ReactNode } from 'react';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { useClubPanelMotion } from './useClubPanelMotion';

export function ClubMotionDialog({ label, onClose, children }: { label: string; onClose: () => void; children: (close: () => void) => ReactNode }) {
  const motion = useClubPanelMotion(onClose), dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialog, motion.close);
  return <div className="club-motion-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-[color:var(--color-overlay)]/60 p-3 backdrop-blur-sm sm:p-5" data-closing={motion.closing} onClick={motion.close}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={label} className="club-motion-dialog relative max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd} onClick={event => event.stopPropagation()}>{children(motion.close)}</div>
  </div>;
}
