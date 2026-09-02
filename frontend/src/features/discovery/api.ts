import { apiClient } from '../../api/axiosConfig';
import type { ClubLocationItem } from '../../components/discovery/clubLocationTypes';

interface ClubDirectoryItem {
    id: number;
    name: string;
    cityName?: string | null;
    countryName?: string | null;
    addressText?: string | null;
}

interface PageLike<T> {
    content: T[];
}

export const fetchClubLocationOptions = async (): Promise<ClubLocationItem[]> => {
    const response = await apiClient.get<ClubDirectoryItem[] | PageLike<ClubDirectoryItem>>('/clubs', {
        params: { page: 0, size: 200 },
    });
    const clubs = Array.isArray(response.data) ? response.data : response.data.content;
    return clubs.map((club) => ({
        clubId: club.id,
        clubName: club.name,
        cityName: club.cityName ?? club.addressText ?? null,
        countryName: club.countryName ?? null,
    }));
};
