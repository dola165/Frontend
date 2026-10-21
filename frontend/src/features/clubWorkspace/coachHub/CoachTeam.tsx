import { useState } from 'react';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { ChevronRight, MessageCircle, Plus } from 'lucide-react';
import { Avatar, Badge, Button, ButtonLink, EmptyNote, List, ListRow, PageFrame, PageHeader, Panel, Section, Skeleton } from '../../../design/primitives';
import { operationTab } from '../../clubOperations/workspaceNavigation';
import { focusableViews } from '../../clubOperations/workspaceStructure';
import { label as words } from '../../clubOperations/api';
import { requestBadge } from '../../clubOperations/roleAccess';
import { dueWords } from '../fixtures';
import { viewSquads } from './coachData';
import { ResponsibilityRequests } from './ResponsibilityRequests';
import * as squadApi from '../../squadCommunication/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { SquadSwitch } from './CoachVisuals';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

interface Coach { id: number; name: string; squads: string[]; head: string[] }

/**
 * The people I coach with, as faces a message away; the jobs shared out for my squads (cover, kit, match day),
 * each with who has it; and my own responsibilities, with one button to ask for another.
 */
export function CoachTeam({ data }: { data: CoachData }) {
    const copy = useCopy('coachHub', coachHubEn);
    const [asking, setAsking] = useState(false), [assigning, setAssigning] = useState<number | null>(null), [error, setError] = useState('');
    // Each squad's head coach, chosen from the club's coaches by whoever may assign it.
    const assign = async (squad: number, coach: string) => {
        setAssigning(squad); setError('');
        try { await squadApi.assignCoach(squad, coach ? Number(coach) : null); data.refresh(); }
        catch (cause) { setError(extractApiErrorMessage(cause, copy('headCoachFailed'))); }
        finally { setAssigning(null); }
    };
    const { roles, names } = data;
    const coaches = new Map<number, Coach>();
    for (const squad of data.squads ?? []) {
        if (!data.shown.includes(squad.id)) continue;
        for (const coach of squad.overview?.coaches ?? []) {
            const entry = coaches.get(coach.user_id) ?? { id: coach.user_id, name: coach.full_name, squads: [], head: [] };
            const name = names.get(squad.id) ?? '';
            entry.squads.push(name);
            if (squad.overview?.head_coach_id === coach.user_id) entry.head.push(name);
            coaches.set(coach.user_id, entry);
        }
    }
    const duties = data.records.rows.filter(record => record.module === 'STAFF' && record.squad_id !== null && data.shown.includes(record.squad_id));
    const staffName = (id: number | null) => data.boot?.staff.find(person => person.id === id)?.name ?? null;
    const responsibilities = focusableViews(roles.views);
    const requests = roles.requests.filter(request => request.user_id === roles.actorId && request.status === 'PENDING');

    return <PageFrame className="cw-page ch-page">
        <PageHeader title={copy('coaches')} actions={<Button onClick={() => setAsking(true)}><Plus aria-hidden="true" />{copy('askResponsibility')}</Button>} />
        <SquadSwitch data={data} />
        <div className="gk-stack">
            {!data.squads ? <Skeleton height={150} />
                : <ul className="ch-coaches">{[...coaches.values()].map(coach => {
                    const me = coach.id === roles.actorId;
                    return <li key={coach.id} className="ch-coach">
                        <Avatar name={coach.name} size={60} />
                        <strong>{me ? copy('nameYou', { name: coach.name }) : coach.name}</strong>
                        <span className="ch-coach__role">{coach.head.length ? copy('headCoach') : copy('coach')}</span>
                        <span className="ch-quiet">{coach.squads.join(', ')}</span>
                        {!me && <ButtonLink size="sm" to={`/messages?chatWith=${coach.id}`}><MessageCircle aria-hidden="true" />{copy('message')}</ButtonLink>}
                    </li>;
                })}</ul>}
            {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
            <Section boxed title={copy('headCoachEach')}>
                <Panel>{(data.squads ?? []).filter(squad => data.shown.includes(squad.id) && squad.overview).map(squad => <label key={squad.id} className="ch-headcoach">
                    <strong>{names.get(squad.id)}</strong>
                    <select className="gk-input" value={squad.overview!.head_coach_id ?? ''} disabled={!squad.overview!.can_assign_coach || assigning === squad.id} onChange={event => void assign(squad.id, event.target.value)}>
                        <option value="">{copy('notAssigned')}</option>
                        {squad.overview!.available_coaches.map(coach => <option key={coach.user_id} value={coach.user_id}>{coach.full_name}</option>)}
                    </select>
                </label>)}</Panel>
            </Section>
            <div className="gk-grid gk-grid--split">
                <Section boxed title={copy('sharedJobs')} hint={copy('sharedJobsHint')}>
                    <Panel flush>{data.records.loading ? <div className="cw-skeleton-rows" role="status" aria-label="Loading jobs">{[0, 1].map(i => <Skeleton key={i} height={44} />)}</div>
                        : duties.length ? <List label={copy('sharedJobs')}>{duties.map(record => {
                            const who = staffName(record.assigned_user_id), due = dueWords(record.attentionDate ?? record.due_on, data.now);
                            return <ListRow key={record.id} to={data.workHref(operationTab(record.module), { record: String(record.id) })}
                                lead={<Avatar name={who ?? '?'} size={32} />} title={record.title} meta={[who ?? copy('nobodyYet'), names.get(record.squad_id ?? 0), words(record.status)].filter(Boolean).join(' · ')}
                                trail={<>{due && <span className={`cw-status${due.late ? ' cw-status--danger' : ''}`}>{due.text}</span>}<ChevronRight className="cw-chevron" aria-hidden="true" /></>} />;
                        })}</List> : <EmptyNote title={copy('noSharedJobs')}>{copy('noSharedJobsHint')}</EmptyNote>}</Panel>
                </Section>
                <Section boxed title={copy('yourResponsibilities')}>
                    <Panel flush>{responsibilities.length || requests.length ? <List label={copy('yourResponsibilities')}>{responsibilities.map(view => {
                        const where = viewSquads(view, roles);
                        return <ListRow key={view.id} title={view.label} meta={where === 'club' ? copy('wholeClub') : where ?? copy('noSquadsYet')} />;
                    })}{requests.map(request => {
                        const badge = requestBadge(request.status);
                        return <ListRow key={`request-${request.id}`} title={roles.catalog.find(role => role.key === request.role_key)?.title ?? request.role_key} meta={copy('askedFor')} trail={<Badge tone={badge.tone}>{badge.text}</Badge>} />;
                    })}</List> : <EmptyNote title={copy('noneYet')} action={<Button size="sm" onClick={() => setAsking(true)}>{copy('askForOne')}</Button>}>{copy('adminApproves')}</EmptyNote>}</Panel>
                </Section>
            </div>
        </div>
        <ResponsibilityRequests open={asking} clubId={data.clubId} roles={roles} onClose={() => setAsking(false)} onChanged={data.refreshRoles} />
    </PageFrame>;
}
