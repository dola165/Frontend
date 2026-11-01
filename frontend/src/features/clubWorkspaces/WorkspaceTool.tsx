import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, EmptyNote, PageFrame, Skeleton } from '../../design/primitives';
import type { AuthSessionId } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useClubOperations } from '../clubOperations/useClubOperations';
import { useWorkspaceRoles } from '../clubOperations/useWorkspaceRoles';
import { WorkspaceOperations } from '../clubOperations/WorkspaceOperations';
import { guardWorkspaceNavigation } from '../clubOperations/workspaceGuard';
import { coachOriginTarget } from '../clubOperations/coachOrigin';
import { mySquadIds } from '../clubWorkspace/coachHub/coachData';
import { TravelWorkspace } from '../travel/TravelWorkspace';
import { Scouting } from '../scouting/Scouting';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { JobWorkspaceManifest, JobWorkspace } from './types';
import type { DeskTool } from './registry';
import { workspaceSectionPath } from './paths';
import { scopeBootstrap } from './scopeBootstrap';
import { WorkspaceLink } from './WorkspaceLink';
import { workspaceLoadError } from './copy';

export function WorkspaceTool({ manifest, workspace, tool, session }: { manifest: JobWorkspaceManifest; workspace: JobWorkspace; tool: DeskTool; session: AuthSessionId }) {
    const copy = useJourneyCopy();
    const [params] = useSearchParams();
    if (tool.module === 'SCOUTING') return <><div className="job-workspaces__back"><WorkspaceLink to={workspaceSectionPath(manifest.clubId, workspace, 'overview', params)}><ArrowLeft aria-hidden="true" />{copy('Back to overview', 'უკან: მიმოხილვა')}</WorkspaceLink></div>
        <Scouting key={`${session}:${manifest.clubId}`} clubId={manifest.clubId} sessionId={session} /></>;
    return <OperationTool manifest={manifest} workspace={workspace} tool={tool} />;
}

function OperationTool({ manifest, workspace, tool }: { manifest: JobWorkspaceManifest; workspace: JobWorkspace; tool: DeskTool }) {
    const copy = useJourneyCopy();
    const operations = useClubOperations(manifest.clubId);
    const roles = useWorkspaceRoles(manifest.clubId, 'all', manifest.actorId);
    const [retryError, setRetryError] = useState<{ cause: unknown } | null>(null);
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const retry = () => { setRetryError(null); roles.refresh(); void operations.refresh().catch(cause => setRetryError({ cause })); };
    if (operations.loading || roles.loading) return <PageFrame><div role="status" aria-label={copy('Loading the tool', 'ინსტრუმენტი იტვირთება')}><Skeleton height={160} /></div></PageFrame>;
    if (retryError || operations.error || roles.error || !operations.boot || !roles.data) return <PageFrame><div role="alert"><p>{retryError ? extractApiErrorMessage(retryError.cause, copy('Could not reload this tool.', 'ინსტრუმენტი თავიდან ვერ ჩაიტვირთა.')) : workspaceLoadError(operations.error || roles.error || copy('Could not load this tool.', 'ინსტრუმენტი ვერ ჩაიტვირთა.'), copy)}</p><Button onClick={retry}>{copy('Try again', 'თავიდან')}</Button></div></PageFrame>;
    if (operations.boot.actorId !== manifest.actorId || operations.boot.clubId !== manifest.clubId || roles.data.actorId !== manifest.actorId) return <PageFrame><p role="alert">{copy('Could not confirm this tool’s account and club context.', 'ამ ინსტრუმენტის ანგარიშისა და კლუბის კონტექსტი ვერ დადასტურდა.')}</p></PageFrame>;
    const boot = scopeBootstrap(operations.boot, workspace, roles.data, tool.module);
    const permission = boot.modules.find(item => item.id === tool.module);
    if (!permission || !permission.globalRead && !permission.readSquads?.length) return <PageFrame><EmptyNote title={copy('This tool is no longer available in your current scope', 'თქვენი მიმდინარე უფლებებით ეს ინსტრუმენტი აღარ არის ხელმისაწვდომი')} action={<Button onClick={retry}>{copy('Reload current access', 'მიმდინარე უფლებების თავიდან ჩატვირთვა')}</Button>} /></PageFrame>;
    const coach = coachOriginTarget(params, manifest.clubId, mySquadIds(roles.data.views));
    const overview = workspaceSectionPath(manifest.clubId, workspace, 'overview', params);
    const origin = { label: coach ? copy('Back to My squads', 'უკან: ჩემი გუნდები') : copy('Back to overview', 'უკან: მიმოხილვა'), onBack: () => guardWorkspaceNavigation(() => navigate(coach ?? overview)) };
    const direct = ['record', 'new', 'person', 'player', 'session', 'scope'].some(key => params.has(key));
    // The canonical travel coordinator is for actual writers; legacy/read-only records still open unchanged.
    if (tool.module === 'TRAVEL' && permission.writable && !direct) return <PageFrame><div className="job-workspaces__back"><Button variant="ghost" onClick={origin.onBack}><ArrowLeft aria-hidden="true" />{origin.label}</Button></div>
        <TravelWorkspace clubId={manifest.clubId} squadId={params.has('squad') ? Number(params.get('squad')) : undefined} /></PageFrame>;
    const content = <WorkspaceOperations boot={boot} module={tool.module} onRefresh={operations.refresh} origin={origin} />;
    // Eligibility and private care are compact panels; lists and direct record details supply their own frame/back.
    const compact = tool.module === 'REGISTRATION' && !params.has('record') && params.get('registration') !== 'records'
        || ['MEDICAL', 'WELLBEING'].includes(tool.module) && (!params.has('record') || params.has('person'));
    return compact ? <PageFrame><div className="job-workspaces__back"><Button variant="ghost" onClick={origin.onBack}><ArrowLeft aria-hidden="true" />{origin.label}</Button></div>{content}</PageFrame> : content;
}
