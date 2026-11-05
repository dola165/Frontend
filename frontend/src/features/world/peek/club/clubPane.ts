import { apiClient } from '../../../../api/axiosConfig';
import type { ClubProfile as DirectoryClub } from '../../../../components/discovery/clubDirectoryTypes';
import type { AuthSessionId } from '../../../../utils/authStorage';
import { fetchClubJobs, type ClubJob } from '../../../clubs/api';
import type { PublicFacility } from '../../../clubs/ClubPlaceCard';
import { placeType } from '../../../clubs/clubPlaceTypes';
import { safePublicUrl } from '../../../clubs/presentation';
import type { ClubProfile as FullClub } from '../../../clubs/profile/types';
import type { PublicSquad, PublicStaff } from '../../../clubs/publicJourney';
import { staffAreas } from '../../../clubs/staffAreas';
import type { HistoryMatch } from '../../../matchHistory/api';
import { searchTryouts, type TryoutPosting } from '../../../tryouts/api';
import { detached, shared } from '../../cache';
import { historyOf } from '../../front/coach/coachMatches';
import { publicProgrammes } from '../../cards/programmes';
import { rememberMatches } from '../../scoreboard/matchRegistry';

/** The club as `GET /clubs/:id` returns it: the directory's fields, and the profile's that the pane shows too. */
export type PaneClub = DirectoryClub & Partial<Pick<FullClub, 'bannerUrl' | 'foundedYear' | 'level' | 'honours' | 'websiteUrl' | 'instagramUrl' | 'email'>>;

/** Everything the pane shows beyond the club's head, from what the club's public page shows. */
export interface ClubExtras {
    squads: PublicSquad[]; coaches: PublicStaff[]; management: PublicStaff[]; venues: PublicFacility[]; jobs: ClubJob[];
    /** The first open trials and how many are open in all. */ trials: TryoutPosting[]; trialCount: number;
    /** The next matches and the latest results (up to twenty), for signed-in people. */ next: HistoryMatch[]; results: HistoryMatch[];
    /** Some part could not load (the rest show; trying again asks only for what failed). */ failed: boolean;
}

const read = <T>(path: string) => apiClient.get<T>(path, { signal: detached() }).then(response => response.data);
const settled = <T>(result: PromiseSettledResult<T>, empty: T) => result.status === 'fulfilled' ? result.value : empty;

/**
 * The club's parts, in one go so the pane paints once: teams, coaches and management (as its staff tab splits them),
 * venues where it plays (not its supporting facilities), open jobs, open trials, and for signed-in people the next
 * ten matches and the latest results. Each request is kept for a minute; one that fails leaves its part out.
 */
export async function loadClubExtras(id: number, sessionId: AuthSessionId, signedIn: boolean): Promise<ClubExtras> {
    const parts = await Promise.allSettled([
        shared(`club-squads:${id}`, () => read<PublicSquad[]>(`/clubs/${id}/squads`)),
        shared(`club-staff:${id}`, () => read<PublicStaff[]>(`/clubs/${id}/staff-directory`)),
        shared(`club-places:${id}`, () => read<PublicFacility[]>(`/clubs/${id}/facilities`)),
        shared(`club-jobs:${id}`, () => fetchClubJobs(id, detached())),
        shared(`club-trials:${id}`, () => searchTryouts({ clubId: id, status: 'OPEN', size: 10 }, detached())),
        signedIn ? historyOf(sessionId, { clubId: id }, 'UPCOMING', 10) : Promise.resolve([]),
        signedIn ? historyOf(sessionId, { clubId: id }, 'HISTORY', 20) : Promise.resolve([]),
    ]);
    const [squads, staff, places, jobs, next, history] = [settled(parts[0], []), settled(parts[1], []), settled(parts[2], []), settled(parts[3], []), settled(parts[5], []), settled(parts[6], [])];
    const trials = settled(parts[4], { items: [], total: 0, page: 0, size: 10, hasMore: false });
    const now = Date.now();
    // A result is a match that is over (one with no end time counts as over three hours after kick-off), not called off.
    const over = (match: HistoryMatch) => match.startsAt != null && (match.endsAt ? Date.parse(match.endsAt) : Date.parse(match.startsAt) + 3 * 3_600_000) <= now;
    const results = history.filter(match => over(match) && match.fixtureStatus?.toUpperCase() !== 'CANCELLED');
    // A match opened from the pane shows at once what the pane showed (a club fixture has no detail of its own).
    rememberMatches(sessionId, [...next, ...results]);
    const coaches = staff.filter(person => staffAreas(person).includes('coaching'));
    // Management is who leads and runs the club: its owner and administrators, and staff with a management, secretary
    // or finance responsibility. Not everyone the staff tab files under club operations (anyone else unsorted lands there).
    const leading = (person: PublicStaff) => ['OWNER', 'CLUB_ADMIN'].includes(person.role) ? 0 : 1;
    const manages = (person: PublicStaff) => leading(person) === 0 || person.responsibilities.some(item => item.specialisations.some(code => /MANAGER|SECRETARY|FINANCE|DIRECTOR/.test(code) || code === 'TRAVEL_COORDINATOR'));
    const management = staff.filter(person => !coaches.includes(person) && manages(person)).sort((a, b) => leading(a) - leading(b));
    return {
        squads, coaches, management, venues: places.filter(place => placeType(place) !== 'FACILITY'), jobs: jobs.filter(job => job.status !== 'CLOSED'),
        trials: trials.items, trialCount: Math.max(trials.total, trials.items.length), next, results,
        failed: parts.some(part => part.status === 'rejected'),
    };
}

/**
 * A page of the club's (`teams`, `people`, …) with its own filters, keeping the child a parent is searching for, so
 * a link lands on the club's Teams & training as if chosen there.
 */
export function clubTab(id: number, tab?: string, extra: Record<string, string> = {}, player?: string | null) {
    const params = new URLSearchParams(tab ? { tab, ...extra } : extra);
    if (player) params.set('player', player);
    const query = params.toString();
    return `/clubs/${id}${query ? `?${query}` : ''}`;
}

/** The parts of a club the pane shows on their own, each a tab after its overview. */
export type ClubPart = 'teams' | 'coaches' | 'management' | 'matches' | 'venues' | 'trials' | 'jobs' | 'honours' | 'contact';

/** The club's public ways to reach it: its website and Instagram (only when safe to open) and its email. */
export const contactWays = (club: PaneClub) => ({ website: safePublicUrl(club.websiteUrl), instagram: safePublicUrl(club.instagramUrl), email: club.email || null });

/** The parts of the club that have something in them, in the club page's order. */
export function clubParts(club: PaneClub, extras: ClubExtras): { id: ClubPart; label: string }[] {
    const ways = contactWays(club);
    return [
        (extras.squads.length > 0 || publicProgrammes(club.presentation).length > 0) && { id: 'teams', label: 'Teams & training' },
        extras.coaches.length > 0 && { id: 'coaches', label: 'Coaches' },
        extras.management.length > 0 && { id: 'management', label: 'Management' },
        (extras.next.length > 0 || extras.results.length > 0) && { id: 'matches', label: 'Matches' },
        extras.venues.length > 0 && { id: 'venues', label: 'Venues' },
        extras.trials.length > 0 && { id: 'trials', label: 'Trials' },
        extras.jobs.length > 0 && { id: 'jobs', label: 'Jobs & volunteering' },
        Boolean(club.honours?.length) && { id: 'honours', label: 'Honours' },
        Boolean(ways.website || ways.instagram || ways.email || club.addressText) && { id: 'contact', label: 'Contact' },
    ].filter((part): part is { id: ClubPart; label: string } => Boolean(part));
}

/** All of a part on the club's own page (its tab, with the same filters); matches and trials have no tab there. */
export function clubPartPage(id: number, part: ClubPart, player?: string | null) {
    const pages: Partial<Record<ClubPart, [string, Record<string, string>?]>> = {
        teams: ['teams'], coaches: ['people', { staff: 'coaching' }], management: ['people', { staff: 'operations' }], venues: ['facilities'],
        jobs: ['business', { opportunity: 'jobs' }], honours: ['honours'], contact: ['contact'],
    };
    const page = pages[part];
    return page && clubTab(id, page[0], page[1], player);
}

/** The teams one of the club's staff is responsible for, from what they published (a name can be missing). */
export function squadsOf(person: PublicStaff): { id: number; name: string }[] {
    const teams = new Map<number, string>();
    person.responsibilities.forEach(item => {
        const ids = item.squadIds ?? (item.squadId == null ? [] : [item.squadId]);
        const names = item.squadNames ?? (item.squadName ? [item.squadName] : []);
        ids.forEach((id, index) => { if (!teams.get(id)) teams.set(id, names[index] ?? ''); });
    });
    return [...teams].map(([id, name]) => ({ id, name }));
}
