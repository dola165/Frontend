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

export type PersonRole = 'COACH' | 'PLAYER' | 'REFEREE' | 'AGENT' | 'SPECIALIST' | 'CLUB_STAFF';
export interface PersonSummary {
    id: number; fullName: string; username: string; avatarUrl: string | null; role: PersonRole;
    headline: string | null; profession: string | null; clubId: number | null; clubName: string | null;
    city: string | null; verified: boolean;
}
export interface PeoplePage { items: PersonSummary[]; /** Unknown (null) when only a name search is available. */ total: number | null; page: number; size: number; hasMore: boolean; /** Only name search is available (no directory endpoint). */ searchOnly?: boolean }

const USER_TYPE_ROLE: Record<string, PersonRole> = { COACH: 'COACH', PLAYER: 'PLAYER', REFEREE: 'REFEREE', AGENT: 'AGENT', SPECIALIST: 'SPECIALIST', STAFF: 'CLUB_STAFF', CLUB_STAFF: 'CLUB_STAFF' };

/** Statuses that mean the server has no people directory (Spring may answer an unmapped route with any of them). */
const MISSING = new Set([404, 405, 501]);
let peopleDirectoryMissing = false;
/** True once this page load has learned that the server has no people directory. */
export const knownWithoutPeopleDirectory = () => peopleDirectoryMissing;

/**
 * Backend needed: `GET /people`, the public directory of football people (never minors,
 * parents or private profiles), filterable by role, profession and place. See
 * sandbox/api/handlers/world-extra.mjs for the contract. Until it exists, a name search
 * falls back to the member search (`/users/search`) and says so with `searchOnly`: role, place,
 * profession and confirmation cannot be searched, and the total is unknown because minors are
 * removed here, after paging.
 */
export const fetchPeople = async (params: Record<string, string | number | undefined>, sessionId: AuthSessionId, signal?: AbortSignal): Promise<PeoplePage> => {
    try {
        return (await apiClient.get<PeoplePage>('/people', { params, signal, _authSessionId: sessionId } as AuthSessionRequestConfig)).data;
    } catch (error) {
        if (!isAxiosError(error) || !MISSING.has(error.response?.status ?? 0)) throw error;
        peopleDirectoryMissing = true;
        const q = String(params.q ?? '').trim();
        const page = Number(params.page) || 0, size = Number(params.size) || 24;
        if (q.length < 2) return { items: [], total: null, page, size, hasMore: false, searchOnly: true };
        const { data } = await apiClient.get<{ content: UserSearchResult[]; totalElements: number; totalPages: number }>('/users/search', { params: { query: q, page, size }, signal, _authSessionId: sessionId } as AuthSessionRequestConfig);
        const items = data.content.filter(user => !user.isMinor).map((user): PersonSummary => ({
            id: user.id, fullName: user.fullName, username: user.username, avatarUrl: user.avatarUrl, role: USER_TYPE_ROLE[user.userType] ?? 'PLAYER',
            headline: user.position, profession: null, clubId: null, clubName: null, city: null, verified: false,
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
