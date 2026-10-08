import { useEffect, useState } from 'react';
import { fetchVenueBookings, type Booking } from './api';
import { addDays, zonedInstant } from './utils';
import { extractApiErrorMessage } from '../../utils/apiError';

/** Ranges are split below the API's 93-day limit; never show a partial inbox as complete. */
export function useOwnerBookings(id: number, timezone: string, date: string, days: number, enabled = true) {
  const [state, setState] = useState<{key: string; bookings: Booking[]; error: string; checkedAt: number}>({ key: '', bookings: [], error: '', checkedAt: 0 });
  const [revision, setRevision] = useState(0), [tick, setTick] = useState(() => Date.now());
  const key = `${id}/${timezone}/${date}/${days}`;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    async function load() {
      try {
        const pages = [];
        for (let offset = 0; offset < days; offset += 90) {
          pages.push(fetchVenueBookings(id, zonedInstant(addDays(date, offset), '00:00', timezone), zonedInstant(addDays(date, Math.min(days, offset + 90)), '00:00', timezone), controller.signal));
        }
        const data = await Promise.all(pages);
        if (!controller.signal.aborted) setState({ key, bookings: [...new Map(data.flat().map(b => [b.id, b])).values()].sort((a,b) => Date.parse(a.startsAt)-Date.parse(b.startsAt)), error: '', checkedAt: Date.now() });
      } catch (error) {
        if (!controller.signal.aborted) setState({ key, bookings: [], error: extractApiErrorMessage(error, 'The calendar could not be refreshed. Try again before making a decision.'), checkedAt: 0 });
      }
    }
    void load();
    return () => controller.abort();
  }, [id, timezone, date, days, key, enabled, revision]);
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { if (document.visibilityState !== 'hidden') { setTick(Date.now()); setRevision(r => r + 1); } };
    const timer = window.setInterval(refresh, 5_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [enabled]);
  return { bookings: state.key === key ? state.bookings : [], error: state.key === key ? state.error : '', loading: state.key !== key, checkedAt: state.checkedAt, now: Math.max(tick, state.checkedAt), refresh: () => { setTick(Date.now()); setRevision(r => r + 1); } };
}
