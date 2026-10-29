import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, FolderKanban, LayoutGrid, Settings, ShieldCheck, Users } from 'lucide-react';
import { WorkspaceShell, type WorkspaceNavItem } from '../../design/workspace/WorkspaceShell';
import { Button, ButtonLink, EmptyNote, PageFrame, Skeleton } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { refreshAccess, useCan } from '../../hooks/useCan';
import type { AuthSessionId } from '../../utils/authStorage';
import { useClubAdmissions } from '../admissions/club/useClubAdmissions';
import { useClubOperations } from '../clubOperations/useClubOperations';
import { useWorkspaceRoles } from '../clubOperations/useWorkspaceRoles';
import { focusableViews } from '../clubOperations/workspaceStructure';
import { guardWorkspaceNavigation } from '../clubOperations/workspaceGuard';
import { ClubPeople } from '../clubOperations/people/ClubPeople';
import { clubRoleLabel, isLeadershipRole } from '../clubs/domain';
import { ClubCalendar } from '../clubWorkspace/calendar/ClubCalendar';
import { useClubOverview } from '../clubWorkspace/useClubOverview';
import { SquadsPage } from '../clubWorkspace/squads/SquadsPage';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { WorkspaceNotices } from '../clubWorkspace/WorkspaceNotices';
import { BirthDateStep } from '../pages/create/BirthDateStep';
import { MoreTools } from './MoreTools';
import { OfficeSettings } from './OfficeSettings';
import { OfficeTool } from './OfficeTool';
import { bareLink, isMovedTool, isOfficeTool, isProjectsTool, movedToolPath, OFFICE_PLACES, officePath, officeToolPath, type OfficePlace, type OfficeTool as Tool } from './officeLinks';
import { projectsPath } from '../projects/projectWords';
import { toolStates } from './officeTools';
import '../clubWorkspace/club-workspace.css';
import './office.css';

/**
 * Club office (step 2 of the club plan, owner, 28 October 2026): the club's own place for the people who run it.
 * Admins run Staff, Squads and Settings; everyone else on the staff reads Staff. More tools holds every tool that has
 * no page of its own yet, each opened here as it worked before; the calendar sits at the bottom. The place, the tool
 * and what they show live in the address.
 */
export function ClubOffice({ clubId, sessionId }: { clubId: number; sessionId: AuthSessionId }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { user } = useAuth();
    const club = useClubOverview(clubId);
    const operations = useClubOperations(clubId);
    const workspaceRoles = useWorkspaceRoles(clubId, 'all', user?.id ?? null);
    const roles = workspaceRoles.data;
    const can = useCan(`club:${clubId}`);
    const [squadNotice, setSquadNotice] = useState<{ error: string | null; success: string | null }>({ error: null, success: null });
    const [askBirthDate, setAskBirthDate] = useState(true);
    const role = club.overview?.currentUserRole;
    const leader = can.decide('invite_staff', isLeadershipRole(role) || Boolean(operations.boot?.leadership)).allowed;
    const seeStaff = can.decide('see_staff', leader || Boolean(roles?.views.length));
    const staff = seeStaff.allowed;
    // Club staff work needs a known adult (the server's BIRTH_DATE_NEEDED): an account without a birth date gives it here
    // once, through the profile's step, and then Staff loads.
    const birthDateFirst = !staff && seeStaff.code === 'BIRTH_DATE_NEEDED';
    const rawTool = params.get('tool');
    const tool: Tool | null = isOfficeTool(rawTool) ? rawTool : null;
    const requested: OfficePlace = tool ? 'tools' : OFFICE_PLACES.find(place => place === params.get('tab')) ?? 'staff';
    const admissions = useClubAdmissions(clubId, sessionId, tool === 'admissions');
    const states = toolStates({ boot: operations.boot, role, admissions: Boolean(admissions.data) });
    // On a squad, applications, attendance and preparation live in My squads; owners, admins and someone on no squad
    // keep them here. `inMySquads`: the squad is one of theirs in My squads (any of theirs when the link names none).
    const inMySquads = (id: string | null) => Boolean(roles?.views.some(view => view.onSquads
        && (id === null || view.clubWide || view.squadIds.map(String).includes(id))));
    const anyTool = leader || [...states.values()].some(state => state !== 'locked');
    const opens = (tool: Tool) => states.get(tool) === 'open' || states.get(tool) === 'view';
    const allowed = (next: OfficePlace) => next === 'staff' || next === 'calendar' || (next === 'tools' ? anyTool : leader);
    const known = !can.pending && !workspaceRoles.loading && !(club.loading && !club.overview) && !operations.loading;
    const place: OfficePlace = !known || allowed(requested) ? requested : 'staff';
    const squad = params.get('squad');
    // A coach's own squad has its own page: My squads.
    const ownSquad = known && !leader && requested === 'squads' && squad !== null
        && Boolean(roles?.views.some(view => !view.clubWide && view.squadIds.map(String).includes(squad)));

    useEffect(() => {
        // An address the person can't use falls back to Staff, so the address always says what is shown.
        if (known && !allowed(requested) && !ownSquad) setParams(new URLSearchParams(), { replace: true });
    });

    if (!Number.isSafeInteger(clubId) || clubId <= 0) return <PageFrame><EmptyNote title={copy('This club office does not exist', 'კლუბის ოფისი ვერ მოიძებნა')} /></PageFrame>;
    if (ownSquad) return <Navigate replace to={`/my-squads?${new URLSearchParams({ clubId: String(clubId), squad: squad! })}`} />;
    // The campaigns manager is Projects now (step 4): its old links land there.
    if (isProjectsTool(rawTool)) return <Navigate replace to={projectsPath(clubId)} />;
    // Applications, attendance and preparation moved into My squads (step 3): a bare link to one of the person's squads
    // lands there; a record, a session, another squad or an owner's or admin's link opens the tool here.
    if (known && !leader && tool && isMovedTool(tool) && bareLink(params) && inMySquads(squad)) return <Navigate replace to={movedToolPath(clubId, tool, Object.fromEntries(params))} />;

    const go = (to: string) => guardWorkspaceNavigation(() => navigate(to));
    // While nothing is known yet the side bar waits quietly rather than naming a made-up club.
    const clubName = club.clubName ?? operations.boot?.clubName ?? (known ? copy('Club', 'კლუბი') : '…');
    const jobs = focusableViews(roles?.views ?? []).map(view => view.label);
    // Someone without a job here has no job line.
    const job = !known ? undefined : isLeadershipRole(role) ? clubRoleLabel(role) : jobs.join(', ') || (staff ? copy('Club staff', 'კლუბის პერსონალი') : undefined);
    // A failed load is never "not for you": when neither the access check nor the jobs answered, say so and retry.
    // The management overview refuses everyone without a staff membership (a physio's job), so it decides nothing here.
    const failed = known && can.failed && !roles && Boolean(workspaceRoles.error);
    const retry = () => { refreshAccess(); workspaceRoles.refresh(); void club.reload(); void operations.refresh(); };
    const adultsOnly = copy('Club office is for adults, so we ask once.', 'კლუბის ოფისი სრულწლოვნებისთვისაა, ამიტომ ერთხელ გეკითხებით.');
    const primary: WorkspaceNavItem[] = [
        { id: 'staff', label: copy('Staff', 'პერსონალი'), icon: Users },
        ...(leader ? [{ id: 'squads', label: copy('Squads', 'გუნდები'), icon: ShieldCheck }, { id: 'settings', label: copy('Settings', 'პარამეტრები'), icon: Settings }] : []),
    ];
    const quiet: WorkspaceNavItem[] = anyTool ? [{ id: 'tools', label: copy('More tools', 'სხვა ინსტრუმენტები'), icon: LayoutGrid }] : [];
    // Projects (step 4) is a page of its own; owners and admins reach it from here too.
    const footer: WorkspaceNavItem[] = [{ id: 'calendar', label: copy('Calendar', 'კალენდარი'), icon: CalendarDays },
        ...(leader ? [{ id: 'projects', label: copy('Projects', 'პროექტები'), icon: FolderKanban }] : [])];
    const pathOf = (id: string) => id === 'projects' ? projectsPath(clubId) : officePath(clubId, id as OfficePlace);

    let content: ReactNode;
    if (!known && !roles && !club.overview) content = <PageFrame className="cw-page"><div className="cw-loading" role="status" aria-label={copy('Loading Club office', 'კლუბის ოფისი იტვირთება')}>
        <Skeleton height={34} width="30%" /><Skeleton height={96} /><Skeleton height={280} /></div></PageFrame>;
    else if (failed) content = <PageFrame className="cw-page"><div className="gk-notice gk-notice--danger" role="alert">
        <span className="cw-notices__text">{workspaceRoles.error || club.error || copy('Club office didn’t load.', 'კლუბის ოფისი ვერ ჩაიტვირთა.')}</span>
        <Button size="sm" onClick={retry}>{copy('Try again', 'თავიდან')}</Button></div></PageFrame>;
    else if (known && birthDateFirst) content = <PageFrame className="cw-page">
        <EmptyNote title={copy('Your date of birth first', 'ჯერ დაბადების თარიღი')}
            action={<Button variant="primary" onClick={() => setAskBirthDate(true)}>{copy('Add your date of birth', 'დაბადების თარიღის დამატება')}</Button>}>{adultsOnly}</EmptyNote>
        {askBirthDate && <BirthDateStep reason={adultsOnly} onClose={() => setAskBirthDate(false)} onSaved={() => { setAskBirthDate(false); retry(); }} />}
    </PageFrame>;
    else if (known && !staff) content = <PageFrame className="cw-page"><EmptyNote title={copy('Club office is for the club’s staff', 'კლუბის ოფისი კლუბის პერსონალისთვისაა')}
        action={<ButtonLink to={`/clubs/${clubId}`}>{copy('Club page', 'კლუბის გვერდი')}</ButtonLink>}>{copy('The club page shows its teams, news and how to get involved.', 'კლუბის გვერდზე ჩანს გუნდები, სიახლეები და როგორ ჩაერთოთ.')}</EmptyNote></PageFrame>;
    else if (place === 'squads') content = <>
        <WorkspaceNotices error={squadNotice.error} success={squadNotice.success} rolesError={null} onRetryRoles={workspaceRoles.refresh}
            onDismissError={() => setSquadNotice(notice => ({ ...notice, error: null }))} onDismissSuccess={() => setSquadNotice(notice => ({ ...notice, success: null }))} />
        <SquadsPage key={clubId} clubId={clubId} overview={club.overview}
            setParentError={error => setSquadNotice(notice => ({ ...notice, error }))} setParentSuccess={success => setSquadNotice(notice => ({ ...notice, success }))}
            workspace={roles ? { data: roles, boot: operations.boot, onOpen: (next, context = {}) => go(isOfficeTool(next) ? officeToolPath(clubId, next, { ...context, return: 'squads' }) : officePath(clubId, 'squads', context)) } : undefined} />
    </>;
    else if (place === 'settings') content = <OfficeSettings clubId={clubId} clubName={clubName} crest={club.clubLogoUrl} overview={club.overview} boot={operations.boot} onRefresh={operations.refresh} />;
    else if (place === 'calendar') content = <ClubCalendar clubId={clubId} clubName={clubName} canManage={leader || Boolean(roles?.squads.length)} />;
    else if (place === 'tools' && tool) content = <OfficeTool clubId={clubId} tool={tool} state={states.get(tool)} sessionId={sessionId} overview={club.overview} reloadOverview={club.reload}
        boot={operations.boot} bootLoading={operations.loading} bootError={operations.error} refreshBoot={operations.refresh} roles={roles} refreshRoles={workspaceRoles.refresh}
        admissions={admissions} leader={leader} admin={can.admin} />;
    else if (place === 'tools') content = <MoreTools clubId={clubId} states={states} boot={operations.boot} leader={leader} onSquads={!leader && inMySquads(null)} admin={can.admin} />;
    else content = <ClubPeople key={clubId} clubId={clubId} clubName={clubName} members={club.overview?.members} invitations={club.overview?.pendingInvitations}
        tools={{ duties: opens('staff-duties'), specialists: opens('specialists') }}
        onChanged={() => { void club.reload(); void operations.refresh(); workspaceRoles.refresh(); }} />;

    return <WorkspaceShell label={copy('Club office', 'კლუბის ოფისი')} storageKey={`office-${clubId}`} guard={guardWorkspaceNavigation} canvas
        context={{ name: clubName, crest: club.clubLogoUrl, role: job, back: { label: copy('Club page', 'კლუბის გვერდი'), to: `/clubs/${clubId}` } }}
        primary={primary} quiet={quiet} footer={footer} active={place} onSelect={id => go(pathOf(id))}
        hrefFor={pathOf} sectionTitle={copy('Club office', 'კლუბის ოფისი')}>
        {workspaceRoles.error && roles && <div className="gk-notice gk-notice--warning" role="alert"><span className="cw-notices__text">{workspaceRoles.error}</span>
            <Button size="sm" onClick={workspaceRoles.refresh}>{copy('Try again', 'თავიდან')}</Button></div>}
        {content}
    </WorkspaceShell>;
}
