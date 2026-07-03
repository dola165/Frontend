import { apiClient } from './axiosConfig';

export interface MyTryoutApplication {
    id: number;
    tryoutId: number;
    tryoutTitle: string;
    status: string;
    appliedAt: string;
}

export const fetchMyTryoutApplications = async (): Promise<MyTryoutApplication[]> => {
    const response = await apiClient.get<MyTryoutApplication[]>('/tryouts/my-applications');
    return response.data;
};
