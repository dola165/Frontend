import { useSyncExternalStore } from 'react';

export type SheetSnap = 'peek' | 'half' | 'full';
const PHONE = '(max-width: 899px)';
const media = () => (typeof window.matchMedia === 'function' ? window.matchMedia(PHONE) : null);
const subscribe = (notify: () => void) => { const query = media(); query?.addEventListener('change', notify); return () => query?.removeEventListener('change', notify); };

/** Phones get the map with a bottom sheet; wider screens get a panel beside or over the map. */
export const usePhoneLayout = () => useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false);
