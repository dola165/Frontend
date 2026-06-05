import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Shield, ArrowLeft, Loader2, AlertCircle, FlaskConical } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolvePostAuthRedirect } from '../utils/authRedirect';

const IS_MOCK_MODE = import.meta.env.VITE_ENABLE_MOCKS === 'true';

const MOCK_USERS = [
    { email: 'player@test.dev', password: 'mock', label: 'Marcus Rivera', role: 'PLAYER' },
    { email: 'organizer@test.dev', password: 'mock', label: 'Sarah Chen', role: 'ORGANIZER' },
    { email: 'coach@test.dev', password: 'mock', label: 'James Wilson', role: 'COACH' },
    { email: 'fan@test.dev', password: 'mock', label: 'Emma Thompson', role: 'FAN' },
    { email: 'admin@test.dev', password: 'mock', label: 'Alex Kim', role: 'ADMIN' },
];

export const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { loginWithAccessToken } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '/feed');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await apiClient.post('/auth/login', { email: email.trim(), password });
            const authenticatedUser = await loginWithAccessToken(res.data.accessToken);
            navigate(authenticatedUser.profileComplete ? nextPath : '/onboarding');
        } catch (err) {
            console.error(err);
            setError(extractApiErrorMessage(err, 'Invalid credentials. Please try again.'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#fcf8f2] dark:bg-[#09090b] flex flex-col justify-center items-center p-6 selection:bg-[#00c853]/20 dark:selection:bg-[#00c853]/30 font-sans text-[#1a1a1a] dark:text-gray-100">

            <Link to="/" className="absolute top-8 left-8 flex items-center gap-2 font-bold uppercase tracking-widest text-sm hover:-translate-x-1 transition-transform">
                <ArrowLeft className="w-5 h-5" /> Back to Base
            </Link>

            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-[#1a1a1a] dark:bg-white text-white dark:text-[#1a1a1a] flex items-center justify-center rounded-xl mx-auto mb-6 shadow-[4px_4px_0px_0px_#00c853] border-2 border-[#1a1a1a] dark:border-white">
                        <Shield className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-serif font-bold tracking-tighter italic uppercase mb-2">Welcome Back</h1>
                    <p className="text-gray-500 font-serif italic">Your legacy awaits. Access the Command Center.</p>
                </div>

                <div className="bg-white dark:bg-[#18181b] p-8 rounded-2xl border-2 border-[#1a1a1a] dark:border-gray-700 shadow-[8px_8px_0px_0px_#1a1a1a] dark:shadow-[8px_8px_0px_0px_#000]">

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
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-medium transition-colors"
                                placeholder="player@talanti.ge"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-500">Password</label>
                                <Link to="/forgot-password" className="text-xs font-bold text-[#00c853] hover:underline">Forgot?</Link>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-[#fcf8f2] dark:bg-gray-900 border-2 border-[#1a1a1a] dark:border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-[#00c853] font-medium transition-colors"
                                placeholder="********"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 bg-[#00c853] hover:bg-[#00e676] text-black font-black uppercase tracking-widest py-4 rounded-xl border-2 border-[#1a1a1a] dark:border-transparent shadow-[4px_4px_0px_0px_#1a1a1a] dark:shadow-[4px_4px_0px_0px_#000] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enter Database'}
                        </button>
                    </form>

                    <div className="my-8 flex items-center gap-4">
                        <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                        <span className="text-xs font-black uppercase tracking-widest text-gray-400">Or bypass with</span>
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

                                    const authenticatedUser = await loginWithAccessToken(res.data.accessToken);
                                    if (!authenticatedUser.profileComplete) {
                                        navigate('/onboarding');
                                    } else {
                                        navigate(nextPath);
                                    }
                                } catch (err) {
                                    console.error("Google Auth Failed", err);
                                    setError(extractApiErrorMessage(err, 'Google login failed.'));
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            onError={() => {
                                setError('Google login popup was closed or failed.');
                            }}
                        />
                    </div>

                    {IS_MOCK_MODE && (
                        <>
                            <div className="my-8 flex items-center gap-4">
                                <div className="h-px bg-purple-200 dark:bg-purple-700 flex-1"></div>
                                <span className="text-xs font-black uppercase tracking-widest text-purple-500 flex items-center gap-1.5">
                                    <FlaskConical className="w-3.5 h-3.5" />
                                    Mock Quick Login
                                </span>
                                <div className="h-px bg-purple-200 dark:bg-purple-700 flex-1"></div>
                            </div>

                            <div className="flex flex-col gap-2">
                                {MOCK_USERS.map((u) => (
                                    <button
                                        key={u.email}
                                        type="button"
                                        disabled={isLoading}
                                        onClick={async () => {
                                            setIsLoading(true);
                                            setError('');
                                            try {
                                                const res = await apiClient.post('/auth/login', { email: u.email, password: u.password });
                                                const authenticatedUser = await loginWithAccessToken(res.data.accessToken);
                                                navigate(authenticatedUser.profileComplete ? nextPath : '/onboarding');
                                            } catch (err) {
                                                setError(extractApiErrorMessage(err, 'Mock login failed.'));
                                            } finally {
                                                setIsLoading(false);
                                            }
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-left transition-colors disabled:opacity-50"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-xs font-black text-purple-700 dark:text-purple-300 shrink-0">
                                            {u.label.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-[#1a1a1a] dark:text-gray-200">{u.label}</p>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-500">{u.role}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <p className="text-center mt-8 font-bold text-sm text-gray-500">
                    Not drafted yet? <Link to="/signup" className="text-[#00c853] hover:underline uppercase tracking-wider ml-1">Create Legacy</Link>
                </p>
            </div>
        </div>
    );
};
