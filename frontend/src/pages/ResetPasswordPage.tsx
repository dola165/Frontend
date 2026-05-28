import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorCode, extractApiErrorMessage } from '../utils/apiError';

export const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const tokenError = useMemo(() => {
        if (!token?.trim()) {
            return 'This reset link is missing its token.';
        }
        return null;
    }, [token]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!token) {
            setErrorMessage('This reset link is not usable.');
            return;
        }
        if (password !== confirmPassword) {
            setErrorMessage('New password and confirmation do not match.');
            return;
        }

        setIsSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        try {
            const response = await apiClient.post<{ message?: string }>('/auth/reset-password', {
                token,
                newPassword: password
            });
            setSuccessMessage(response.data?.message || 'Password updated successfully.');
            setPassword('');
            setConfirmPassword('');
        } catch (error) {
            const code = extractApiErrorCode(error);
            if (code === 'expired_token') {
                setErrorMessage('This reset link has expired. Request a new password reset email.');
            } else if (code === 'used_token') {
                setErrorMessage('This reset link has already been used. Request a fresh one if needed.');
            } else {
                setErrorMessage(extractApiErrorMessage(error, 'Failed to reset password.'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#fcf8f2] p-6 font-sans text-[#1a1a1a] dark:bg-[#09090b] dark:text-gray-100">
            <Link to="/login" className="absolute left-8 top-8 flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-transform hover:-translate-x-1">
                <ArrowLeft className="h-5 w-5" /> Back to Login
            </Link>

            <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
                <div className="w-full rounded-2xl border-2 border-[#1a1a1a] bg-white p-8 shadow-[8px_8px_0px_0px_#1a1a1a] dark:border-gray-700 dark:bg-[#18181b] dark:shadow-[8px_8px_0px_0px_#000]">
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#00c853] text-black shadow-[4px_4px_0px_0px_#1a1a1a]">
                            <KeyRound className="h-8 w-8" />
                        </div>
                        <h1 className="mb-2 text-4xl font-serif font-bold uppercase italic tracking-tighter">Set New Access</h1>
                        <p className="font-serif italic text-gray-500">Use your secure Talanti link to establish a new password.</p>
                    </div>

                    {tokenError && (
                        <div className="mb-6 flex items-start gap-2 rounded-lg border-2 border-rose-500 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                            <span>{tokenError}</span>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="mb-6 flex items-start gap-2 rounded-lg border-2 border-rose-500 bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="mb-6 flex items-start gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 p-4 text-sm font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">New Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                disabled={Boolean(tokenError) || Boolean(successMessage)}
                                className="w-full rounded-xl border-2 border-[#1a1a1a] bg-[#fcf8f2] px-4 py-3 font-medium outline-none transition-colors focus:border-[#00c853] disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:focus:border-[#00c853]"
                                placeholder="********"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                disabled={Boolean(tokenError) || Boolean(successMessage)}
                                className="w-full rounded-xl border-2 border-[#1a1a1a] bg-[#fcf8f2] px-4 py-3 font-medium outline-none transition-colors focus:border-[#00c853] disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:focus:border-[#00c853]"
                                placeholder="********"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={Boolean(tokenError) || Boolean(successMessage) || isSubmitting}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1a1a1a] bg-[#00c853] py-4 font-black uppercase tracking-widest text-black shadow-[4px_4px_0px_0px_#1a1a1a] transition-all hover:bg-[#00e676] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-transparent dark:bg-[#00c853] dark:shadow-[4px_4px_0px_0px_#000] dark:hover:bg-[#00e676]"
                        >
                            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Reset Password'}
                        </button>
                    </form>

                    <p className="mt-6 text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">
                        Once this succeeds, use your new password on the normal Talanti sign-in screen.
                    </p>
                </div>
            </div>
        </div>
    );
};
