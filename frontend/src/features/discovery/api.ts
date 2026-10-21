import { apiClient } from '../../api/axiosConfig';
import type { ClubLocationItem } from '../../components/discovery/clubLocationTypes';
import type { ClubDirectoryPageResult } from '../../components/discovery/clubDirectoryTypes';

/** Lightweight, paged location records; do not truncate the choices at the first club page. */
export const fetchClubLocationOptions = async (): Promise<ClubLocationItem[]> => {
    const clubs: ClubLocationItem[] = [];
    for (let page = 0; ; page++) {
        const { data } = await apiClient.get<ClubDirectoryPageResult<ClubLocationItem>>('/clubs/locations', { params: { page, size: 100 } });
        clubs.push(...data.content);
        if (page + 1 >= data.totalPages) return clubs;
    }
};
