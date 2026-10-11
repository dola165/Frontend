import { createContext, useContext } from 'react';

/**
 * The link between the results and their pins while the map is open. Several results can share a pin (jobs at
 * one club), so results are matched to pins through `pinOf`.
 */
export interface DirectorySelection {
    pinOf: Map<string, string>;
    /** The pin chosen on the map, and the pin under the pointer. */ selectedPin?: string; hoverPin?: string;
    /** A result has the pointer or focus (or lost it). */ hover: (key?: string) => void;
}
export const DirectorySelectionContext = createContext<DirectorySelection | null>(null);
/** The key of the result being rendered, so an item can find its map counterpart. */
export const DirectoryItemKey = createContext<string | null>(null);

/**
 * Links a result to its pin: `current` when its pin is chosen, `highlighted` while the pointer is on its pin,
 * and `onHover` to light the pin while the result has the pointer or focus. Results without a pin get nothing.
 */
export function useMapCounterpart(): { current?: boolean; highlighted?: boolean; onHover?: (active: boolean) => void } {
    const selection = useContext(DirectorySelectionContext);
    const key = useContext(DirectoryItemKey);
    const pin = key === null ? undefined : selection?.pinOf.get(key);
    if (!selection || key === null || !pin) return {};
    return { current: selection.selectedPin === pin, highlighted: selection.hoverPin === pin, onHover: active => selection.hover(active ? key : undefined) };
}

/** The same link as element props, for a result that is not a list row (a card). */
export function counterpartProps({ current, highlighted, onHover }: ReturnType<typeof useMapCounterpart>) {
    return {
        'aria-current': current || undefined, 'data-highlighted': highlighted || undefined,
        onMouseEnter: onHover && (() => onHover(true)), onMouseLeave: onHover && (() => onHover(false)),
        onFocus: onHover && (() => onHover(true)), onBlur: onHover && (() => onHover(false)),
    };
}
