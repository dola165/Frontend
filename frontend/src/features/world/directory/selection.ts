import { createContext, useContext } from 'react';

/** Which result is selected on the map beside the list, and which one the pointer is on. */
export interface DirectorySelection { selectedId?: string; hover: (id?: string) => void }
export const DirectorySelectionContext = createContext<DirectorySelection | null>(null);
/** The key of the result being rendered, so an item can find its map counterpart. */
export const DirectoryItemKey = createContext<string | null>(null);

/**
 * Links a result to its pin when a map is shown beside the list: `current` when the pin is
 * selected, and `onHover` to highlight the pin while the result has the pointer or focus.
 */
export function useMapCounterpart(): { current?: boolean; onHover?: (active: boolean) => void } {
    const selection = useContext(DirectorySelectionContext);
    const key = useContext(DirectoryItemKey);
    if (!selection || key === null) return {};
    return { current: selection.selectedId === key, onHover: active => selection.hover(active ? key : undefined) };
}

/** The same link as element props, for a result that is not a list row (a card). */
export function counterpartProps({ current, onHover }: ReturnType<typeof useMapCounterpart>) {
    return {
        'aria-current': current || undefined,
        onMouseEnter: onHover && (() => onHover(true)), onMouseLeave: onHover && (() => onHover(false)),
        onFocus: onHover && (() => onHover(true)), onBlur: onHover && (() => onHover(false)),
    };
}
