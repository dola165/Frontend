import { Button, GkRoot, Panel, Skeleton } from '../../design/primitives';
import { useSyncExternalStore } from 'react';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';
import { dateTime, permissionDecision } from '../mapPlanning/api';
import { useTravelCommand, useTravelRead } from './useTravel';
import type { FamilyTravel as FamilyTrip } from './api';
import './travel.css';

/** An own-child projection, mounted only when a published journey is relevant to this child. */
export function FamilyTravel({ childId }: { childId: number }) {
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    return <FamilyTravelContent key={`${session}:${childId}`} childId={childId} />;
}
function FamilyTravelContent({ childId }: { childId: number }) {
    const read = useTravelRead<FamilyTrip[]>(`/family/${childId}`);
    const action = useTravelCommand(read.refresh);
    if (read.error) return <GkRoot className="gk-travel"><p role="alert">{read.error}<Button onClick={read.refresh}>Try again</Button></p></GkRoot>;
    if (!read.data) return <Skeleton height={64} />;
    if (!read.data.length) return null;
    return <GkRoot className="gk-travel">{action.error && <p role="alert">{action.error}</p>}{read.data.map(p => <FamilyTravelCard key={`${p.plan_id}:${p.child_id}:${p.version}`} trip={p} busy={action.busy}
        cannotCome={() => action.run(`/plans/${p.plan_id}/cannot-come`, { version: p.version, childId }).then(() => undefined)} refresh={read.refresh} takeBack={() => action.run(`/plans/${p.plan_id}/take-back-cannot-come`, { version: p.version, childId }).then(() => undefined)} />)}</GkRoot>;
}
function FamilyTravelCard({ trip: p, busy, cannotCome, takeBack, refresh }: { trip: FamilyTrip; busy: boolean; cannotCome: () => Promise<void>; takeBack: () => Promise<void>; refresh: () => void }) {
    const permissions = useTravelCommand(refresh), permission = p.permission;
    const expired = permission?.expired || Boolean(permission?.data.expiresOn && permission.data.expiresOn < new Intl.DateTimeFormat('en-CA', { timeZone: p.itinerary.timezone }).format(new Date()));
    return <Panel padded title={`Travel · ${p.child_name}`}><strong>{p.source.title}</strong><p>{dateTime(p.source.starts_at, p.source.timezone)} · {p.source.location_name || 'Ask the club about the ground'}</p>
        {p.source.cancelled && <p role="status">The event is cancelled or closed. Contact the responsible staff about any outstanding return.</p>}
        {p.sourceChanged && <p role="status">The event changed. Pickup and return below are the previous published arrangements and need staff review. Previous permission does not approve the changed journey.</p>}
        {!p.canRespond && !p.source.cancelled && <p role="status">The published plan may need review or travel replies have closed. Use the current event details above and contact staff if needed.</p>}
        <dl><dt>Pickup</dt><dd>{p.itinerary.meetingPoint} · {dateTime(p.itinerary.startsAt, p.itinerary.timezone)}</dd>
            <dt>Expected return</dt><dd>{p.itinerary.collectionPoint} · {dateTime(p.itinerary.endsAt, p.itinerary.timezone)}</dd>
            <dt>Responsible staff</dt><dd>{p.itinerary.supervisionContact}</dd></dl>
        {!!p.itinerary.transport?.length && <p>Outside transport arrangement: {p.itinerary.transport.join('; ')}</p>}
        {p.itinerary.message && <p>{p.itinerary.message}</p>}
        <p>{p.eventExpected === false ? 'The event no longer expects this child. Contact staff about travel; recorded physical updates remain.' : p.attendance === 'CANCELLED' ? 'Event closed · check any remaining travel with staff.' : p.attendance === 'NOT_GOING' ? 'Can’t come is recorded.' : 'Expected · no attendance reply needed.'}</p>
        {p.canRespond && p.eventExpected !== false && !p.sourceChanged && !p.source.cancelled && (p.attendance === 'NOT_GOING' ? <Button disabled={busy || permissions.busy} onClick={() => void takeBack()}>Take back Can’t come</Button> : <Button disabled={busy || permissions.busy} onClick={() => void cannotCome()}>Can’t come</Button>)}
        <p>Travel permission: {expired ? 'expired' : permission?.status.toLowerCase() || 'not recorded'}. Expected attendance does not give permission or record boarding.</p>
        {permission?.data.wording && <details><summary>Exact permission terms · version {p.version}</summary><p>{permission.data.wording}</p></details>}
        {permissions.error && <p role="alert">{permissions.error}<Button onClick={refresh}>Reload current details</Button></p>}
        <div className="gk-travel-actions">{permission?.transitions.filter(s => s === 'REVOKED' || (p.canRespond && p.eventExpected !== false && !p.sourceChanged && !p.source.cancelled && !expired && ['GRANTED', 'DECLINED'].includes(s))).map(status => <Button key={status} disabled={busy || permissions.busy}
            onClick={() => void permissions.runExternal(() => permissionDecision(p.club_id, permission.id, permission.revision, status))}>{status === 'GRANTED' ? 'Give travel permission' : status === 'DECLINED' ? 'Decline permission' : 'Withdraw permission'}</Button>)}</div>
        <p>Staff update: {(p.travel.passenger?.status || p.travel.status).toLowerCase().replaceAll('_', ' ')}{p.travel.passenger?.updated_at && ` · ${dateTime(p.travel.passenger.updated_at, p.itinerary.timezone)}`}</p>
    </Panel>;
}
