import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { isUnder13, todayIso } from '../utils/age';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

/**
 * DOB capture gate for the Google Sign-In path (WEB_APP_MASTER_PLAN.md §2.1).
 * A Google account carries no date of birth, so a fresh Google login lands here
 * before entering the app. The server rejects under-13s on PUT /users/me —
 * this screen is the UX, the backend is the law.
 */
export const DobGatePage = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const [dob, setDob] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Users who already have a DOB don't belong on this screen.
    useEffect(() => {
        if (user?.dob) {
            navigate(user.profileComplete ? '/feed' : '/onboarding', { replace: true });
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!dob) {
            setError(t('minors.dob.required'));
            return;
        }
        if (isUnder13(dob)) {
            setError(t('minors.dob.blocked'));
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await apiClient.put('/users/me', { dateOfBirth: dob });
            navigate(user?.profileComplete ? '/feed' : '/onboarding', { replace: true });
        } catch (err) {
            console.error(err);
            setError(extractApiErrorMessage(err, t('minors.dob.failed')));
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    const inputClass = 'theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-[#f4f4f5] outline-none transition-colors focus:border-[#16a34a] placeholder:text-[#a1a1aa]';

    return (
        <div className="bg-[#0f1117] flex min-h-screen flex-col items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-[#16a34a] text-white flex items-center justify-center mx-auto mb-6 border border-[#16a34a]">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-semibold uppercase tracking-tight text-[#f4f4f5] mb-2">{t('minors.dob.title')}</h1>
                    <p className="text-sm text-[#a1a1aa]">{t('minors.dob.subtitle')}</p>
                </div>

                <div className="theme-surface theme-border border shadow-2xl p-8 rounded-xl">
                    {error && (
                        <div className="mb-6 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)] flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-semibold  text-[#a1a1aa]">{t('minors.dob.label')}</label>
                            <input
                                type="date"
                                value={dob}
                                max={todayIso()}
                                onChange={(e) => setDob(e.target.value)}
                                required
                                className={inputClass}
                            />
                            <p className="text-[10px] font-semibold  text-muted">{t('minors.dob.under13')}</p>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 inline-flex items-center justify-center gap-2 border border-[#16a34a] bg-[#16a34a] text-white px-4 py-3 text-[11px] font-semibold  transition-colors disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('minors.dob.confirm')}
                        </button>
                    </form>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                    >
                        {t('minors.dob.notYou')}
                    </button>
                </div>
            </div>
        </div>
    );
};
