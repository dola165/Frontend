import './context-menu.css';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { GkRoot } from '../design/primitives';
import { placeMenu, type ContextMenuItem, type OpenedMenu } from './contextMenuParts';

/**
 * A right-click menu, over everything, at its place: the items in one column (`useContextMenu` opens it). It is
 * measured where it opens and moved inside the screen before it shows.
 */
export function ContextMenu({ opened, label, onClose }: { opened: OpenedMenu; label: string; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const id = useId();
    const { items, returnTo } = opened;

    const finish = useCallback((restore: boolean) => {
        onClose();
        if (restore && returnTo && returnTo.isConnected) returnTo.focus({ preventScroll: true });
    }, [onClose, returnTo]);

    // Placed on the element itself, before the browser paints it: measured hidden, then moved and shown.
    useLayoutEffect(() => {
        const menu = ref.current;
        if (!menu) return;
        const box = menu.getBoundingClientRect();
        const screen = { width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
        const place = placeMenu({ x: opened.x, y: opened.y }, { width: box.width, height: box.height }, screen);
        menu.style.left = `${place.x}px`;
        menu.style.top = `${place.y}px`;
        menu.style.maxHeight = `${place.maxHeight}px`;
        menu.style.visibility = '';
    }, [opened.x, opened.y]);

    useEffect(() => {
        const first = ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? ref.current?.querySelector<HTMLElement>('[role="menuitem"]');
        first?.focus({ preventScroll: true });
        const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) finish(false); };
        const away = () => finish(false);
        const scrolled = (event: Event) => { if (!ref.current?.contains(event.target as Node)) finish(false); };
        document.addEventListener('pointerdown', outside, true);
        window.addEventListener('resize', away);
        window.addEventListener('blur', away);
        document.addEventListener('scroll', scrolled, true);
        return () => {
            document.removeEventListener('pointerdown', outside, true);
            window.removeEventListener('resize', away);
            window.removeEventListener('blur', away);
            document.removeEventListener('scroll', scrolled, true);
        };
    }, [finish]);

    const all = () => [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const move = (from: Element | null, step: 1 | -1 | 'first' | 'last') => {
        const list = all();
        if (!list.length) return;
        const at = from instanceof HTMLElement ? list.indexOf(from) : -1;
        const next = step === 'first' ? 0 : step === 'last' ? list.length - 1 : at < 0 ? (step === 1 ? 0 : list.length - 1) : (at + step + list.length) % list.length;
        list[next]?.focus();
    };
    const keys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const current = document.activeElement;
        switch (event.key) {
            case 'ArrowDown': event.preventDefault(); move(current, 1); return;
            case 'ArrowUp': event.preventDefault(); move(current, -1); return;
            case 'Home': event.preventDefault(); move(current, 'first'); return;
            case 'End': event.preventDefault(); move(current, 'last'); return;
            case 'Escape': event.preventDefault(); event.stopPropagation(); finish(true); return;
            case 'Tab': event.preventDefault(); finish(true); return;
            default: {
                // A letter goes to the next item that starts with it.
                if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || !event.key.trim()) return;
                const list = all();
                const at = current instanceof HTMLElement ? list.indexOf(current) : -1;
                const letter = event.key.toLocaleLowerCase();
                [...list.slice(at + 1), ...list.slice(0, at + 1)].find(item => (item.dataset.label ?? '').toLocaleLowerCase().startsWith(letter))?.focus();
            }
        }
    };
    const choose = (item: ContextMenuItem) => {
        if (item.disabled) return;
        finish(true);
        // Once the menu has gone and focus is back, so whatever the item opens takes focus from there.
        window.setTimeout(item.onSelect, 0);
    };

    return createPortal(<GkRoot className="gk-cm-layer">
        <div ref={ref} className="gk-cm" role="menu" aria-label={label} id={id} onKeyDown={keys} onContextMenu={event => event.preventDefault()}
            style={{ left: opened.x, top: opened.y, visibility: 'hidden' }}>
            {items.map(item => <MenuRow key={item.key} item={item} menuId={id} onChoose={choose} />)}
        </div>
    </GkRoot>, document.body);
}

function MenuRow({ item, menuId, onChoose }: { item: ContextMenuItem; menuId: string; onChoose: (item: ContextMenuItem) => void }) {
    const Icon = item.icon;
    const reasonId = `${menuId}-${item.key}-why`, labelId = `${menuId}-${item.key}-label`;
    return <>
        {item.separated && <div className="gk-cm__line" role="separator" />}
        <button type="button" role="menuitem" className="gk-cm__item" data-danger={item.danger || undefined} data-label={item.label}
            aria-disabled={item.disabled || undefined} aria-labelledby={labelId} aria-describedby={item.disabled && item.reason ? reasonId : undefined}
            onClick={() => onChoose(item)}>
            <span className="gk-cm__icon" aria-hidden="true">{Icon && <Icon />}</span>
            <span className="gk-cm__text">
                <span id={labelId} className="gk-cm__label">{item.label}</span>
                {item.disabled && item.reason && <span id={reasonId} className="gk-cm__reason">{item.reason}</span>}
            </span>
        </button>
    </>;
}
