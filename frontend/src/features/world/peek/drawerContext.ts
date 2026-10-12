import { createContext, useContext } from 'react';

/**
 * Where a thing is shown and how it closes: a drawer over the page (`side` right or left), or the pane beside the list
 * under the map. In the pane, who is behind the thing stacks over it, and `back` returns to the thing.
 */
export interface DrawerPlace { side: 'right' | 'left'; close: () => void; place: 'drawer' | 'pane'; back?: () => void }
export const DrawerPlaceContext = createContext<DrawerPlace>({ side: 'right', close: () => undefined, place: 'drawer' });
export const useDrawerPlace = () => useContext(DrawerPlaceContext);

/**
 * Where a press opens a thing: beside the list it was pressed in (`pane`, inside the list column under the map), or
 * in a drawer over the page (everywhere else: the map's panel, a docked strip, the overview, a shared link).
 */
export const PeekPlaceContext = createContext<'pane' | 'overlay'>('overlay');

/** Keys typed into a field are the field's own: Escape there never closes the pane or a drawer (a draft keeps its text). */
export const TYPING = 'input:not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit]), textarea, select, [contenteditable="true"]';
export const typingIn = (element: Element | null) => Boolean(element?.closest(TYPING));
