export type ClubJoinPolicy = 'OPEN_TRIAL' | 'APPLICATION_REQUIRED' | 'INVITE_ONLY';

export type ClubRelationshipState = 'NONE' | 'INVITED' | 'APPLIED' | 'TRIALIST' | 'ACTIVE' | 'LEFT' | 'REMOVED';

export interface ClubProfile {
    presentation?: import('../../features/clubs/presentation').ClubPresentation | null;
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    followerCount: number;
    memberCount: number;
    isFollowedByMe: boolean;
    addressText?: string;
    cityName?: string;
    countryName?: string;
    logoUrl?: string;
    joinPolicy?: ClubJoinPolicy;
    relationshipState?: ClubRelationshipState;
}

export interface ClubDirectoryPageResult<T> {
    content: T[];
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
}

export const CLUB_TYPES = ['PROFESSIONAL', 'SEMI_PROFESSIONAL', 'AMATEUR', 'GRASSROOTS', 'ACADEMY', 'SCHOOL', 'OTHER'] as const;
export const JOIN_POLICIES = ['OPEN_TRIAL', 'APPLICATION_REQUIRED', 'INVITE_ONLY'] as const;
export const SORT_OPTIONS = [
    { value: 'NEWEST', label: 'Newest' },
    { value: 'NAME', label: 'Name A–Z' },
    { value: 'MEMBER_COUNT', label: 'Most Members' }
] as const;
