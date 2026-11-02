import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageFrame } from '../../design/primitives';
import type { AuthSessionId } from '../../utils/authStorage';
import { todayIso } from '../../utils/age';
import { formatDate } from '../../utils/formatting';
import { label } from '../clubOperations/api';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { waitingTools, type DeskTool } from './registry';
import { workspaceRecordPath } from './paths';
import type { JobWorkspace, JobWorkspaceManifest } from './types';
import { useDeskWaiting } from './useDeskWaiting';
import { WorkspaceLink } from './WorkspaceLink';

/**
 * What waits on this job, in one row at the top of its main tool, like Home's "waiting on you": the first item and
 * "+ N more"; each is a dot, the record, its status in words (red when overdue) and an arrow. Shown only when something waits.
 */
export function DeskWaiting({ manifest, workspace, tools, session }: { manifest: JobWorkspaceManifest; workspace: JobWorkspace; tools: DeskTool[]; session: AuthSessionId }) {
    const copy = useJourneyCopy();
    const [params] = useSearchParams();
    const [expanded, setExpanded] = useState(false);
    const squad = params.has('squad') ? Number(params.get('squad')) : null;
    const listed = waitingTools(tools, squad);
    const read = useDeskWaiting(manifest.clubId, manifest.actorId, session, listed, params);
    if (!listed.length || read.loading || !read.error && !read.rows.length) return null;
    const today = todayIso();
    return <PageFrame className="job-workspaces__waiting"><section aria-label={copy('Waiting on you', 'თქვენ გელოდებათ')} data-expanded={expanded || undefined}>
        {read.error ? <p role="alert">{read.error} <button type="button" onClick={read.refresh}>{copy('Try again', 'თავიდან')}</button></p>
            : <ul>{(expanded ? read.rows : read.rows.slice(0, 1)).map(row => {
                const tool = listed.find(item => item.module === row.module)!;
                const urgent = row.expired || Boolean(row.due_on && row.due_on < today);
                return <li key={`${row.module}:${row.id}`} data-urgent={urgent || undefined}>
                    <WorkspaceLink to={workspaceRecordPath(manifest.clubId, workspace, tool.id, row, params)}>
                        <span className="job-workspaces__dot" aria-hidden="true" />
                        <span><strong>{row.title}</strong><small>{label(row.status)}{row.due_on && ` · ${formatDate(row.due_on)}`}</small></span>
                        <ArrowRight aria-hidden="true" />
                    </WorkspaceLink>
                </li>;
            })}</ul>}
        {!read.error && read.rows.length > 1 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
            {expanded ? copy('Show less', 'ნაკლების ჩვენება') : copy(`+ ${read.rows.length - 1} more`, `+ კიდევ ${read.rows.length - 1}`)}</button>}
    </section></PageFrame>;
}
