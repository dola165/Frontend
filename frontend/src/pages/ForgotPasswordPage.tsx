import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail, Loader2 } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { extractApiErrorMessage } from '../utils/apiError';

export const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        try {
            const response = await apiClient.post<{ message?: string }>('/auth/forgot-password', {
                email: email.trim()
            });
            setSuccessMessage(response.data?.message || 'If an account exists for that email, a reset link has been sent.');
        } catch (error) {
            setErrorMessage(extractApiErrorMessage(error, 'Password reset could not be requested right now.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#fcf8f2] dark:bg-[#09090b] flex flex-col justify-center items-center p-6 selection:bg-[#00c853]/20 dark:selection:bg-[#00c853]/30 font-sans text-[#1a1a1a] dark:text-gray-100">
            <Link to="/login" className="absolute top-8 left-8 flex items-center gap-2 font-bold uppercase tracking-widest text-sm hover:-translate-x-1 transition-transform">
                <ArrowLeft className="w-5 h-5" /> Back to Login
            </Link>

            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-[#00c853] text-black flex items-center justify-center rounded-xl mx-auto mb-6 shadow-[4px_4px_0px_0px_#1a1a1a] border-2 border-[#1a1a1a]">
                        <Mail className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-serif font-bold tracking-tighter italic uppercase mb-2">Reset Access</h1>
                    <p className="text-gray-500 font-serif italic">Request a secure email link to reset your Talanti password.</p>
                </div>

                <div className="bg-white dark:bg-[#18181b] p-8 rounded-2xl border-2 border-[#1a1a1a] dark:border-gray-700 shadow-[8px_8px_0px_0px_#1a1a1a] dark:shadow-[8px_8px_0px_0px_#000]">
                    {successMessage && (
                        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold text-sm rounded-lg flex items-start gap-2">
                            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>{successMessage}</span>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-500 text-rose-800 dark:text-rose-300 font-bold text-sm rounded-lg">
                            {errorMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-medium transition-colors"
                                placeholder="player@talanti.ge"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full mt-2 bg-[#00c853] hover:bg-[#00e676] text-black font-black uppercase tracking-widest py-4 rounded-xl border-2 border-[#1a1a1a] dark:border-transparent shadow-[4px_4px_0px_0px_#1a1a1a] dark:shadow-[4px_4px_0px_0px_#000] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Email'}
                        </button>
                    </form>

                    <p className="mt-6 text-xs font-semibold text-gray-500 dark:text-gray-400 leading-relaxed">
                        For privacy, Talanti always responds the same way here. If the email exists, the reset link is on its way.
                    </p>
                </div>
            </div>
        </div>
    );
};
