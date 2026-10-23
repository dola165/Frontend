import { useNavigate } from 'react-router-dom';
import { ClubAdmissionWorkspace } from '../admissions/club/ClubAdmissionWorkspace';
import type { useClubAdmissions } from '../admissions/club/useClubAdmissions';
import { ClubApproachesPanel } from '../agents/ClubApproachesPanel';
import { ClubPeople } from '../clubOperations/people/ClubPeople';
import { SentInvitations } from '../clubOperations/people/SentInvitations';
import type { Bootstrap } from '../clubOperations/api';
import type { RolesWorkspace } from '../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../clubOperations/workspaceStructure';
import type { ClubManagementOverview, PlayerAffiliationStatus } from '../clubs/domain';
import type { WorkspaceTab } from '../../components/workspace/types';
import type { AuthSessionId } from '../../utils/authStorage';
import { InboxTab } from '../../components/workspace/tabs/InboxTab';
import { RolesTab } from '../../components/workspace/tabs/RolesTab';
import { Button, PageFrame, PageHeader } from '../../design/primitives';
import type { ClubMembership } from './useClubMembership';
import { ClubCampaignsPage } from './commerce/ClubCampaignsPage';
import { OpenRolesPage } from './commerce/OpenRolesPage';
import { StoreProductsPage } from './commerce/StoreProductsPage';
import { PlayersPage } from './players/PlayersPage';
import { PlayerCardsPage } from './players/PlayerCardsPage';
import { ApplicationsPage } from './recruitment/ApplicationsPage';
import { TryoutsPage } from './recruitment/TryoutsPage';
import type { useClubInbox } from './useClubInbox';
import './club-workspace.css';

export interface ClubToolsContext {
    tab: WorkspaceTab; clubId: number; sessionId: AuthSessionId; currentUserId: number | null;
    overview: ClubManagementOverview | null; reloadOverview: () => Promise<void>;
    roles: RolesWorkspace | null; refreshRoles: () => void; boot: Bootstrap | null; refreshBoot: () => void;
    admissions: ReturnType<typeof useClubAdmissions>; admissionCopy: (key: 'loading' | 'revoked') => string;
    membership: ClubMembership; inbox: ReturnType<typeof useClubInbox>;
    can: { leadership: boolean; operations: boolean; playerStatus: boolean; owner: boolean };
    allowed: (tab: WorkspaceTab) => boolean;
    focusedApplicationId: number | null; clearApplicationFocus: () => void;
    switchTab: (tab: WorkspaceTab) => void; openWork: OpenWorkspace; openPlayers: (status?: 'ALL' | PlayerAffiliationStatus) => void;
}

/** The club tools that keep their own page layout for now, each inside the shared workspace frame. */
export function ClubTools(ctx: ClubToolsContext) {
    const navigate = useNavigate();
    const { tab, clubId, overview, membership: m, can } = ctx;
    const players = m.players, apps = m.applications;
    const focusNote = (text: string) => <PageFrame className="cw-focus-note"><div className="gk-notice" role="status"><span className="cw-notices__text">{text}</span><Button size="sm" onClick={ctx.clearApplicationFocus}>Show all applications</Button></div></PageFrame>;
    switch (tab) {
        case 'personnel': return <ClubPeople key={clubId} clubId={clubId} clubName={ctx.boot?.clubName ?? ''} roles={ctx.roles} members={overview?.members}
            onChanged={() => { void ctx.reloadOverview(); ctx.refreshBoot(); ctx.refreshRoles(); }} />;
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
        case 'invites': return <PageFrame className="cw-page"><PageHeader title="Invitations" subtitle="Club invitations waiting for an answer. Staff jobs are given and followed in People." />
            <SentInvitations overview={overview} pendingKey={m.pendingKey} onCancelInvite={m.actions.cancelInvite}
                onOpenPeople={ctx.allowed('personnel') ? () => ctx.switchTab('personnel') : undefined} /></PageFrame>;
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
        case 'roles': return overview ? <RolesTab overview={overview} currentUserId={ctx.currentUserId} currentRole={overview.currentUserRole ?? null} pendingKey={m.pendingKey}
            confirmingOwnershipTransferUserId={m.decisions.confirmingOwnershipTransferUserId} confirmingSelfLeave={m.decisions.confirmingSelfLeave} isOwner={can.owner}
            onConfirmOwnershipTransfer={m.decisions.setConfirmingOwnershipTransferUserId} onTransferOwnership={m.actions.transferOwnership}
            onConfirmSelfLeave={m.actions.confirmSelfLeave} onLeaveClub={m.actions.leaveClub} onOpenJobs={() => ctx.switchTab('jobs')} /> : null;
        case 'club-approaches': return can.leadership ? <ClubApproachesPanel mode="club" clubId={clubId} /> : null;
        case 'jobs': return <OpenRolesPage clubId={clubId} pendingKey={m.pendingKey} currentUserId={ctx.currentUserId} canReviewAllApplications={can.leadership} />;
        case 'store': return can.leadership ? <StoreProductsPage key={clubId} clubId={clubId} /> : null;
        case 'campaigns': return can.leadership ? <ClubCampaignsPage key={clubId} clubId={clubId} /> : null;
        case 'player-cards': return <PlayerCardsPage clubId={clubId} canRemove={can.leadership} setParentError={m.setErrorMessage} setParentSuccess={m.setSuccessMessage} />;
        case 'tryouts': return <>
            {ctx.focusedApplicationId != null && focusNote(!m.tryouts.loading && !m.tryouts.applicants.some(a => a.id === ctx.focusedApplicationId) ? 'This application is unavailable or you no longer have access.' : 'Showing the application from your notification.')}
            <TryoutsPage clubId={clubId} tryoutApplicants={ctx.focusedApplicationId != null ? m.tryouts.applicants.filter(a => a.id === ctx.focusedApplicationId) : m.tryouts.applicants}
                tryoutsLoading={m.tryouts.loading} pendingKey={m.pendingKey} onTryoutStatus={can.leadership ? m.actions.tryoutStatus : undefined}
                onOpenPlayers={ctx.allowed('players') ? () => ctx.openPlayers() : undefined} />
        </>;
        case 'inbox': return <InboxTab notifications={ctx.inbox.notifications} loading={ctx.inbox.loading} loadingMore={ctx.inbox.loadingMore} busyId={ctx.inbox.busyId}
            hasMore={ctx.inbox.hasMore} unreadCount={ctx.inbox.unreadCount} error={ctx.inbox.error} onOpen={ctx.inbox.open} onLoadMore={ctx.inbox.loadMore}
            onMarkAllRead={ctx.inbox.markAllRead} onRetry={ctx.inbox.retry} />;
        default: return null;
    }
}
