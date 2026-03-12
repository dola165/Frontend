import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Shield, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export const RegisterPage = () => {
    useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const res = await apiClient.post('/auth/register', { email, password });
            localStorage.setItem('accessToken', res.data.accessToken);

            // Send them directly into the app (or to onboarding later)
            window.location.href = '/feed';
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'Registration failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:8080/oauth2/authorization/google';
    };

    return (
        <div className="min-h-screen bg-[#fcf8f2] dark:bg-gray-900 flex flex-col justify-center items-center p-6 selection:bg-emerald-100 dark:selection:bg-emerald-900 font-sans text-[#1a1a1a] dark:text-gray-100">

            <Link to="/" className="absolute top-8 left-8 flex items-center gap-2 font-bold uppercase tracking-widest text-sm hover:-translate-x-1 transition-transform">
                <ArrowLeft className="w-5 h-5" /> Back to Base
            </Link>

            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-[#a34e36] text-white flex items-center justify-center rounded-xl mx-auto mb-6 shadow-[4px_4px_0px_0px_#1a1a1a] border-2 border-[#1a1a1a]">
                        <Shield className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-serif font-bold tracking-tighter italic uppercase mb-2">Draft Day</h1>
                    <p className="text-gray-500 font-serif italic">Register your profile and enter the global arena.</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border-2 border-[#1a1a1a] dark:border-gray-700 shadow-[8px_8px_0px_0px_#1a1a1a] dark:shadow-[8px_8px_0px_0px_#000]">

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 text-red-700 dark:text-red-400 font-bold text-sm rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="flex flex-col gap-5">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#a34e36] font-medium transition-colors"
                                placeholder="champion@talanti.ge"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#a34e36] font-medium transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#a34e36] font-medium transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] hover:bg-gray-800 dark:hover:bg-gray-200 font-black uppercase tracking-widest py-4 rounded-xl border-2 border-[#1a1a1a] dark:border-transparent shadow-[4px_4px_0px_0px_#a34e36] dark:shadow-[4px_4px_0px_0px_#a34e36] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Legacy'}
                        </button>
                    </form>

                    <div className="my-8 flex items-center gap-4">
                        <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                        <span className="text-xs font-black uppercase tracking-widest text-gray-400">Or draft via</span>
                        <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        className="w-full bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-[#1a1a1a] dark:text-white font-black uppercase tracking-widest py-4 rounded-xl border-2 border-[#1a1a1a] dark:border-gray-600 shadow-[4px_4px_0px_0px_#1a1a1a] dark:shadow-[4px_4px_0px_0px_#000] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
                    >
                        <img src="https://www.svgrepo.com/show/355037/google.svg" className="w-5 h-5" alt="Google" />
                        Google Sign In
                    </button>
                </div>

                <p className="text-center mt-8 font-bold text-sm text-gray-500">
                    Already drafted? <Link to="/login" className="text-[#2a4d37] hover:underline uppercase tracking-wider ml-1">Access Database</Link>
                </p>
            </div>
        </div>
    );
};