import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Shield, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export const RegisterPage = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<'PLAYER' | 'FAN'>('PLAYER');
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
            await apiClient.post('/auth/register', { email, password, role });
            const loginRes = await apiClient.post('/auth/login', { email, password });
            localStorage.setItem('accessToken', loginRes.data.accessToken);
            await apiClient.get('/auth/csrf').catch(() => undefined);

            navigate('/onboarding');
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || 'Registration failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
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
                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Starting Role</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'PLAYER', label: 'Player', desc: 'Seeking clubs and tryouts' },
                                    { id: 'FAN', label: 'Fan', desc: 'Following clubs and content' }
                                ].map((option) => (
                                    <button
                                        type="button"
                                        key={option.id}
                                        onClick={() => setRole(option.id as 'PLAYER' | 'FAN')}
                                        className={`rounded-xl border-2 px-4 py-4 text-left transition-all ${
                                            role === option.id
                                                ? 'border-[#2a4d37] bg-emerald-50 dark:bg-emerald-900/20 shadow-[4px_4px_0px_0px_#2a4d37]'
                                                : 'border-[#1a1a1a] dark:border-gray-600 bg-[#fcf8f2] dark:bg-gray-900'
                                        }`}
                                    >
                                        <p className="font-black uppercase tracking-widest text-sm">{option.label}</p>
                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">{option.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-500">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#a34e36] font-medium transition-colors"
                                placeholder="********"
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
                                placeholder="********"
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

                    <div className="flex justify-center w-full">
                        <GoogleLogin
                            theme="filled_black"
                            size="large"
                            width="100%"
                            text="continue_with"
                            onSuccess={async (credentialResponse) => {
                                setIsLoading(true);
                                try {
                                    const res = await apiClient.post('/auth/google', {
                                        token: credentialResponse.credential
                                    });

                                    localStorage.setItem('accessToken', res.data.accessToken);
                                    await apiClient.get('/auth/csrf').catch(() => undefined);

                                    const meRes = await apiClient.get('/users/me');
                                    if (!meRes.data.profileComplete) {
                                        navigate('/onboarding');
                                    } else {
                                        navigate('/feed');
                                    }
                                } catch (err: any) {
                                    console.error("Google Auth Failed", err);
                                    setError(err.response?.data?.error || 'Google login failed.');
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            onError={() => {
                                setError('Google login popup was closed or failed.');
                            }}
                        />
                    </div>
                </div>

                <p className="text-center mt-8 font-bold text-sm text-gray-500">
                    Already drafted? <Link to="/login" className="text-[#2a4d37] hover:underline uppercase tracking-wider ml-1">Access Database</Link>
                </p>
            </div>
        </div>
    );
};
