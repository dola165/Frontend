import { apiClient } from './axiosConfig';

export interface MyTryoutApplication {
    id: number;
    tryoutId: number;
    tryoutTitle: string;
    status: string;
    appliedAt: string;
    tryoutLifecycleStatus?: string | null;
    cancelledAt?: string | null;
}

export interface TryoutApplyResponse {
    id: number;
    tryoutId: number;
    tryoutTitle?: string | null;
    status: string;
    appliedAt: string;
}

export const fetchMyTryoutApplications = async (signal?: AbortSignal): Promise<MyTryoutApplication[]> => {
    const response = await apiClient.get<MyTryoutApplication[]>('/tryouts/my-applications', { signal });
    return response.data;
};

/** POST /tryouts/{id}/apply — self-service application to a tryout. */
export const applyToTryout = async (tryoutId: number, message?: string): Promise<TryoutApplyResponse> => {
    const response = await apiClient.post<TryoutApplyResponse>(`/tryouts/${tryoutId}/apply`, {
        message: message?.trim() || undefined,
    });
    return response.data;
};

export interface TryoutDto {
    status?: string;
    id: number;
    clubId: number;
    title: string;
    description: string | null;
    position: string | null;
    ageGroup: string | null;
    gender: string | null;
    tryoutDate: string;
    deadline: string | null;
}

/** The browse endpoint uses tryoutId; mutation responses use id. */
export type TryoutBrowseItem = Omit<TryoutDto, 'id' | 'gender'> & { tryoutId: number };
export function normalizeManagedTryout(item: TryoutBrowseItem): TryoutDto {
    if (!Number.isSafeInteger(item.tryoutId) || item.tryoutId <= 0) throw new Error('Invalid tryout identity. Reload the sessions.');
    return { ...item, id: item.tryoutId, gender: null };
}

/** POST /tryouts — club-owner tryout creation. */
export const createTryout = async (payload: {
    clubId: number;
    title: string;
    tryoutDate: string;
    deadline?: string;
    position?: string;
    ageGroup?: string;
    description?: string;
}): Promise<TryoutDto> => {
    const response = await apiClient.post<TryoutDto>('/tryouts', payload);
    return response.data;
};

/** PUT /tryouts/{id} — club-owner tryout update. */
export const updateTryout = async (tryoutId: number, payload: {
    title?: string;
    tryoutDate?: string;
    deadline?: string;
    position?: string;
    ageGroup?: string;
    description?: string;
}): Promise<TryoutDto> => {
    const response = await apiClient.put<TryoutDto>(`/tryouts/${tryoutId}`, payload);
    return response.data;
};

/** DELETE /tryouts/{id} — cancels the session while preserving application history. */
export const deleteTryout = async (tryoutId: number): Promise<void> => {
    await apiClient.delete(`/tryouts/${tryoutId}`);
};
