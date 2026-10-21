import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isAndroidApp } from '../../android/bridge';
import { getAuthSessionId, isCurrentAuthSession } from '../../utils/authStorage';
import { secondFactorError } from '../../components/auth/useSecondFactorLogin';
import { disableTwoFactor, fetchTwoFactorStatus, saveTwoFactor, setupTwoFactor, type TwoFactorStatus } from './api';
import { useTwoFactorSensitiveState } from './sensitiveState';
import { useSecurityNavigationGuard } from './useSecurityNavigationGuard';
import { useAccountCopy } from '../profiles/account/accountCopy';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--fc-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50';
const input = 'w-full min-h-11 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3 py-2 text-sm';
type Action = 'setup' | 'enable' | 'recovery-codes' | 'disable';
type Props = { accountId: number; passwordLoginEnabled: boolean; onCredentialsChanged?: () => void };

export function TwoFactorSettings({ accountId, passwordLoginEnabled, onCredentialsChanged }: Props) {
    const { user, sessionId } = useAuth();
    return user?.id === accountId ? <ScopedTwoFactorSettings key={`${sessionId}:${accountId}`} accountId={accountId} passwordLoginEnabled={passwordLoginEnabled} onCredentialsChanged={onCredentialsChanged} /> : null;
}

function ScopedTwoFactorSettings({ accountId, passwordLoginEnabled, onCredentialsChanged }: Props) {
    const text = useAccountCopy();
    const [sensitive, setSensitive] = useTwoFactorSensitiveState(accountId);
    const [status, setStatus] = useState<TwoFactorStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [action, setAction] = useState<Action | null>(null);
    const [confirmation, setConfirmation] = useState<'disable' | 'recovery-codes' | null>(null);
    const [saved, setSaved] = useState(false);
    const [now, setNow] = useState(Date.now());
    const request = useRef<AbortController | null>(null);
    const owner = useRef(getAuthSessionId());
    const hasCodes = sensitive.recoveryCodes !== null;
    useSecurityNavigationGuard(Boolean(sensitive.setup || (hasCodes && !saved)), action !== null);

    useEffect(() => () => request.current?.abort(), []);
    useEffect(() => {
        if (!sensitive.setup) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [sensitive.setup]);
    useEffect(() => {
        // No automatic status request can replace or hide the only copy of newly issued recovery codes.
        if (hasCodes) return;
        const controller = new AbortController();
        setLoading(true); setError(null);
        void fetchTwoFactorStatus(controller.signal).then(value => {
            if (!controller.signal.aborted && isCurrentAuthSession(owner.current)) {
                setStatus(value);
                if (value.enabled) setSensitive({ setup: null, recoveryCodes: null, enabled: true });
            }
        }).catch(error => {
            if (!controller.signal.aborted && isCurrentAuthSession(owner.current)) setError(secondFactorError(error, 'Could not load authenticator settings.'));
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [revision, hasCodes, setSensitive]);

    const mutate = async (next: Action) => {
        if (request.current || !isCurrentAuthSession(owner.current) || !password || (next !== 'setup' && !code.trim())) return;
        const controller = new AbortController();
        request.current = controller;
        setAction(next); setError(null); setNotice(null);
        const current = () => !controller.signal.aborted && isCurrentAuthSession(owner.current);
        try {
            if (next === 'setup') {
                const setup = await setupTwoFactor(password, controller.signal);
                if (!current()) return;
                setSensitive({ setup: { ...setup, expiresAt: Date.now() + setup.expiresIn * 1000 }, recoveryCodes: null, enabled: false });
                setNow(Date.now()); setCode('');
            } else if (next === 'disable') {
                await disableTwoFactor(password, code, controller.signal);
                if (!current()) return;
                setSensitive({ setup: null, recoveryCodes: null, enabled: false });
                setStatus(previous => previous ? { ...previous, enabled: false, recoveryCodesRemaining: 0 } : previous);
                setPassword(''); setCode(''); setConfirmation(null);
                setNotice('Authenticator disabled. Other remembered sessions were signed out.');
                onCredentialsChanged?.();
            } else {
                const recoveryCodes = await saveTwoFactor(next, password, code, controller.signal);
                if (!current()) return;
                setSensitive({ setup: null, recoveryCodes, enabled: true });
                setPassword(''); setCode(''); setConfirmation(null); setSaved(false);
                if (next === 'enable') onCredentialsChanged?.();
            }
        } catch (error) {
            if (current()) setError(secondFactorError(error, 'The security change could not be confirmed. Refresh your settings before trying again.'));
        } finally {
            if (current()) { request.current = null; setAction(null); }
        }
    };

    const finish = () => {
        if (action || !saved) return;
        setSensitive({ setup: null, recoveryCodes: null, enabled: true });
        setNotice(null); setSaved(false); setRevision(value => value + 1);
    };
    const codesText = () => `GrassKickZ recovery codes\nEach code can be used once. Keep them private.\n\n${sensitive.recoveryCodes?.join('\n') ?? ''}`;
    const copy = async (value: string) => {
        setError(null); setNotice(null);
        try { await navigator.clipboard.writeText(value); setNotice('Copied. Store this in a secure place.'); }
        catch { setError('Could not copy automatically. Select the text and copy it manually.'); }
    };
    const download = async () => {
        setError(null); setNotice(null);
        try {
            if (isAndroidApp) {
                await navigator.share({ title: 'GrassKickZ recovery codes', text: codesText() });
                setNotice('Save the codes in a secure place before continuing.');
            } else {
                const url = URL.createObjectURL(new Blob([codesText()], { type: 'text/plain' }));
                const anchor = document.createElement('a');
                anchor.href = url; anchor.download = 'grasskickz-recovery-codes.txt'; anchor.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                setNotice('Download requested. Check the saved file before continuing.');
            }
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setError('Could not save the codes. Copy them or write them down before continuing.');
        }
    };

    const expired = Boolean(sensitive.setup && now >= sensitive.setup.expiresAt);
    const setupMinutes = sensitive.setup ? Math.max(1, Math.ceil((sensitive.setup.expiresAt - now) / 60000)) : 0;
    return <div className="space-y-4 text-[var(--fc-text-primary)]">
        <p className="text-sm text-[var(--fc-text-secondary)]">{text("Add an authenticator code to password and Google sign-in. Recovery codes let you sign in if you lose access to your authenticator.")}</p>
        {error && <p role="alert" className="text-sm text-[var(--fc-state-danger)]">{text(error)}</p>}
        {notice && <p role="status" className="text-sm text-[var(--fc-accent)]">{text(notice)}</p>}
        {hasCodes ? <section aria-label={text("Save recovery codes")} className="space-y-4">
            <h3 className="font-semibold">{text("Save your recovery codes")}</h3>
            <p role="status" className="text-sm">{text("Authenticator enabled. These ten codes are shown only here. Each code works once; replacing them invalidates all older recovery codes.")}</p>
            <pre tabIndex={0} aria-label={text("Recovery codes")} className="overflow-x-auto rounded-xl bg-[var(--fc-surface)] p-3 text-sm select-text">{sensitive.recoveryCodes?.join('\n')}</pre>
            <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => void copy(codesText())}>{text("Copy recovery codes")}</button><button type="button" className={button} onClick={() => void download()}>{isAndroidApp ? text("Save or share codes") : text("Download recovery codes")}</button></div>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} />{text("I saved these recovery codes in a secure place.")}</label>
            <button type="button" disabled={!saved} className={button} onClick={finish}>{text("Done saving codes")}</button>
        </section> : loading ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{text("Loading authenticator settings…")}</p>
            : !status ? <button type="button" className={button} onClick={() => setRevision(value => value + 1)}>{text("Retry authenticator settings")}</button>
                : <>
                    <p className="font-semibold">{text(status.enabled ? 'Authenticator enabled' : 'Authenticator not enabled')}</p>
                    <button type="button" className={button} disabled={action !== null} onClick={() => setRevision(value => value + 1)}>{text("Refresh authenticator status")}</button>
                    {!status.available ? <div className="space-y-3"><p role="status" className="text-sm">{text("Authenticator verification is temporarily unavailable on this server. Your recorded setting is shown above.")}</p><button className={button} onClick={() => setRevision(value => value + 1)}>{text("Refresh availability")}</button></div>
                        : !passwordLoginEnabled ? <p className="text-sm">{text("Set a password before managing an authenticator.")} <Link className="app-text-action" to="/forgot-password">{text("Set a password through account recovery")}</Link>.</p>
                            : <>
                                {status.enabled && <p className="text-sm">{text(`${status.recoveryCodesRemaining} unused recovery codes remain.`, `${status.recoveryCodesRemaining} გამოუყენებელი აღდგენის კოდი დარჩა.`)}</p>}
                                {sensitive.setup && <div className="space-y-3">
                                    <p className="text-sm">{text("Scan this code with your authenticator app, or enter the setup key manually. Then enter its current six-digit code below.")}</p>
                                    <div className="w-fit max-w-full rounded-xl bg-[color:var(--color-elevated)] p-3"><QRCodeSVG value={sensitive.setup.authenticatorUri} size={200} marginSize={2} title={text("Authenticator setup QR code")} /></div>
                                    <code className="block break-all rounded-xl bg-[var(--fc-surface)] p-3 text-sm select-text">{sensitive.setup.secret}</code>
                                    <button type="button" className={button} onClick={() => void copy(sensitive.setup?.secret ?? '')}>{text("Copy setup key")}</button>
                                    <p role={expired ? 'alert' : undefined} className="text-sm">{expired ? text("Setup expired. Start again for a new key.") : text(`Setup expires in ${setupMinutes} ${setupMinutes === 1 ? 'minute' : 'minutes'}.`, `გამართვის ვადა ${setupMinutes} წუთში ამოიწურება.`)}</p>
                                </div>}
                                <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!status.enabled) void mutate(sensitive.setup && !expired ? 'enable' : 'setup'); }}>
                                    <label className="block space-y-2 text-sm">{text("Current password")}<input type="password" autoComplete="current-password" maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} className={input} disabled={action !== null} /></label>
                                    {(status.enabled || (sensitive.setup && !expired)) && <label className="block space-y-2 text-sm">{status.enabled ? text("Authenticator or unused recovery code") : text("Six-digit authenticator code")}<input type="text" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} maxLength={40} required value={code} onChange={event => setCode(event.target.value)} className={input} disabled={action !== null} /></label>}
                                    {action && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{text("Saving security change…")}</p>}
                                    {!status.enabled ? <div className="flex flex-wrap gap-2"><button type="submit" className={button} disabled={action !== null || !password || Boolean(sensitive.setup && !expired && !code.trim())}>{sensitive.setup && !expired ? text("Enable authenticator") : sensitive.setup ? text("Start setup again") : text("Set up authenticator")}</button>
                                        {sensitive.setup && <button type="button" className={button} disabled={action !== null} onClick={() => { setSensitive({ setup: null, recoveryCodes: null }); setPassword(''); setCode(''); setError(null); }}>{text("Cancel setup")}</button>}</div>
                                        : <div className="space-y-3"><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={action !== null} onClick={() => setConfirmation('recovery-codes')}>{text("Replace recovery codes")}</button><button type="button" className={button} disabled={action !== null} onClick={() => setConfirmation('disable')}>{text("Disable authenticator")}</button></div>
                                            {confirmation && <div className="space-y-3 rounded-xl border border-[var(--fc-border)] p-3"><p className="text-sm">{confirmation === 'disable' ? text("Disable authenticator protection? Other remembered sessions will be signed out.") : text("Replace your recovery codes? Every old recovery code will stop working. Save the new set before leaving.")}</p><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={action !== null || !password || !code.trim()} onClick={() => void mutate(confirmation)}>{text(confirmation === 'disable' ? 'Confirm disable' : 'Confirm replacement')}</button><button type="button" className={button} disabled={action !== null} onClick={() => setConfirmation(null)}>{text("Cancel")}</button></div></div>}</div>}
                                </form>
                            </>}
                </>}
    </div>;
}
