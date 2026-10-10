import { useSyncExternalStore } from 'react';

export type SheetSnap = 'peek' | 'half' | 'full';
const PHONE = '(max-width: 899px)';
const subscribe = (notify: () => void) => { const query = window.matchMedia(PHONE); query.addEventListener('change', notify); return () => query.removeEventListener('change', notify); };

/** Phones get the map with a bottom sheet; wider screens get a panel beside or over the map. */
export const usePhoneLayout = () => useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false);
