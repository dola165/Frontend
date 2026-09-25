import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound, Loader2, X } from 'lucide-react';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { ageFromDob, todayIso } from '../../utils/age';
import { extractApiErrorMessage } from '../../utils/apiError';
import { isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import { activateChild, type ParentChild } from './api';

export function ChildActivationDialog({ child, sessionId, onClose, onActivated }: {
    child: ParentChild;
    sessionId: AuthSessionId;
    onClose: () => void;
    onActivated: () => void;
}) {
    const dialog = useRef<HTMLDivElement>(null);
    const mounted = useRef(true);
    const [dob, setDob] = useState('');
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [credentials, setCredentials] = useState<{ username: string; tempPassword: string } | null>(null);
    useDialogFocus(true, dialog, () => { if (!busy && !credentials) onClose(); });
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => {
        if (!busy && !credentials) return;
        const protectSignInDetails = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', protectSignInDetails);
        return () => window.removeEventListener('beforeunload', protectSignInDetails);
    }, [busy, credentials]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (busy || !isCurrentAuthSession(sessionId)) return;
        const age = ageFromDob(dob);
        if (!dob || !Number.isFinite(age) || age < 13 || age >= 18 || Number(dob.slice(0, 4)) !== child.birthYear) {
            setError(`Enter the correct birth date for a child aged 13–17, born in ${child.birthYear}.`);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const result = await activateChild(child.cardId, dob, email.trim(), sessionId);
            if (!mounted.current || !isCurrentAuthSession(sessionId)) return;
            setCredentials(result);
            onActivated();
        } catch (err) {
            if (mounted.current && isCurrentAuthSession(sessionId)) {
                setError(extractApiErrorMessage(err, 'Could not activate this account. Check the details and try again.'));
            }
        } finally {
            if (mounted.current && isCurrentAuthSession(sessionId)) setBusy(false);
        }
    };

    return <div className="parent-dialog-backdrop">
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="parent-activation-title" className="parent-dialog">
            <div className="parent-section-heading">
                <div className="parent-icon"><KeyRound size={22} /></div>
                {!credentials && <button type="button" className="parent-icon-button" aria-label="Close activation" disabled={busy} onClick={onClose}><X size={20} /></button>}
            </div>
            <h2 id="parent-activation-title">{credentials ? 'Their account is ready' : `An account for ${child.fullName || 'your child'}`}</h2>
            {credentials ? <div className="parent-activation-content">
                <p>Save these sign-in details now and share them privately with your child. The temporary password is shown once; they must change it after signing in.</p>
                <label>Username<input readOnly value={credentials.username} autoComplete="off" onFocus={event => event.currentTarget.select()} /></label>
                <label>Temporary password<input readOnly value={credentials.tempPassword} autoComplete="off" onFocus={event => event.currentTarget.select()} /></label>
                <p>If these details are lost, use Forgot password with your child's email to recover access.</p>
                <button type="button" className="parent-button parent-button-primary" onClick={onClose}><CheckCircle2 size={17} /> I have saved the sign-in details</button>
            </div> : <form className="parent-activation-content" onSubmit={event => void submit(event)}>
                <p>Children aged 13–17 can have their own sign-in after club consent is confirmed. Use your child's email address.</p>
                {error && <p role="alert" className="parent-error">{error}</p>}
                <label>Date of birth<input type="date" required value={dob} max={todayIso()} disabled={busy} onChange={event => setDob(event.target.value)} /></label>
                <label>Child's email<input type="email" required value={email} maxLength={254} disabled={busy} autoComplete="off" onChange={event => setEmail(event.target.value)} placeholder="Their email address" /></label>
                <button type="submit" disabled={busy} className="parent-button parent-button-primary">{busy ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}{busy ? 'Activating…' : 'Activate account'}</button>
            </form>}
            {error && <p className="parent-muted mt-4">If the connection was interrupted, close this form and refresh the hub before trying again. If the child account is active, use Forgot password with the email you entered to recover access.</p>}
        </div>
    </div>;
}
