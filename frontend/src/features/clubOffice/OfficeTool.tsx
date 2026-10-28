import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, ButtonLink, EmptyNote, PageFrame, Skeleton } from '../../design/primitives';
import { askAdminPath } from '../../api/access';
import type { AuthSessionId } from '../../utils/authStorage';
import { useClubAdmissionCopy } from '../admissions/club/copy';
import type { useClubAdmissions } from '../admissions/club/useClubAdmissions';
import type { Bootstrap } from '../clubOperations/api';
import { coachOriginTarget } from '../clubOperations/coachOrigin';
import type { RolesWorkspace } from '../clubOperations/useWorkspaceRoles';
import { WorkspaceOperations } from '../clubOperations/WorkspaceOperations';
import { operationModule } from '../clubOperations/workspaceNavigation';
import { focusableViews } from '../clubOperations/workspaceStructure';
import { guardWorkspaceNavigation } from '../clubOperations/workspaceGuard';
import { canManageClubOperations, canManagePlayerStatuses, isLeadershipRole, type ClubManagementOverview, type PlayerAffiliationStatus } from '../clubs/domain';
import { ClubDecisionDialogs } from '../clubWorkspace/ClubDecisionDialogs';
import { ClubTools } from '../clubWorkspace/ClubTools';
import { ProgrammesPage } from '../clubWorkspace/settings/ProgrammesPage';
import { useClubMembership } from '../clubWorkspace/useClubMembership';
import { ViewOnlyNote } from '../clubWorkspace/ViewOnlyNote';
import { WorkspaceNotices } from '../clubWorkspace/WorkspaceNotices';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { isOfficeTool, legacyWorkspaceTarget, officePath, officeToolPath, type OfficeTool as Tool } from './officeLinks';
import type { ToolState } from './officeTools';
import './office.css';

const positive = (value: string | null) => value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;

/**
 * One tool opened inside More tools, exactly as it worked in the club workspace: a club records tool (its list,
 * filters and records) or one of the older club screens. The way back leads to More tools, or to My squads when a
 * coach opened a record from there.
 */
export function OfficeTool({ clubId, tool, state, sessionId, overview, reloadOverview, boot, bootLoading, bootError, refreshBoot, roles, refreshRoles, admissions, leader, admin }: {
    clubId: number; tool: Tool; state: ToolState | undefined; sessionId: AuthSessionId;
    overview: ClubManagementOverview | null; reloadOverview: () => Promise<void>;
    boot: Bootstrap | null; bootLoading: boolean; bootError: string | null; refreshBoot: () => Promise<void>;
    roles: RolesWorkspace | null; refreshRoles: () => void; admissions: ReturnType<typeof useClubAdmissions>;
    leader: boolean; admin: { userId: number; name: string } | null;
}) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { c: admissionCopy } = useClubAdmissionCopy();
    const role = overview?.currentUserRole;
    const focusedApplicationId = positive(params.get('applicationId'));
    // Players, applications and tryouts load only while their tool is open.
    const membership = useClubMembership({ clubId, activeTab: tool, overview, reloadOverview, canChangePlayerStatus: canManagePlayerStatuses(role), focusedApplicationId });
    const go = (to: string) => guardWorkspaceNavigation(() => navigate(to));
    const coach = boot && roles ? coachOriginTarget(params, clubId, focusableViews(roles.views).filter(view => !view.clubWide).flatMap(view => view.squadIds)) : null;
    const origin = coach ? { label: copy('Back to My squads', 'უკან: ჩემი გუნდები'), onBack: () => go(coach) } : undefined;
    const squad = params.get('squad');
    // Opened from Squads, the way back leads to that squad (as the club workspace's return did).
    const toSquads = params.get('return') === 'squads' ? { label: copy('Squads', 'გუნდები'), onBack: () => go(officePath(clubId, 'squads', squad ? { squad } : {})) } : null;
    const toTools = { label: copy('More tools', 'სხვა ინსტრუმენტები'), onBack: () => go(officePath(clubId, 'tools')) };
    const askAdmin = admin ? () => navigate(askAdminPath(admin)) : undefined;
    const module = operationModule(tool);
    const way = origin ?? toSquads ?? toTools;
    const back = <div className="office-back"><Button variant="ghost" size="sm" onClick={way.onBack}><ArrowLeft aria-hidden="true" />{way.label}</Button></div>;

    // A records tool whose club data failed to load says so, with Try again, never "not your job".
    if (module && !boot && !bootLoading) return <PageFrame className="cw-page">{back}<div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{bootError || copy('This tool is unavailable right now.', 'ინსტრუმენტი ახლა მიუწვდომელია.')}</span>
        <Button size="sm" onClick={() => { void refreshBoot(); }}>{copy('Try again', 'თავიდან')}</Button></div></PageFrame>;
    if (state === undefined && (bootLoading || (tool === 'admissions' && admissions.loading)))
        return <PageFrame className="cw-page"><div className="cw-loading" role="status" aria-label={copy('Opening the tool', 'ინსტრუმენტი იხსნება')}><Skeleton height={34} width="40%" /><Skeleton height={240} /></div></PageFrame>;
    if (state === undefined || state === 'locked') return <PageFrame className="cw-page">{back}
        <EmptyNote title={state === 'locked' ? copy('Only the job that holds this tool opens it', 'ამ ინსტრუმენტს მხოლოდ ის სამუშაო ხსნის, რომელსაც ის აქვს') : copy('This tool isn’t part of your job here', 'ეს ინსტრუმენტი თქვენი სამუშაოს ნაწილი არ არის')}
            action={!leader && admin ? <ButtonLink size="sm" to={askAdminPath(admin)}>{copy('Ask the admin', 'ადმინთან მიწერა')}</ButtonLink> : undefined}>
            {copy('The admin gives jobs and their tools.', 'სამუშაოს და მის ინსტრუმენტებს ადმინი გასცემს.')}</EmptyNote></PageFrame>;
    if (module && boot) {
        return <>
            {!origin && !params.get('record') && back}
            {state === 'view' && <ViewOnlyNote onAsk={askAdmin} />}
            <WorkspaceOperations key={`${clubId}-${module}-${params.get('squad') ?? ''}-${params.get('session') ?? ''}-${params.get('person') ?? ''}`}
                boot={{ ...boot, peopleBySquad: roles?.people }} module={module} onRefresh={refreshBoot} origin={origin} />
        </>;
    }
    // The older screens name the club workspace's tabs: each opens where it lives now (Manage squads opens Squads).
    const open = (next: string, context: Record<string, string> = {}) => go(isOfficeTool(next) ? officeToolPath(clubId, next, context) : legacyWorkspaceTarget(clubId, new URLSearchParams({ tab: next, ...context })));
    return <>
        {back}
        <WorkspaceNotices error={membership.errorMessage} success={membership.successMessage} rolesError={null}
            onDismissError={() => membership.setErrorMessage(null)} onDismissSuccess={() => membership.setSuccessMessage(null)} onRetryRoles={refreshRoles} />
        {tool === 'programmes' ? <ProgrammesPage clubId={clubId} />
            : <ClubTools tab={tool} clubId={clubId} sessionId={sessionId} overview={overview} reloadOverview={reloadOverview} roles={roles} refreshRoles={refreshRoles}
                boot={boot} refreshBoot={() => { void refreshBoot(); }} admissions={admissions} admissionCopy={admissionCopy} membership={membership}
                can={{ leadership: leader, operations: canManageClubOperations(role), playerStatus: isLeadershipRole(role), owner: role === 'OWNER' }}
                allowed={next => next === 'players' ? canManageClubOperations(role) : isOfficeTool(next)} focusedApplicationId={focusedApplicationId}
                clearApplicationFocus={() => { const next = new URLSearchParams(params); next.delete('applicationId'); setParams(next); }}
                switchTab={next => open(next)} openWork={open}
                openPlayers={(status: 'ALL' | PlayerAffiliationStatus = 'TRIALIST') => { membership.players.show(status); open('players'); }} />}
        <ClubDecisionDialogs membership={membership} />
    </>;
}
