export interface AgentPortfolioPlayer {
    representationId: number;
    playerUserId: number;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    position: string | null;
    currentClubName: string | null;
    currentClubId: number | null;
    representationType: string;
    status: string;
    startedAt: string;
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
}

export interface PlayerSearchResult {
    userId: number;
    fullName: string;
    username: string;
    position: string;
}
