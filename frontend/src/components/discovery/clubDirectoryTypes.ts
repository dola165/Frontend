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
    /** How players join (the backend's name for it, in the directory and on the profile). */
    playerJoinPolicy?: ClubJoinPolicy | null;
    /** The person's relationship with the club. Directory rows leave it empty; `isMember` says membership there. */
    relationshipState?: ClubRelationshipState | null;
    isMember?: boolean;
    isStaffMember?: boolean;
    latitude?: number | null;
    longitude?: number | null;
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
