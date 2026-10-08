import { useState } from 'react';
import { AgentDashboardPresentation, type DashboardTab } from '../../../pages/AgentDashboardPage';
import type { AgentDashboardData, AgentEngagement, AgentInterest } from '../domain';

export type AgentHubFixtureVariant = 'ready' | 'empty' | 'error' | 'loading' | 'protected';

const readyDashboard: AgentDashboardData = {
    agencyName: 'North Star Agency',
    fifaLicenseNumber: 'FIFA-77',
    verified: true,
    activePlayerCount: 2,
    activeEngagementCount: 1,
    pendingEngagementCount: 1,
    portfolio: [
        {
            representationId: 11,
            playerUserId: null,
            fullName: null,
            username: null,
            avatarUrl: null,
            position: null,
            currentClubName: null,
            currentClubId: null,
            representationType: 'FULL',
            status: 'ACTIVE',
            startedAt: '2026-09-01',
            requiresMinorConsent: true,
            minorConsentStatus: 'PENDING'
        },
        {
            representationId: 12,
            playerUserId: 88,
            fullName: 'Nino Beridze',
            username: 'nino_b',
            avatarUrl: null,
            position: 'MIDFIELDER',
            currentClubName: 'Tbilisi United',
            currentClubId: 4,
            representationType: 'FULL',
            status: 'ACTIVE',
            startedAt: '2026-08-01',
            requiresMinorConsent: false,
            minorConsentStatus: null
        }
    ]
};

const readyInterests: AgentInterest[] = [
    {
        interestId: 21,
        listingId: 90,
        clubId: 4,
        clubName: 'Tbilisi United',
        interestedByUserId: 44,
        interestedByName: 'Sporting Director',
        message: 'Could we arrange a private call this week?',
        status: 'EXPRESSED',
        createdAt: '2026-09-20T10:00:00'
    },
    {
        interestId: 22,
        listingId: null,
        clubId: 5,
        clubName: 'Historic FC',
        interestedByUserId: null,
        interestedByName: null,
        message: null,
        status: 'VIEWED',
        createdAt: '2026-08-20T10:00:00'
    }
];

const readyEngagements: AgentEngagement[] = [
    {
        engagementId: 31,
        clubId: 4,
        clubName: 'Tbilisi United',
        clubLogoUrl: null,
        status: 'PENDING',
        notes: 'Representation discussion',
        responseNotes: null,
        createdAt: '2026-09-18T10:00:00',
        respondedAt: null,
        agentUserId: 7,
        agentName: 'Agent User',
        agencyName: 'North Star Agency',
        agentAvatarUrl: null
    },
    {
        engagementId: 32,
        clubId: 5,
        clubName: 'Historic FC',
        clubLogoUrl: null,
        status: 'TERMINATED',
        notes: null,
        responseNotes: 'Closed by agreement',
        createdAt: '2026-07-18T10:00:00',
        respondedAt: '2026-08-18T10:00:00',
        agentUserId: 7,
        agentName: 'Agent User',
        agencyName: 'North Star Agency',
        agentAvatarUrl: null
    }
];

const emptyDashboard: AgentDashboardData = {
    ...readyDashboard,
    activePlayerCount: 0,
    activeEngagementCount: 0,
    pendingEngagementCount: 0,
    portfolio: []
};

/** Local/test-only in-memory adapter for rendering the production presentation component. */
export function AgentHubFixture({ variant = 'ready' }: { variant?: AgentHubFixtureVariant }) {
    const [activeTab, setActiveTab] = useState<DashboardTab>(variant === 'protected' ? 'portfolio' : 'overview');
    const empty = variant === 'empty';
    const unavailable = variant === 'loading' || variant === 'error';
    return (
        <AgentDashboardPresentation
            username="fixture_agent"
            dashboard={unavailable ? null : empty ? emptyDashboard : readyDashboard}
            interests={empty || unavailable ? [] : readyInterests}
            engagements={empty || unavailable ? [] : readyEngagements}
            loading={variant === 'loading'}
            error={variant === 'error'}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onRetry={() => undefined}
        />
    );
}
