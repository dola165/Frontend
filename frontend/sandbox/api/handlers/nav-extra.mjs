// Synthetic API: endpoints the app header uses that no domain handler answered yet.
// `/organizations/discovery` is an existing backend endpoint (global search, places); this only fills the sandbox.
import { get } from '../router.mjs';
import * as W from '../world.mjs';

get('/organizations/discovery', ({ query: q }) => {
  const term = (q.get('q') ?? '').trim().toLocaleLowerCase();
  const limit = Math.min(20, Math.max(1, Number(q.get('limit')) || 5));
  const kind = q.get('kind') ?? 'ALL';
  const matches = term ? W.venues.filter(venue => `${venue.name} ${venue.city} ${venue.district}`.toLocaleLowerCase().includes(term)) : [];
  const venues = kind === 'ORGANIZATION' ? [] : matches.slice(0, limit).map(venue => ({
    id: venue.id, name: venue.name, location: `${venue.district}, ${venue.city}`, profileKind: 'VENUE', venueCount: 1,
    fromPrice: venue.hourly, currency: venue.hourly ? 'GEL' : null, bookingMode: venue.hourly ? 'REQUEST' : null,
  }));
  return { organizations: [], venues, moreOrganizations: false, moreVenues: matches.length > limit };
});
