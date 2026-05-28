import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Loader2, MailWarning, RefreshCw, ShieldAlert } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorCode, extractApiErrorMessage } from '../utils/apiError';
import { useAuth } from '../context/AuthContext';

type VerifyState = 'loading' | 'success' | 'error';

export const VerifyEmailPage = () => {
    const [searchParams] = useSearchParams();
    const { status, bootstrapSession } = useAuth();
    const token = searchParams.get('token');
    const [verifyState, setVerifyState] = useState<VerifyState>(token ? 'loading' : 'error');
    const [message, setMessage] = useState<string>(token ? 'Verifying your Talanti email...' : 'This verification link is missing its token.');
    const [resendMessage, setResendMessage] = useState<string | null>(null);
    const [resendError, setResendError] = useState<string | null>(null);
    const [isSendingVerification, setIsSendingVerification] = useState(false);

    const canResendFromHere = status === 'authenticated';

    useEffect(() => {
        if (!token) {
            return;
        }

        let isCancelled = false;

        const verifyEmail = async () => {
            try {
                const response = await apiClient.post<{ message?: string }>('/auth/verify-email', { token });
                if (isCancelled) {
                    return;
                }
                setVerifyState('success');
                setMessage(response.data?.message || 'Email verified successfully.');
                if (status === 'authenticated') {
                    await bootstrapSession();
                }
            } catch (error) {
                if (isCancelled) {
                    return;
                }
                const code = extractApiErrorCode(error);
                if (code === 'expired_token') {
                    setMessage('This verification link has expired.');
                } else if (code === 'used_token') {
                    setMessage('This verification link has already been used.');
                } else {
                    setMessage(extractApiErrorMessage(error, 'This verification link is invalid.'));
                }
                setVerifyState('error');
            }
        };

        void verifyEmail();

        return () => {
            isCancelled = true;
        };
    }, [bootstrapSession, token]);

    const statusBlock = useMemo(() => {
        if (verifyState === 'loading') {
            return {
                icon: <Loader2 className="h-6 w-6 animate-spin text-[#00c853]" />,
                title: 'Verifying',
                copy: message,
                className: 'border-[#00c853]/30 bg-[#00c853]/10 text-[#00c853] dark:bg-[#00c853]/10 dark:text-[#00c853]'
            };
        }

        if (verifyState === 'success') {
            return {
                icon: <BadgeCheck className="h-6 w-6 text-[#00c853]" />,
                title: 'Verified',
                copy: message,
                className: 'border-[#00c853]/30 bg-[#00c853]/10 text-[#00c853] dark:bg-[#00c853]/10 dark:text-[#00c853]'
            };
        }

        return {
            icon: <MailWarning className="h-6 w-6 text-amber-500" />,
            title: 'Verification Issue',
            copy: message,
            className: 'border-amber-500/30 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
        };
    }, [message, verifyState]);

    const handleResend = async () => {
        setIsSendingVerification(true);
        setResendMessage(null);
        setResendError(null);

        try {
            const response = await apiClient.post<{ message?: string }>('/auth/send-verification');
            setResendMessage(response.data?.message || 'Verification email sent.');
            await bootstrapSession();
        } catch (error) {
            setResendError(extractApiErrorMessage(error, 'Failed to send another verification email.'));
        } finally {
            setIsSendingVerification(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#fcf8f2] p-6 font-sans text-[#1a1a1a] dark:bg-[#09090b] dark:text-gray-100">
            <Link to={canResendFromHere ? '/account?tab=security' : '/login'} className="absolute left-8 top-8 flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-transform hover:-translate-x-1">
                <ArrowLeft className="h-5 w-5" /> {canResendFromHere ? 'Back to Account' : 'Back to Login'}
            </Link>

            <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
                <div className="w-full rounded-2xl border-2 border-[#1a1a1a] bg-white p-8 shadow-[8px_8px_0px_0px_#1a1a1a] dark:border-gray-700 dark:bg-[#18181b] dark:shadow-[8px_8px_0px_0px_#000]">
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#1a1a1a] text-white shadow-[4px_4px_0px_0px_#00c853] dark:border-white dark:bg-white dark:text-[#1a1a1a]">
                            <BadgeCheck className="h-8 w-8" />
                        </div>
                        <h1 className="mb-2 text-4xl font-serif font-bold uppercase italic tracking-tighter">Email Verification</h1>
                        <p className="font-serif italic text-gray-500">Talanti uses this step to secure password recovery and future account protection.</p>
                    </div>

                    <div className={`rounded-lg border-2 p-5 ${statusBlock.className}`}>
                        <div className="flex items-start gap-3">
                            {statusBlock.icon}
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-widest">{statusBlock.title}</h2>
                                <p className="mt-2 text-sm font-semibold">{statusBlock.copy}</p>
                            </div>
                        </div>
                    </div>

                    {canResendFromHere && verifyState === 'error' && (
                        <div className="mt-6">
                            {resendMessage && (
                                <div className="mb-4 rounded-lg border border-[#00c853]/30 bg-[#00c853]/10 px-4 py-3 text-sm font-bold text-[#00c853] dark:bg-[#00c853]/10 dark:text-[#00c853]">
                                    {resendMessage}
                                </div>
                            )}
                            {resendError && (
                                <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{resendError}</span>
                                </div>
                            )}
                            <button
                                onClick={() => void handleResend()}
                                disabled={isSendingVerification}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1a1a1a] bg-[#00c853] py-4 font-black uppercase tracking-widest text-black shadow-[4px_4px_0px_0px_#1a1a1a] transition-all hover:bg-[#00e676] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-transparent dark:bg-[#00c853] dark:shadow-[4px_4px_0px_0px_#000] dark:hover:bg-[#00e676]"
                            >
                                {isSendingVerification ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                                Resend Verification Email
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
