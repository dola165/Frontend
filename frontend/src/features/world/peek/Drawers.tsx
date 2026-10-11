import { lazy, Suspense, useRef, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../../../components/workspace/useDialogFocus';
import { GkRoot } from '../../../design/primitives';
import { useWorldCopy } from '../copy';
import { DrawerPlaceContext } from './drawerContext';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { usePeek } from './usePeek';
import './drawers.css';

/** What each kind of thing shows in a drawer, loaded when first opened. */
const KINDS: Record<string, ComponentType<{ id: string }>> = {
    person: lazy(() => import('./PersonPeek')),
    job: lazy(() => import('./JobPeek')),
    club: lazy(() => import('./ClubPeek')),
};

function Drawer({ kind, id, side, close }: { kind: string; id: string; side: 'right' | 'left'; close: () => void }) {
    const t = useWorldCopy();
    const Kind = KINDS[kind];
    return (
        <DrawerPlaceContext.Provider value={{ side, close }}>
            <Suspense fallback={<DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>}>
                <Kind key={`${kind}-${id}`} id={id} />
            </Suspense>
        </DrawerPlaceContext.Provider>
    );
}

/**
 * World's drawers: the thing itself slides in from the right (a job, a person), and who is behind it (the club or the
 * person who posted it) from the left, with the page showing between them. A click between them, or Back, closes
 * them all; Escape closes the left one first. The page behind cannot be used while they are open.
 */
export function Drawers() {
    const t = useWorldCopy();
    const peek = usePeek();
    const layer = useRef<HTMLDivElement>(null);
    const open = Boolean(peek.right || peek.left);
    useDialogFocus(open, layer, () => (peek.left && peek.right ? peek.closeSide() : peek.closeAll()));
    if (!open) return null;
    return createPortal(
        <GkRoot className="gk-drawers" data-both={peek.right && peek.left ? true : undefined}>
            <div ref={layer} className="gk-drawers__layer" role="dialog" aria-modal="true" aria-label={t('Details')}>
                <div className="gk-drawers__gap" data-dialog-backdrop="" aria-hidden="true" onClick={peek.closeAll} />
                {peek.right && <Drawer {...peek.right} side="right" close={peek.closeAll} />}
                {peek.left && <Drawer {...peek.left} side="left" close={peek.right ? peek.closeSide : peek.closeAll} />}
            </div>
        </GkRoot>,
        document.body,
    );
}
