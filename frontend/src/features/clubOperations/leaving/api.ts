import { apiClient } from '../../../api/axiosConfig';
import { extractApiErrorCode } from '../../../utils/apiError';

/**
 * Release 7 (owner, 27 October 2026): staff means one club; leaving, handing a club over and closing it
 * (fnd-access-b §N). Every refusal has a stable `code`.
 */
type Payload = { otherClubId?: unknown; otherClubName?: unknown; lastStaff?: unknown };
const payload = (failure: unknown) => (failure as { response?: { data?: Payload } } | null)?.response?.data ?? {};

/** 409 STAFF_OF_ANOTHER_CLUB (or OWNER_ELSEWHERE when choosing): the club the person must leave first. */
export function otherClubOf(failure: unknown): { clubId: number; name: string } | null {
    const code = extractApiErrorCode(failure);
    if (code !== 'STAFF_OF_ANOTHER_CLUB' && code !== 'OWNER_ELSEWHERE') return null;
    const { otherClubId, otherClubName } = payload(failure);
    return typeof otherClubId === 'number' ? { clubId: otherClubId, name: typeof otherClubName === 'string' ? otherClubName : '' } : null;
}

/** 409 OWNER_MUST_HAND_OVER: the Owner hands the club over first, or closes it when nobody else is staff. */
export function ownerMustHandOver(failure: unknown): { lastStaff: boolean } | null {
    return extractApiErrorCode(failure) === 'OWNER_MUST_HAND_OVER' ? { lastStaff: payload(failure).lastStaff === true } : null;
}

/** Leaves the club's staff (every staff job there) with the server's departure snapshot. */
export async function leaveClubStaff(clubId: number) {
    const rows = (await apiClient.get<{ clubId: number; departureSnapshots?: { STAFF?: string } }[]>('/me/club-relationships')).data;
    const snapshot = rows.find(row => row.clubId === clubId)?.departureSnapshots?.STAFF;
    // No snapshot: nothing staff-like is left here; the leave answers that plainly.
    await apiClient.post(`/clubs/${clubId}/relationships/STAFF/leave`, { requestId: crypto.randomUUID(), snapshot: snapshot ?? '' });
}


export interface Ownership {
    ownerId: number; ownerName: string;
    handover: { id: number; toUserId: number; toName: string; status: string; createdAt: string } | null;
    reclaim: { id: number; byUserId: number; byName: string; status: string; dueAt: string; objectedAt: string | null } | null;
}
const ownership = (club: number) => `/clubs/${club}/ownership`;
export const fetchOwnership = async (club: number, signal?: AbortSignal) => (await apiClient.get<Ownership>(ownership(club), { signal })).data;
/** To an Admin it is at once (the old Owner becomes Admin); to anyone else it is an invitation they accept. */
export const handOver = async (club: number, userId: number) =>
    (await apiClient.post<{ outcome: 'TRANSFERRED' | 'INVITED'; handoverId: number }>(`${ownership(club)}/handover`, { userId })).data;
export const answerHandover = async (club: number, handover: number, accept: boolean) =>
    (await apiClient.post<{ outcome: 'TRANSFERRED' | 'DECLINED' }>(`${ownership(club)}/handover/${handover}/answer`, { accept })).data;
export const cancelHandover = async (club: number, handover: number) => { await apiClient.post(`${ownership(club)}/handover/${handover}/cancel`); };
/** An Admin's "the Owner has vanished": GrassKickZ hands the club over after 30 days unless the Owner objects. */
export const askHandover = async (club: number) => (await apiClient.post<{ reclaimId: number; dueAt: string }>(`${ownership(club)}/reclaim`)).data;
export const objectToReclaim = async (club: number, reclaim: number) => { await apiClient.post(`${ownership(club)}/reclaim/${reclaim}/object`); };

/** People who are staff at several clubs today choose one (§N.2). */
export interface StaffClubChoice {
    needed: boolean; deadline: string | null; suggestedClubId: number | null; chosenClubId: number | null;
    clubs: { clubId: number; name: string; logoUrl: string | null; jobs: string[]; activity: string | null; suggested: boolean }[];
}
export const fetchStaffClubChoice = async (signal?: AbortSignal) => (await apiClient.get<StaffClubChoice>('/me/staff-club', { signal })).data;
export const chooseStaffClub = async (clubId: number) =>
    (await apiClient.post<{ chosenClubId: number; ended: { clubId: number; name: string }[] }>('/me/staff-club', { clubId })).data;
