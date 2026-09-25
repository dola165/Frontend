import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AgentDashboardData, AgentEngagement, AgentInterest, AgentPortfolioPlayer, PlayerSearchResult } from './domain';
import type { ClubSearchResult } from '../tournaments/domain';

export const fetchClubApproachSummary = async (config?: AuthSessionRequestConfig): Promise<{active: number; pending: number}> =>
    (await apiClient.get<{active: number; pending: number}>('/club-approaches/summary', config)).data;

export const fetchRepresentationAttention = async (config?: AuthSessionRequestConfig): Promise<number> => {
    const response = await apiClient.get<Array<{ status: string; canRespond: boolean }>>('/representation-requests', config);
    return response.data.filter(request => request.status === 'PENDING' && request.canRespond).length;
};

export const fetchAgentDashboard = async (config?: AuthSessionRequestConfig): Promise<AgentDashboardData> => {
    const response = await apiClient.get<Partial<AgentDashboardData>>('/agents/me/dashboard', config);
    return {
        agencyName: response.data.agencyName ?? null,
        fifaLicenseNumber: response.data.fifaLicenseNumber ?? null,
        verified: response.data.verified ?? false,
        activePlayerCount: response.data.activePlayerCount ?? 0,
        activeEngagementCount: response.data.activeEngagementCount ?? 0,
        pendingEngagementCount: response.data.pendingEngagementCount ?? 0,
        portfolio: response.data.portfolio ?? []
    };
};

export const fetchAgentPortfolio = async (agentId: number): Promise<AgentPortfolioPlayer[]> => {
    const response = await apiClient.get<AgentPortfolioPlayer[]>(`/agents/${agentId}/portfolio`);
    return response.data;
};

export const fetchMyPortfolio = async (): Promise<AgentPortfolioPlayer[]> => {
    const response = await apiClient.get<AgentPortfolioPlayer[]>('/agents/me/portfolio');
    return response.data;
};

export const addPlayerToPortfolio = async (playerUserId: number, representationType?: string, notes?: string): Promise<AgentPortfolioPlayer> => {
    const response = await apiClient.post<AgentPortfolioPlayer>('/agents/me/portfolio/players', {
        playerUserId,
        representationType: representationType || 'FULL',
        notes: notes || undefined
    });
    return response.data;
};

export const removePlayerFromPortfolio = async (representationId: number): Promise<void> => {
    await apiClient.delete(`/agents/me/portfolio/players/${representationId}`);
};

/** 16-17 self-consent: the player accepts or declines their agent representation. */
export const respondToRepresentationConsent = async (representationId: number, accept: boolean): Promise<void> => {
    await apiClient.post(`/agents/representations/${representationId}/consent`, { accept });
};

export const fetchMyEngagements = async (status?: string, config?: AuthSessionRequestConfig): Promise<AgentEngagement[]> => {
    const response = await apiClient.get<AgentEngagement[]>('/agents/me/engagements', {
        ...config,
        params: { status: status || undefined }
    });
    return response.data;
};

export const fetchMyInterests = async (config?: AuthSessionRequestConfig): Promise<AgentInterest[]> => {
    const response = await apiClient.get<AgentInterest[]>('/agents/me/interests', config);
    return response.data;
};

export const initiateEngagement = async (clubId: number, notes?: string): Promise<AgentEngagement> => {
    const response = await apiClient.post<AgentEngagement>('/agents/me/engagements', {
        clubId,
        notes: notes || undefined
    });
    return response.data;
};

export const searchPlayersForPortfolio = async (query: string): Promise<PlayerSearchResult[]> => {
    if (!query.trim()) return [];
    const response = await apiClient.get<PlayerSearchResult[]>('/agents/me/portfolio/players/search', {
        params: { query: query.trim() }
    });
    return response.data;
};

export const searchClubs = async (query: string, config?: AuthSessionRequestConfig): Promise<ClubSearchResult[]> => {
    if (!query.trim()) return [];
    const response = await apiClient.get<ClubSearchResult[]>('/clubs/search', {
        ...config,
        params: { q: query.trim(), limit: 10 }
    });
    return response.data;
};

export const respondToEngagement = async (engagementId: number, clubId: number, decision: string, notes?: string): Promise<AgentEngagement> => {
    const response = await apiClient.put<AgentEngagement>(`/agents/engagements/${engagementId}/respond`, {
        decision,
        notes: notes || undefined
    }, {
        params: { clubId }
    });
    return response.data;
};

export const fetchClubAgentEngagements = async (clubId: number, status?: string): Promise<AgentEngagement[]> => {
    const response = await apiClient.get<AgentEngagement[]>(`/agents/clubs/${clubId}/agent-engagements`, {
        params: { status: status || undefined }
    });
    return response.data;
};
