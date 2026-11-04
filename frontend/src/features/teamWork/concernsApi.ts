import { apiClient } from '../../api/axiosConfig';

export interface ConcernRow { id: number; clubId: number; clubName: string; createdAt: string; status: string }
export interface ConcernList { open: number; closed: number; rows: ConcernRow[] }

/** Only the one reader gets an answer; for anyone else the server says not found. */
export const fetchConcerns = (signal?: AbortSignal) =>
    Promise.resolve(apiClient.get<ConcernList>('/team-work/concerns', { signal })).then(response => {
        if (!Array.isArray(response?.data?.rows)) throw new Error('No concerns.');
        return response.data;
    });
