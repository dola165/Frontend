import { createContext, useContext } from 'react';

/** Which drawer a thing is shown in and how it closes. */
export interface DrawerPlace { side: 'right' | 'left'; close: () => void }
export const DrawerPlaceContext = createContext<DrawerPlace>({ side: 'right', close: () => undefined });
export const useDrawerPlace = () => useContext(DrawerPlaceContext);
