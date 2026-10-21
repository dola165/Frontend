import type { ReactNode } from 'react';
import { usePanelMotion } from './usePanelMotion';

/** Nonmodal panels keep their own existing keyboard and conversation behavior. */
export function MotionPanel({ label, className = '', onClose, children }: { label: string; className?: string; onClose: () => void; children: (close: () => void) => ReactNode }) {
    const motion = usePanelMotion(onClose);
    return <section aria-label={label} className={`app-motion-panel ${className}`} data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd}>
        {children(motion.close)}
    </section>;
}
