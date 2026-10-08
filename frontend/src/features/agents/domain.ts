export interface AgentPortfolioPlayer {
    representationId: number;
    playerUserId: number | null;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
    position: string | null;
    currentClubName: string | null;
    currentClubId: number | null;
    representationType: string;
    status: string;
    startedAt: string;
    requiresMinorConsent?: boolean | null;
    minorConsentStatus?: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
}

export interface AgentDashboardData {
    agencyName: string | null;
    fifaLicenseNumber: string | null;
    verified: boolean;
    activePlayerCount: number;
    activeEngagementCount: number;
    pendingEngagementCount: number;
    portfolio: AgentPortfolioPlayer[];
}

export interface AgentEngagement {
    engagementId: number;
    clubId: number;
    clubName: string;
    clubLogoUrl: string | null;
    status: 'PENDING' | 'ACTIVE' | 'DECLINED' | 'CANCELLED' | 'TERMINATED';
    notes: string | null;
    responseNotes: string | null;
    createdAt: string;
    respondedAt: string | null;
    agentUserId: number;
    agentName: string;
    agencyName: string | null;
    agentAvatarUrl: string | null;
}

export interface AgentInterest {
    interestId: number;
    listingId: number | null;
    clubId: number;
    clubName: string;
    interestedByUserId: number | null;
    interestedByName: string | null;
    message: string | null;
    status: 'EXPRESSED' | 'VIEWED' | 'CONTACTED' | 'DISMISSED';
    createdAt: string;
}

export interface PlayerSearchResult {
    userId: number;
    fullName: string;
    username: string;
    position: string;
}
