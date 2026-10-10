import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { usePhoneLayout, type SheetSnap } from './usePhoneLayout';
import './sheet.css';

const ORDER: SheetSnap[] = ['peek', 'half', 'full'];

/**
 * The map's companion surface. On wide screens a panel (floating over the map or docked beside
 * it, collapsible); on phones a bottom sheet with peek, half and full heights. The handle is a
 * button, so the sheet works by keyboard as well as by dragging.
 */
export function MapPanel({ label, variant = 'floating', header, children, footer, snap, onSnap, collapsed = false, className }: {
    label: string; variant?: 'floating' | 'docked'; header?: ReactNode; children: ReactNode; footer?: ReactNode;
    snap: SheetSnap; onSnap: (snap: SheetSnap) => void; collapsed?: boolean; className?: string;
}) {
    const phone = usePhoneLayout();
    const sheet = useRef<HTMLElement>(null);
    const drag = useRef<{ y: number; start: number; height: number; moved: boolean } | null>(null);
    const [offset, setOffset] = useState<number | null>(null);
    const [settled, setSettled] = useState(snap);
    if (settled !== snap) { setSettled(snap); setOffset(null); }
    const body = useRef<HTMLDivElement>(null);
    useEffect(() => { if (phone && snap === 'peek') body.current?.scrollTo({ top: 0 }); }, [phone, snap]);

    if (!phone) {
        return (
            <aside className={`gk-map-panel gk-map-panel--${variant}${className ? ` ${className}` : ''}`} aria-label={label} data-collapsed={collapsed || undefined}>
                {header && <div className="gk-map-panel__head">{header}</div>}
                {!collapsed && <div className="gk-map-panel__body">{children}</div>}
                {!collapsed && footer && <div className="gk-map-panel__foot">{footer}</div>}
            </aside>
        );
    }

    const next = () => onSnap(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]);
    const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
        const height = sheet.current?.parentElement?.clientHeight ?? window.innerHeight;
        drag.current = { y: event.clientY, start: sheet.current?.getBoundingClientRect().top ?? 0, height, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
        if (!drag.current) return;
        const delta = event.clientY - drag.current.y;
        if (Math.abs(delta) > 4) drag.current.moved = true;
        const parentTop = sheet.current?.parentElement?.getBoundingClientRect().top ?? 0;
        setOffset(Math.max(56, Math.min(drag.current.height - 96, drag.current.start - parentTop + delta)));
    };
    const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
        const state = drag.current; drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (!state?.moved || offset == null) { setOffset(null); if (!state?.moved) next(); return; }
        const share = offset / state.height;
        onSnap(share > 0.7 ? 'peek' : share > 0.3 ? 'half' : 'full');
    };
    return (
        <section ref={sheet} className={`gk-map-sheet${className ? ` ${className}` : ''}`} aria-label={label} data-snap={snap} style={offset != null ? { top: offset, transition: 'none' } : undefined}>
            <button type="button" className="gk-map-sheet__handle" aria-label={snap === 'full' ? `Shrink ${label.toLowerCase()}` : `Expand ${label.toLowerCase()}`}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null; setOffset(null); }}
                onKeyDown={event => { if (event.key === 'ArrowUp') { event.preventDefault(); onSnap(snap === 'peek' ? 'half' : 'full'); } if (event.key === 'ArrowDown') { event.preventDefault(); onSnap(snap === 'full' ? 'half' : 'peek'); } }}>
                <span aria-hidden="true" />
            </button>
            {header && <div className="gk-map-sheet__head">{header}</div>}
            <div ref={body} className="gk-map-sheet__body" inert={snap === 'peek' || undefined}>{children}</div>
            {footer && snap !== 'peek' && <div className="gk-map-sheet__foot">{footer}</div>}
        </section>
    );
}
