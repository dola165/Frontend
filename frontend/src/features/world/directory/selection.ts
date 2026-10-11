import { createContext, useContext } from 'react';

/**
 * The link between the results and their pins while the map is open. Several results can share a pin (jobs at
 * one club), so results are matched to pins through `pinOf`. One result at a time can be chosen in the Browse area.
 */
export interface DirectorySelection {
    pinOf: Map<string, string>;
    /** The pin chosen on the map (or the chosen result's pin), and the pin under the pointer. */ selectedPin?: string; hoverPin?: string;
    /** A result has the pointer or focus (or lost it). */ hover: (key?: string) => void;
    /** The one chosen result, by key. */ chosen?: string;
    /** Chooses a result: the map flies to its pin. */ choose: (key: string) => void;
    /** Ends the choice; the camera stays where it is. */ clear: () => void;
    /** The list puts its results on the map (false for referees, for example). */ mappable: boolean;
    /** Places are still being looked up, so a result without a pin may get one. */ placing?: boolean;
    /** Some places could not be looked up, so a result without a pin may have a place after all. */ incomplete: boolean;
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

/**
 * A Browse area line's part in the choice: whether it is the chosen result, whether it shares the chosen pin
 * (`atPin`), whether its pin has the pointer, whether it is on the map at all, and how to choose it.
 */
export function useBrowseChoice() {
    const selection = useContext(DirectorySelectionContext);
    const key = useContext(DirectoryItemKey);
    if (!selection || key === null) return null;
    const pin = selection.pinOf.get(key);
    const chosen = selection.chosen === key;
    return {
        chosen, atPin: !chosen && pin !== undefined && selection.selectedPin === pin,
        highlighted: pin !== undefined && selection.hoverPin === pin,
        placed: pin !== undefined, mappable: selection.mappable, placing: Boolean(selection.placing), incomplete: selection.incomplete,
        choose: () => selection.choose(key), hover: (active: boolean) => selection.hover(active ? key : undefined),
    };
}
