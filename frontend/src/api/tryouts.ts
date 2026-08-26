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
