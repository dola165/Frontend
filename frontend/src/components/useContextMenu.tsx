import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ContextMenu } from './ContextMenu';
import { keepsNativeMenu, LONG_PRESS_MS, type ContextMenuItem, type ContextMenuItems, type OpenedMenu } from './contextMenuParts';

export type { ContextMenuItem, ContextMenuItems } from './contextMenuParts';

/** How far a finger may move and still be holding (past that it is scrolling). */
const HOLD_SLOP = 10;

/** Where focus goes back to: what had it inside the element, else the element when it can take focus. */
function returnPoint(element: HTMLElement) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && element.contains(active)) return active;
    return element.matches('button, [href], [tabindex], input, select, textarea') ? element : active instanceof HTMLElement ? active : null;
}

/** Only one menu is open at a time: opening another closes this one. */
let closeOpenMenu: (() => void) | null = null;

/**
 * Presses an inner element's menu already took: a menu inside another (a chat in the chat column) opens alone, the
 * outer one does not start its own long press for the same finger.
 */
const claimed = new WeakSet<Event>();

/** Handlers a menu's element takes: spread them on it (and call them from your own, when it has some). */
export interface ContextMenuBinding {
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onClickCapture: (event: ReactMouseEvent<HTMLElement>) => void;
}

/**
 * A right-click menu for one element, like a chat app's: it opens at the pointer on a right click, by holding a finger
 * on it (touch), and by Shift+F10 or the menu key when the element has focus (then at the element). Arrow keys move,
 * Enter chooses, Escape or a click elsewhere closes, and focus goes back where it was. It stays inside the screen.
 * Where a right click means something to the browser (text boxes, links, selected text) the browser's menu stays.
 *
 * Everything a menu does must also be on screen somewhere: the menu is a shortcut, never the only way.
 * `items` is read when the menu opens, so it shows what is true then; an empty list opens nothing.
 */
export function useContextMenu(items: () => ContextMenuItems, options: { label: string; disabled?: boolean }) {
    const [opened, setOpened] = useState<OpenedMenu | null>(null);
    const timer = useRef<number | undefined>(undefined);
    const start = useRef<{ x: number; y: number } | null>(null);
    const swallowClick = useRef(false);
    const keyboardAt = useRef(0);
    const pressedAt = useRef(0);
    const build = useRef(items);
    useEffect(() => { build.current = items; });
    const { disabled = false, label } = options;

    const close = useCallback(() => setOpened(null), []);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    useEffect(() => {
        if (!opened) return undefined;
        return () => { if (closeOpenMenu === close) closeOpenMenu = null; };
    }, [opened, close]);

    const open = useCallback((x: number, y: number, returnTo: HTMLElement | null) => {
        if (disabled) return false;
        const list = build.current().filter((item): item is ContextMenuItem => !!item);
        if (!list.length) return false;
        if (closeOpenMenu !== close) closeOpenMenu?.();
        closeOpenMenu = close;
        setOpened({ x, y, items: list, returnTo });
        return true;
    }, [disabled, close]);

    const cancelHold = () => { window.clearTimeout(timer.current); timer.current = undefined; start.current = null; };
    /**
     * An event from outside the element in the page: React passes events up through portals, so a dialog or menu the
     * element opened (rendered elsewhere in the page) would otherwise reach its handlers.
     */
    const outside = (event: { target: EventTarget | null; currentTarget: HTMLElement }) =>
        !(event.target instanceof Node) || !event.currentTarget.contains(event.target);

    const bind: ContextMenuBinding = {
        onContextMenu: event => {
            // The menu key and Shift+F10 also send a context menu event, and Android sends one after a long press:
            // the menu is open already.
            const now = Date.now();
            if (outside(event)) return;
            if (now - keyboardAt.current < 600 || now - pressedAt.current < 1000) { event.preventDefault(); return; }
            if (disabled || keepsNativeMenu(event.target, event.currentTarget)) return;
            if (open(event.clientX, event.clientY, returnPoint(event.currentTarget))) { event.preventDefault(); event.stopPropagation(); cancelHold(); }
        },
        onKeyDown: event => {
            const menuKey = event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);
            if (!menuKey || disabled || outside(event)) return;
            // In a text box the key keeps the browser's own menu (spelling, paste), as a right click there does.
            if (keepsNativeMenu(event.target, event.currentTarget)) return;
            const from = returnPoint(event.currentTarget) ?? event.currentTarget;
            const box = from.getBoundingClientRect();
            if (open(box.left + Math.min(24, box.width / 2), box.bottom, from)) {
                keyboardAt.current = Date.now();
                event.preventDefault();
                event.stopPropagation();
            }
        },
        onPointerDown: event => {
            if (event.pointerType !== 'touch' || disabled || claimed.has(event.nativeEvent) || outside(event)) return;
            if (keepsNativeMenu(event.target, event.currentTarget)) return;
            claimed.add(event.nativeEvent);
            const target = event.currentTarget;
            const at = { x: event.clientX, y: event.clientY };
            start.current = at;
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => {
                timer.current = undefined;
                start.current = null;
                if (open(at.x, at.y, target)) { pressedAt.current = Date.now(); swallowClick.current = true; }
            }, LONG_PRESS_MS);
        },
        onPointerMove: event => {
            if (!start.current) return;
            if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > HOLD_SLOP) cancelHold();
        },
        onPointerUp: cancelHold,
        onPointerCancel: cancelHold,
        onClickCapture: event => {
            // The finger lifting after a long press is not a tap on the element.
            if (swallowClick.current) { swallowClick.current = false; event.preventDefault(); event.stopPropagation(); }
        },
    };

    const menu = opened ? <ContextMenu opened={opened} label={label} onClose={close} /> : null;
    const openAt = useCallback((x: number, y: number, returnTo: HTMLElement | null = null) => open(x, y, returnTo), [open]);
    return { bind, menu, isOpen: opened !== null, openAt, close };
}
