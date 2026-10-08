import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { credentialUpdate } from '../api/credentialUpdates';
import { extractApiErrorMessage } from '../utils/apiError';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { assertCurrentAuthSession } from '../utils/authStorage';

/**
 * First-login password change for card-activated accounts
 * (WEB_APP_MASTER_PLAN.md §2.2, Sprint 3). The kid logs in with the temp
 * password the guardian handed them, then sets their own.
 */
export const SetPasswordPage = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { logout, sessionId } = useAuth();
    const request = useRef<AbortController | null>(null);
    useEffect(() => () => request.current?.abort(), [sessionId]);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (request.current) return;

        if (newPassword !== confirmPassword) {
            setError(t('minors.setPassword.mismatch'));
            return;
        }
        if (newPassword.length < 8) {
            setError(t('minors.setPassword.tooShort'));
            return;
        }

        setIsLoading(true);
        setError('');
        const controller = new AbortController(); request.current = controller;
        try {
            await credentialUpdate(config => apiClient.post('/auth/change-password', { currentPassword, newPassword }, config), response => response, controller.signal);
            assertCurrentAuthSession(sessionId);
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
            await logout();
            navigate('/login?passwordChanged=1', { replace: true });
        } catch (err) {
            if (!controller.signal.aborted) setError(extractApiErrorMessage(err, t('minors.setPassword.failed')));
        } finally {
            if (request.current === controller) request.current = null;
            if (!controller.signal.aborted) setIsLoading(false);
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
                    <h1 className="text-3xl font-semibold uppercase tracking-tight text-[var(--color-text)] mb-2">{t('minors.setPassword.title')}</h1>
                    <p className="text-sm text-[var(--color-secondary)]">{t('minors.setPassword.subtitle')}</p>
                    <p className="mt-2 text-sm text-[var(--color-secondary)]">After saving, sign in again with your new password to continue.</p>
                </div>

                <div className="theme-surface theme-border border shadow-2xl p-8 rounded-xl">
                    {error && (
                        <div className="mb-6 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)] flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold  text-[var(--color-secondary)]">{t('minors.setPassword.temporary')}</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                className={inputClass}
                                placeholder="********"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold  text-[var(--color-secondary)]">{t('minors.setPassword.newPassword')}</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                minLength={8}
                                className={inputClass}
                                placeholder="********"
                            />
                            <p className="text-[10px] font-semibold  text-muted">{t('minors.setPassword.minChars')}</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold  text-[var(--color-secondary)]">{t('minors.setPassword.confirmPassword')}</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className={inputClass}
                                placeholder="********"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 inline-flex items-center justify-center gap-2 border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)] px-4 py-3 text-[11px] font-semibold  transition-colors disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('minors.setPassword.save')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
