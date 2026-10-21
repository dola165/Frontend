import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { fetchAgentDashboard, fetchRepresentationAttention } from './api';
import type { AgentDashboardData } from './domain';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));

describe('Agent Hub API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('counts only unresolved requests the viewer can answer', async () => {
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [
            { status: 'PENDING', canRespond: true },
            { status: 'PENDING', canRespond: false },
            { status: 'ACTIVE', canRespond: false },
            { status: 'DECLINED', canRespond: false },
        ] });
        const config = { _authSessionId: 'agent-session' };
        await expect(fetchRepresentationAttention(config)).resolves.toBe(1);
        expect(apiClient.get).toHaveBeenCalledWith('/representation-requests', config);
    });

    it('restores DTO defaults omitted from an empty dashboard wire payload', async () => {
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { portfolio: [] } });
        const config = { _authSessionId: 'agent-session' };

        await expect(fetchAgentDashboard(config)).resolves.toEqual({
            agencyName: null,
            fifaLicenseNumber: null,
            verified: false,
            activePlayerCount: 0,
            activeEngagementCount: 0,
            pendingEngagementCount: 0,
            portfolio: []
        });
        expect(apiClient.get).toHaveBeenCalledWith('/agents/me/dashboard', config);
    });

    it('retains populated dashboard values from the wire', async () => {
        const populated: AgentDashboardData = {
            agencyName: 'North Star Agency',
            fifaLicenseNumber: 'FIFA-77',
            verified: true,
            activePlayerCount: 1,
            activeEngagementCount: 2,
            pendingEngagementCount: 3,
            portfolio: [{
                representationId: 11,
                playerUserId: 88,
                fullName: 'Adult Player',
                username: 'adult_player',
                avatarUrl: null,
                position: 'MIDFIELDER',
                currentClubName: 'Current FC',
                currentClubId: 4,
                representationType: 'FULL',
                status: 'ACTIVE',
                startedAt: '2026-08-01',
                requiresMinorConsent: false,
                minorConsentStatus: null
            }]
        };
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: populated });

        await expect(fetchAgentDashboard()).resolves.toEqual(populated);
    });
});
