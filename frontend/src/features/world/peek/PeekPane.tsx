import { useEffect, useRef } from 'react';
import { PeekPlaceContext } from './drawerContext';
import { PeekBody } from './PeekBody';
import { takePaneFocus, usePeek } from './usePeek';
import './drawers.css';

/**
 * The thing pressed in the list under the map, beside the list (as LinkedIn shows a job beside the jobs). It stays in
 * view while the list scrolls. What the thing relates to (a club, a coach) stacks over it with a way back. It is part of
 * the page, not a dialog: the list stays usable. Opened from the keyboard it takes focus; when what it shows changes
 * under the focus (something stacked, the way back), focus moves to it rather than falling to the page; when it closes,
 * focus returns to the row that opened it.
 */
export function PeekPane({ root }: { /** The list column, where the row that opened the pane is. */ root: HTMLElement | null }) {
    const peek = usePeek();
    const ref = useRef<HTMLDivElement>(null);
    const shown = peek.left ?? peek.right;
    const key = shown ? `${shown.kind}-${shown.id}` : '';
    useEffect(() => {
        const lost = !document.activeElement || document.activeElement === document.body;
        if (takePaneFocus(peek.value) || (lost && key)) ref.current?.focus({ preventScroll: true });
    }, [key, peek.value]);
    const last = useRef<string | undefined>(undefined);
    const host = useRef(root);
    useEffect(() => { last.current = peek.value; host.current = root; });
    useEffect(() => () => {
        // Closed while focus was in it (it fell to the page): back to the row that opened it, when it is still listed.
        if (document.activeElement && document.activeElement !== document.body) return;
        if (last.current) host.current?.querySelector<HTMLElement>(`[data-peek="${CSS.escape(last.current)}"]`)?.focus({ preventScroll: true });
    }, []);
    if (!shown) return null;
    return (
        <div ref={ref} className="gk-world-pane" tabIndex={-1}>
            <PeekPlaceContext.Provider value="pane">
                <PeekBody {...shown} place="pane" side={peek.left ? 'left' : 'right'} close={peek.closeAll} back={peek.left && peek.right ? peek.closeSide : undefined} />
            </PeekPlaceContext.Provider>
        </div>
    );
}
