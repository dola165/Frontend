import type { WorldMapPoint } from '../world/map/WorldMap';
import { posterOf, type Job } from './api';
import { clubJobsPath, jobsPath, type JobsSearch } from './query';

/** The listings that pass the column's filters: the same rules the catalogue applies, on what the map holds. */
export function filterListings(jobs: Job[], query: JobsSearch) {
    const text = query.query.toLowerCase();
    const since = query.posted === '7D' ? Date.now() - 7 * 86_400_000 : query.posted === '30D' ? Date.now() - 30 * 86_400_000 : 0;
    return jobs.filter(job => {
        const poster = posterOf(job), direction = job.direction ?? 'HIRING';
        if (query.direction && direction !== query.direction) return false;
        if (query.category && job.category !== query.category) return false;
        if (query.terms && job.engagementType !== query.terms) return false;
        if (query.hours && job.hours !== query.hours) return false;
        if (query.poster && (query.poster === 'clubs') !== (poster.kind === 'CLUB')) return false;
        if (query.city && (job.clubCityName ?? poster.city ?? '').toLowerCase() !== query.city.toLowerCase()) return false;
        if (since && Date.parse(job.createdAt ?? '') < since) return false;
        if (text && ![job.title, job.description, poster.name, job.clubName].some(value => (value ?? '').toLowerCase().includes(text))) return false;
        return true;
    });
}

/** Listings as pins: a club's roles at its ground (crest and count); people's listings counted at their town, never named. */
export function pinsOf(jobs: Job[]): { points: WorldMapPoint[]; placed: number } {
    const pins = new Map<string, WorldMapPoint & { n: number }>();
    let placed = 0;
    for (const job of jobs) {
        if (!job.place) continue;
        placed += 1;
        const poster = posterOf(job);
        const id = poster.kind === 'CLUB' ? `club:${poster.id}` : `area:${(job.clubCityName ?? poster.city ?? '').toLowerCase()}`;
        const pin = pins.get(id);
        if (pin) { pin.n += 1; continue; }
        pins.set(id, poster.kind === 'CLUB'
            ? { id, lat: job.place.lat, lng: job.place.lng, label: poster.name, tone: 'club', crest: poster.avatarUrl, to: clubJobsPath(poster.id), action: 'Open the club’s jobs', n: 1 }
            : { id, lat: job.place.lat, lng: job.place.lng, label: job.clubCityName ?? poster.city ?? 'Listings', tone: 'person', approximate: 'area', to: jobsPath({ city: job.clubCityName ?? poster.city ?? '', poster: 'people' }), action: 'See the listings', n: 1 });
    }
    const points = [...pins.values()].map(({ n, ...pin }) => ({ ...pin, count: n, meta: pin.tone === 'club' ? `${n} open ${n === 1 ? 'role' : 'roles'}` : `${n} ${n === 1 ? 'listing' : 'listings'} by people` }));
    return { points, placed };
}

