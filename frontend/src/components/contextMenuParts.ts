import type { LucideIcon } from 'lucide-react';

/** One thing a menu offers. A disabled one stays in the list and says why (`reason`), so nobody wonders where it went. */
export interface ContextMenuItem {
    key: string;
    label: string;
    icon?: LucideIcon;
    /** Deleting, removing, leaving: said in the danger colour. */
    danger?: boolean;
    disabled?: boolean;
    /** Why it cannot be done now, under its label. */
    reason?: string;
    /** A thin line before it, starting a new group. */
    separated?: boolean;
    onSelect: () => void;
}

/** What a menu is built from: anything falsy leaves an item out (`can && { … }`). */
export type ContextMenuItems = (ContextMenuItem | false | null | undefined | '' | 0)[];

/** How long a finger holds still before the menu opens (touch screens have no right click). */
export const LONG_PRESS_MS = 450;
/** Room kept between the menu and the edge of the screen. */
const EDGE = 8;

/**
 * Where a menu of this size goes for a point: at the point, opening right and down; to the left of the point or above
 * it when there is no room; never past an edge, and no taller than the screen allows (`maxHeight`, then it scrolls).
 */
export function placeMenu(point: { x: number; y: number }, size: { width: number; height: number }, screen: { width: number; height: number }) {
    const maxHeight = Math.max(0, screen.height - EDGE * 2);
    const height = Math.min(size.height, maxHeight);
    let x = point.x, y = point.y;
    if (x + size.width > screen.width - EDGE) x = point.x - size.width;
    if (y + height > screen.height - EDGE) y = point.y - height;
    x = Math.min(Math.max(EDGE, x), Math.max(EDGE, screen.width - size.width - EDGE));
    y = Math.min(Math.max(EDGE, y), Math.max(EDGE, screen.height - height - EDGE));
    return { x, y, maxHeight };
}

/**
 * Whether a right click here keeps the browser's own menu: in a text box (spelling, paste), on a link inside the
 * element (open in a new tab), or over text someone has selected in it (copy what they chose).
 */
export function keepsNativeMenu(target: EventTarget | null, element: Element) {
    if (!(target instanceof Element)) return false;
    if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return true;
    const link = target.closest('a[href]');
    if (link && link !== element && element.contains(link)) return true;
    const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
        const anchor = selection.anchorNode;
        if (anchor && element.contains(anchor)) return true;
    }
    return false;
}

/** A menu while it is open: where, what it holds, and where focus goes back to. */
export interface OpenedMenu { x: number; y: number; items: ContextMenuItem[]; returnTo: HTMLElement | null }
