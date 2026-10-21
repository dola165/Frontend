import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { activatePlayerCard } from '../features/clubs/api';
import { extractApiErrorMessage } from '../utils/apiError';
import { ageFromDob, todayIso } from '../utils/age';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { buildLoginPath, buildSignupPath } from '../utils/authRedirect';

type Stage =
    | { kind: 'loading' }
    | { kind: 'login-required' }
    | { kind: 'confirm' }
    | { kind: 'activate'; cardId: number }
    | { kind: 'credentials'; username: string; email: string }
    | { kind: 'done-accepted' }
    | { kind: 'done-declined' }
    | { kind: 'error'; message: string };

/**
 * Parental-consent magic-link landing (WEB_APP_MASTER_PLAN.md §2.1, Sprint 3).
 * Confirming doubles as the claim path: it links the confirmer as the guardian
 * of the kid's Player Card, then offers activation only when the server confirms eligibility.
 */
export const ConsentPage = () => {
    const [searchParams] = useSearchParams();
    const { t } = useTranslation();
    const { isAuthenticated, isBootstrapping } = useAuth();
    const token = searchParams.get('token') ?? '';
    const [stage, setStage] = useState<Stage>({ kind: 'loading' });
    const [busy, setBusy] = useState(false);
    const [childDob, setChildDob] = useState('');
    const [childEmail, setChildEmail] = useState('');
    const [activationError, setActivationError] = useState<string | null>(null);

    useEffect(() => {
        if (isBootstrapping) return;
        if (!token) {
            setStage({ kind: 'error', message: t('minors.consent.missingToken') });
            return;
        }
        setStage(isAuthenticated ? { kind: 'confirm' } : { kind: 'login-required' });
    }, [isAuthenticated, isBootstrapping, token, t]);

    const handleConfirm = async (accept: boolean) => {
        setBusy(true);
        try {
            const res = await apiClient.post('/consent/confirm', { token, accept });
            const cardId = res.data?.cardId as number | undefined;
            if (!accept) {
                setStage({ kind: 'done-declined' });
            } else if (cardId && res.data?.activationEligible === true) {
                setStage({ kind: 'activate', cardId });
            } else {
                setStage({ kind: 'done-accepted' });
            }
        } catch (err) {
            setStage({ kind: 'error', message: extractApiErrorMessage(err, t('minors.consent.failed')) });
        } finally {
            setBusy(false);
        }
    };

    const handleActivate = async (e: React.FormEvent, cardId: number) => {
        e.preventDefault();
        setActivationError(null);
        if (!childDob || !Number.isFinite(ageFromDob(childDob)) || ageFromDob(childDob) < 13 || ageFromDob(childDob) >= 18) {
            setActivationError(t('minors.consent.activationAge'));
            return;
        }
        setBusy(true);
        try {
            const creds = await activatePlayerCard(cardId, childDob, childEmail.trim());
            setStage({ kind: 'credentials', username: creds.username, email: creds.email });
        } catch (err) {
            setActivationError(extractApiErrorMessage(err, t('minors.consent.activationFailed')));
        } finally {
            setBusy(false);
        }
    };

    const inputClass = 'theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)] placeholder:text-[var(--color-secondary)]';

    return (
        <div className="bg-[var(--color-surface)] flex min-h-screen flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-[var(--color-accent)] text-[var(--color-on-accent)] flex items-center justify-center mx-auto mb-6 border border-[var(--color-accent)]">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-semibold uppercase tracking-tight text-[var(--color-text)] mb-2">{t('minors.consent.title')}</h1>
                    <p className="text-sm text-[var(--color-secondary)]">{t('minors.consent.intro')}</p>
                </div>

                <div className="theme-surface theme-border border shadow-2xl p-8 rounded-xl">
                    {stage.kind === 'loading' && (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-7 w-7 animate-spin text-[var(--color-accent)]" />
                        </div>
                    )}

                    {stage.kind === 'error' && (
                        <div className="border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)] flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" /> {stage.message}
                        </div>
                    )}

                    {stage.kind === 'login-required' && (
                        <div className="flex flex-col gap-4 text-center">
                            <p className="text-sm text-[var(--color-secondary)]">
                                {t('minors.consent.signInPrompt')}
                            </p>
                            <Link
                                to={buildSignupPath(`/consent?token=${encodeURIComponent(token)}`)}
                                className="w-full border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-on-accent)]"
                            >
                                {t('minors.consent.createParent')}
                            </Link>
                            <Link
                                to={buildLoginPath(`/consent?token=${encodeURIComponent(token)}`)}
                                className="text-[11px] font-semibold uppercase tracking-[0.14em] app-text-action"
                            >
                                {t('minors.consent.haveAccount')}
                            </Link>
                        </div>
                    )}

                    {stage.kind === 'confirm' && (
                        <div className="flex flex-col gap-4">
                            <p className="text-sm text-[var(--color-secondary)]">
                                {t('minors.consent.agreeLine')}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleConfirm(true)}
                                    disabled={busy}
                                    className="flex-1 inline-flex items-center justify-center gap-2 border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-on-accent)] disabled:opacity-50"
                                >
                                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('minors.consent.confirm')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleConfirm(false)}
                                    disabled={busy}
                                    className="flex-1 border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-secondary)] hover:text-[var(--color-text)]"
                                >
                                    {t('minors.consent.decline')}
                                </button>
                            </div>
                        </div>
                    )}

                    {stage.kind === 'activate' && (
                        <form onSubmit={(e) => handleActivate(e, stage.cardId)} className="flex flex-col gap-4">
                            <p className="text-sm font-semibold text-[var(--color-text)]">
                                {t('minors.consent.cardPrompt')}
                            </p>
                            {activationError && <p role="alert" className="text-sm text-[color:var(--state-danger)]">{activationError}</p>}
                            <div className="space-y-2">
                                <label htmlFor="consent-child-dob" className="text-[10px] font-semibold  text-[var(--color-secondary)]">{t('minors.consent.childDob')}</label>
                                <input
                                    id="consent-child-dob"
                                    type="date"
                                    value={childDob}
                                    max={todayIso()}
                                    onChange={(e) => setChildDob(e.target.value)}
                                    required
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="consent-child-email" className="text-[10px] font-semibold  text-[var(--color-secondary)]">{t('minors.consent.childEmail')}</label>
                                <input
                                    id="consent-child-email"
                                    type="email"
                                    value={childEmail}
                                    onChange={(e) => setChildEmail(e.target.value)}
                                    required
                                    className={inputClass}
                                    placeholder={t('minors.consent.emailPlaceholder')}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={busy}
                                className="w-full inline-flex items-center justify-center gap-2 border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-on-accent)] disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('minors.consent.activate')}
                            </button>
                        </form>
                    )}

                    {stage.kind === 'credentials' && (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm font-semibold text-[var(--color-text)]">Account invitation sent</p>
                            <p className="text-[11px] font-semibold  text-[color:var(--state-danger)]">
                                Email verification is required before sign-in.
                            </p>
                            <p role="status">Account invitation sent to {stage.email}. The recipient must verify this address and use the password setup link sent to their mailbox. Club consent remains separate.</p>
                            <Link to="/login" className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] app-text-action">
                                {t('minors.consent.goLogin')}
                            </Link>
                        </div>
                    )}

                    {stage.kind === 'done-accepted' && (
                        <p className="text-sm text-[var(--color-secondary)]">
                            {t('minors.consent.confirmed')}
                        </p>
                    )}

                    {stage.kind === 'done-declined' && (
                        <p className="text-sm text-[var(--color-secondary)]">
                            {t('minors.consent.declined')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
