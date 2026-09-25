import { apiClient } from '../../api/axiosConfig';

export interface AdminClub {
    id: number;
    name: string;
    description?: string | null;
    type?: string | null;
    isOfficial: boolean;
    statusLabel?: string | null;
    cityName?: string | null;
    countryName?: string | null;
    addressText?: string | null;
}

export interface AdminClubPage {
    content: AdminClub[];
    pageNumber: number;
    pageSize: number;
    totalElements: number;
}

export const ADMIN_CLUB_PAGE_SIZE = 12;

export const fetchAdminClubs = async (query: string, page: number, signal: AbortSignal) => {
    // The ordinary directory includes unverified operating clubs and excludes dissolved clubs.
    const response = await apiClient.get<AdminClubPage>('/clubs', {
        params: { search: query.trim() || undefined, page, size: ADMIN_CLUB_PAGE_SIZE, sort: 'NEWEST' },
        signal,
    });
    return response.data;
};

export const verifyAdminClub = async (clubId: number, signal: AbortSignal) => {
    const response = await apiClient.post<Pick<AdminClub, 'id' | 'isOfficial'>>(
        `/admin/clubs/${clubId}/verification`, undefined, { signal },
    );
    if (response.data?.id !== clubId || response.data.isOfficial !== true) {
        throw new Error('The server did not confirm this club was verified. Refresh the list before trying again.');
    }
};
