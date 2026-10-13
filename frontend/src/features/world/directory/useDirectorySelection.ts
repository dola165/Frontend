import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { reducedMotion } from '../map/canvas/useMapTheme';
import type { MapFocus } from '../stage/stageContext';
import type { PlacedResults } from './mapPoints';
import type { DirectoryState } from './useDirectoryState';

const behavior = () => reducedMotion() ? 'auto' as const : 'smooth' as const;

/** Brings an element into view inside its scrolling panel only (the one marked `data-browse-scroll`), never scrolling the page. */
function scrollWithin(element: Element | null | undefined) {
    const body = element?.closest<HTMLElement>('[data-browse-scroll]');
    if (!element || !body) return;
    const box = body.getBoundingClientRect(), row = element.getBoundingClientRect();
    if (row.top >= box.top && row.bottom <= box.bottom) return;
    body.scrollTo({ top: body.scrollTop + row.top - box.top - (box.height - row.height) / 2, behavior: behavior() });
}

/**
 * Which result is chosen and what the map does about it. One result is chosen at a time and kept in the address
 * (`selected`), so Back and shared links return to it; a pin holding several results lights them all without
 * choosing one. Choosing a result in the Browse area flies the map to its pin, and the camera then stays on it until
 * the person asks to see every pin again; choosing a pin never moves the camera.
 */
export function useDirectorySelection({ state, keys, placed, panel, list }: {
    state: Pick<DirectoryState, 'selected' | 'setSelected'>; /** The keys of the results on screen. */ keys: string[];
    placed: Pick<PlacedResults, 'pinOf' | 'keysOf' | 'points'>;
    /** The Browse area panel while its results show (not folded). */ panel: HTMLElement | null;
    /** The results under the map. */ list: RefObject<HTMLElement | null>;
}) {
    const chosen = state.selected && keys.includes(state.selected) ? state.selected : undefined;
    const chosenPin = chosen ? placed.pinOf.get(chosen) : undefined;
    const [groupPin, setGroupPin] = useState<string>();
    // Flights are numbered within this list and marked with it, so no other list's flight is ever taken for one.
    const mount = useId();
    const flights = useRef(0);
    // A link that arrives with a choice flies to it once its pin exists, like a press would.
    const [request, setRequest] = useState<{ key: string; token: string } | undefined>(() => state.selected ? { key: state.selected, token: `${mount}0` } : undefined);
    const [frame, setFrame] = useState(0);
    const [hoverKey, setHoverKey] = useState<string>();
    const [hoverPin, setHoverPin] = useState<string>();
    const selectedPin = chosenPin ?? (!chosen && groupPin && placed.keysOf.has(groupPin) ? groupPin : undefined);
    // The flight holds only while its result is still the chosen one and on the map.
    const focus: MapFocus | undefined = request && request.key === chosen && chosenPin ? { id: chosenPin, token: request.token } : undefined;
    // After a flight the camera stays near one pin until "Show all", or until new pins frame the map again.
    const pins = placed.points.map(point => point.id).join('|');
    const [leftAt, setLeftAt] = useState<string>();
    const away = Boolean(focus) || leftAt === pins;
    /** Ends a flight; the camera stays where it is, so "Show all" stays on offer. */
    const land = () => { if (focus) setLeftAt(pins); setRequest(undefined); };

    // The chosen row comes into view whenever the panel shows it without a press: a shared link, Back, or the panel
    // opened again. A press brings its own row into view.
    const shown = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (!panel) { shown.current = undefined; return; }
        if (!chosen || shown.current === chosen) return;
        const row = panel.querySelector('[aria-current="true"]');
        if (!row) return;
        shown.current = chosen;
        scrollWithin(row);
    }, [chosen, panel, keys.length]);

    /** After the panel shows the new choice, its first row comes into view inside the panel. */
    const reveal = () => requestAnimationFrame(() => scrollWithin(panel?.querySelector('[aria-current="true"], [data-at-pin]')));
    const choose = (key: string) => {
        shown.current = key;
        if (key !== state.selected) state.setSelected(key);
        setGroupPin(undefined);
        setRequest({ key, token: `${mount}${++flights.current}` });
    };
    const clear = () => {
        if (state.selected) state.setSelected(undefined);
        setGroupPin(undefined);
        land();
    };
    /** A pin pressed on the map: one result is chosen, several are lit together; the camera does not move. */
    const selectPin = (pin?: string) => {
        if (!pin) return clear();
        const at = placed.keysOf.get(pin) ?? [];
        land();
        if (at.length === 1) { shown.current = at[0]; if (at[0] !== state.selected) state.setSelected(at[0]); setGroupPin(undefined); }
        else { if (state.selected) state.setSelected(undefined); setGroupPin(pin); }
        reveal();
    };
    /** Frames every pin again; the choice stays. */
    const showAll = () => { setRequest(undefined); setLeftAt(undefined); setFrame(value => value + 1); };
    /** "Show in list": the first result at the pin, in the list under the map, comes into view and takes focus. */
    const showInList = (pin: string) => {
        selectPin(pin);
        requestAnimationFrame(() => {
            const element = list.current?.querySelector<HTMLElement>('[aria-current="true"]');
            element?.scrollIntoView({ block: 'center', behavior: behavior() });
            (element?.matches('a, button') ? element : element?.querySelector<HTMLElement>('a, button'))?.focus({ preventScroll: true });
        });
    };
    return { chosen, selectedPin, focus, frame, away, hoverKey, setHoverKey, hoverPin, setHoverPin, choose, clear, selectPin, showAll, showInList };
}
