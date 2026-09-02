import { apiClient } from './axiosConfig';

export interface MyTryoutApplication {
    id: number;
    tryoutId: number;
    tryoutTitle: string;
    status: string;
    appliedAt: string;
}

export interface TryoutApplyResponse {
    id: number;
    tryoutId: number;
    tryoutTitle?: string | null;
    status: string;
    appliedAt: string;
}

export const fetchMyTryoutApplications = async (): Promise<MyTryoutApplication[]> => {
    const response = await apiClient.get<MyTryoutApplication[]>('/tryouts/my-applications');
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

/** DELETE /tryouts/{id} — club-owner tryout deletion. */
export const deleteTryout = async (tryoutId: number): Promise<void> => {
    await apiClient.delete(`/tryouts/${tryoutId}`);
};
