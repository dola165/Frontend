import { useSyncExternalStore } from 'react';

const query = '(max-width: 767px)';
const subscribe = (onChange: () => void) => {
    if (!window.matchMedia) return () => undefined;
    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
};
const snapshot = () => window.matchMedia?.(query).matches ?? false;

/** Mount one schedule surface, so phones never render the desktop drag-and-drop grid. */
export const useMobileSchedule = () => useSyncExternalStore(subscribe, snapshot, () => false);
