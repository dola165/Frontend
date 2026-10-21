import { useSearchParams } from 'react-router-dom';
import { useMediaQuery } from '../useMediaQuery';

const REMEMBERED = 'gk-world-map';
export const PHONE = '(max-width: 760px)';

/**
 * Whether a tab's map is open: the address (`map=open|closed`) first, then an older link's `view` (the list and
 * map views it replaced), then what this browser chose last, and otherwise open on wide screens, folded on phones.
 */
export function isMapOpen({ param, legacyView, remembered, phone }: { param: string | null; legacyView: string | null; remembered: string | null; phone: boolean }) {
    if (param === 'open' || param === 'closed') return param === 'open';
    if (legacyView === 'split' || legacyView === 'map') return true;
    if (legacyView === 'list') return false;
    if (remembered === 'open' || remembered === 'closed') return remembered === 'open';
    return !phone;
}

const read = () => { try { return localStorage.getItem(REMEMBERED); } catch { return null; } };

/** The map's fold on every World tab: kept in the address and remembered for the next tab and visit. */
export function useMapFold() {
    const [params, setParams] = useSearchParams();
    const phone = useMediaQuery(PHONE);
    const open = isMapOpen({ param: params.get('map'), legacyView: params.get('view'), remembered: read(), phone });
    const toggle = () => {
        const next = open ? 'closed' : 'open';
        try { localStorage.setItem(REMEMBERED, next); } catch { /* remembered for this address only */ }
        setParams(current => {
            const copy = new URLSearchParams(current);
            copy.set('map', next);
            copy.delete('view');
            return copy;
        }, { replace: true, preventScrollReset: true });
    };
    return { open, toggle };
}
