import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { getAuthSessionId } from '../../utils/authStorage';
import type { Plan, FamilyItinerary } from '../mapPlanning/api';
import type { OperationRecord, History } from '../clubOperations/api';

export interface TravelSource { id: number; title: string; starts_at: string; ends_at: string; location_name: string | null; status: string; timezone: string; cancelled?: boolean }
export interface TravelEvent extends TravelSource { squad_id: number; squad_name: string }
export interface TravelPlan extends Plan {
    source: TravelSource; sourceCancelled: boolean; canPublish: boolean; peopleReviewRequired?: boolean;
    travelChecks: { id: number; subject_user_id: number; name: string; status: string; revision: number; updated_at: string; permission_id: number | null; permissionState: string; eventExpected?: boolean; attendance?: 'EXPECTED' | 'NOT_GOING' | 'NOT_EXPECTED' }[];
    physicalHistory: History[];
    eventPlayers: { id: number; name: string }[];
}
export interface TravelContext { relevant?: boolean; events: TravelEvent[]; plans: { id: number; title: string; squad_id: number; published_version: number }[] }
export interface TravelLogistics { revision: number; startsAt: string; endsAt: string; meetingPoint: string; collectionPoint: string; supervisionContact: string; transport: string; transportEvidence: string; familyMessage: string; transportConfirmed: boolean }
export interface FamilyTravel {
    plan_id: number; club_id: number; title: string; version: number; child_id: number; child_name: string; club_name: string;
    permission_id: number | null; permission?: Pick<OperationRecord, 'id' | 'revision' | 'status' | 'expired' | 'transitions' | 'data'>;
    itinerary: FamilyItinerary & { transport?: string[] }; source: TravelSource; sourceChanged: boolean; eventExpected?: boolean; canRespond: boolean; attendance: 'EXPECTED' | 'NOT_GOING' | 'NOT_EXPECTED' | 'CANCELLED';
    travel: { status: string; updated_at?: string; passenger?: { status: string; updated_at: string } | null };
}
export const travelGet = async <T>(path: string, signal?: AbortSignal) => (await apiClient.get<T>(`/travel${path}`, { signal })).data;
export const travelCommand = async <T>(path: string, body: unknown, method: 'post' | 'put' | 'get' = 'post') => {
    const config = { _authSessionId: getAuthSessionId(), timeout: 25000 } satisfies AuthSessionRequestConfig;
    return method === 'get' ? (await apiClient.get<T>(`/travel${path}`, config)).data : (await apiClient[method]<T>(`/travel${path}`, body, config)).data;
};

export const takeBackCannotCome = (planId: number, version: number, childId: number) => travelCommand(`/plans/${planId}/take-back-cannot-come`, { version, childId });
