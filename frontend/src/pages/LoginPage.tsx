import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Shield, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export const LoginPage = () => {
    useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await apiClient.post('/auth/login', { email, password });
            localStorage.setItem('accessToken', res.data.accessToken);
            // Optional: Store user info if needed right away
            // localStorage.setItem('user', JSON.stringify(res.data));

            // Force a hard reload or navigate to feed so App.tsx re-evaluates the token
            window.location.href = '/feed';
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
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
                    <div className="w-16 h-16 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] flex items-center justify-center rounded-xl mx-auto mb-6 shadow-[4px_4px_0px_0px_#a34e36] border-2 border-[#1a1a1a] dark:border-white">
                        <Shield className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-serif font-bold tracking-tighter italic uppercase mb-2">Welcome Back</h1>
                    <p className="text-gray-500 font-serif italic">Your legacy awaits. Access the Command Center.</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border-2 border-[#1a1a1a] dark:border-gray-700 shadow-[8px_8px_0px_0px_#1a1a1a] dark:shadow-[8px_8px_0px_0px_#000]">

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 text-red-700 dark:text-red-400 font-bold text-sm rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="flex flex-col gap-5">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#2a4d37] dark:focus:border-emerald-500 font-medium transition-colors"
                                placeholder="player@talanti.ge"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-500">Password</label>
                                <a href="#" className="text-xs font-bold text-[#a34e36] hover:underline">Forgot?</a>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#2a4d37] dark:focus:border-emerald-500 font-medium transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 bg-[#2a4d37] dark:bg-emerald-600 hover:bg-[#1f3a29] dark:hover:bg-emerald-500 text-white font-black uppercase tracking-widest py-4 rounded-xl border-2 border-[#1a1a1a] dark:border-transparent shadow-[4px_4px_0px_0px_#1a1a1a] dark:shadow-[4px_4px_0px_0px_#000] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enter Database'}
                        </button>
                    </form>

                    <div className="my-8 flex items-center gap-4">
                        <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                        <span className="text-xs font-black uppercase tracking-widest text-gray-400">Or bypass with</span>
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
                    Not drafted yet? <Link to="/signup" className="text-[#a34e36] hover:underline uppercase tracking-wider ml-1">Create Legacy</Link>
                </p>
            </div>
        </div>
    );
};