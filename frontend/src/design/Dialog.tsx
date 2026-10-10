import './dialog.css';
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogFocus } from '../components/workspace/useDialogFocus';
import { Button, GkRoot } from './primitives';

/**
 * A modal dialog on the design system: a title, the content, and the actions at the foot.
 * Focus is contained and returned, Escape closes, and the page behind is inert.
 * `role="alertdialog"` is for confirmations that interrupt work (unsaved changes).
 * `size="sheet"` docks it to the right edge at full height (a bottom sheet on phones), for detail beside a list.
 */
export function Dialog({ open, title, description, onClose, children, footer, size = 'md', role = 'dialog', closeLabel = 'Close' }: {
    open: boolean; title: ReactNode; description?: ReactNode; onClose: () => void; children?: ReactNode; footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'sheet'; role?: 'dialog' | 'alertdialog'; closeLabel?: string;
}) {
    const ref = useRef<HTMLElement>(null);
    const titleId = useId(), descriptionId = useId();
    useDialogFocus(open, ref, onClose);
    if (!open) return null;
    return createPortal(
        <GkRoot className={`gk-dialog-layer${size === 'sheet' ? ' gk-dialog-layer--sheet' : ''}`}>
            <div className="gk-dialog-backdrop" data-dialog-backdrop="" onClick={onClose} aria-hidden="true" />
            <section ref={ref} className={`gk-dialog gk-dialog--${size}`} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
                <header className="gk-dialog__head">
                    <div className="gk-dialog__titles">
                        <h2 id={titleId} className="gk-dialog__title">{title}</h2>
                        {description && <p id={descriptionId} className="gk-dialog__description">{description}</p>}
                    </div>
                    <Button variant="ghost" iconOnly aria-label={closeLabel} onClick={onClose}><X aria-hidden="true" /></Button>
                </header>
                {children && <div className="gk-dialog__body">{children}</div>}
                {footer && <footer className="gk-dialog__foot">{footer}</footer>}
            </section>
        </GkRoot>,
        document.body,
    );
}
