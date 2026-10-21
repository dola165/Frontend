import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';

const focusable = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';
const focusablesIn = (panel: HTMLElement | null) => Array.from(panel?.querySelectorAll<HTMLElement>(focusable) ?? []);

interface PopoverOptions {
    /** Where focus goes when it opens: the first control, or the panel itself (for a panel that reads like a page). */
    initialFocus?: 'first' | 'panel';
    /** A modal sheet keeps focus inside until it closes; everything else closes once focus leaves it. */
    modal?: boolean;
}

/**
 * One header popover: opens from a trigger and closes on navigation, an outside press, Escape, or focus
 * moving elsewhere. Escape returns focus to the trigger. Bound to the location key, so a new page never inherits it.
 */
export function usePopover({ initialFocus = 'first', modal = false }: PopoverOptions = {}) {
    const location = useLocation();
    const [openKey, setOpenKey] = useState<string | null>(null);
    const open = openKey === location.key;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const focusLast = useRef(false);

    const close = useCallback((returnFocus = true) => {
        setOpenKey(null);
        if (returnFocus) triggerRef.current?.focus();
    }, []);
    const toggle = useCallback(() => { focusLast.current = false; setOpenKey(current => current === location.key ? null : location.key); }, [location.key]);
    /** Opens with focus on the first or last item, as a menu button does for the arrow keys. */
    const show = useCallback((at: 'first' | 'last') => { focusLast.current = at === 'last'; setOpenKey(location.key); }, [location.key]);

    useEffect(() => {
        if (!open) return;
        const panel = panelRef.current;
        const items = focusablesIn(panel);
        const target = initialFocus === 'panel' ? panel : (focusLast.current ? items[items.length - 1] : items[0]) ?? panel;
        target?.focus({ preventScroll: true });
        const inside = (node: Node | null) => Boolean(node && (panelRef.current?.contains(node) || triggerRef.current?.contains(node)));
        const onPointer = (event: PointerEvent) => { if (!inside(event.target as Node)) setOpenKey(null); };
        // Tabbing out of a menu or panel closes it; a modal sheet pulls focus back instead.
        const onFocus = (event: FocusEvent) => {
            if (inside(event.target as Node)) return;
            if (modal) (focusablesIn(panelRef.current)[0] ?? panelRef.current)?.focus({ preventScroll: true });
            else setOpenKey(null);
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('focusin', onFocus);
        return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('focusin', onFocus); };
    }, [open, initialFocus, modal]);

    const onKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape' && open) {
            event.stopPropagation();
            close();
            return;
        }
        if (event.key !== 'Tab' || !modal || !open) return;
        const items = focusablesIn(panelRef.current);
        if (!items.length) { event.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }, [close, modal, open]);

    return { open, toggle, show, close, triggerRef, panelRef, onKeyDown };
}

/** Arrow, Home and End keys move between the items of a role="menu". */
export function moveMenuFocus(event: KeyboardEvent<HTMLElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]'))
        .filter(item => !item.hasAttribute('disabled'));
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
}

/** ArrowDown and ArrowUp on a menu button open its menu at the first or last item. */
export function openMenuFromKey(event: KeyboardEvent<HTMLElement>, show: (at: 'first' | 'last') => void) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    show(event.key === 'ArrowDown' ? 'first' : 'last');
}
