import './design.css';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface TabItem<T extends string> { id: T; label: ReactNode; count?: number; icon?: ReactNode }

/** Underline tabs with arrow-key support. Use `useUrlTab` to keep the selection in the URL. */
export function Tabs<T extends string>({ items, value, onChange, label, className }: { items: TabItem<T>[]; value: T; onChange: (id: T) => void; label: string; className?: string }) {
    const refs = useRef<Array<HTMLButtonElement | null>>([]);
    const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const index = items.findIndex(item => item.id === value);
        const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!delta || index < 0) return;
        event.preventDefault();
        const next = (index + delta + items.length) % items.length;
        onChange(items[next].id);
        refs.current[next]?.focus();
    };
    return (
        <div role="tablist" aria-label={label} className={`gk-tabs${className ? ` ${className}` : ''}`} onKeyDown={onKey}>
            {items.map((item, index) => (
                <button key={item.id} ref={node => { refs.current[index] = node; }} role="tab" type="button" className="gk-tab"
                    aria-selected={item.id === value} tabIndex={item.id === value ? 0 : -1} onClick={() => onChange(item.id)}>
                    {item.icon}{item.label}{typeof item.count === 'number' && <span className="gk-tab__count">{item.count}</span>}
                </button>
            ))}
        </div>
    );
}

/** Reads and writes one tab id in the query string, falling back to the first allowed value. */
export function useUrlTab<T extends string>(param: string, allowed: readonly T[], fallback: T): [T, (id: T) => void] {
    const [params, setParams] = useSearchParams();
    const raw = params.get(param);
    const value = raw && (allowed as readonly string[]).includes(raw) ? raw as T : fallback;
    const set = (id: T) => {
        const next = new URLSearchParams(params);
        if (id === fallback) next.delete(param); else next.set(param, id);
        setParams(next, { replace: false });
    };
    return [value, set];
}
