import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, EmptyNote, PageFrame, PageHeader, Panel } from '../../design/primitives';
import type { AuthSessionId } from '../../utils/authStorage';
import { guardWorkspaceNavigation } from '../clubOperations/workspaceGuard';
import { useClubEditorClose } from '../clubOperations/useClubEditorClose';
import { officeToolPath } from '../clubOffice/officeLinks';
import { scoutingApi, type ScoutingApi, type Scope } from './api';
import { useScoutingAction, useScoutingResource } from './useScouting';
import { ScoutingRecord, type Draft } from './ScoutingRecord';
import { ScoutingLink } from './ScoutingLink';
import { scoutingFamilyPath } from './familyHandoff';
import './scouting.css';

const positive = (value: string | null) => value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;

export function Scouting({ clubId, sessionId }: { clubId: number; sessionId: AuthSessionId }) {
    const api = useMemo(() => scoutingApi(clubId, sessionId), [clubId, sessionId]);
    const load = useCallback((signal: AbortSignal) => api.scope(signal), [api]);
    const scope = useScoutingResource(load, false);
    if (scope.loading) return <PageFrame className="scouting"><p role="status">Loading Scouting…</p></PageFrame>;
    if (scope.error) return <PageFrame className="scouting"><Failure error={scope.error} retry={scope.reload} /></PageFrame>;
    if (!scope.data || !scope.data.clubWide && !scope.data.squads.length) return <PageFrame className="scouting">
        <PageHeader title="Scouting" /><EmptyNote title="No current Scout job here">Scouting opens for an accepted club job and its teams. Your public football role does not grant access.</EmptyNote>
    </PageFrame>;
    return <ScopedScouting api={api} scope={scope.data} club={clubId} session={sessionId} />;
}

export function Failure({ error, retry }: { error: string; retry: () => void }) {
    return <div className="gk-notice gk-notice--danger" role="alert"><span>{error}</span><Button onClick={retry}>Try again</Button></div>;
}

function ScopedScouting({ api, scope, club, session }: { api: ScoutingApi; scope: Scope; club: number; session: AuthSessionId }) {
    const [params, setParams] = useSearchParams();
    const requested = positive(params.get('squad'));
    const squad = requested ?? (scope.clubWide ? null : scope.squads[0].id);
    const permitted = squad === null ? scope.clubWide : scope.squads.some(s => s.id === squad);
    useEffect(() => {
        if (!requested && squad !== null) {
            const next = new URLSearchParams(params); next.set('squad', String(squad)); setParams(next, { replace: true });
        }
    }, [requested, squad, params, setParams]);
    const selectScope = (value: string) => guardWorkspaceNavigation(() => {
        const next = new URLSearchParams(params);
        if (value) next.set('squad', value); else next.delete('squad');
        next.delete('prospect'); next.delete('page'); setParams(next);
    });
    return <PageFrame className="scouting">
        <PageHeader title="Scouting" subtitle="Football observations and decisions for your current job." />
        <label className="scouting-scope">Team scope<select aria-label="Team scope" value={squad ?? ''} onChange={e => selectScope(e.target.value)}>
            {scope.clubWide && <option value="">Whole club</option>}
            {scope.squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>
        {!permitted ? <EmptyNote title="This team is outside your current job">Choose one of your current teams.</EmptyNote>
            : <ScoutingWork key={`${club}:${session}:${squad}:${params.get('view') ?? ''}:${params.get('prospect') ?? ''}`} api={api} club={club} squad={squad} session={session} />}
    </PageFrame>;
}

function ScoutingWork({ api, club, squad, session }: { api: ScoutingApi; club: number; squad: number | null; session: AuthSessionId }) {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const view = ['adults', 'applications'].includes(params.get('view') ?? '') ? params.get('view')! : 'watch';
    const id = positive(params.get('prospect'));
    const page = Math.min(10000, Math.max(0, Math.floor(Number(params.get('page')) || 0)));
    const [query, setQuery] = useState(params.get('q') ?? '');
    const q = params.get('q') ?? '';
    const load = useCallback(async (signal: AbortSignal) => {
        if (id) {
            const record = await api.get(id, signal);
            return record.squadId === squad ? { record } : { wrongScope: true };
        }
        if (view === 'adults') return { adults: await api.adults(squad, q, page, signal) };
        if (view === 'applications') return { applications: await api.applications(squad, signal) };
        return { watch: await api.list(squad, page, signal) };
    }, [api, squad, id, view, q, page]);
    const result = useScoutingResource(load);
    const [draft, setDraft] = useState<Draft>({ id: null, action: 'OBSERVE', note: '', source: '', date: '' });
    const action = useScoutingAction(session, `${club}:${squad}:${id ?? 'discovery'}`, api, result.reload, saved => {
        if (saved.kind === 'CONTACT') navigate(`/messages?conversationId=${saved.conversationId}`);
        else if (saved.kind === 'WATCH') {
            const next = new URLSearchParams(params); next.set('prospect', String(saved.record.id)); setParams(next);
        } else { setDraft({ id, action: 'OBSERVE', note: '', source: '', date: '' }); result.reload(); }
    });
    const guard = useClubEditorClose(Boolean(draft.note || draft.source || draft.date || action.uncertain), action.busy, () => {});
    const change = (values: Record<string, string | null>) => guardWorkspaceNavigation(() => {
        const next = new URLSearchParams(params);
        Object.entries(values).forEach(([k, v]) => v === null ? next.delete(k) : next.set(k, v));
        setParams(next);
    });
    const watch = (person: number, application: number | null) => {
        action.run({ kind: 'WATCH', squad, person, application, requestId: crypto.randomUUID() });
    };
    return <>
        <nav className="scouting-tabs" aria-label="Scouting">
            {[['watch', 'Watchlist'], ['adults', 'Find adults'], ['applications', 'Family applications']].map(([key, title]) =>
                <Button key={key} aria-current={!id && view === key ? 'page' : undefined} onClick={() => change({ view: key, prospect: null, page: null })}>{title}</Button>)}
        </nav>
        {action.error && <div role="alert" className="gk-notice gk-notice--danger">{action.error}{action.uncertain
            ? <Button disabled={action.busy} onClick={action.retry}>Retry saved action</Button>
            : <Button onClick={result.reload}>Reload record</Button>}</div>}
        {result.loading && <p role="status">Loading current scouting records…</p>}
        {result.error && <Failure error={result.error} retry={result.reload} />}
        {result.data?.wrongScope && <EmptyNote title="This record belongs to another team scope">Open it from that team's watchlist.</EmptyNote>}
        {result.data?.record && <ScoutingRecord key={`${id}`} record={result.data.record} action={action}
            draft={draft} setDraft={setDraft} requestClose={guard.requestClose}
            familyPath={result.data.record.applicationId ? scoutingFamilyPath(club, result.data.record.id, result.data.record.applicationId, params) : undefined} />}
        {view === 'adults' && !id && <>
            <form className="scouting-search" onSubmit={e => { e.preventDefault(); change({ q: query, page: null }); }}>
                <label>Find a public adult player<input value={query} maxLength={100} onChange={e => setQuery(e.target.value)} /></label>
                <Button type="submit">Search</Button>
            </form>
            <p className="scouting-hint">Only published adult player profiles appear. No registration or eligibility is inferred.</p>
            {result.data?.adults && <Panel padded>
                {!result.data.adults.items.length && <EmptyNote title="No matching public adults">Try another name or return later.</EmptyNote>}
                <ul className="scouting-list">{result.data.adults.items.map(person => <li key={person.id}>
                    <div><strong>{person.fullName}</strong><span>{[person.position, person.city].filter(Boolean).join(' · ')}</span></div>
                    <div className="scouting-actions"><ScoutingLink to={`/profile/${person.id}`}>Public profile</ScoutingLink>
                        <Button disabled={action.busy || action.uncertain} onClick={() => watch(person.id, null)}>Watch</Button></div>
                </li>)}</ul>
            </Panel>}
        </>}
        {result.data?.applications && <>
            <p>Children appear only after their family's actual application, while the original family link and your intake authority remain current. Contact stays with the family in that application. Showing up to 50 current applications.</p>
            <Panel padded>{!result.data.applications.length && <EmptyNote title="No current family applications in your scope">A Scout job alone does not grant access to intake. Families can apply through the club's existing joining flow.</EmptyNote>}
                <ul className="scouting-list">{result.data.applications.map(candidate => <li key={candidate.applicationId}>
                    <div><strong>{candidate.name}</strong><span>Family application · {candidate.sourceStatus.replaceAll('_', ' ').toLowerCase()}</span></div>
                    <Button disabled={action.busy || action.uncertain} onClick={() => watch(candidate.personId, candidate.applicationId)}>Open scouting record</Button>
                </li>)}</ul>
            </Panel>
        </>}
        {result.data?.watch && <Panel padded>
            {!result.data.watch.items.length && <EmptyNote title="No scouting records in this scope" action={<Button onClick={() => change({ view: 'adults', page: null })}>Find an adult player</Button>}>Start with one player. You can return whenever there is something useful to record.</EmptyNote>}
            <ul className="scouting-list">{result.data.watch.items.map(record => <li key={record.id}>
                <div><strong>{record.name}</strong><span>{record.restricted ? 'Current access unavailable' : record.status === 'CLOSED' ? 'Outcome recorded' : 'Watching · no outcome recorded'}</span></div>
                <Button onClick={() => change({ prospect: String(record.id) })}>Open record</Button>
            </li>)}</ul>
        </Panel>}
        {!id && (result.data?.watch || result.data?.adults) && <div className="scouting-actions">
            <Button disabled={page === 0} onClick={() => change({ page: String(page - 1) })}>Previous</Button>
            <span>Page {page + 1}</span>
            <Button disabled={!(result.data.watch?.hasMore || result.data.adults?.hasMore)} onClick={() => change({ page: String(page + 1) })}>Next</Button>
        </div>}
        <details className="scouting-retained"><summary>Existing tools</summary><div className="scouting-actions">
            <ScoutingLink to={officeToolPath(club, 'tryouts')}>Tryouts</ScoutingLink>
            <ScoutingLink to={officeToolPath(club, 'club-approaches')}>Representation and club approaches</ScoutingLink>
        </div></details>
        {guard.confirmation}
    </>;
}
