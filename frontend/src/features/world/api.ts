import { isAxiosError } from 'axios';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { UserSearchResult } from '../../api/chat';
import type { AuthSessionId } from '../../utils/authStorage';
import type { ClubDirectoryPageResult, ClubProfile } from '../../components/discovery/clubDirectoryTypes';
import type { Match, Referee } from '../matchExchange/api';

/** The club directory search (`GET /clubs`), the same contract the old club directory used. */
export const fetchClubDirectory = async (params: URLSearchParams, signal?: AbortSignal) => {
    const { data } = await apiClient.get<ClubDirectoryPageResult<ClubProfile> | ClubProfile[]>(`/clubs?${params}`, { signal });
    return Array.isArray(data)
        ? { content: data, pageNumber: 0, pageSize: data.length, totalElements: data.length, totalPages: 1 }
        : data;
};

export const fetchClubProfile = async (clubId: number, signal?: AbortSignal) =>
    (await apiClient.get<ClubProfile>(`/clubs/${clubId}`, { signal })).data;

/** Following a club is a toggle on the server, as on the club profile. */
export const toggleClubFollow = async (clubId: number) => {
    await apiClient.post(`/clubs/${clubId}/follow`);
};

/** The People view a person is in, worked out from their job (a club physio is a specialist). */
export type PersonRole = 'COACH' | 'CLUB_STAFF' | 'SPECIALIST' | 'PLAYER' | 'REFEREE';
/** A licence as the person states it: UEFA Pro, A, B or C, or a goalkeeper licence. */
export type StatedLicence = 'PRO' | 'A' | 'B' | 'C' | 'GK';
/**
 * What a person says they are open to: a job at a club (WORK), paid sessions such as private training or physio
 * (SERVICES), volunteering (VOLUNTEER); a player looking for a club (CLUB) or for a coach (COACHING).
 */
export type OpenTo = 'WORK' | 'SERVICES' | 'VOLUNTEER' | 'CLUB' | 'COACHING';
export interface PersonSummary {
    id: number; fullName: string; username: string; avatarUrl: string | null; role: PersonRole;
    headline: string | null; profession: string | null;
    /** The person's club: null when they have none, absent when it is not known (the name search knows no clubs). */
    clubId?: number | null; clubName?: string | null; clubLogoUrl?: string | null;
    city: string | null;
    /** How far they are from the place the search was made from (`lat`/`lng`), in km: from their club, else their city. */
    distanceKm?: number | null;
    /** Players: position (GOALKEEPER, STRIKER…), age and stronger foot. */
    position?: string | null; age?: number | null; foot?: string | null;
    licence?: StatedLicence | null;
    /** What they say they are open to (see `OpenTo`), and their price for a session when they offer one. */
    openTo?: OpenTo[]; rate?: { amount: number; currency: string; per: 'SESSION' } | null;
}
export interface PeoplePage { items: PersonSummary[]; /** Unknown (null) when only a name search is available. */ total: number | null; page: number; size: number; hasMore: boolean; /** Only name search is available (no directory endpoint). */ searchOnly?: boolean }

/** The member search knows account types only; parents, fans, agents and the rest are never People. */
const USER_TYPE_ROLE: Record<string, PersonRole> = { COACH: 'COACH', PLAYER: 'PLAYER', REFEREE: 'REFEREE', CLUB_ADMIN: 'CLUB_STAFF' };

/** Query values for `/people`: repeatable filters are sent once per value (`role=COACH&role=CLUB_STAFF`). */
export type PeopleParams = Record<string, string | number | string[] | undefined>;
const peopleQuery = (params: PeopleParams) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined && item !== '') query.append(key, String(item));
    return query;
};

/** Statuses that mean the server has no people directory (Spring may answer an unmapped route with any of them). */
const MISSING = new Set([404, 405, 501]);
let peopleDirectoryMissing = false;
/** True once this page load has learned that the server has no people directory. */
export const knownWithoutPeopleDirectory = () => peopleDirectoryMissing;

/**
 * Backend needed: `GET /people`, the public directory of football people (never minors, parents, agents or private
 * profiles), filterable by view, job, licence, position, age and place. See sandbox/api/handlers/world-extra.mjs
 * for the contract. Until it exists, a name search falls back to the member search (`/users/search`) and says so
 * with `searchOnly`: only the name can be searched, results are kept to the views asked for (`role`), and the total
 * is unknown because minors and other accounts are removed here, after paging.
 */
export const fetchPeople = async (params: PeopleParams, sessionId: AuthSessionId, signal?: AbortSignal): Promise<PeoplePage> => {
    try {
        return (await apiClient.get<PeoplePage>('/people', { params: peopleQuery(params), signal, _authSessionId: sessionId } as AuthSessionRequestConfig)).data;
    } catch (error) {
        if (!isAxiosError(error) || !MISSING.has(error.response?.status ?? 0)) throw error;
        peopleDirectoryMissing = true;
        const q = String(params.q ?? '').trim();
        const page = Number(params.page) || 0, size = Number(params.size) || 24;
        if (q.length < 2) return { items: [], total: null, page, size, hasMore: false, searchOnly: true };
        const { data } = await apiClient.get<{ content: UserSearchResult[]; totalElements: number; totalPages: number }>('/users/search', { params: { query: q, page, size }, signal, _authSessionId: sessionId } as AuthSessionRequestConfig);
        const roles = ([] as (string | number)[]).concat(params.role ?? []).map(String);
        const items = data.content.filter(user => !user.isMinor && USER_TYPE_ROLE[user.userType] && (!roles.length || roles.includes(USER_TYPE_ROLE[user.userType]))).map((user): PersonSummary => ({
            id: user.id, fullName: user.fullName, username: user.username, avatarUrl: user.avatarUrl, role: USER_TYPE_ROLE[user.userType],
            headline: user.position, profession: null, city: null,
        }));
        return { items, total: null, page, size, hasMore: page + 1 < data.totalPages, searchOnly: true };
    }
};

/** The referee directory used by Matches › Officials. */
export const fetchReferees = async (params: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    (await apiClient.get<{ items: Referee[]; total: number; page?: number; pageSize?: number }>('/referees', { params, signal, timeout: 15000 })).data;

/** Open match-exchange listings, the same query the Match exchange browse tab sends. */
export const fetchMatchListings = async (params: URLSearchParams, signal?: AbortSignal) =>
    (await apiClient.get<{ items: Match[]; total: number; page?: number; pageSize?: number }>(`/match-exchange?${params}`, { signal, timeout: 15000 })).data;
