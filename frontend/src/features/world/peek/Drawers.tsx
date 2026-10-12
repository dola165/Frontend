import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../../../components/workspace/useDialogFocus';
import { GkRoot } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { typingIn } from './drawerContext';
import { PeekBody } from './PeekBody';
import { usePaneShown, usePeek } from './usePeek';
import './drawers.css';

/**
 * World's drawers: the thing itself slides in from the right (a job, a person), and who is behind it (the club or the
 * person who posted it) from the left, with the page showing between them. A click between them, or Back, closes
 * them all; Escape closes the left one first (never while typing in a field: a form's draft keeps its text). The page
 * behind cannot be used while they are open. A thing pressed in
 * the list under the map shows in the pane beside it instead (`PeekPane`).
 */
export function Drawers() {
    const t = useWorldCopy();
    const peek = usePeek();
    const layer = useRef<HTMLDivElement>(null);
    const paneShown = usePaneShown();
    const open = Boolean(peek.right || peek.left) && !paneShown;
    useDialogFocus(open, layer, () => {
        if (typingIn(document.activeElement)) return;
        if (peek.left && peek.right) peek.closeSide(); else peek.closeAll();
    });
    if (!open) return null;
    return createPortal(
        <GkRoot className="gk-drawers" data-both={peek.right && peek.left ? true : undefined}>
            <div ref={layer} className="gk-drawers__layer" role="dialog" aria-modal="true" aria-label={t('Details')}>
                <div className="gk-drawers__gap" data-dialog-backdrop="" aria-hidden="true" onClick={peek.closeAll} />
                {peek.right && <PeekBody {...peek.right} side="right" place="drawer" close={peek.closeAll} />}
                {peek.left && <PeekBody {...peek.left} side="left" place="drawer" close={peek.right ? peek.closeSide : peek.closeAll} />}
            </div>
        </GkRoot>,
        document.body,
    );
}
