import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorMessage } from '../utils/apiError';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

/**
 * First-login password change for card-activated accounts
 * (WEB_APP_MASTER_PLAN.md §2.2, Sprint 3). The kid logs in with the temp
 * password the guardian handed them, then sets their own.
 */
export const SetPasswordPage = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

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
        try {
            await apiClient.post('/auth/change-password', { currentPassword, newPassword });
            navigate('/feed', { replace: true });
        } catch (err) {
            console.error(err);
            setError(extractApiErrorMessage(err, t('minors.setPassword.failed')));
        } finally {
            setIsLoading(false);
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
                    <h1 className="text-3xl font-semibold uppercase tracking-tight text-[#f4f4f5] mb-2">{t('minors.setPassword.title')}</h1>
                    <p className="text-sm text-[#a1a1aa]">{t('minors.setPassword.subtitle')}</p>
                </div>

                <div className="theme-surface theme-border border shadow-2xl p-8 rounded-xl">
                    {error && (
                        <div className="mb-6 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)] flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.setPassword.temporary')}</label>
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
                            <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.setPassword.newPassword')}</label>
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
                            <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.setPassword.confirmPassword')}</label>
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
                            className="w-full mt-2 inline-flex items-center justify-center gap-2 border border-[#16a34a] bg-[#16a34a] text-white px-4 py-3 text-[11px] font-semibold  transition-colors disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('minors.setPassword.save')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
