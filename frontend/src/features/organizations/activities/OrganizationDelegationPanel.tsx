import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import { cancelInvitation, getInvitations, getOperators, inviteOperator, respondToInvitation, revokeOperator,
    type Delegation, type OrganizationInvitation } from './api';
import { activityCopy, activityError, activityStatus } from './copy';
import './activities.css';

function useAlive() {
    const alive = useRef(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    return alive;
}
export function OrganizationDelegationPanel({ id }: { id: number }) {
    const { sessionId } = useAuth();
    return <DelegationPanel key={`${id}-${sessionId}`} id={id} />;
}
export function DelegationPanel({ id }: { id: number }) {
    const { i18n } = useTranslation(), copy = activityCopy(i18n.language), alive = useAlive();
    const [data, setData] = useState<Delegation | null>(null), [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
    const [email, setEmail] = useState(''), [confirm, setConfirm] = useState<number | null>(null), [reload, setReload] = useState(0);
    const submitting = useRef(false);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(''); setData(null); setConfirm(null);
        void getOperators(id, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
            .catch(err => { if (!controller.signal.aborted) setError(activityError(err, copy)); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [id, reload, copy]);
    const act = async (work: () => Promise<Delegation>, success: string, clearEmail = false) => {
        if (submitting.current || !data) return;
        submitting.current = true; setBusy(true); setError(''); setMessage('');
        try {
            const value = await work();
            if (!alive.current) return;
            setData(value); setMessage(success); setConfirm(null); if (clearEmail) setEmail('');
        } catch (err) {
            if (!alive.current) return;
            setError(activityError(err, copy));
            // Do not retain privileged membership lists after authority loss or an uncertain mutation.
            setData(null); setConfirm(null);
        } finally { submitting.current = false; if (alive.current) setBusy(false); }
    };
    const invite = (event: FormEvent) => { event.preventDefault(); void act(() => inviteOperator(id, email.trim()), copy.invited, true); };
    return <section className="organization-activities" aria-labelledby={`operators-${id}`}>
        <h2 id={`operators-${id}`}>{copy.operators}</h2><p>{copy.operatorHelp}</p>
        {loading ? <p role="status">{copy.loading}</p> : data && <>
            <form onSubmit={invite}><fieldset disabled={busy}>
                <label htmlFor={`operator-email-${id}`}>{copy.email}</label>
                <input id={`operator-email-${id}`} type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />
                <div className="organization-activity-actions"><button className="organization-primary">{busy ? copy.saving : copy.invite}</button></div>
            </fieldset></form>
            {!data.invitations.length && !data.operators.length && <p>{copy.noOperators}</p>}
            {data.operators.map(operator => <div className="organization-activity-row" key={`member-${operator.membershipId}`}>
                <div>{operator.name || copy.unknown}<small>{activityStatus(operator.status, copy)}</small></div>
                {operator.status === 'ACTIVE' && <div className="organization-activity-actions">
                    {confirm === operator.membershipId ? <>
                        <p>{copy.revokeHelp}</p>
                        <button disabled={busy} onClick={() => void act(() => revokeOperator(id, operator.membershipId), copy.revoked)}>{copy.revokeConfirm}</button>
                        <button disabled={busy} onClick={() => setConfirm(null)}>{copy.cancel}</button>
                    </> : <button disabled={busy} onClick={() => setConfirm(operator.membershipId)}>{copy.revoke}</button>}
                </div>}
            </div>)}
            {data.invitations.map(invite => <div className="organization-activity-row" key={`invite-${invite.id}`}>
                <div>{invite.recipientName || copy.unknown}<small>{activityStatus(invite.status, copy)}</small></div>
                {invite.status === 'PENDING' && <button disabled={busy} onClick={() => void act(() => cancelInvitation(id, invite.id), copy.cancelled)}>{copy.cancelInvite}</button>}
            </div>)}
        </>}
        {error && <><p role="alert">{error}</p><button disabled={busy} onClick={() => setReload(n => n + 1)}>{copy.retry}</button></>}
        {message && <p role="status">{message}</p>}
    </section>;
}

export function OrganizationInvitations() {
    const { sessionId } = useAuth();
    return <Invitations key={sessionId} />;
}
export function Invitations() {
    const { i18n } = useTranslation(), copy = activityCopy(i18n.language), alive = useAlive();
    const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]), [loading, setLoading] = useState(true);
    const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
    const submitting = useRef(false);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(''); setInvitations([]);
        void getInvitations(controller.signal).then(value => { if (!controller.signal.aborted) setInvitations(value); })
            .catch(err => { if (!controller.signal.aborted) setError(activityError(err, copy)); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [reload, copy]);
    const respond = async (id: number, action: 'ACCEPT' | 'DECLINE') => {
        if (submitting.current) return;
        submitting.current = true; setBusy(true); setError(''); setMessage('');
        try {
            await respondToInvitation(id, action);
            if (!alive.current) return;
            setMessage(copy.responded); setReload(n => n + 1);
        } catch (err) {
            if (!alive.current) return;
            setError(activityError(err, copy)); setInvitations([]);
        } finally { submitting.current = false; if (alive.current) setBusy(false); }
    };
    return <section className="organization-activities" aria-labelledby="organization-invitations">
        <h2 id="organization-invitations">{copy.inbox}</h2>
        {loading ? <p role="status">{copy.loading}</p> : !error && <>
            {!invitations.length && <p>{copy.noInvitations}</p>}
            {invitations.map(invite => <div className="organization-activity-row" key={invite.id}>
                <div>{invite.organizationName}<small>{activityStatus(invite.status, copy)}</small></div>
                <div className="organization-activity-actions">
                    {invite.canRespond && invite.status === 'PENDING' && <>
                        <button disabled={busy} className="organization-primary" onClick={() => void respond(invite.id, 'ACCEPT')}>{copy.accept}</button>
                        <button disabled={busy} onClick={() => void respond(invite.id, 'DECLINE')}>{copy.decline}</button>
                    </>}
                    {invite.status === 'PENDING' && !invite.canRespond && <p>{copy.unavailableInvite}</p>}
                    {invite.canOpenVenue && <Link to={`/stadiums/${invite.organizationId}/manage`}>{copy.open}</Link>}
                </div>
            </div>)}
        </>}
        {error && <><p role="alert">{error}</p><button disabled={busy} onClick={() => setReload(n => n + 1)}>{copy.retry}</button></>}
        {message && <p role="status">{message}</p>}
    </section>;
}
