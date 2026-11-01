import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Badge, Button, EmptyNote, PageFrame, PageHeader, Panel, Skeleton } from '../../design/primitives';
import type { AuthSessionId } from '../../utils/authStorage';
import { formatDate } from '../../utils/formatting';
import { label } from '../clubOperations/api';
import { isFinished, statusTone } from '../clubOperations/records/recordStatus';
import { canReadScope, privateModules, type DeskTool } from './registry';
import { workspaceRecordPath, workspaceSectionPath } from './paths';
import type { JobWorkContext, JobWorkspace, JobWorkspaceManifest } from './types';
import { useDeskWork } from './useDeskWork';
import { WorkspaceLink } from './WorkspaceLink';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { workspaceTitle } from './copy';

export function WorkspaceToolList({ club, workspace, tools }: { club: number; workspace: JobWorkspace; tools: DeskTool[] }) {
    const [params] = useSearchParams();
    return <ul className="job-workspaces__destinations">{tools.map(tool => <li key={tool.id}>
        <WorkspaceLink to={workspaceSectionPath(club, workspace, tool.id, params)}><tool.icon aria-hidden="true" /><span><strong>{tool.label}</strong><span>{tool.description}</span></span><ArrowRight aria-hidden="true" /></WorkspaceLink>
    </li>)}</ul>;
}

export function WorkspaceOverview({ manifest, workspace, tools, session, renderSharedWork }: {
    manifest: JobWorkspaceManifest; workspace: JobWorkspace; tools: DeskTool[]; session: AuthSessionId;
    renderSharedWork?: (context: JobWorkContext) => ReactNode;
}) {
    const copy = useJourneyCopy();
    const [params] = useSearchParams();
    const activeSquad = params.has('squad') ? Number(params.get('squad')) : null;
    const current = tools.filter(tool => !privateModules.has(tool.module) && tool.module !== 'SCOUTING' && canReadScope(tool.scope, activeSquad)).slice(0, 3);
    return <PageFrame className="job-workspaces__page">
        <PageHeader title={workspaceTitle(workspace, copy)} subtitle={copy('Overview', 'მიმოხილვა')} />
        {!!tools.length && <Panel title={copy('Tools for your work', 'თქვენი სამუშაო ინსტრუმენტები')} flush><WorkspaceToolList club={manifest.clubId} workspace={workspace} tools={tools.slice(0, 3)} />
            {tools.length > 3 && <div className="job-workspaces__more"><WorkspaceLink to={workspaceSectionPath(manifest.clubId, workspace, 'tools', params)}>{copy('All permitted tools', 'ყველა ნებადართული ინსტრუმენტი')}</WorkspaceLink></div>}
        </Panel>}
        {current.map(tool => <CurrentWork key={tool.id} manifest={manifest} workspace={workspace} tool={tool} session={session} />)}
        {workspace.key === 'scouting' && <p>{copy('Open Scouting to see your current watch records, permitted adult players and family applications.', 'სკაუტინგში ნახავთ დაკვირვების მიმდინარე ჩანაწერებს, თქვენთვის ხელმისაწვდომ სრულწლოვან მოთამაშეებსა და ოჯახების განაცხადებს.')}</p>}
        {tools.some(tool => privateModules.has(tool.module)) && <p>{copy('Private care and concerns open in their own permitted tool. They are not included in the shared overview.', 'პირადი ზრუნვის ჩანაწერები და შეშფოთებები შესაბამის ნებადართულ ინსტრუმენტში იხსნება. საერთო მიმოხილვაში ისინი არ ჩანს.')}</p>}
        {['matches', 'media'].includes(workspace.key) && <Panel padded title={workspace.key === 'media' ? copy('Club updates', 'კლუბის სიახლეები') : copy('Match work', 'მატჩებზე მუშაობა')}>
            <p>{workspace.key === 'media' ? copy('Use the club’s existing posts and media. Publishing remains subject to your current permission.', 'გამოიყენეთ კლუბის არსებული პოსტები და მედია. გამოქვეყნებას კვლავ შესაბამისი მიმდინარე უფლება სჭირდება.') : copy('Use the existing match and calendar records. Appointments and results keep their own authority.', 'გამოიყენეთ მატჩებისა და კალენდრის არსებული ჩანაწერები. დანიშვნებსა და შედეგებზე უფლებები ცალკე მოწმდება.')}</p>
            <ul className="job-workspaces__destinations"><li><WorkspaceLink to={`/clubs/${manifest.clubId}`}>{copy('Club page and posts', 'კლუბის გვერდი და პოსტები')}<ArrowRight aria-hidden="true" /></WorkspaceLink></li>
                <li><WorkspaceLink to="/world/matches">{copy('Matches & competitions', 'მატჩები და შეჯიბრებები')}<ArrowRight aria-hidden="true" /></WorkspaceLink></li></ul>
        </Panel>}
        {!tools.length && !['matches', 'media'].includes(workspace.key) && <EmptyNote title={copy('No supported tools are available in this desk', 'ამ სამუშაო სივრცეში მხარდაჭერილი ინსტრუმენტები ხელმისაწვდომი არ არის')}>{copy('Open another available workspace or retry your current responsibilities.', 'გახსენით სხვა ხელმისაწვდომი სამუშაო სივრცე ან თავიდან ჩატვირთეთ თქვენი მიმდინარე მოვალეობები.')}</EmptyNote>}
        {renderSharedWork?.({ manifest, workspace })}
    </PageFrame>;
}

function CurrentWork({ manifest, workspace, tool, session }: { manifest: JobWorkspaceManifest; workspace: JobWorkspace; tool: DeskTool; session: AuthSessionId }) {
    const copy = useJourneyCopy();
    const [params] = useSearchParams();
    const read = useDeskWork(manifest.clubId, manifest.actorId, session, tool, params);
    const rows = read.rows.filter(row => !isFinished(row.status)).slice(0, 5);
    return <Panel title={`${copy('Current work', 'მიმდინარე საქმეები')} · ${tool.label}`} flush action={<WorkspaceLink to={workspaceSectionPath(manifest.clubId, workspace, tool.id, params)}>{copy('Open tool', 'ინსტრუმენტის გახსნა')}</WorkspaceLink>}>
        {read.loading ? <div className="job-workspaces__note" role="status" aria-label={`${copy('Loading', 'იტვირთება')}: ${tool.label}`}><Skeleton height={88} /></div>
            : read.error ? <div className="job-workspaces__note" role="alert"><p>{read.error}</p><Button size="sm" onClick={read.refresh}>{copy('Try again', 'თავიდან')}</Button></div>
                : !rows.length ? <div className="job-workspaces__note"><EmptyNote title={copy('No open records returned', 'მიმდინარე ჩანაწერები ვერ მოიძებნა')}>{copy('Open the tool for all records, history and available actions.', 'ყველა ჩანაწერის, ისტორიისა და ხელმისაწვდომი მოქმედებების სანახავად გახსენით ინსტრუმენტი.')}</EmptyNote></div>
                    : <ul className="job-workspaces__records">{rows.map(row => <li key={row.id}><WorkspaceLink to={workspaceRecordPath(manifest.clubId, workspace, tool.id, row, params)}>
                        <span><strong>{row.title}</strong>{row.due_on && <span>{copy('Due', 'ვადა')}: {formatDate(row.due_on)}</span>}</span><Badge tone={statusTone(row)}>{label(row.status)}</Badge><ArrowRight aria-hidden="true" />
                    </WorkspaceLink></li>)}</ul>}
        {!!rows.length && <p className="job-workspaces__note">{copy('Up to five open source records. The tool holds the full list and current actions.', 'ნაჩვენებია მაქსიმუმ ხუთი მიმდინარე საწყისი ჩანაწერი. სრული სია და მიმდინარე მოქმედებები ინსტრუმენტშია.')}</p>}
    </Panel>;
}
