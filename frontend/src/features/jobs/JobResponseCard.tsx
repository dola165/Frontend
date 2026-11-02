import { Link } from 'react-router-dom';
import { Button, Field } from '../../design/primitives';
import { type JobResponse, type ResponseAction } from './responsesApi';
import { useResponseCommand } from './useResponseCommand';
import { categoryLabel, hoursLabel, termsLabel } from './api';
import './responses.css';

const statuses: Record<string, string> = { SUBMITTED: 'Waiting for a reply', DISCUSSING: 'In discussion', OFFERED: 'Offer awaiting your decision', AGREED: 'Agreed', DECLINED: 'Not proceeding', WITHDRAWN: 'Withdrawn', CLOSED: 'Listing closed' };
const labels: Record<ResponseAction, string> = { REPLY: 'Send reply', OFFER: 'Send offer', ACCEPT: 'Accept offer', DECLINE: 'Decline', WITHDRAW: 'Withdraw' };
const events: Record<string, string> = { SUBMIT: 'Response sent', REPLY: 'Reply', OFFER: 'Offer sent', ACCEPT: 'Offer accepted', DECLINE: 'Declined', WITHDRAW: 'Withdrawn', CLOSE: 'Listing closed' };

export function JobResponseCard({ response, userId, onSaved }: { response: JobResponse; userId: number; onSaved: (listingChanged?: boolean) => void }) {
    const state = useResponseCommand(response.jobId, response.id, userId, response.version, onSaved, response.terms.version, response.contactAllowed);
    const staleOffer = response.status === 'OFFERED' && response.offeredListingVersion !== response.terms.version;
    return <article className="gk-job-response" aria-label={`Response: ${response.title}`}>
        <h3>{response.title}</h3>
        <p><strong>{statuses[response.status] ?? response.status}</strong>{response.publisher && <> · {response.applicantName}</>}</p>
        <p className="gk-faint">{response.direction === 'OFFERING' ? 'Service enquiry' : 'Application'} · <Link to={`/jobs/${response.jobId}`}>Open listing</Link></p>
        {(response.status === 'OFFERED' || response.actions.includes('OFFER')) && <div aria-label="Current listing terms">
            <p>{[categoryLabel(response.terms.category), termsLabel(response.terms.engagementType), response.terms.pay, hoursLabel(response.terms.hours), response.terms.city, response.terms.licence, response.terms.ageGroup, response.terms.level].filter(Boolean).join(' · ')}</p>
            <p>{response.terms.description}</p>
            {staleOffer && <p role="status">The listing changed after this offer. Review the current terms; the publisher must send a fresh offer before you can accept.</p>}
        </div>}
        <ol className="gk-job-response__history">{response.events.map(event => <li key={event.id}>
            <small>{event.side === 'APPLICANT' ? 'Applicant' : event.side === 'PUBLISHER' ? 'Publisher' : 'Listing'} · {events[event.action] ?? event.action} · <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></small>
            {event.note && <p>{event.note}</p>}
        </li>)}</ol>
        {response.status === 'AGREED' && <p>Arrange the practical details with the publisher. This response does not create a club appointment or record payment.</p>}
        {!response.contactAllowed && <p className="gk-faint">Direct contact is unavailable while either person has blocked the other. You can still resolve this response without a note.</p>}
        {state.pending ? <>
            <div className="gk-job-response__actions"><Button disabled={state.busy} onClick={() => void state.send()}>{state.resolution ? 'Check previous resolution' : 'Check previous response'}</Button><Button disabled={state.busy} onClick={() => onSaved(true)}>Recheck access</Button></div>
            {state.canResolveWithoutNote && response.actions.some(action => action === 'WITHDRAW' || action === 'DECLINE') && <>
                <p>Your previous attempt stays saved. You can resolve this response separately without sending its note.</p>
                <div className="gk-job-response__actions">{response.actions.filter(action => action === 'WITHDRAW' || action === 'DECLINE').map(action => <Button key={action} disabled={state.busy} onClick={() => void state.send(action, true)}>{labels[action]} without a note</Button>)}</div>
            </>}
        </> : response.actions.length > 0 && <>
            {response.contactAllowed && <Field label="Reply or note (optional)" htmlFor={`response-note-${response.id}`}><textarea id={`response-note-${response.id}`} className="gk-input" maxLength={2000} rows={3} disabled={state.busy} value={state.note} onChange={e => state.change(e.target.value)} /></Field>}
            <div className="gk-job-response__actions">{response.actions.map(action => <Button key={action} disabled={state.busy || action === 'REPLY' && !state.note.trim()} onClick={() => void state.send(action)}>{labels[action]}</Button>)}</div>
            {response.publisher && response.actions.includes('OFFER') && <p className="gk-faint">An offer asks this adult to agree. It grants no club access.</p>}
        </>}
        {state.error && <p role="alert">{state.error}</p>}
    </article>;
}
