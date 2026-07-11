import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { Shield, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolvePostAuthRedirect } from '../utils/authRedirect';

export const RegisterPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { loginWithAccessToken } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<'PLAYER' | 'FAN' | 'ORGANIZER'>('PLAYER');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '/feed');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const normalizedEmail = email.trim();
            await apiClient.post('/auth/register', { email: normalizedEmail, password, role });
            const loginRes = await apiClient.post('/auth/login', { email: normalizedEmail, password });
            const authenticatedUser = await loginWithAccessToken(loginRes.data.accessToken);
            navigate(authenticatedUser.profileComplete ? nextPath : '/onboarding');
        } catch (err) {
            console.error(err);
            setError(extractApiErrorMessage(err, 'Registration failed. Please try again.'));
        } finally {
            setIsLoading(false);
        }
    };

    const inputClass = 'theme-surface-strong theme-border w-full border px-3 py-3 text-sm font-semibold text-primary outline-none transition-colors focus:border-accent-primary placeholder:text-secondary';

    return (
        <div className="bg-base flex min-h-screen flex-col items-center justify-center p-6">

            <Link to="/" className="absolute top-8 left-8 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-secondary hover:text-primary transition-colors">
                <ArrowLeft className="w-5 h-5" /> Back to Base
            </Link>

            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-accent-primary text-white flex items-center justify-center mx-auto mb-6 border border-accent-primary">
                        <Shield className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-black uppercase tracking-tight text-primary mb-2">Draft Day</h1>
                    <p className="text-sm text-secondary">Register your profile and enter the global arena.</p>
                </div>

                <div className="theme-surface theme-border border shadow-2xl p-8 rounded-2xl">

                    {error && (
                        <div className="mb-6 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)] flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="flex flex-col gap-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className={inputClass}
                                placeholder="champion@talanti.ge"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Starting Role</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'PLAYER', label: 'Player', desc: 'Seeking clubs & tryouts' },
                                    { id: 'ORGANIZER', label: 'Organizer', desc: 'Building a club or squad' },
                                    { id: 'FAN', label: 'Fan', desc: 'Following the action' }
                                ].map((option) => (
                                    <button
                                        type="button"
                                        key={option.id}
                                        onClick={() => setRole(option.id as 'PLAYER' | 'FAN' | 'ORGANIZER')}
                                        className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                                            role === option.id
                                                ? 'border-accent-primary bg-accent-primary-soft'
                                                : 'border-subtle hover:border-strong'
                                        }`}
                                    >
                                        <p className="font-black uppercase tracking-[0.14em] text-sm text-primary">{option.label}</p>
                                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-secondary">{option.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className={inputClass}
                                placeholder="********"
                            />
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">At least 6 characters</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Confirm Password</label>
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
                            className="w-full mt-2 inline-flex items-center justify-center gap-2 border border-accent-primary bg-accent-primary text-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] transition-colors disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Legacy'}
                        </button>
                    </form>

                    <div className="my-8 flex items-center gap-4">
                        <div className="h-px bg-[color:var(--border-subtle)] flex-1"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Or draft via</span>
                        <div className="h-px bg-[color:var(--border-subtle)] flex-1"></div>
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
                                        token: credentialResponse.credential,
                                        role
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
                </div>

                <p className="text-center mt-8 text-[11px] font-black uppercase tracking-[0.14em] text-secondary">
                    Already drafted? <Link to="/login" className="accent-primary hover:underline ml-1">Access Database</Link>
                </p>
            </div>
        </div>
    );
};
