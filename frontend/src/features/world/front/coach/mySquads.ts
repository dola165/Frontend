import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { spaces, type SquadSpace } from '../../../squadCommunication/api';
import { clubSquads } from '../../../matchExchange/arrange/api';
import { ageGroupOf, defaultFormat } from '../../../matchExchange/arrange/matchPlan';
import type { PublicSquad } from '../../../clubs/publicJourney';
import { useWorldData } from '../../useWorldData';
import { useWorldSession } from '../../worldSession';
import type { WorldRole } from '../roles';
import { shared } from './cache';

/** A squad the coach works with, with what World filters by: age group, gender and the format it plays. */
export interface MySquad { id: number; clubId: number; name: string; ageGroup: string; gender: 'MALE' | 'FEMALE' | 'MIXED' | null; format: string; sideSize: number }

/** Youngest first: U8 before U14 before seniors and veterans. */
const ageRank = (ageGroup: string) => { const under = /^U(\d+)/.exec(ageGroup); return under ? Number(under[1]) : ageGroup === 'SENIOR' ? 100 : 200; };

/** "9_A_SIDE" → 9. */
export const sideSizeOf = (format: string) => Number(format.split('_')[0]) || 11;
const genderOf = (value?: string | null): MySquad['gender'] => value === 'MALE' || value === 'FEMALE' || value === 'MIXED' ? value : null;

/**
 * Squads from the squad spaces the person manages (or from a whole club's squads), with the gender each club
 * publishes. The format follows the age group (the backend keeps no squad format).
 */
export function squadsFrom(managed: { id: number; clubId: number; name: string; category: string }[], published: PublicSquad[]): MySquad[] {
    const gender = new Map(published.map(squad => [squad.id, genderOf(squad.gender)]));
    return managed.map(squad => {
        const ageGroup = ageGroupOf(squad.category), format = defaultFormat(ageGroup);
        return { id: squad.id, clubId: squad.clubId, name: squad.name, ageGroup, gender: gender.get(squad.id) ?? null, format, sideSize: sideSizeOf(format) };
    }).sort((a, b) => ageRank(a.ageGroup) - ageRank(b.ageGroup) || a.name.localeCompare(b.name));
}

/** Whether a competition's eligibility category admits a squad of this gender: Girls only girls, Boys only boys. */
export function fitsGender(category: string | null | undefined, gender: MySquad['gender']) {
    const value = (category ?? '').toLowerCase();
    if (/girl|women|female/.test(value)) return gender === 'FEMALE' || gender === 'MIXED';
    if (/boy|\bmen\b|male/.test(value)) return gender === 'MALE' || gender === 'MIXED';
    return true;
}

/** The squads in focus: the one named in the URL when it is among them, otherwise all of them. */
export function focusFrom(param: string | null, squads: MySquad[]) {
    const chosen = squads.find(squad => String(squad.id) === param);
    return chosen ? [chosen] : squads;
}

/** Roles that see the whole club's squads rather than only the ones they coach. */
const CLUB_SCOPE = new Set<WorldRole>(['academy-director', 'club-admin']);
export const COACHING_ROLES = new Set<WorldRole>(['head-coach', 'assistant-coach', 'goalkeeper-coach', 'fitness-coach', 'analyst', 'team-manager', 'academy-director']);

export type SquadFocus = {
    status: 'signed-out' | 'loading' | 'error' | 'none' | 'ready';
    /** The whole club's squads (an academy director) or only those the person coaches. */ scope: 'club' | 'coached';
    /** Every squad in scope, and the ones in focus (`?for=`). */ squads: MySquad[]; focus: MySquad[];
    ages: string[]; formats: string[]; clubIds: number[]; error: string; retry: () => void;
};

/**
 * The squads a coaching role's World is for (none for other roles, without asking). A coach sees the squads they manage; an academy director the
 * whole club's. `?for=<squadId>` narrows it to one squad and is kept in the URL.
 */
export function useSquadFocus(role: WorldRole): SquadFocus {
    const { status, sessionId } = useAuth();
    const { membership } = useWorldSession();
    const [params] = useSearchParams();
    const club = CLUB_SCOPE.has(role) ? membership?.clubId ?? null : null;
    const signedIn = status === 'authenticated', coaching = COACHING_ROLES.has(role);
    const key = signedIn && coaching && membership !== undefined ? `my-squads:${sessionId}:${club ?? 'coached'}` : null;
    const data = useWorldData(key, () => shared(key!, async () => {
        if (club) {
            const published = await clubSquads(Number(club), new AbortController().signal);
            return squadsFrom(published.map(squad => ({ id: squad.id, clubId: Number(club), name: squad.name, category: squad.category })), published);
        }
        const managed = (await spaces()).filter((space: SquadSpace) => space.can_manage);
        const clubs = [...new Set(managed.map(space => space.club_id))];
        const published = (await Promise.all(clubs.map(id => clubSquads(id, new AbortController().signal).catch(() => [] as PublicSquad[])))).flat();
        return squadsFrom(managed.map(space => ({ id: space.id, clubId: space.club_id, name: space.name, category: space.category })), published);
    }));
    const squads = data.data ?? [];
    const focus = focusFrom(params.get('for'), squads);
    const state: SquadFocus['status'] = !signedIn ? 'signed-out' : !coaching ? 'none' : data.error ? 'error' : data.data === undefined ? 'loading' : squads.length ? 'ready' : 'none';
    return {
        status: state, scope: club ? 'club' : 'coached', squads, focus, error: data.error, retry: data.retry,
        ages: [...new Set(focus.map(squad => squad.ageGroup))], formats: [...new Set(focus.map(squad => squad.format))], clubIds: [...new Set(squads.map(squad => squad.clubId))],
    };
}
