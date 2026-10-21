import { useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { fetchVenue, fetchVenues, type Venue } from '../../../venues/api';

/**
 * The grounds the Draw room offers: a search by name (after a short pause in typing), with the chosen ground kept among
 * them, looked up by its id when a kept draft names one the search did not bring, so the picker never reads "To be
 * agreed" while a ground is set. A chosen ground that is no longer published says so.
 */
export function useVenueChoice(value: number | null, query: string) {
    const [venues, setVenues] = useState<Venue[]>([]);
    const [chosen, setChosen] = useState<Venue | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        const abort = new AbortController();
        const timer = setTimeout(() => void fetchVenues({ q: query, size: 24 }, abort.signal).then(page => setVenues(page.content)).catch(() => undefined), 200);
        return () => { clearTimeout(timer); abort.abort(); };
    }, [query]);
    const known = value == null || chosen?.id === value || venues.some(venue => venue.id === value);
    useEffect(() => {
        if (known) return;
        const abort = new AbortController();
        fetchVenue(value!, abort.signal).then(setChosen, cause => {
            if (!abort.signal.aborted) setError(extractApiErrorMessage(cause, 'The chosen ground is no longer published. Choose another, or leave it to be agreed.'));
        });
        return () => abort.abort();
    }, [known, value]);
    /** Keeps the ground picked from the search, so a later search does not lose it. */
    const choose = (id: number | null) => { setChosen(venues.find(venue => venue.id === id) ?? null); setError(''); };
    const options = chosen && chosen.id === value && !venues.some(venue => venue.id === chosen.id) ? [chosen, ...venues] : venues;
    return { options, error, choose };
}
