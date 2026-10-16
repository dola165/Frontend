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

/**
 * Listings as pins: a club's roles at its ground (crest and count); people's listings counted at their town, never
 * named. `members` says which listings each pin holds; a pin with one opens it, a pin with several opens their list
 * (with the column's filters kept).
 */
export function pinsOf(jobs: Job[], query?: Partial<JobsSearch>): { points: WorldMapPoint[]; placed: number; members: Map<string, Job[]> } {
    const members = new Map<string, Job[]>();
    for (const job of jobs) {
        if (!job.place) continue;
        const poster = posterOf(job);
        const id = poster.kind === 'CLUB' ? `club:${poster.id}` : `area:${(job.clubCityName ?? poster.city ?? '').toLowerCase()}`;
        members.set(id, [...(members.get(id) ?? []), job]);
    }
    const kept = { ...query, page: 0, job: undefined };
    const points = [...members.entries()].map(([id, held]): WorldMapPoint => {
        const job = held[0], poster = posterOf(job), n = held.length, town = job.clubCityName ?? poster.city ?? '';
        const base = { id, lat: job.place!.lat, lng: job.place!.lng, count: n };
        const one = n === 1 ? { to: `/jobs/${job.id}`, action: 'Open the listing' } : null;
        return poster.kind === 'CLUB'
            ? { ...base, label: poster.name, tone: 'club', crest: poster.avatarUrl, meta: n === 1 ? job.title : `${n} open roles`, ...(one ?? { to: clubJobsPath(poster.id, { ...kept, clubId: undefined }), action: 'Open the club’s jobs' }) }
            : { ...base, label: town || 'Listings', tone: 'person', approximate: 'area', meta: n === 1 ? job.title : `${n} listings by people`, ...(one ?? { to: jobsPath({ ...kept, city: town, poster: 'people' }), action: 'See the listings' }) };
    });
    return { points, placed: [...members.values()].reduce((sum, held) => sum + held.length, 0), members };
}
