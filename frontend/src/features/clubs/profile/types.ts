import type { ClubPresentation } from '../presentation';
import type { ClubMembershipRole, ClubRelationshipState, PlayerAffiliationStatus, PlayerJoinPolicy } from '../domain';

export interface ClubOpportunity {
    id: number;
    type: 'FUNDRAISING' | 'JOB' | 'VOLUNTEER';
    title: string;
    externalLink: string;
}

export interface ClubHonour {
    id: number;
    title: string;
    yearWon: number;
    description?: string | null;
}

/** The public club profile as `GET /clubs/:id` returns it, with the viewer's relationship. */
export interface ClubProfile {
    presentation?: ClubPresentation | null;
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    statusLabel: string;
    followerCount: number;
    memberCount: number;
    isFollowedByMe: boolean;
    isStaffMember: boolean;
    isMember: boolean;
    myRole?: ClubMembershipRole | null;
    playerJoinPolicy?: PlayerJoinPolicy | null;
    playerAffiliationStatus?: PlayerAffiliationStatus | null;
    relationshipState?: ClubRelationshipState | null;
    pendingApplicationId?: number | null;
    pendingApplicationRole?: ClubMembershipRole | null;
    addressText?: string;
    logoUrl?: string;
    bannerUrl?: string;
    whatsappNumber?: string | null;
    facebookMessengerUrl?: string | null;
    preferredCommunicationMethod?: string | null;
    cityName?: string | null;
    countryName?: string | null;
    email?: string | null;
    /** The links from the club page's Contact box, in one place on the server: https addresses only. */
    websiteUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    foundedYear?: number | null;
    level?: string | null;
    latitude?: number;
    longitude?: number;
    trustedByClubs: Array<{ clubId: number; clubName: string }>;
    honours: ClubHonour[];
    opportunities: ClubOpportunity[];
    category?: string | null;
    pendingApplicationJobId?: number | null;
}
