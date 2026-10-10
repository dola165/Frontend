import type { MapEntityType } from '../../../../api/map';

/**
 * The discovery API's filter model, one section per kind of place so club criteria never
 * narrow fixtures. The map builds it from the URL (see `exploreQuery.ts`); admissions use
 * it to search training groups at their actual venues.
 */
export type MapSortMode = 'RELEVANCE' | 'SOONEST' | 'DISTANCE' | 'NAME';
export type MapTimeWindow = 'Morning' | 'Afternoon' | 'Evening';
export type MapDateWindow = 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'NEXT_90_DAYS' | 'ANY';
export type MapGender = 'Boys' | 'Girls' | 'Men' | 'Women' | 'Mixed';
export type MapLevel = 'Youth' | 'Academy' | 'Amateur' | 'Grassroots';
export type MapMatchSubtype = 'FRIENDLY' | 'COMPETITIVE';
export type MapPosition = 'GOALKEEPER' | 'CENTER_BACK' | 'FULLBACK' | 'LEFT_BACK' | 'RIGHT_BACK' | 'DEFENSIVE_MIDFIELDER'
    | 'CENTRAL_MIDFIELDER' | 'ATTACKING_MIDFIELDER' | 'WINGER' | 'LEFT_WINGER' | 'RIGHT_WINGER' | 'STRIKER' | 'FORWARD';
export type ClubCategory = 'PROFESSIONAL_ACADEMY' | 'PRIVATE_ACADEMY' | 'SCHOOL_CLUB' | 'AMATEUR_CLUB' | 'OTHER';

interface ClubFilters {
    birthYear?: number;
    includeWaitlist?: boolean;
    trainingMinPrice?: string;
    trainingMaxPrice?: string;
    trainingCurrency?: string;
    trainingPeriod?: string;
    officialOnly: boolean;
    openTryoutsOnly: boolean;
    city: string;
    country: string;
    categories: ClubCategory[];
    ageGroups: string[];
    genders: MapGender[];
    levels: MapLevel[];
}
interface TryoutFilters { city: string; country: string; dateWindow: MapDateWindow; timeWindows: MapTimeWindow[]; genders: MapGender[]; ageGroups: string[] }
interface MatchFilters { city: string; country: string; dateWindow: MapDateWindow; timeWindows: MapTimeWindow[]; genders: MapGender[]; levels: MapLevel[]; ageGroups: string[]; subtypes: MapMatchSubtype[] }

export interface MapFilters {
    entityType: MapEntityType[];
    sortBy: MapSortMode;
    distanceKm: number;
    positions: MapPosition[];
    clubs: ClubFilters;
    tryouts: TryoutFilters;
    matches: MatchFilters;
}

export const defaultMapFilters: MapFilters = {
    entityType: ['CLUB', 'STADIUM', 'MATCH', 'TOURNAMENT'],
    sortBy: 'RELEVANCE',
    distanceKm: 50,
    positions: [],
    clubs: { officialOnly: false, openTryoutsOnly: false, city: '', country: '', categories: [], ageGroups: [], genders: [], levels: [] },
    tryouts: { city: '', country: '', dateWindow: 'ANY', timeWindows: [], genders: [], ageGroups: [] },
    matches: { city: '', country: '', dateWindow: 'ANY', timeWindows: [], genders: [], levels: [], ageGroups: [], subtypes: ['FRIENDLY', 'COMPETITIVE'] },
};

export const AGE_GROUPS = ['U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U21', 'Senior'];
export const GENDERS: MapGender[] = ['Boys', 'Girls', 'Men', 'Women', 'Mixed'];
export const LEVELS: MapLevel[] = ['Youth', 'Academy', 'Amateur', 'Grassroots'];
export const TIME_WINDOWS: MapTimeWindow[] = ['Morning', 'Afternoon', 'Evening'];
export const CLUB_CATEGORIES: { value: ClubCategory; label: string }[] = [
    { value: 'PROFESSIONAL_ACADEMY', label: 'Pro academies' }, { value: 'PRIVATE_ACADEMY', label: 'Private academies' },
    { value: 'SCHOOL_CLUB', label: 'School clubs' }, { value: 'AMATEUR_CLUB', label: 'Amateur clubs' }, { value: 'OTHER', label: 'Other' },
];
export const POSITIONS: { value: MapPosition; label: string }[] = [
    { value: 'GOALKEEPER', label: 'Goalkeeper' }, { value: 'CENTER_BACK', label: 'Centre back' }, { value: 'FULLBACK', label: 'Full-back' },
    { value: 'DEFENSIVE_MIDFIELDER', label: 'Defensive midfielder' }, { value: 'CENTRAL_MIDFIELDER', label: 'Central midfielder' },
    { value: 'ATTACKING_MIDFIELDER', label: 'Attacking midfielder' }, { value: 'WINGER', label: 'Winger' }, { value: 'STRIKER', label: 'Striker' },
];
export const DATE_WINDOWS: { value: MapDateWindow; label: string }[] = [
    { value: 'NEXT_7_DAYS', label: 'Next 7 days' }, { value: 'NEXT_30_DAYS', label: 'Next 30 days' }, { value: 'NEXT_90_DAYS', label: 'Next 90 days' },
];
export const FEE_PERIODS = [['MONTH', 'Per month'], ['SESSION', 'Per session'], ['TERM', 'Per term'], ['YEAR', 'Per year'], ['ONE_OFF', 'One-off']] as const;
export const CURRENCIES = ['GEL', 'EUR', 'USD', 'GBP'];
