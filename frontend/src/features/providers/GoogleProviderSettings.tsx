import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GoogleLogin, useGoogleOAuth } from '@react-oauth/google';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isAndroidApp } from '../../android/bridge';
import { getAuthSessionId, isCurrentAuthSession } from '../../utils/authStorage';
import { fetchProviderSettings, googleLinked, linkGoogleProvider, providerError, unlinkGoogleProvider, type ProviderSettings } from './api';

type Props = { accountId: number; onCredentialsChanged: () => void };
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--fc-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50';
const input = 'w-full min-h-11 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2 text-sm';

function WebGoogleProof({ nonce, onProof, onError }: { nonce: string; onProof: (token: string) => void; onError: () => void }) {
    const { scriptLoadedSuccessfully } = useGoogleOAuth();
    const [waiting, setWaiting] = useState(false);
    useEffect(() => {
        const timer = window.setTimeout(() => setWaiting(true), 10_000);
        return () => window.clearTimeout(timer);
    }, []);
    if (!scriptLoadedSuccessfully) return <p role="status" className="text-sm">{waiting ? 'Google sign-in has not loaded. Check your connection and reload this screen.' : 'Loading Google account selection…'}</p>;
    return <GoogleLogin nonce={nonce} auto_select={false} text="continue_with" onSuccess={response => {
        if (response.credential) onProof(response.credential); else onError();
    }} onError={onError} />;
}

export function GoogleProviderSettings(props: Props) {
    const { user, sessionId } = useAuth();
    return user?.id === props.accountId ? <ScopedGoogleProviderSettings key={`${sessionId}:${props.accountId}`} {...props} /> : null;
}

function ScopedGoogleProviderSettings({ accountId, onCredentialsChanged }: Props) {
    const [settings, setSettings] = useState<ProviderSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [flow, setFlow] = useState<{ action: 'link' | 'unlink'; nonce: string } | null>(null);
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const owner = useRef(getAuthSessionId());
    const operation = useRef<AbortController | null>(null);
    const activeFlow = useRef<typeof flow>(null);
    const mounted = useRef(true);
    const googleConfigured = isAndroidApp || Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; activeFlow.current = null; operation.current?.abort(); };
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(null);
        void fetchProviderSettings(controller.signal).then(value => {
            if (!controller.signal.aborted && isCurrentAuthSession(owner.current)) setSettings(value);
        }).catch(error => {
            if (!controller.signal.aborted && isCurrentAuthSession(owner.current)) {
                setSettings(null); setError(providerError(error, 'Could not load your linked providers.'));
            }
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [revision]);

    const cancel = () => {
        if (operation.current) {
            setSettings(null);
            setNotice('The operation was interrupted. Refresh provider settings to check whether the change completed.');
        }
        activeFlow.current = null; operation.current?.abort(); operation.current = null;
        setFlow(null); setPassword(''); setCode(''); setBusy(false); setError(null);
    };
    const begin = (action: 'link' | 'unlink') => {
        if (operation.current || !isCurrentAuthSession(owner.current)) return;
        const next = { action, nonce: crypto.randomUUID() };
        activeFlow.current = next; setFlow(next); setPassword(''); setCode(''); setError(null); setNotice(null);
    };
    const proofReady = Boolean(settings && (!settings.passwordLoginEnabled || password) && (!settings.twoFactorEnabled || code.trim()));
    const submit = async (attempt: NonNullable<typeof flow>, googleToken?: string) => {
        if (!mounted.current || operation.current || activeFlow.current !== attempt || !isCurrentAuthSession(owner.current) || !proofReady) return;
        if (attempt.action === 'link' && !isAndroidApp) {
            // The server validates the Google signature; the nonce prevents a cancelled popup from completing a later UI attempt.
            let nonce: unknown;
            try { nonce = JSON.parse(atob((googleToken?.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))).nonce; }
            catch { /* Invalid proof stays out of the mutation API. */ }
            if (nonce !== attempt.nonce) { setError('Google confirmation expired. Choose your Google account again.'); return; }
        }
        const controller = new AbortController(); operation.current = controller;
        setBusy(true); setError(null); setNotice(null);
        const current = () => mounted.current && !controller.signal.aborted && activeFlow.current === attempt && isCurrentAuthSession(owner.current);
        const proof = { ...(settings?.passwordLoginEnabled ? { currentPassword: password } : {}), ...(settings?.twoFactorEnabled ? { oneTimeCode: code.trim() } : {}) };
        try {
            const linkedAccounts = attempt.action === 'link'
                ? await linkGoogleProvider(accountId, proof, googleToken, controller.signal)
                : await unlinkGoogleProvider(accountId, proof, controller.signal);
            if (!current()) return;
            setSettings(previous => previous ? { ...previous, linkedAccounts, googleUnlinkAllowed: attempt.action === 'link' && previous.passwordLoginEnabled,
                googleUnlinkBlockedReason: attempt.action === 'link' && !previous.passwordLoginEnabled ? 'last_login_method' : null } : previous);
            activeFlow.current = null; setFlow(null); setPassword(''); setCode('');
            setNotice(`Google ${attempt.action === 'link' ? 'linked' : 'unlinked'}. Other remembered sessions were signed out.`);
            onCredentialsChanged();
        } catch (error) {
            if (current()) {
                setCode(''); setError(providerError(error, 'The provider change could not be confirmed. Refresh provider settings before trying again.'));
                if (!(error as { response?: unknown })?.response) {
                    activeFlow.current = null; setFlow(null); setPassword(''); setSettings(null);
                }
            }
        } finally {
            if (mounted.current && operation.current === controller) { operation.current = null; setBusy(false); }
        }
    };

    if (loading) return <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading linked providers…</p>;
    const linked = settings ? googleLinked(settings.linkedAccounts) : false;
    return <div className="space-y-4 text-[var(--fc-text-primary)]">
        {error && <p role="alert" className="text-sm text-[var(--fc-state-danger)]">{error}</p>}
        {notice && <p role="status" className="text-sm text-[var(--fc-accent)]">{notice}</p>}
        <button type="button" className={button} disabled={busy} onClick={() => { cancel(); setRevision(value => value + 1); }}>Refresh provider settings</button>
        {settings && <>
            <div><h3 className="font-semibold">Google {linked ? 'linked' : 'not linked'}</h3><p className="mt-1 text-sm">Link Google to sign in to this same GrassKickZ account. Linking does not merge accounts or change your email.</p></div>
            {!settings.googleAvailable || !googleConfigured ? <p role="status" className="text-sm">Google linking is not configured for this {settings.googleAvailable ? 'app' : 'server'}. Your existing sign-in methods are unchanged.</p> : null}
            {linked && !settings.googleUnlinkAllowed && <p className="text-sm">Google is your only sign-in method. <Link className="app-text-action" to="/forgot-password">Set a password through account recovery</Link> before unlinking it.</p>}
            {!flow ? <button type="button" className={button} disabled={linked ? !settings.googleUnlinkAllowed : !settings.googleAvailable || !googleConfigured}
                onClick={() => begin(linked ? 'unlink' : 'link')}>{linked ? 'Unlink Google' : 'Link Google'}</button>
                : <section aria-label={flow.action === 'link' ? 'Link Google account' : 'Confirm Google unlink'} className="space-y-4 rounded-xl border border-[var(--fc-border)] p-4">
                    <p className="text-sm">{flow.action === 'unlink' ? 'Unlink Google from this account? Use your password for future sign-in. Other remembered sessions will be signed out.' : 'Confirm your current account, then choose the Google account to link. Other remembered sessions will be signed out.'}</p>
                    {settings.passwordLoginEnabled && <label className="block space-y-2 text-sm">Current account password<input type="password" autoComplete="current-password" maxLength={256} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} className={input} /></label>}
                    {settings.twoFactorEnabled && <label className="block space-y-2 text-sm">Authenticator or unused recovery code<input type="text" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} maxLength={40} value={code} onChange={event => setCode(event.target.value)} disabled={busy} className={input} /></label>}
                    {busy ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{flow.action === 'link' ? 'Confirming Google link…' : 'Unlinking Google…'}</p>
                        : flow.action === 'unlink' ? <button type="button" className={button} disabled={!proofReady} onClick={() => void submit(flow)}>Confirm unlink Google</button>
                            : isAndroidApp ? <button type="button" className={button} disabled={!proofReady} onClick={() => void submit(flow)}>Choose Google account</button>
                                : proofReady ? <WebGoogleProof key={flow.nonce} nonce={flow.nonce} onProof={token => void submit(flow, token)} onError={() => { if (activeFlow.current === flow) setError('Google confirmation was not completed. Choose your account again.'); }} />
                                    : <p className="text-sm">Enter the required account proof to choose your Google account.</p>}
                    <button type="button" className={button} onClick={cancel}>Cancel {flow.action === 'link' ? 'Google linking' : 'Google unlink'}</button>
                </section>}
        </>}
    </div>;
}
