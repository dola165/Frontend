import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { activatePlayerCard } from '../features/clubs/api';
import { extractApiErrorMessage } from '../utils/apiError';
import { isUnder13, todayIso } from '../utils/age';
import { ShieldCheck, Loader2, AlertCircle, Check, Copy } from 'lucide-react';

type Stage =
    | { kind: 'loading' }
    | { kind: 'login-required' }
    | { kind: 'confirm' }
    | { kind: 'activate'; cardId: number }
    | { kind: 'credentials'; username: string; tempPassword: string }
    | { kind: 'done-accepted' }
    | { kind: 'done-declined' }
    | { kind: 'error'; message: string };

/**
 * Parental-consent magic-link landing (WEB_APP_MASTER_PLAN.md §2.1, Sprint 3).
 * Confirming doubles as the claim path: it links the confirmer as the guardian
 * of the kid's Player Card, then offers activation when the kid is 13+.
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
    const [copied, setCopied] = useState(false);

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
            } else if (cardId) {
                setStage({ kind: 'activate', cardId });
            } else {
                setStage({ kind: 'done-accepted' });
            }
        } catch (err) {
            console.error(err);
            setStage({ kind: 'error', message: extractApiErrorMessage(err, t('minors.consent.failed')) });
        } finally {
            setBusy(false);
        }
    };

    const handleActivate = async (e: React.FormEvent, cardId: number) => {
        e.preventDefault();
        if (!childDob || isUnder13(childDob)) {
            setStage({ kind: 'error', message: t('minors.consent.activationAge') });
            return;
        }
        setBusy(true);
        try {
            const creds = await activatePlayerCard(cardId, childDob, childEmail.trim());
            setStage({ kind: 'credentials', username: creds.username, tempPassword: creds.tempPassword });
        } catch (err) {
            console.error(err);
            setStage({ kind: 'error', message: extractApiErrorMessage(err, t('minors.consent.activationFailed')) });
        } finally {
            setBusy(false);
        }
    };

    const inputClass = 'theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-[#f4f4f5] outline-none transition-colors focus:border-[#16a34a] placeholder:text-[#a1a1aa]';

    return (
        <div className="bg-[#0f1117] flex min-h-screen flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-[#16a34a] text-white flex items-center justify-center mx-auto mb-6 border border-[#16a34a]">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-semibold uppercase tracking-tight text-[#f4f4f5] mb-2">{t('minors.consent.title')}</h1>
                    <p className="text-sm text-[#a1a1aa]">{t('minors.consent.intro')}</p>
                </div>

                <div className="theme-surface theme-border border shadow-2xl p-8 rounded-xl">
                    {stage.kind === 'loading' && (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-7 w-7 animate-spin text-[#16a34a]" />
                        </div>
                    )}

                    {stage.kind === 'error' && (
                        <div className="border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)] flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" /> {stage.message}
                        </div>
                    )}

                    {stage.kind === 'login-required' && (
                        <div className="flex flex-col gap-4 text-center">
                            <p className="text-sm text-[#a1a1aa]">
                                {t('minors.consent.signInPrompt')}
                            </p>
                            <Link
                                to={`/signup?next=/consent?token=${encodeURIComponent(token)}`}
                                className="w-full border border-[#16a34a] bg-[#16a34a] px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
                            >
                                {t('minors.consent.createParent')}
                            </Link>
                            <Link
                                to={`/login?next=/consent?token=${encodeURIComponent(token)}`}
                                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#16a34a] hover:underline"
                            >
                                {t('minors.consent.haveAccount')}
                            </Link>
                        </div>
                    )}

                    {stage.kind === 'confirm' && (
                        <div className="flex flex-col gap-4">
                            <p className="text-sm text-[#a1a1aa]">
                                {t('minors.consent.agreeLine')}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleConfirm(true)}
                                    disabled={busy}
                                    className="flex-1 inline-flex items-center justify-center gap-2 border border-[#16a34a] bg-[#16a34a] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-50"
                                >
                                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('minors.consent.confirm')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleConfirm(false)}
                                    disabled={busy}
                                    className="flex-1 border border-[#ffffff0d] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] hover:text-[#f4f4f5]"
                                >
                                    {t('minors.consent.decline')}
                                </button>
                            </div>
                        </div>
                    )}

                    {stage.kind === 'activate' && (
                        <form onSubmit={(e) => handleActivate(e, stage.cardId)} className="flex flex-col gap-4">
                            <p className="text-sm font-semibold text-[#f4f4f5]">
                                {t('minors.consent.cardPrompt')}
                            </p>
                            <div className="space-y-2">
                                <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.consent.childDob')}</label>
                                <input
                                    type="date"
                                    value={childDob}
                                    max={todayIso()}
                                    onChange={(e) => setChildDob(e.target.value)}
                                    required
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.consent.childEmail')}</label>
                                <input
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
                                className="w-full inline-flex items-center justify-center gap-2 border border-[#16a34a] bg-[#16a34a] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('minors.consent.activate')}
                            </button>
                        </form>
                    )}

                    {stage.kind === 'credentials' && (
                        <div className="flex flex-col gap-3">
                            <p className="text-sm font-semibold text-[#f4f4f5]">{t('minors.consent.activated')}</p>
                            <p className="text-[11px] font-semibold  text-[color:var(--state-danger)]">
                                {t('minors.consent.credentialsOnce')}
                            </p>
                            <div className="flex items-center justify-between border border-[#ffffff0d] bg-elevated px-3 py-2">
                                <span className="text-sm font-mono text-[#f4f4f5]">{stage.username}</span>
                                <button
                                    type="button"
                                    onClick={() => { void navigator.clipboard.writeText(stage.username); setCopied(true); }}
                                    className="p-1 text-[#a1a1aa] hover:text-[#f4f4f5]"
                                >
                                    {copied ? <Check className="h-4 w-4 text-[#16a34a]" /> : <Copy className="h-4 w-4" />}
                                </button>
                            </div>
                            <div className="flex items-center justify-between border border-[#ffffff0d] bg-elevated px-3 py-2">
                                <span className="text-sm font-mono text-[#f4f4f5]">{stage.tempPassword}</span>
                                <button
                                    type="button"
                                    onClick={() => { void navigator.clipboard.writeText(stage.tempPassword); setCopied(true); }}
                                    className="p-1 text-[#a1a1aa] hover:text-[#f4f4f5]"
                                >
                                    {copied ? <Check className="h-4 w-4 text-[#16a34a]" /> : <Copy className="h-4 w-4" />}
                                </button>
                            </div>
                            <Link to="/login" className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#16a34a] hover:underline">
                                {t('minors.consent.goLogin')}
                            </Link>
                        </div>
                    )}

                    {stage.kind === 'done-accepted' && (
                        <p className="text-sm text-[#a1a1aa]">
                            {t('minors.consent.confirmed')}
                        </p>
                    )}

                    {stage.kind === 'done-declined' && (
                        <p className="text-sm text-[#a1a1aa]">
                            {t('minors.consent.declined')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
