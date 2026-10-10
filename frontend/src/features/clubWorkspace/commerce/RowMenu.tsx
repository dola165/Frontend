import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

/**
 * The less frequent actions for one row (publish, close, archive), behind a "More actions" button.
 * Built on <details>, so it works without script; Escape, a choice or a tap outside closes it.
 * Items are plain buttons with the `cm-menu__item` class (`cm-menu__item--danger` for destructive ones).
 */
export function RowMenu({ name, disabled, children }: { name: string; disabled?: boolean; children: ReactNode }) {
    const ref = useRef<HTMLDetailsElement>(null);
    const [open, setOpen] = useState(false);
    const close = (focus: boolean) => {
        if (!ref.current) return;
        ref.current.open = false;
        if (focus) ref.current.querySelector('summary')?.focus();
    };
    useEffect(() => {
        if (!open) return;
        const outside = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) close(false); };
        document.addEventListener('pointerdown', outside);
        return () => document.removeEventListener('pointerdown', outside);
    }, [open]);
    return <details className="cm-menu" ref={ref} onToggle={event => setOpen(event.currentTarget.open)}
        onKeyDown={event => { if (event.key === 'Escape' && ref.current?.open) { event.stopPropagation(); close(true); } }}>
        <summary className="gk-btn gk-btn--ghost gk-btn--icon" aria-label={`More actions for ${name}`} aria-disabled={disabled || undefined}
            onClick={event => { if (disabled) event.preventDefault(); }}><MoreHorizontal aria-hidden="true" /></summary>
        <div className="cm-menu__list" onClick={event => { if ((event.target as HTMLElement).closest('button')) close(false); }}>{children}</div>
    </details>;
}
