import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';
import { extractApiErrorMessage } from '../../utils/apiError';
import { todayIso } from '../../utils/age';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import './parents.css';

/** Invites an adult to the account their player identity already has (children: Parent Hub's own-account row). */
export function IdentityActivationForm({ childId, path, onChanged }: {
    childId?: number; path?: string; onChanged: () => void;
}) {
    const copy = useJourneyCopy();
    const { sessionId } = useAuth();
    const [dob, setDob] = useState('');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const saving = useRef(false);
    useEffect(() => {
        setDob(''); setEmail(''); setMessage(''); setError(''); setBusy(false); saving.current = false;
    }, [sessionId]);
    const send = async (event: FormEvent) => {
        event.preventDefault();
        if (saving.current || !isCurrentAuthSession(sessionId)) return;
        saving.current = true; setBusy(true); setError(''); setMessage('');
        const config: AuthSessionRequestConfig = { _authSessionId: sessionId };
        try {
            await apiClient.post(path ?? `/family/children/${childId}/activation`, { dateOfBirth: dob, email: email.trim() }, config);
            if (!isCurrentAuthSession(sessionId)) return;
            setMessage(copy('Invitation sent. The recipient must verify their mailbox and set their own password. Their player identity is preserved.', 'მოწვევა გაიგზავნა. მიმღებმა უნდა დაადასტუროს ელფოსტა და თავად შექმნას პაროლი. მოთამაშის პროფილი შენარჩუნებულია.'));
            onChanged();
        } catch (cause) {
            if (isCurrentAuthSession(sessionId)) setError(extractApiErrorMessage(cause, copy('Could not send the invitation.', 'მოწვევა ვერ გაიგზავნა.')));
        } finally { if (isCurrentAuthSession(sessionId)) { saving.current = false; setBusy(false); } }
    };
    return <details className="family-history">
        <summary>{copy('Invite adult to their existing account', 'ზრდასრულის მოწვევა არსებულ ანგარიშზე')}</summary>
        <p>{copy('This is an invitation for the adult to accept independently. It grants no guardian access or club responsibility.', 'ზრდასრულმა მოწვევა დამოუკიდებლად უნდა მიიღოს. მეურვის წვდომა ან კლუბის უფლებამოსილება არ ენიჭება.')}</p>
        {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
        <form onSubmit={event => void send(event)} className="family-invite-form">
            <label>{copy('Recorded date of birth', 'დაბადების ჩაწერილი თარიღი')}<input type="date" required max={todayIso()} disabled={busy} value={dob} onChange={e => setDob(e.target.value)} /></label>
            <label>{copy('Recipient’s own email', 'მიმღების პირადი ელფოსტა')}<input type="email" required maxLength={254} disabled={busy} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
            <button type="submit" className="parent-button" disabled={busy}>{copy(busy ? 'Sending…' : 'Send account invitation', busy ? 'იგზავნება…' : 'ანგარიშის მოწვევის გაგზავნა')}</button>
        </form>
    </details>;
}
