import { useEffect, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, FolderKanban, Lightbulb, Users } from 'lucide-react';
import { WorkspaceShell, type WorkspaceNavItem } from '../../design/workspace/WorkspaceShell';
import { Button, ButtonLink, EmptyNote, PageFrame, Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { clubRoleLabel, isLeadershipRole } from '../clubs/domain';
import type { MyProjects, ProjectYou } from './api';
import { ProjectList } from './ProjectList';
import { ProjectView } from './ProjectView';
import { PROJECTS_PLACES, placeOf, projectsPath, type ProjectsPlace } from './projectWords';
import { useBoard, useMyProjects, useProject } from './useProjects';
import './projects.css';

/** Calendar and Staff at the foot of the rail open Club office, where they live. */
const officeHref = (clubId: number, id: string) => id === 'calendar' ? `/clubs/${clubId}/office?tab=calendar` : `/clubs/${clubId}/office`;

/**
 * Projects (step 4 of the club plan, owner, 29 October 2026): the club's planner on the one frame. Projects, Ideas
 * and Done, then Calendar and Staff. The project is the shared place: everyone on it sees the same project, and
 * their job decides only which buttons work. The club, the place and any open dialog live in the address;
 * `/projects/{id}` opens one project (the Inbox's links) in its own club's frame.
 */
export function ProjectsPage({ projectId }: { projectId?: number }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const project = useProject(projectId ?? null);
    const asked = Number(params.get('club'));
    const mine = useMyProjects();
    const clubId = projectId ? project.data?.club?.id ?? null : Number.isSafeInteger(asked) && asked > 0 ? asked : null;
    const board = useBoard(clubId);
    const requested = PROJECTS_PLACES.find(place => place === params.get('place')) ?? 'projects';
    const place: ProjectsPlace = projectId && project.data ? placeOf(project.data.summary.status) : requested;

    // Without a club in the address, the first club with work waiting (else the first one) is the page's club.
    useEffect(() => {
        if (projectId || clubId || !mine.data?.length) return;
        const first = [...mine.data].sort((a, b) => b.waitingOnMe - a.waitingOnMe)[0];
        setParams(query => { const next = new URLSearchParams(query); next.set('club', String(first.club.id)); return next; }, { replace: true });
    }, [projectId, clubId, mine.data, setParams]);

    const club = board.data?.club ?? project.data?.club ?? mine.data?.find(entry => entry.club.id === clubId)?.club ?? null;
    // The side bar names the person's job, as Club office does; someone only on a project is "On a project".
    const jobLine = (you?: ProjectYou) => !you ? undefined : isLeadershipRole(you.role) ? clubRoleLabel(you.role)
        : you.jobs.join(', ') || (you.role ? clubRoleLabel(you.role) : copy('On a project', 'პროექტში'));
    const projects = board.data?.projects ?? [];
    const primary: WorkspaceNavItem[] = [
        { id: 'projects', label: copy('Projects', 'პროექტები'), icon: FolderKanban, count: board.data?.needsYou.length },
        { id: 'ideas', label: copy('Ideas', 'იდეები'), icon: Lightbulb, count: projects.filter(p => p.status === 'IDEA').length || undefined },
        { id: 'done', label: copy('Done', 'დასრულებული'), icon: CheckCircle2 },
    ];
    const footer: WorkspaceNavItem[] = clubId ? [
        { id: 'calendar', label: copy('Calendar', 'კალენდარი'), icon: CalendarDays },
        { id: 'staff', label: copy('Staff', 'პერსონალი'), icon: Users },
    ] : [];
    const select = (id: string) => {
        if (!clubId) return;
        if (id === 'calendar' || id === 'staff') navigate(officeHref(clubId, id));
        else navigate(projectsPath(clubId, id as ProjectsPlace));
    };
    const hrefFor = (id: string) => !clubId ? '/projects' : id === 'calendar' || id === 'staff' ? officeHref(clubId, id) : projectsPath(clubId, id as ProjectsPlace);
    const title = place === 'ideas' ? copy('Ideas', 'იდეები') : place === 'done' ? copy('Done', 'დასრულებული') : copy('Projects', 'პროექტები');

    let content: ReactNode;
    const loadingNote = <PageFrame className="pj-page"><div className="pj-loading" role="status" aria-label={copy('Loading projects', 'პროექტები იტვირთება')}><Skeleton height={30} width="28%" /><Skeleton height={120} /><Skeleton height={240} /></div></PageFrame>;
    const failed = (message: string, retry: () => void) => <PageFrame className="pj-page"><div className="gk-notice gk-notice--danger" role="alert">
        <span>{message || copy('Projects didn’t load.', 'პროექტები ვერ ჩაიტვირთა.')}</span><Button size="sm" onClick={retry}>{copy('Try again', 'თავიდან')}</Button></div></PageFrame>;
    const notHere = <PageFrame className="pj-page"><EmptyNote title={copy('This project isn’t here', 'ეს პროექტი აქ არ არის')}
        action={<ButtonLink to="/projects">{copy('Your projects', 'თქვენი პროექტები')}</ButtonLink>}>{copy('It may have been removed, or it is for the people on it only.', 'შეიძლება წაიშალა, ან მხოლოდ მასში ჩართულებისთვისაა.')}</EmptyNote></PageFrame>;
    if (projectId) {
        if (project.notFound) content = notHere;
        else if (project.error && !project.data) content = failed(project.error, project.reload);
        else if (!project.data) content = loadingNote;
        else content = <ProjectView project={project.data} onChanged={next => { project.put(next); board.reload(); }} />;
    } else if (mine.error && !mine.data) content = failed(mine.error, mine.reload);
    else if (mine.data && !mine.data.length) content = <PageFrame className="pj-page"><EmptyNote title={copy('Projects are for a club’s staff', 'პროექტები კლუბის პერსონალისთვისაა')}
        action={<ButtonLink to="/home">{copy('Home', 'მთავარი')}</ButtonLink>}>{copy('When a club adds you to its staff or to one of its projects, it shows here.', 'როცა კლუბი დაგამატებთ პერსონალში ან პროექტში, აქ გამოჩნდება.')}</EmptyNote></PageFrame>;
    else if (board.notFound) content = notHere;
    else if (board.error && !board.data) content = failed(board.error, board.reload);
    else if (!board.data) content = loadingNote;
    else content = <ProjectList board={board.data} place={place}
        switcher={(mine.data?.length ?? 0) > 1 ? <ClubSwitch mine={mine.data!} clubId={clubId} onPick={id => navigate(projectsPath(id, place))} /> : undefined}
        onStarted={detail => { board.reload(); navigate(`/projects/${detail.summary.id}`); }} />;

    return <WorkspaceShell label={copy('Projects', 'პროექტები')} storageKey="projects" canvas
        context={{ name: club?.name ?? '…', crest: club?.crestUrl, role: jobLine(board.data?.you ?? project.data?.you), back: club ? { label: copy('Club page', 'კლუბის გვერდი'), to: `/clubs/${club.id}` } : undefined }}
        primary={primary} footer={footer} active={place} onSelect={select} hrefFor={hrefFor} sectionTitle={title}>
        {content}
    </WorkspaceShell>;
}

/** Someone working with several clubs picks whose projects they see. */
function ClubSwitch({ mine, clubId, onPick }: { mine: MyProjects[]; clubId: number | null; onPick: (id: number) => void }) {
    const copy = useJourneyCopy();
    return <label className="pj-switch"><span className="gk-visually-hidden">{copy('Club', 'კლუბი')}</span>
        <select className="gk-input" value={clubId ?? ''} onChange={event => onPick(Number(event.target.value))}>
            {mine.map(entry => <option key={entry.club.id} value={entry.club.id}>{entry.club.name}{entry.waitingOnMe ? ` · ${entry.waitingOnMe}` : ''}</option>)}
        </select>
    </label>;
}
