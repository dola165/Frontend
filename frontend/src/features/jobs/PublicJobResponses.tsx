import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Field } from '../../design/primitives';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';
import { useWorldData } from '../world/useWorldData';
import { type Job, directionOf } from './api';
import { fetchResponses, fetchMyResponses } from './responsesApi';
import { JobResponseCard } from './JobResponseCard';
import { useResponseCommand } from './useResponseCommand';
import './responses.css';

function SubmitResponse({ job, userId, onSaved }: { job: Job; userId: number; onSaved: (listingChanged?: boolean) => void }) {
    const state = useResponseCommand(job.id, null, userId, job.version!, onSaved);
    return <form className="gk-job-response" onSubmit={event => { event.preventDefault(); void state.send(); }}>
        <Field label="Note (optional)" htmlFor={`job-response-note-${job.id}`}><textarea id={`job-response-note-${job.id}`} className="gk-input" rows={3} maxLength={2000} value={state.note} disabled={state.busy || !!state.pending} onChange={event => state.change(event.target.value)} /></Field>
        <Button type="submit" variant="primary" disabled={state.busy}>{state.pending ? 'Check previous response' : directionOf(job) === 'OFFERING' ? 'Send enquiry' : 'Send application'}</Button>
        {state.pending && <Button type="button" disabled={state.busy} onClick={() => onSaved(true)}>Recheck access</Button>}
        <p className="gk-faint">Only you and the current publisher can read this response. Use an adult’s details; keep children’s private information out of the note.</p>
        {state.error && <p role="alert">{state.error}</p>}
    </form>;
}

function ListingResponses({ job, userId, onListingChanged }: { job: Job; userId: number; onListingChanged?: () => void }) {
    const data = useWorldData(`job-responses:${userId}:${getAuthSessionId()}:${job.id}:${job.version}:${job.canManage}`, signal => fetchResponses(job.id, signal));
    const refresh = (listingChanged?: boolean) => { data.retry(); if (listingChanged) onListingChanged?.(); };
    return <section className="gk-job-responses" aria-label="Applications and enquiries">
        <h2>{job.canManage ? 'Responses' : directionOf(job) === 'OFFERING' ? 'Enquire about this service' : 'Your application'}</h2>
        {data.loading ? <p role="status">Checking current responses…</p> : data.error ? <p role="alert">{data.error} <Button onClick={data.retry}>Retry responses</Button> <Link to="/account?tab=profile">Review account</Link></p> : data.data && <>
            {data.data.responses.map(response => <JobResponseCard key={response.id} response={response} userId={userId} onSaved={refresh} />)}
            {data.data.canSubmit && (job.version == null ? <p role="alert">Reload the listing before responding. <Button onClick={onListingChanged}>Reload listing</Button></p> : <SubmitResponse job={job} userId={userId} onSaved={refresh} />)}
            {data.data.publisher && !data.data.responses.length && <p>No responses yet. People can respond without setting up club management.</p>}
            {!data.data.canSubmit && !data.data.publisher && !data.data.responses.length && <p>{data.data.reason === 'PERSONAL_BLOCK' ? 'Direct contact is unavailable while either person has blocked the other.' : 'Use the listing’s current contact method.'}</p>}
        </>}
    </section>;
}

export function PublicJobResponses({ job, onListingChanged }: { job: Job; onListingChanged?: () => void }) {
    const { status, user } = useAuth();
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    if (status === 'bootstrapping') return <p role="status">Checking your account…</p>;
    if (status !== 'authenticated' || !user) return <Link className="gk-btn gk-btn--primary" to={`/login?next=${encodeURIComponent(`/jobs/${job.id}`)}`}>Sign in to respond</Link>;
    return <ListingResponses key={`${user.id}:${session}:${job.id}`} job={job} userId={user.id} onListingChanged={onListingChanged} />;
}

function MyResponses({ userId }: { userId: number }) {
    const data = useWorldData(`my-job-responses:${userId}:${getAuthSessionId()}`, fetchMyResponses);
    return <section className="gk-job-responses" aria-label="Your work responses"><h2>Your applications and enquiries</h2>
        {data.loading ? <p role="status">Loading your responses…</p> : data.error ? <p role="alert">{data.error} <Button onClick={data.retry}>Retry your responses</Button></p>
            : data.data?.length ? data.data.map(response => <JobResponseCard key={response.id} response={response} userId={userId} onSaved={data.retry} />) : <p>No available responses. Email and website actions are handled outside GrassKickZ.</p>}
    </section>;
}

export function MyJobResponses() {
    const { status, user } = useAuth();
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    return status === 'authenticated' && user ? <MyResponses key={`${user.id}:${session}`} userId={user.id} /> : null;
}
