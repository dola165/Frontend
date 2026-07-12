import { apiClient } from '../../api/axiosConfig';
import type { AgentDashboardData, AgentEngagement, AgentPortfolioPlayer } from './domain';

export const fetchAgentDashboard = async (): Promise<AgentDashboardData> => {
    const response = await apiClient.get<AgentDashboardData>('/agents/me/dashboard');
    return response.data;
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

export const fetchMyEngagements = async (status?: string): Promise<AgentEngagement[]> => {
    const response = await apiClient.get<AgentEngagement[]>('/agents/me/engagements', {
        params: { status: status || undefined }
    });
    return response.data;
};

export const initiateEngagement = async (clubId: number, notes?: string): Promise<AgentEngagement> => {
    const response = await apiClient.post<AgentEngagement>('/agents/me/engagements', {
        clubId,
        notes: notes || undefined
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
