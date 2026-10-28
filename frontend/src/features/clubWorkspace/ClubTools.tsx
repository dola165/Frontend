import { useNavigate } from 'react-router-dom';
import { ClubAdmissionWorkspace } from '../admissions/club/ClubAdmissionWorkspace';
import type { useClubAdmissions } from '../admissions/club/useClubAdmissions';
import { ClubApproachesPanel } from '../agents/ClubApproachesPanel';
import type { Bootstrap } from '../clubOperations/api';
import type { RolesWorkspace } from '../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../clubOperations/workspaceStructure';
import type { ClubManagementOverview, PlayerAffiliationStatus } from '../clubs/domain';
import type { WorkspaceTab } from '../../components/workspace/types';
import type { AuthSessionId } from '../../utils/authStorage';
import { Button, PageFrame } from '../../design/primitives';
import type { ClubMembership } from './useClubMembership';
import { ClubCampaignsPage } from './commerce/ClubCampaignsPage';
import { StoreProductsPage } from './commerce/StoreProductsPage';
import { PlayersPage } from './players/PlayersPage';
import { PlayerCardsPage } from './players/PlayerCardsPage';
import { ApplicationsPage } from './recruitment/ApplicationsPage';
import { TryoutsPage } from './recruitment/TryoutsPage';
import './club-workspace.css';

export interface ClubToolsContext {
    tab: WorkspaceTab; clubId: number; sessionId: AuthSessionId;
    overview: ClubManagementOverview | null; reloadOverview: () => Promise<void>;
    roles: RolesWorkspace | null; refreshRoles: () => void; boot: Bootstrap | null; refreshBoot: () => void;
    admissions: ReturnType<typeof useClubAdmissions>; admissionCopy: (key: 'loading' | 'revoked') => string;
    membership: ClubMembership;
    can: { leadership: boolean; operations: boolean; playerStatus: boolean; owner: boolean };
    allowed: (tab: WorkspaceTab) => boolean;
    focusedApplicationId: number | null; clearApplicationFocus: () => void;
    switchTab: (tab: WorkspaceTab) => void; openWork: OpenWorkspace; openPlayers: (status?: 'ALL' | PlayerAffiliationStatus) => void;
}

/** The older club tools that keep their own page layout, opened in Club office's More tools. */
export function ClubTools(ctx: ClubToolsContext) {
    const navigate = useNavigate();
    const { tab, clubId, overview, membership: m, can } = ctx;
    const players = m.players, apps = m.applications;
    const focusNote = (text: string) => <PageFrame className="cw-focus-note"><div className="gk-notice" role="status"><span className="cw-notices__text">{text}</span><Button size="sm" onClick={ctx.clearApplicationFocus}>Show all applications</Button></div></PageFrame>;
    switch (tab) {
        case 'players': return <PlayersPage
            playerDirectory={players.directory} playerLoading={players.loading} playerError={players.error} playerStatusFilter={players.filter}
            playerCounts={overview ? {
                ACTIVE: overview.activePlayerCount, TRIALIST: overview.trialistCount, PAST: overview.pastPlayerCount ?? 0, REMOVED: overview.removedPlayerCount ?? 0,
                ALL: (overview.activePlayerCount ?? 0) + (overview.trialistCount ?? 0) + (overview.pastPlayerCount ?? 0) + (overview.removedPlayerCount ?? 0),
            } : undefined}
            pendingKey={m.pendingKey} canManagePlayerStatuses={can.playerStatus && Boolean(ctx.admissions.data)} canInvitePlayer={Boolean(ctx.admissions.data)}
            joiningUnavailableReason={ctx.admissions.data ? undefined : ctx.admissions.loading ? ctx.admissionCopy('loading') : ctx.admissions.error || ctx.admissionCopy('revoked')}
            totalPlayerPages={players.directory ? Math.max(1, Math.ceil(players.directory.totalElements / Math.max(players.directory.pageSize, 1))) : 1}
            onStatusFilterChange={filter => { players.setFilter(filter); players.setPage(0); }} onPlayerStatusChange={m.actions.playerStatusChange}
            onReviewJoining={ctx.admissions.data ? userId => {
                const record = ctx.admissions.data?.cases.find(row => row.playerId === userId && row.stage !== 'CLOSED');
                ctx.openWork('admissions', record ? { caseId: String(record.id) } : { person: String(userId) });
            } : undefined}
            joiningPlayerIds={ctx.admissions.data?.cases.filter(row => row.stage !== 'CLOSED').map(row => row.playerId)}
            onTrialEndsChange={m.actions.trialEndsChange} onRetry={() => { void players.reload(); }} onPageChange={players.setPage}
            onMessagePlayer={userId => navigate(`/messages?chatWith=${userId}`)} onSendConsentEmail={m.actions.sendConsentEmail}
            onTabChange={next => next === 'admissions' ? ctx.openWork('admissions', { intake: '1' }) : ctx.switchTab(next)} />;
        case 'admissions': return <ClubAdmissionWorkspace state={ctx.admissions} sessionId={ctx.sessionId} existingPeople={ctx.roles?.people} onOpen={ctx.openWork}
            onRosterChanged={() => { players.invalidate(); void ctx.reloadOverview(); ctx.refreshRoles(); }} />;
        case 'applications': return <>
            {ctx.focusedApplicationId != null && focusNote('Showing the application from your notification.')}
            <ApplicationsPage applications={ctx.focusedApplicationId != null ? apps.list.filter(a => a.id === ctx.focusedApplicationId) : apps.list}
                applicationsLoading={apps.loading} applicationsError={apps.error} jobs={apps.jobs}
                filters={ctx.focusedApplicationId != null ? { position: '', ageGroup: '', status: '', jobId: '' } : apps.filters}
                bulkPending={!!m.pendingKey && m.pendingKey.startsWith('bulk-')}
                onFiltersChange={filters => { ctx.clearApplicationFocus(); apps.setPage(0); apps.setFilters(filters); }}
                pagination={ctx.focusedApplicationId == null ? { page: apps.page, total: apps.total, size: 100, onChange: apps.setPage } : undefined}
                onAcceptApplication={m.actions.acceptApplication} onDeclineApplication={m.actions.declineApplication} onBulkDecide={m.actions.bulkDecide}
                onRetry={() => { void apps.reload(); }}
                onOpenPlayers={ctx.allowed('players') ? () => ctx.openPlayers() : undefined} />
        </>;
        case 'player-cards': return <PlayerCardsPage clubId={clubId} canRemove={can.leadership} setParentError={m.setErrorMessage} setParentSuccess={m.setSuccessMessage} />;
        case 'club-approaches': return can.leadership ? <ClubApproachesPanel mode="club" clubId={clubId} /> : null;
        case 'store': return can.leadership ? <StoreProductsPage key={clubId} clubId={clubId} /> : null;
        case 'campaigns': return can.leadership ? <ClubCampaignsPage key={clubId} clubId={clubId} /> : null;
        case 'tryouts': return <>
            {ctx.focusedApplicationId != null && focusNote(!m.tryouts.loading && !m.tryouts.applicants.some(a => a.id === ctx.focusedApplicationId) ? 'This application is unavailable or you no longer have access.' : 'Showing the application from your notification.')}
            <TryoutsPage clubId={clubId} tryoutApplicants={ctx.focusedApplicationId != null ? m.tryouts.applicants.filter(a => a.id === ctx.focusedApplicationId) : m.tryouts.applicants}
                tryoutsLoading={m.tryouts.loading} pendingKey={m.pendingKey} onTryoutStatus={can.leadership ? m.actions.tryoutStatus : undefined}
                onOpenPlayers={ctx.allowed('players') ? () => ctx.openPlayers() : undefined} />
        </>;
        default: return null;
    }
}
