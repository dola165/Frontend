import { useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, EmptyNote, GkRoot, PageHeader, Panel, Skeleton } from '../../design/primitives';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';
import { dateTime } from '../mapPlanning/api';
import { TravelExistingLinks } from './TravelExistingLinks';
import { TravelLogisticsForm } from './TravelLogisticsForm';
import { useTravelCommand, useTravelRead } from './useTravel';
import type { TravelContext, TravelPlan } from './api';
import './travel.css';

/** Coordinator mounts this only for a relevant current Travel writer. Legacy records keep their own links. */
export function TravelWorkspace({ clubId, squadId }: { clubId: number; squadId?: number }) {
    const [params, setParams] = useSearchParams();
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const id = Number(params.get('travelPlan')) || 0;
    const select = (plan: number) => { const next = new URLSearchParams(params); if (plan) next.set('travelPlan', String(plan)); else next.delete('travelPlan'); setParams(next); };
    return <GkRoot className="gk-travel">{id ? <TravelDetail key={`${session}:${clubId}:${id}`} id={id} clubId={clubId} back={() => select(0)} />
        : <TravelList key={`${session}:${clubId}`} clubId={clubId} squadId={squadId} open={select} />}</GkRoot>;
}
function TravelList({ clubId, squadId, open }: { clubId: number; squadId?: number; open: (id: number) => void }) {
    const read = useTravelRead<TravelContext>(`/context?clubId=${clubId}${squadId ? `&squadId=${squadId}` : ''}`);
    const action = useTravelCommand(read.refresh);
    if(read.data?.relevant === false)return null;
    return <><PageHeader title="Travel" subtitle="Arrange travel around an existing event." />
        {action.error && <><p role="alert">{action.error}</p><TravelExistingLinks links={action.links} /></>}
        {read.error ? <p role="alert">{read.error} <Button onClick={read.refresh}>Try again</Button></p> : !read.data ? <Skeleton height={120} /> : <>
            {!!read.data.plans.length && <Panel padded title="Existing journeys"><ul className="gk-travel-list">{read.data.plans.map(p => <li key={p.id}><Button onClick={() => open(p.id)}>{p.title}</Button><span>{p.published_version ? `Family version ${p.published_version}` : 'Draft'}</span></li>)}</ul></Panel>}
            <Panel padded title="Choose the event"><ul className="gk-travel-list">{read.data.events.map(e => <li key={`${e.id}:${e.squad_id}`}><div><strong>{e.title}</strong><p>{e.squad_name} · {dateTime(e.starts_at, e.timezone)} · {e.location_name || 'Ground not recorded'}</p></div>
                <Button disabled={action.busy} onClick={() => void action.run<TravelPlan>('/from-event', { clubId, squadId: e.squad_id, eventId: e.id }).then(p => { if (p) open(p.id); })}>Open travel</Button></li>)}</ul>
                {!read.data.events.length && <EmptyNote title="No upcoming events in your travel scope">Use the existing club schedule when an event is agreed. Travel needs no separate fixture.</EmptyNote>}</Panel>
        </>}</>;
}
function TravelDetail({ id, clubId, back }: { id: number; clubId: number; back: () => void }) {
    const read = useTravelRead<TravelPlan>(`/plans/${id}`), action = useTravelCommand(read.refresh);
    const [params, setParams] = useSearchParams();
    const [review, setReview] = useState<{ fingerprint: string; changes: { activity: string; oldStart: string; newStart: string; oldEnd: string; newEnd: string; location: string }[] }>();
    const [absence, setAbsence] = useState<{ id: number; reason: string }>();
    const p = read.data?.club_id === clubId ? read.data : undefined;
    const command = async (name: string, extra: Record<string, unknown> = {}) => Boolean(p && await action.run(`/plans/${id}/${name}`, { revision: p.revision, ...extra }));
    if (read.error) return <p role="alert">{read.error} <Button onClick={read.refresh}>Try again</Button><Button onClick={back}>Back to travel</Button></p>;
    if (read.data && !p) return <p role="alert">This journey belongs to another club context.<Button onClick={back}>Back to travel</Button></p>;
    if (!p) return <Skeleton height={160} />;
    const history = params.get('travelTab') === 'history';
    return <><PageHeader title={p.title} actions={<Button onClick={back}>Back to travel</Button>} />
        <nav aria-label="Travel sections" className="gk-travel-actions">{['overview', 'history'].map(tab => <Button key={tab} aria-current={history === (tab === 'history') ? 'page' : undefined} onClick={() => { const next = new URLSearchParams(params); next.set('travelTab', tab); setParams(next); }}>{tab === 'overview' ? 'Overview' : 'History'}</Button>)}</nav>
        {action.error && <p role="alert">{action.error} <Button onClick={read.refresh}>Reload current details</Button></p>}
        {history ? <Panel padded title="History"><ul className="gk-travel-list">{[...p.history, ...(p.physicalHistory ?? [])].map((h, i) => <li key={`${i}:${h.id}`}><strong>{h.action.replaceAll('_', ' ')}</strong><span>{h.actor} · {dateTime(h.created_at, p.source.timezone)}</span><p>{h.note}</p></li>)}</ul></Panel> : <>
            <Panel padded title="Linked event"><strong>{p.source.title}</strong><p>{dateTime(p.source.starts_at, p.source.timezone)} · {p.source.location_name || 'Ground not recorded'} · {p.source.status.toLowerCase()}</p>
                <ButtonLink to={`/matches/${p.source.id}`}>Open event</ButtonLink>
                {p.sourceCancelled && <p role="status">The source event is cancelled or closed. Preserve actual passenger updates and outstanding returns.</p>}
                {p.peopleReviewRequired && <p role="status">The event’s expected people changed. Review untravelled people before saving and publishing. Existing physical return duties stay recorded.</p>}
                {p.issues.map((issue, i) => <p key={i} role="status">{issue.message}</p>)}
                <Button disabled={action.busy} onClick={() => void action.run<NonNullable<typeof review>>(`/plans/${id}/changes`, {}, 'get').then(r => { if (r) setReview(r); })}>Review source changes</Button>
                {review && <div><p>{review.changes.length} proposed changes. Departure and return estimates still need your review.</p><ul>{review.changes.map((change, i) => <li key={i}>{change.activity}: {dateTime(change.oldStart, p.source.timezone)} → {dateTime(change.newStart, p.source.timezone)}; ends {dateTime(change.newEnd, p.source.timezone)} · {change.location}</li>)}</ul><Button disabled={!review.changes.length || action.busy} onClick={() => void command('apply-changes', { fingerprint: review.fingerprint }).then(ok => { if (ok) setReview(undefined); })}>Apply reviewed source changes</Button></div>}
            </Panel>
            <Panel padded title="Pickup and return"><TravelLogisticsForm key={id} plan={p} busy={action.busy} save={v => action.run<TravelPlan>(`/plans/${id}/logistics`, v, 'put')} />
                <details><summary>Expected event players · {p.eventPlayers.length}</summary><ul>{p.eventPlayers.map(person => <li key={person.id}>{person.name}</li>)}</ul><p>From the event’s current players. Save logistics to review these people; no routine attendance reply is needed.</p></details>
                {!p.canPublish && <p role="status">Publishing children’s travel currently needs permission-request authority. Your logistics draft can be saved.</p>}
                <div className="gk-travel-actions"><Button disabled={action.busy || !p.canPublish || p.sourceCancelled} onClick={() => void command('publish')}>Publish family details and connect travel</Button>
                    <ButtonLink to={`/world/map?plans=staff&plan=${id}&club=${clubId}&squad=${p.squad_id}`}>Open full journey and people</ButtonLink></div></Panel>
            <Panel padded title="Physical travel updates"><p>Expected participation is automatic. Record what responsible staff actually observe. Permission, boarding and arrival are separate.</p>
                <div className="gk-travel-actions">{p.trip?.transitions.filter(s => ['READY', 'DEPARTED', 'RETURNED', 'CANCELLED'].includes(s)).map(status => <Button key={status} disabled={action.busy || (p.sourceCancelled && ['READY', 'DEPARTED'].includes(status))} onClick={() => void command('milestones', { status })}>{status === 'READY' ? 'Mark logistics ready' : status === 'DEPARTED' ? 'Record departure' : status === 'RETURNED' ? 'Record team return' : 'Cancel untravelled trip'}</Button>)}</div>
                <ul className="gk-travel-list">{p.travelChecks.map(person => <li key={person.id}><div><strong>{person.name}</strong>{person.eventExpected === false && <p>No longer expected by the event. Recorded physical return duties remain.</p>}<p>{person.status.toLowerCase()} · Permission: {person.permissionState.toLowerCase().replaceAll('_', ' ')}</p>{person.attendance === 'NOT_GOING' && <p>Family recorded “Can’t come”. Physical presence has not been inferred.</p>}</div>
                    <div className="gk-travel-actions">{(person.status === 'PLANNED' ? ['BOARDED'] : person.status === 'BOARDED' ? ['ARRIVED'] : person.status === 'ARRIVED' ? ['RETURNED'] : []).map(status => <Button key={status} disabled={action.busy || (status === 'BOARDED' && (person.eventExpected === false || p.peopleReviewRequired || p.sourceCancelled || p.trip?.status !== 'READY' || !['CURRENT', 'NOT_REQUIRED'].includes(person.permissionState)))} onClick={() => void command('passengers', { passengerId: person.id, status })}>{status === 'BOARDED' ? 'Record boarding' : status === 'ARRIVED' ? 'Record arrival' : 'Record return'}</Button>)}
                        {person.status === 'PLANNED' && <Button disabled={action.busy} onClick={() => setAbsence({ id: person.id, reason: '' })}>Can’t come</Button>}</div></li>)}</ul>
                {absence && <form onSubmit={e => { e.preventDefault(); void command('passengers', { passengerId: absence.id, status: 'CANCELLED', note: absence.reason }).then(ok => { if (ok) setAbsence(undefined); }); }}><label>Reason<input className="gk-input" required maxLength={2000} value={absence.reason} onChange={e => setAbsence({ ...absence, reason: e.target.value })} /></label><Button type="submit" disabled={action.busy}>Record absence</Button><Button onClick={() => setAbsence(undefined)}>Keep travelling</Button></form>}
                {!p.trip && <p>Publish current family details to connect the shared trip and passenger records.</p>}
            </Panel>
        </>}
    </>;
}
