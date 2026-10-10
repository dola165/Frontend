import { useEffect, useState } from 'react';
import { Avatar, Button, EmptyNote, List, ListRow, Panel, Section, Skeleton, type BadgeTone } from '../../../design/primitives';
import { get, label, moduleNames, type Bootstrap, type OperationRecord } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import { operationTab } from '../../clubOperations/workspaceNavigation';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { dueLabel } from '../fixtures';
import { isFinished } from '../../clubOperations/records/recordStatus';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { personName } from './coachData';
import { canReadSquad } from '../../clubOperations/squadAccess';
import { useNow } from '../useNow';
import '../club-workspace.css';

const SOURCES = [
    { module: 'AVAILABILITY', query: 'state=open' },
    { module: 'GUARDIANS', query: 'kind=CONSENT&state=open' },
    { module: 'DEVELOPMENT', query: 'state=open' },
] as const;

/** Loads one tool's open records per squad, only where the person may read them. */
function useSquadRecords(club: number, squads: number[], boot: Bootstrap | null) {
    const spec = JSON.stringify(SOURCES.flatMap(source => squads.filter(squad => canReadSquad(boot, source.module, squad)).map(squad => ({ module: source.module, query: source.query, squad }))));
    const [revision, setRevision] = useState(0);
    const key = `${club}:${spec}:${revision}`;
    const [result, setResult] = useState<{ key: string; rows: OperationRecord[]; error: string } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        const requests = JSON.parse(spec) as { module: string; query: string; squad: number }[];
        void Promise.all(requests.map(r => get<OperationRecord[]>(`/clubs/${club}/workspace-roles/work?module=${r.module}&squad=${r.squad}&${r.query}`, controller.signal)))
            .then(lists => { if (!controller.signal.aborted) setResult({ key, rows: lists.flat(), error: '' }); })
            .catch(error => { if (!controller.signal.aborted) setResult({ key, rows: [], error: extractApiErrorMessage(error, 'Could not load your players’ records.') }); });
        return () => controller.abort();
    }, [club, spec, key]);
    const current = result?.key === key ? result : null;
    return { rows: current?.rows ?? [], loading: !current, error: current?.error ?? '', retry: () => setRevision(v => v + 1), any: spec !== '[]' };
}

interface Attention { record: OperationRecord; title: string; meta: string; badge: string; tone: BadgeTone; rank: number; date: string }

/** Players in my squads who need something from me: restrictions, missing consent, development reviews. */
export function PlayersAttention({ clubId, roles, boot, squads, onOpen }: { clubId: number; roles: RolesWorkspace; boot: Bootstrap | null; squads: number[]; onOpen: OpenWorkspace }) {
    const copy = useCopy('coachHub', coachHubEn);
    const records = useSquadRecords(clubId, squads, boot);
    const now = useNow();
    if (!squads.length) return null;
    const squadName = (id: number | null) => roles.squads.find(s => s.id === id)?.name;
    const soon = new Date(now + 14 * 86_400_000).toISOString().slice(0, 10);
    const items: Attention[] = [];
    for (const record of records.rows) {
        const player = personName(roles, boot, record.subject_user_id);
        const squad = squadName(record.squad_id);
        if (record.module === 'AVAILABILITY') items.push({ record, title: player ?? record.title, meta: [record.data.restrictions || record.title, squad].filter(Boolean).join(' · '), badge: copy('badgeRestricted'), tone: 'warning', rank: 0, date: record.data.reviewOn ?? '' });
        else if (record.module === 'GUARDIANS' && record.status === 'PENDING') items.push({ record, title: player ?? record.title, meta: [copy('consentFor', { name: record.title }), squad].filter(Boolean).join(' · '), badge: copy('badgeAwaitingParent'), tone: 'info', rank: 1, date: record.due_on ?? '' });
        else if (record.module === 'DEVELOPMENT') {
            const date = record.data.reviewOn ?? record.due_on ?? '';
            const draft = record.status === 'DRAFT';
            if (!draft && (!date || date > soon)) continue;
            const due = dueLabel(date, now, isFinished(record.status));
            items.push({ record, title: player ?? record.title, meta: [record.title.split(' — ')[0].replace(/^Observation · .*/, copy('observation')), squad].filter(Boolean).join(' · '), badge: draft ? copy('badgeDraft') : due?.label ?? copy('badgeReview'), tone: due?.overdue ? 'danger' : 'neutral', rank: 2, date: date || '9999' });
        }
    }
    items.sort((a, b) => a.rank - b.rank || a.date.localeCompare(b.date));
    const counts = { restricted: items.filter(i => i.rank === 0).length, consent: items.filter(i => i.rank === 1).length, development: items.filter(i => i.rank === 2).length };
    const hint = [counts.restricted && copy('restricted', { count: counts.restricted }), counts.consent && copy('consents', { count: counts.consent }), counts.development && copy('developmentCount', { count: counts.development })].filter(Boolean).join(' · ');

    return <Section className="cw-attention" title={copy('playersToCheck')} hint={hint || undefined}>
        <Panel flush>
            {!records.any ? <EmptyNote title={copy('notShared')}>{copy('notSharedHint')}</EmptyNote>
                : records.loading ? <div className="cw-skeleton-rows" role="status" aria-label={copy('loadingPlayers')}>{[0, 1, 2].map(i => <Skeleton key={i} height={40} />)}</div>
                    : records.error ? <div className="cw-panel-notice"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{records.error}</span><Button size="sm" onClick={records.retry}>{copy('tryAgain')}</Button></div></div>
                        : items.length ? <List label={copy('playersToCheck')}>{items.slice(0, 8).map(item => <ListRow key={item.record.id}
                            lead={<Avatar name={item.title} size={32} />} title={item.title} meta={item.meta} trail={<span className={`cw-status cw-status--${item.tone}`}>{item.badge}</span>}
                            onClick={() => onOpen(operationTab(item.record.module), { record: String(item.record.id), ...(item.record.squad_id ? { squad: String(item.record.squad_id) } : {}) })} />)}</List>
                            : <EmptyNote title={copy('allClear')}>{copy('allClearHint')}</EmptyNote>}
            {items.length > 8 && <div className="gk-panel__foot"><button type="button" className="cw-text-button" onClick={() => onOpen('restrictions')}>{copy('moreRecords', { count: items.length - 8 })}</button></div>}
        </Panel>
    </Section>;
}

/** Records assigned to me, soonest first. */
export function MyTasks({ clubId, roles, onOpen }: { clubId: number; roles: RolesWorkspace; onOpen: OpenWorkspace }) {
    const copy = useCopy('coachHub', coachHubEn);
    const now = useNow();
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState<{ key: string; rows: OperationRecord[]; error: string } | null>(null);
    const key = `${clubId}:${roles.actorId}:${revision}`;
    useEffect(() => {
        const controller = new AbortController();
        void get<OperationRecord[]>(`/clubs/${clubId}/workspace-roles/work?module=HOME&mine=true`, controller.signal)
            .then(rows => { if (!controller.signal.aborted) setResult({ key, rows, error: '' }); })
            .catch(error => { if (!controller.signal.aborted) setResult({ key, rows: [], error: extractApiErrorMessage(error, 'Could not load your tasks.') }); });
        return () => controller.abort();
    }, [clubId, key]);
    const current = result?.key === key ? result : null;
    const rows = current?.rows ?? [];
    return <Section title={copy('myTasks')} hint={rows.length ? copy('assigned', { count: rows.length }) : undefined} action={<button type="button" className="gk-section__action cw-text-button" onClick={() => onOpen('actions', { mine: 'true' })}>{copy('workQueue')}</button>}>
        <Panel flush>
            {!current ? <div className="cw-skeleton-rows" role="status" aria-label={copy('loadingTasks')}>{[0, 1].map(i => <Skeleton key={i} height={40} />)}</div>
                : current.error ? <div className="cw-panel-notice"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{current.error}</span><Button size="sm" onClick={() => setRevision(v => v + 1)}>{copy('tryAgain')}</Button></div></div>
                    : rows.length ? <List label={copy('myTasks')}>{rows.slice(0, 6).map(record => {
                        const due = dueLabel(record.attentionDate ?? record.due_on, now, isFinished(record.status));
                        return <ListRow key={record.id} title={record.title} meta={[moduleNames[record.module], roles.squads.find(s => s.id === record.squad_id)?.name ?? (record.squad_id ? null : copy('clubWide')), label(record.status)].filter(Boolean).join(' · ')}
                            trail={<span className={`cw-status cw-status--${record.expired || due?.overdue ? 'danger' : 'neutral'}`}>{record.expired ? copy('expired') : due?.label ?? label(record.status)}</span>}
                            onClick={() => onOpen(operationTab(record.module), { record: String(record.id), ...(record.squad_id ? { squad: String(record.squad_id) } : {}) })} />;
                    })}</List>
                        : <EmptyNote title={copy('noTasks')}>{copy('noTasksHint')}</EmptyNote>}
            {rows.length > 6 && <div className="gk-panel__foot"><button type="button" className="cw-text-button" onClick={() => onOpen('actions', { mine: 'true' })}>{copy('moreTasks', { count: rows.length - 6 })}</button></div>}
        </Panel>
    </Section>;
}
