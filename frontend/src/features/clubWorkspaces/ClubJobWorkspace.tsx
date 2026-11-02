import type { ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Badge, Button, EmptyNote, GkRoot, PageFrame, PageHeader, Panel, Skeleton } from '../../design/primitives';
import { WorkspaceShell, type WorkspaceNavItem } from '../../design/workspace/WorkspaceShell';
import type { AuthSessionId } from '../../utils/authStorage';
import { useCan } from '../../hooks/useCan';
import { guardWorkspaceNavigation } from '../clubOperations/workspaceGuard';
import { officePath } from '../clubOffice/officeLinks';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { useJobWorkspaces } from './useJobWorkspaces';
import { canReadScope, inboxItem, indexItem, mainTool, toolsItem, workElsewhere, workspaceTools } from './registry';
import { jobWorkspacePath, workspaceDestinationPath, workspaceSectionPath } from './paths';
import { WorkspaceIndex } from './WorkspaceIndex';
import { WorkspaceToolList } from './WorkspaceToolList';
import { WorkspaceTool } from './WorkspaceTool';
import { WorkspaceLink } from './WorkspaceLink';
import { DeskWaiting } from './DeskWaiting';
import type { JobWorkspace, JobWorkspaceManifest } from './types';
import { workspaceTitle } from './copy';
import './job-workspaces.css';

export function ClubJobWorkspace({ clubId, actorId, sessionId, workspaceKey }: { clubId: number; actorId: number; sessionId: AuthSessionId; workspaceKey?: string }) {
    const copy = useJourneyCopy();
    const read = useJobWorkspaces(clubId, actorId, sessionId);
    const [params] = useSearchParams();
    if (read.loading) return <GkRoot className="job-workspaces"><PageFrame><div role="status" aria-label={copy('Loading your club workspaces', 'კლუბში თქვენი სამუშაო სივრცეები იტვირთება')}><Skeleton height={34} /><Skeleton height={180} /></div></PageFrame></GkRoot>;
    if (!read.data) return <GkRoot className="job-workspaces"><PageFrame><PageHeader title={copy('Your club work', 'თქვენი სამუშაო კლუბში')} /><div role="alert"><p>{read.error || copy('Could not load your club workspaces.', 'კლუბში თქვენი სამუშაო სივრცეები ვერ ჩაიტვირთა.')}</p><Button onClick={read.refresh}>{copy('Try again', 'თავიდან')}</Button></div></PageFrame></GkRoot>;
    const manifest = read.data, workspace = manifest.workspaces.find(item => item.key === workspaceKey);
    if (workspaceKey && !workspace) return <GkRoot className="job-workspaces"><PageFrame><EmptyNote title={copy('This workspace is not available for your current responsibilities', 'ეს სამუშაო სივრცე თქვენი მიმდინარე მოვალეობებისთვის ხელმისაწვდომი არ არის')}
        action={<WorkspaceLink to={jobWorkspacePath(clubId)}>{copy('Available workspaces', 'ხელმისაწვდომი სამუშაო სივრცეები')}</WorkspaceLink>} /></PageFrame></GkRoot>;
    if (workspace && workspace.path.split('?')[0] !== jobWorkspacePath(clubId, workspace.key)) return <Navigate replace to={workspaceDestinationPath(workspace, params)} />;
    const elsewhere = workspace && workElsewhere[workspace.key];
    if (elsewhere) return <Navigate replace to={elsewhere(clubId)} />;
    const blocked = read.revalidating || Boolean(read.error);
    return <div className="job-workspaces">
        {blocked && <GkRoot><PageFrame>{read.error ? <div role="alert"><p>{read.error}</p><Button onClick={read.refresh}>{copy('Try again', 'თავიდან')}</Button></div>
            : <p role="status">{copy('Checking your current workspace access…', 'სამუშაო სივრცეზე თქვენი მიმდინარე უფლებები მოწმდება…')}</p>}</PageFrame></GkRoot>}
        {/* Keep canonical editor/recovery memory mounted, but inaccessible until current authority answers. */}
        <div hidden={blocked} inert={blocked}>
            <DeskShell key={workspace?.key ?? 'index'} manifest={manifest} workspace={workspace} session={sessionId} />
        </div>
    </div>;
}

/** A workspace opens on its main tool; another tool is `?tool=`, the full list (when the rail can't hold them) `?deskTab=tools`. */
function DeskShell({ manifest, workspace, session }: { manifest: JobWorkspaceManifest; workspace?: JobWorkspace; session: AuthSessionId }) {
    const copy = useJourneyCopy();
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const can = useCan(`club:${manifest.clubId}`);
    const staffDecision = can.decide('see_staff', false);
    const colleagues = !can.pending && !can.failed && !staffDecision.pending && staffDecision.allowed === true;
    const tools = workspace ? workspaceTools(workspace, copy) : [];
    const main = workspace ? mainTool(workspace, tools) : undefined;
    const rawTool = params.get('tool'), tool = tools.find(item => item.id === rawTool);
    const listing = params.get('deskTab') === 'tools';
    const selected = tool ?? (params.has('tool') || params.has('deskTab') ? undefined : main);
    const active = selected?.id ?? (listing ? 'tools' : indexItem.id);
    const railTools = tools.length > 4 ? tools.slice(0, 3) : tools;
    const primary: WorkspaceNavItem[] = [...railTools.map(item => ({ id: item.id, label: item.label, icon: item.icon, view: !item.scope.globalWrite && !item.scope.writeSquadIds.length })),
        ...(tools.length > railTools.length ? [{ ...toolsItem, label: copy('All tools', 'ყველა ინსტრუმენტი') }] : [])];
    const hrefFor = (id: string) => id === 'inbox' ? '/requests' : id === 'colleagues' ? officePath(manifest.clubId, 'staff') : workspace ? workspaceSectionPath(manifest.clubId, workspace, id, params) : jobWorkspacePath(manifest.clubId);
    const squad = params.has('squad') ? Number(params.get('squad')) : null;
    const badScope = selected && params.has('squad') && (!Number.isSafeInteger(squad) || !squad || !canReadScope(selected.scope, squad));
    // Retire an editor on a confirmed scope change, not a fresh object or reordered identical squad lists.
    const toolKey = selected ? JSON.stringify([selected.id, selected.scope.globalRead, selected.scope.globalWrite,
        [...selected.scope.readSquadIds].sort((a, b) => a - b), [...selected.scope.writeSquadIds].sort((a, b) => a - b)]) : '';
    // The way out of a wrong tool or squad is the job's main tool (the squad itself is the problem in the second case).
    const start = (context: URLSearchParams) => workspace && main && <WorkspaceLink to={workspaceSectionPath(manifest.clubId, workspace, null, context)}>{copy(`Open ${main.label}`, `${main.label}: გახსნა`)}</WorkspaceLink>;
    let content: ReactNode;
    if (!workspace) content = <WorkspaceIndex manifest={manifest} />;
    else if (!tools.length) content = <PageFrame><EmptyNote title={copy('No supported tools are available in this workspace', 'ამ სამუშაო სივრცეში მხარდაჭერილი ინსტრუმენტები ხელმისაწვდომი არ არის')}
        action={<WorkspaceLink to={jobWorkspacePath(manifest.clubId)}>{copy('Available workspaces', 'ხელმისაწვდომი სამუშაო სივრცეები')}</WorkspaceLink>} /></PageFrame>;
    else if (params.has('tool') && (!tool || params.getAll('tool').length !== 1) || params.has('deskTab') && (!listing || params.getAll('deskTab').length !== 1)) content = <PageFrame><EmptyNote title={copy('This tool is not available in this workspace', 'ეს ინსტრუმენტი ამ სამუშაო სივრცეში ხელმისაწვდომი არ არის')} action={start(params)} /></PageFrame>;
    else if (badScope) content = <PageFrame><EmptyNote title={copy('This squad is outside this tool’s current scope', 'ამ ინსტრუმენტზე თქვენი მიმდინარე უფლებები ამ გუნდზე არ ვრცელდება')} action={start(new URLSearchParams())} /></PageFrame>;
    else if (selected) content = <>
        {selected === main && !params.has('record') && <DeskWaiting manifest={manifest} workspace={workspace} tools={tools} session={session} />}
        <WorkspaceTool key={toolKey} manifest={manifest} workspace={workspace} tool={selected} session={session} />
    </>;
    else content = <PageFrame><PageHeader title={copy('Tools', 'ინსტრუმენტები')} /><Panel flush><WorkspaceToolList club={manifest.clubId} workspace={workspace} tools={tools} /></Panel></PageFrame>;
    const title = workspace ? workspaceTitle(workspace, copy) : copy('Your club work', 'თქვენი სამუშაო კლუბში');
    return <div className="job-workspaces"><WorkspaceShell label={title} storageKey={`job-work-${manifest.clubId}`} canvas guard={guardWorkspaceNavigation}
        context={{ name: manifest.clubName, role: workspace ? title : undefined, back: { label: workspace ? copy('Your club work', 'თქვენი სამუშაო კლუბში') : copy('Club page', 'კლუბის გვერდი'), to: workspace ? jobWorkspacePath(manifest.clubId) : `/clubs/${manifest.clubId}` } }}
        primary={workspace ? primary : [{ ...indexItem, label: copy('Workspaces', 'სამუშაო სივრცეები') }]} footer={[{ ...inboxItem, label: copy('Inbox', 'შემოსულები') }, ...(colleagues ? [{ id: 'colleagues', label: copy('Colleagues', 'კოლეგები'), icon: Users }] : [])]}
        active={active} sectionTitle={title} hrefFor={hrefFor} onSelect={id => guardWorkspaceNavigation(() => navigate(hrefFor(id)))}>
        {workspace?.maturity === 'prototype' && <div className="job-workspaces__prototype" role="status"><Badge>{copy('Prototype', 'პროტოტიპი')}</Badge><span>{copy('Workspace layout in preview · existing tool permissions apply', 'სამუშაო სივრცის საცდელი ვერსია · ინსტრუმენტებზე არსებული უფლებები მოქმედებს')}</span></div>}
        {content}
    </WorkspaceShell></div>;
}
