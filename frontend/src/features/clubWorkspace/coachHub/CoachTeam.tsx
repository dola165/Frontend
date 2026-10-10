import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle, Plus } from 'lucide-react';
import { Avatar, Badge, Button, ButtonLink, EmptyNote, List, ListRow, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import { DataTable, PrimaryCell, type Column } from '../../../design/DataTable';
import { nextSort, type TableSort } from '../../../design/tableSort';
import { RecordTable } from '../../clubOperations/records/RecordList';
import { operationTab } from '../../clubOperations/workspaceNavigation';
import { focusableViews } from '../../clubOperations/workspaceStructure';
import { requestBadge } from '../../clubOperations/roleAccess';
import { viewSquads } from './coachData';
import { ResponsibilityRequests } from './ResponsibilityRequests';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

interface Coach { id: number; name: string; squads: string[]; head: string[] }

/**
 * The people I coach with: who else works with my squads, the duties shared out for them (cover, kit, match
 * day), and my own responsibilities, with a way to ask the club for another one.
 */
export function CoachTeam({ data }: { data: CoachData }) {
    const [params, setParams] = useSearchParams();
    const [asking, setAsking] = useState(false);
    const { roles, names } = data;
    const sortBy = params.get('sort'), descending = params.get('dir') === 'desc';
    const sort = useMemo<TableSort | null>(() => sortBy ? { by: sortBy, descending } : null, [sortBy, descending]);

    const coaches = new Map<number, Coach>();
    for (const squad of data.squads ?? []) for (const coach of squad.overview?.coaches ?? []) {
        const entry = coaches.get(coach.user_id) ?? { id: coach.user_id, name: coach.full_name, squads: [], head: [] };
        const name = names.get(squad.id) ?? '';
        entry.squads.push(name);
        if (squad.overview?.head_coach_id === coach.user_id) entry.head.push(name);
        coaches.set(coach.user_id, entry);
    }
    const columns: Column<Coach>[] = [
        { id: 'coach', label: 'Coach', width: 'minmax(220px, 2fr)', render: coach => <PrimaryCell lead={<Avatar name={coach.name} size={30} />}
            title={coach.id === roles.actorId ? `${coach.name} (you)` : coach.name} subtitle={coach.head.length ? `Head coach · ${coach.head.join(', ')}` : 'Coach'} /> },
        { id: 'squads', label: 'Your squads together', width: 'minmax(160px, 2fr)', render: coach => coach.squads.join(', ') },
    ];
    const duties = data.records.rows.filter(record => record.module === 'STAFF');
    const responsibilities = focusableViews(roles.views);
    const requests = roles.requests.filter(request => request.user_id === roles.actorId && request.status === 'PENDING');

    return <PageFrame className="cw-page ch-page">
        <PageHeader title="Coaching team" subtitle="Who works with your squads, who does what, and your own responsibilities."
            actions={<Button onClick={() => setAsking(true)}><Plus aria-hidden="true" />Ask for another responsibility</Button>} />
        <div className="gk-stack">
            <Section title="Coaches on your squads">
                {!data.squads ? <Panel><div className="cw-skeleton-rows" role="status" aria-label="Loading the coaching team">{[0, 1].map(i => <Skeleton key={i} height={44} />)}</div></Panel>
                    : coaches.size ? <DataTable label="Coaches on your squads" columns={columns} rows={[...coaches.values()]} rowKey={coach => coach.id}
                        actions={coach => coach.id === roles.actorId ? null : <ButtonLink size="sm" variant="ghost" className="gk-dt__keep" to={`/messages?chatWith=${coach.id}`}><MessageCircle aria-hidden="true" />Message</ButtonLink>} />
                        : <Panel><EmptyNote title="No other coaches yet">Coaches the club adds to your squads appear here.</EmptyNote></Panel>}
            </Section>
            <Section title="Duties for your squads" hint="Session cover, kit, match day and other shared jobs">
                {data.records.loading ? <Panel><div className="cw-skeleton-rows" role="status" aria-label="Loading duties">{[0, 1].map(i => <Skeleton key={i} height={44} />)}</div></Panel>
                    : duties.length && data.boot ? <RecordTable records={duties} boot={data.boot} home={false} sort={sort}
                        onSort={by => { const value = nextSort(sort, by), next = new URLSearchParams(params); next.delete('sort'); next.delete('dir'); if (value) { next.set('sort', value.by); if (value.descending) next.set('dir', 'desc'); } setParams(next, { replace: true }); }}
                        hrefFor={record => data.workHref(operationTab(record.module), { record: String(record.id) })} onOpen={record => data.openWork(operationTab(record.module), { record: String(record.id) })} />
                        : <Panel><EmptyNote title="No open duties">Duties the club shares out for your squads, such as session cover or a kit check, appear here.</EmptyNote></Panel>}
            </Section>
            <Section title="Your responsibilities" hint="What the club has approved for you">
                <Panel flush>{responsibilities.length ? <List label="Your responsibilities">{responsibilities.map(view => {
                    const where = viewSquads(view, roles);
                    return <ListRow key={view.id} title={view.label} meta={where === 'club' ? 'Whole club' : where ?? 'No squads assigned yet'} />;
                })}{requests.map(request => {
                    const badge = requestBadge(request.status);
                    return <ListRow key={`request-${request.id}`} title={roles.catalog.find(role => role.key === request.role_key)?.title ?? request.role_key} meta="Asked for" trail={<Badge tone={badge.tone}>{badge.text}</Badge>} />;
                })}</List> : <EmptyNote title="No responsibilities yet" action={<Button size="sm" onClick={() => setAsking(true)}>Ask for one</Button>}>A club admin approves each one before anything changes.</EmptyNote>}</Panel>
            </Section>
        </div>
        <ResponsibilityRequests open={asking} clubId={data.clubId} roles={roles} onClose={() => setAsking(false)} onChanged={data.refreshRoles} />
    </PageFrame>;
}
