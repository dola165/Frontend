import { useAuth } from '../../../context/AuthContext';
import type { MapPageResult } from '../../../api/map';
import { eventSearch, type EventItem } from '../../requests/api';
import { browseCompetitions } from '../../competitions/api';
import { fetchOpenJobDirectory } from '../../clubs/api';
import { searchTryouts } from '../../tryouts/api';
import { getMatchHistory } from '../../matchHistory/api';
import { searchOpportunities } from '../../admissions/api';
import { fetchCampaigns } from '../../campaigns/api';
import { fetchClubDirectory, fetchMatchListings, fetchPeople, fetchReferees } from '../api';
import { isoDay, isoDayOf } from '../format';
import { ageOn, useWorldChild } from '../players';
import { useWorldData, type WorldData } from '../useWorldData';
import type { WorldArea } from '../useWorldArea';
import { useWorldSession } from '../worldSession';

/** Published matches and competitions in the area over the next ten days, soonest first. Training is not a fixture; trials have their own tile. */
export function useComingUp(area: WorldArea) {
    const { sessionId } = useAuth();
    const until = isoDay(9);
    const events = useWorldData(area.ready ? `coming-up:${area.city}:${isoDay(0)}:${sessionId}` : null,
        signal => eventSearch({ q: '', location: area.city, activity: 'ALL', from: isoDay(0), to: until, page: 0, size: 60 }, sessionId, signal));
    const items = (events.data?.items ?? [])
        .filter((item): item is EventItem & { startsAt: string } => item.kind !== 'SESSION' && item.kind !== 'TRYOUT' && item.activity !== 'TRAINING' && Boolean(item.startsAt) && isoDayOf(item.startsAt!) >= isoDay(0))
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return { ...events, items, all: `/world/matches?tab=events&location=${encodeURIComponent(area.city)}&from=${isoDay(0)}&to=${until}` };
}

/** Teams near the area looking for an opponent (the match exchange), soonest first. */
export function useOpenMatches(area: WorldArea) {
    const { status } = useAuth();
    return useWorldData(status === 'authenticated' && area.ready ? `open-matches:${area.city}` : null, signal => {
        const params = new URLSearchParams();
        if (area.centre) { params.set('lat', String(area.centre.lat)); params.set('lng', String(area.centre.lng)); params.set('radiusKm', '50'); }
        return fetchMatchListings(params, signal);
    });
}

/** Competitions taking entries now, soonest first. */
export const useOpenCompetitions = () =>
    useWorldData('open-competitions', signal => browseCompetitions(new URLSearchParams({ registration: 'OPEN', page: '0', size: '6' }), signal));

/** Open jobs and volunteering at clubs. */
export function useJobs(area: WorldArea) {
    return useWorldData(area.ready ? `front-jobs:${area.city}` : null, signal => fetchOpenJobDirectory(signal));
}

/** Coaches, referees and specialists in the area, from outside the person's own club. */
export function usePeopleNearby(area: WorldArea) {
    const { status, sessionId, user } = useAuth();
    const { membership } = useWorldSession();
    const ownClub = membership?.clubId ? Number(membership.clubId) : null;
    const people = useWorldData(status === 'authenticated' && area.ready ? `people-to-know:${area.city}:${sessionId}` : null,
        signal => fetchPeople({ city: area.city, size: 12 }, sessionId, signal));
    const items = (people.data?.searchOnly ? [] : people.data?.items ?? []).filter(person => person.id !== user?.id && person.clubId !== ownClub && person.role !== 'PLAYER');
    return { ...people, items, signedIn: status === 'authenticated', searchOnly: Boolean(people.data?.searchOnly) };
}

/**
 * Clubs in the area, nearest first (distance from the map search around the area's centre), without the
 * person's own club. For a parent searching for a child, only clubs with a programme for the child's age.
 */
export function useNearbyClubs(area: WorldArea, markers: WorldData<MapPageResult>) {
    const { membership } = useWorldSession();
    const { child } = useWorldChild();
    const age = ageOn(child?.dateOfBirth);
    const ownClub = membership?.clubId ? Number(membership.clubId) : null;
    // Wait for the person's club so it can be left out without loading the list twice.
    const clubs = useWorldData(area.ready && membership !== undefined ? `near-clubs:${area.city}:${ownClub}:${age ?? ''}` : null, signal => {
        const params = new URLSearchParams({ city: area.city, sort: 'MEMBER_COUNT', page: '0', size: '12' });
        // Backend needed: `age` keeps clubs with a published programme for that age (see clubSources).
        if (age != null) params.set('age', String(age));
        return fetchClubDirectory(params, signal);
    });
    const distance = new Map((markers.data?.content ?? []).filter(marker => marker.entityType === 'CLUB').map(marker => [marker.clubId ?? marker.entityId, marker.distanceKm]));
    const far = Number.POSITIVE_INFINITY;
    const items = (clubs.data?.content ?? []).filter(club => club.id !== ownClub).sort((a, b) => (distance.get(a.id) ?? far) - (distance.get(b.id) ?? far));
    return { ...clubs, items, distance, total: clubs.data?.totalElements ?? items.length };
}

/** Pitches and venues to hire around the area, nearest first, from the same map search. */
export function useNearbyVenues(markers: WorldData<MapPageResult>) {
    const items = (markers.data?.content ?? []).filter(marker => marker.entityType !== 'CLUB').sort((a, b) => a.distanceKm - b.distanceKm);
    return { ...markers, items };
}

/** Referees who take matches, as the Officials directory lists them. */
export const useReferees = () => useWorldData('front-referees', signal => fetchReferees({ page: 0 }, signal));

/** The friendlies this person is arranging through the match exchange. */
export function useArrangements() {
    const { status } = useAuth();
    return useWorldData(status === 'authenticated' ? 'front-arrangements' : null, signal => fetchMatchListings(new URLSearchParams({ mine: 'true' }), signal));
}

/** Recently recorded results, newest first. */
export function useResults() {
    const { sessionId } = useAuth();
    return useWorldData(`front-results:${sessionId}`, signal => getMatchHistory(new URLSearchParams({ period: 'HISTORY', page: '0', size: '8' }).toString(), signal, sessionId));
}

/** Open trials, soonest first. */
export const useTrials = () => useWorldData('front-trials', signal => searchTryouts({ status: 'OPEN', page: 0, size: 8 }, signal));

/** Specialists in the area: physios, fitness and nutrition, psychology, video analysis. */
export function useSpecialists(area: WorldArea) {
    const { status, sessionId } = useAuth();
    return useWorldData(status === 'authenticated' && area.ready ? `front-specialists:${area.city}:${sessionId}` : null,
        signal => fetchPeople({ city: area.city, role: 'SPECIALIST', size: 8 }, sessionId, signal));
}

/** Academies in the area, by size. */
export function useAcademies(area: WorldArea) {
    return useWorldData(area.ready ? `front-academies:${area.city}` : null,
        signal => fetchClubDirectory(new URLSearchParams({ city: area.city, type: 'ACADEMY', sort: 'MEMBER_COUNT', page: '0', size: '8' }), signal));
}

/** Arranged matches near the area still looking for a referee. */
export function useRefereeNeeded(area: WorldArea) {
    const matches = useOpenMatches(area);
    const items = (matches.data?.items ?? []).filter(match => match.referee_required && match.referee_status === 'NEEDED')
        .sort((a, b) => Date.parse(a.starts_at_iso) - Date.parse(b.starts_at_iso));
    return { ...matches, items };
}

/** Leagues and cups being played now. */
export const useLiveCompetitions = () =>
    useWorldData('live-competitions', signal => browseCompetitions(new URLSearchParams({ status: 'ACTIVE', page: '0', size: '6' }), signal));

/** Clubs in the area with open trials or open to applications. */
export function useOpenClubs(area: WorldArea) {
    return useWorldData(area.ready ? `open-clubs:${area.city}` : null, signal => {
        const params = new URLSearchParams({ city: area.city, sort: 'MEMBER_COUNT', page: '0', size: '8' });
        params.append('joinPolicy', 'OPEN_TRIAL'); params.append('joinPolicy', 'APPLICATION_REQUIRED');
        return fetchClubDirectory(params, signal);
    });
}

/** Training groups with places, for the chosen child's birth year and category when there is one. */
export function useGroups(area: WorldArea) {
    const { child } = useWorldChild();
    const birthYear = child?.dateOfBirth ? Number(child.dateOfBirth.slice(0, 4)) : undefined;
    return useWorldData(area.ready ? `front-groups:${area.city}:${child?.id ?? ''}` : null,
        signal => searchOpportunities({ acceptingOnly: true, city: [area.city], birthYear, gender: (child?.gender || undefined) as 'MALE' | 'FEMALE' | undefined, page: 0, size: 8 }, signal));
}

/** Fundraisers clubs in the area are running. */
export function useCampaigns(area: WorldArea) {
    return useWorldData(area.ready ? `front-campaigns:${area.city}` : null, signal => fetchCampaigns({ city: area.city, page: 0, size: 8, sort: 'ENDING' }, signal));
}
