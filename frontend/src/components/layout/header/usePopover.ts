import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';

const focusable = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * One header popover: opens from a trigger, closes on navigation, outside press or Escape,
 * and returns focus to its trigger. Bound to the location key, so a new page never inherits it.
 */
export function usePopover(initialFocus: 'first' | 'panel' = 'first') {
    const location = useLocation();
    const [openKey, setOpenKey] = useState<string | null>(null);
    const open = openKey === location.key;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const close = useCallback((returnFocus = true) => {
        setOpenKey(null);
        if (returnFocus) triggerRef.current?.focus();
    }, []);
    const toggle = useCallback(() => setOpenKey(current => current === location.key ? null : location.key), [location.key]);

    useEffect(() => {
        if (!open) return;
        const panel = panelRef.current;
        const target = initialFocus === 'first' ? panel?.querySelector<HTMLElement>(focusable) : panel;
        target?.focus({ preventScroll: true });
        const onPointer = (event: PointerEvent) => {
            const node = event.target as Node;
            if (panelRef.current?.contains(node) || triggerRef.current?.contains(node)) return;
            if (node instanceof Element && node.closest('[data-header-portal]')) return;
            setOpenKey(null);
        };
        document.addEventListener('pointerdown', onPointer);
        return () => document.removeEventListener('pointerdown', onPointer);
    }, [open, initialFocus]);

    const onKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        close();
    }, [close]);

    return { open, toggle, close, triggerRef, panelRef, onKeyDown };
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
