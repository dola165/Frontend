import './design.css';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export interface TabItem<T extends string> { id: T; label: ReactNode; /** A number, or "–" while it is not known yet. */ count?: number | string; icon?: ReactNode }

/**
 * Underline tabs with arrow, Home and End key support. Use `useUrlTab` to keep the selection in the URL.
 * With `idBase`, each tab gets the id `${idBase}-${id}` and controls the panel `${idBase}-${id}-panel`.
 */
export function Tabs<T extends string>({ items, value, onChange, label, className, idBase }: { items: TabItem<T>[]; value: T; onChange: (id: T) => void; label: string; className?: string; idBase?: string }) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);
    const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const index = items.findIndex(item => item.id === value);
        const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if ((!delta && event.key !== 'Home' && event.key !== 'End') || index < 0) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + delta + items.length) % items.length;
        onChange(items[next].id);
        refs.current[next]?.focus();
    };
    return (
        <div role="tablist" aria-label={label} className={`gk-tabs${className ? ` ${className}` : ''}`} onKeyDown={onKey}>
            {items.map((item, index) => (
                <button key={item.id} ref={node => { refs.current[index] = node; }} role="tab" type="button" className="gk-tab"
                    id={idBase && `${idBase}-${item.id}`} aria-controls={idBase && item.id === value ? `${idBase}-${item.id}-panel` : undefined}
                    aria-selected={item.id === value} tabIndex={item.id === value ? 0 : -1} onClick={() => onChange(item.id)}>
                    {item.icon}{item.label}{item.count != null && <span className="gk-tab__count">{item.count}</span>}
                </button>
            ))}
        </div>
    );
}

export interface RouteTabItem { to: string; label: ReactNode; icon?: ReactNode; /** Match the path exactly, for an index destination. */ end?: boolean }

/** Tabs that are destinations: each is a link, and the current route carries the underline. */
export function RouteTabs({ items, label, className }: { items: RouteTabItem[]; label: string; className?: string }) {
    const nav = useRef<HTMLElement>(null);
    const { pathname } = useLocation();
    // On a narrow screen the row scrolls sideways; keep the current destination in view.
    useEffect(() => {
        const row = nav.current, active = row?.querySelector<HTMLElement>('[aria-current="page"]');
        if (!row || !active || row.scrollWidth <= row.clientWidth) return;
        const left = active.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft, right = left + active.offsetWidth;
        if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) row.scrollLeft = Math.max(0, left - (row.clientWidth - active.offsetWidth) / 2);
    }, [pathname]);
    return (
        <nav ref={nav} aria-label={label} className={`gk-tabs${className ? ` ${className}` : ''}`}>
            {items.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end} className="gk-tab">{item.icon}{item.label}</NavLink>
            ))}
        </nav>
    );
}

export interface SegmentItem<T extends string> { id: T; label: string; icon?: ReactNode }

/** A small set of mutually exclusive views, such as list or map. Icons stay; labels hide on narrow screens. */
export function Segmented<T extends string>({ items, value, onChange, label, className }: { items: SegmentItem<T>[]; value: T; onChange: (id: T) => void; label: string; className?: string }) {
    return (
        <div role="group" aria-label={label} className={`gk-segmented${className ? ` ${className}` : ''}`}>
            {items.map(item => (
                <button key={item.id} type="button" className="gk-segmented__item" aria-pressed={item.id === value} title={item.label} onClick={() => onChange(item.id)}>
                    {item.icon}<span className="gk-segmented__label">{item.label}</span>
                </button>
            ))}
        </div>
    );
}
