export interface ClubLocationItem {
    clubId: number;
    clubName: string;
    cityName?: string | null;
    countryName?: string | null;
}

export interface ClubRegionSelection {
    country: string | null;
    city: string | null;
    clubId: number | null;
}

export const EMPTY_CLUB_REGION: ClubRegionSelection = { country: null, city: null, clubId: null };
