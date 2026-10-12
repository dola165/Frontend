import { useCallback, useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { PeekPlaceContext, typingIn } from '../peek/drawerContext';
import { PeekPane } from '../peek/PeekPane';
import { usePaneShown, usePeek } from '../peek/usePeek';
import { useStage } from '../stage/stageContext';
import './split.css';

/**
 * Under the map, the list sits in one bounded column the width of the Home feed, with the page's background either
 * side. Pressing a result shows it in a pane beside the column (LinkedIn's jobs and the job beside them); nothing is
 * there until something is pressed. Escape closes the pane (who is behind a thing first), as its Close and Back do.
 */
export function ListSplit({ children }: { children: ReactNode }) {
    const { setPaneHost } = useStage();
    const peek = usePeek();
    const shown = usePaneShown();
    const split = useRef<HTMLDivElement>(null);
    const [column, setColumn] = useState<HTMLElement | null>(null);
    // The column says it is on screen, so a press in it can open the pane.
    const host = useCallback((node: HTMLDivElement | null) => { setColumn(node); setPaneHost(node); }, [setPaneHost]);
    const onKey = useEffectEvent((event: KeyboardEvent) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        const target = event.target as HTMLElement | null;
        if (typingIn(target) || (target && target !== document.body && !split.current?.contains(target))) return;
        event.preventDefault();
        if (peek.left && peek.right) peek.closeSide(); else peek.closeAll();
    });
    useEffect(() => {
        if (!shown) return;
        const listen = (event: KeyboardEvent) => onKey(event);
        window.addEventListener('keydown', listen);
        return () => window.removeEventListener('keydown', listen);
    }, [shown]);
    return (
        <div ref={split} className="gk-world-split" data-pane={shown || undefined}>
            <div ref={host} className="gk-world-list">
                <PeekPlaceContext.Provider value="pane">{children}</PeekPlaceContext.Provider>
            </div>
            {shown && <PeekPane root={column} />}
        </div>
    );
}
