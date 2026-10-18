import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { isAndroidApp } from '../android/bridge';
import { AlertCircle, Check, Eye, EyeOff, Loader2, LocateFixed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { AuthSplitShell } from '../components/auth/AuthSplitShell';
import { useSecondFactorLogin } from '../components/auth/useSecondFactorLogin';
import { SecondFactorPrompt } from '../components/auth/SecondFactorPrompt';
import { GrasskickzLogo } from '../components/layout/GrasskickzLogo';
import {
    authDividerClass,
    authDividerLabelClass,
    authDividerLineClass,
    authFieldErrorClass,
    authInputClass,
    authInputErrorClass,
    authLabelClass,
    authPrimaryButtonClass,
} from '../components/auth/authClasses';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { ageFromDob, isUnder13, todayIso } from '../utils/age';
import { isEmail, NEUTRAL_REGISTRATION_ROLE } from '../utils/registration';
import { getAuthSessionId, isCurrentAuthSession, subscribeAuthSession } from '../utils/authStorage';
import { DEFAULT_TOWN, TOWNS, locateTown } from '../features/start/towns';
import {
    buildLoginPath,
    completedAuthDestination,
    publicContinuationPath,
    rememberAuthFlow,
    requiredAccountStep,
    resolvePostAuthRedirect,
} from '../utils/authRedirect';

type RegisterField = 'name' | 'email' | 'password' | 'dob';

/**
 * One screen: name, email, password, date of birth and town. No role: what a person does in football is
 * chosen later and never decides access. A new account then goes to its first run (`/start`).
 */
export const RegisterPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { loginWithAccessToken } = useAuth();
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '');
    const secondFactor = useSecondFactorLogin();
    const registration = useRef<AbortController | null>(null);
    const registrationOwner = useRef(getAuthSessionId());
    useEffect(() => {
        const retire = () => { if (!isCurrentAuthSession(registrationOwner.current)) registration.current?.abort(); };
        const unsubscribe = subscribeAuthSession(retire);
        return () => { unsubscribe(); registration.current?.abort(); };
    }, []);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [dob, setDob] = useState('');
    const [town, setTown] = useState(DEFAULT_TOWN.name);
    const [locating, setLocating] = useState<'idle' | 'locating' | 'failed'>('idle');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterField, string>>>({});

    const passwordRules = [
        { key: 'length', test: (value: string) => value.length >= 8, label: t('auth.register.ruleLength') },
        { key: 'upper', test: (value: string) => /[A-Z]/.test(value), label: t('auth.register.ruleUpper') },
        { key: 'lower', test: (value: string) => /[a-z]/.test(value), label: t('auth.register.ruleLower') },
        { key: 'digit', test: (value: string) => /\d/.test(value), label: t('auth.register.ruleDigit') },
    ];
    const passwordRulesMet = passwordRules.every((rule) => rule.test(password));

    const clearFieldError = (field: RegisterField) => setFieldErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
    });

    const validate = () => {
        const errors: Partial<Record<RegisterField, string>> = {};
        if (fullName.trim().length < 2) errors.name = fullName.trim() ? t('auth.register.errNameTooShort') : t('auth.register.errNameRequired');
        else if (fullName.trim().length > 100) errors.name = t('auth.register.nameTooLong');
        if (!email.trim()) errors.email = t('auth.register.errEmailRequired');
        else if (!isEmail(email)) errors.email = t('auth.register.errEmailInvalid');
        if (!passwordRulesMet) errors.password = t('auth.register.errPasswordWeak');
        if (!dob) errors.dob = t('auth.register.errDobRequired');
        else if (!Number.isFinite(ageFromDob(dob)) || dob > todayIso()) errors.dob = t('auth.register.dobInvalid');
        else if (isUnder13(dob)) errors.dob = t('auth.register.errUnder13');
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const findMyTown = async () => {
        setLocating('locating');
        const found = await locateTown();
        if (found) { setTown(found.name); setLocating('idle'); } else setLocating('failed');
    };

    const handleRegister = async (event: React.FormEvent) => {
        event.preventDefault();
        if (registration.current || isLoading || !validate()) return;

        setIsLoading(true);
        setError('');
        const controller = new AbortController();
        registration.current = controller;
        const normalizedEmail = email.trim().toLowerCase();
        let installingSession = false;
        try {
            // The town travels with the sign-up flow to the first run, which saves it; the request keeps the backend's own shape.
            const response = await apiClient.post<{ emailVerificationRequired?: boolean }>('/auth/register', {
                fullName: fullName.trim(),
                email: normalizedEmail,
                password,
                role: NEUTRAL_REGISTRATION_ROLE,
                dateOfBirth: dob,
                continuationPath: publicContinuationPath(nextPath),
            }, { signal: controller.signal });
            if (controller.signal.aborted || !isCurrentAuthSession(registrationOwner.current)) return;

            rememberAuthFlow({
                email: normalizedEmail,
                nextPath,
                newAccount: true,
                town,
                awaitingVerification: response.data.emailVerificationRequired === true,
            });

            if (response.data.emailVerificationRequired) {
                navigate('/verify-email?pending=1', { replace: true });
                return;
            }

            const result = await secondFactor.authenticate({ kind: 'password', email: normalizedEmail, password });
            if (!result) return;
            setPassword('');
            installingSession = true;
            const authenticatedUser = await loginWithAccessToken(result.accessToken);
            const requiredStep = requiredAccountStep({
                ...authenticatedUser,
                mustChangePassword: result.mustChangePassword || authenticatedUser.mustChangePassword,
            });
            navigate(requiredStep ?? completedAuthDestination(authenticatedUser, nextPath, true), { replace: true });
        } catch (requestError) {
            if (!installingSession && (controller.signal.aborted || !isCurrentAuthSession(registrationOwner.current))) return;
            const message = extractApiErrorMessage(requestError, t('auth.register.errSubmitFallback'));
            setError(message === 'Transactional email sender is not configured.' ? t('auth.register.emailUnavailable') : message);
        } finally {
            registration.current = null;
            if (!controller.signal.aborted || installingSession) setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
        if (!credentialResponse.credential) return;
        setIsLoading(true);
        setError('');
        rememberAuthFlow({ nextPath, town });
        try {
            const result = await secondFactor.authenticate({ kind: 'google', token: credentialResponse.credential });
            if (!result) return;
            rememberAuthFlow({ nextPath, town, newAccount: result.newAccount === true });
            const authenticatedUser = await loginWithAccessToken(result.accessToken);
            const requiredStep = requiredAccountStep({ ...authenticatedUser, mustChangePassword: result.mustChangePassword === true || authenticatedUser.mustChangePassword });
            navigate(requiredStep ?? completedAuthDestination(authenticatedUser, nextPath, result.newAccount === true), { replace: true });
        } catch (requestError) {
            setError(extractApiErrorMessage(requestError, t('auth.common.googleFailed')));
        } finally {
            setIsLoading(false);
        }
    };

    const fieldClass = (key: RegisterField) => (fieldErrors[key] ? authInputErrorClass : authInputClass);
    const describedBy = (id: string, key: RegisterField, hint?: string) => [hint, fieldErrors[key] ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined;
    const fieldError = (id: string, key: RegisterField) => fieldErrors[key] && <p id={`${id}-error`} className={authFieldErrorClass}>{fieldErrors[key]}</p>;

    return (
        <AuthSplitShell
            heroMicro={t('auth.register.heroMicro')}
            heroTitle={t('auth.register.heroTitle')}
            heroTagline={t('auth.register.heroTagline')}
            chips={[t('auth.register.chipFollow'), t('auth.register.chipEvents'), t('auth.register.chipFree')]}
            cardHeader={(
                <div className="mb-6">
                    <GrasskickzLogo wordmark className="mb-6 lg:hidden" />
                    <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{t('auth.register.title')}</h1>
                    <p className="mt-1 text-sm text-[var(--color-secondary)]">{t('auth.register.subtitle')}</p>
                </div>
            )}
            footer={(
                <>{t('auth.register.alreadyHave')}{' '}<Link to={buildLoginPath(nextPath)} className="ml-1 app-text-action">{t('auth.register.goLogin')}</Link></>
            )}
        >
            {error && (
                <div role="alert" className="mb-6 flex items-center gap-2 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                    <AlertCircle className="h-5 w-5 shrink-0" /> {error}
                </div>
            )}

            {secondFactor.challenge ? <SecondFactorPrompt pending={secondFactor.pending} error={secondFactor.error} onSubmit={code => void secondFactor.submit(code)} onCancel={() => { secondFactor.cancel(); setPassword(''); }} /> : (
                <>
                    <form onSubmit={handleRegister} className="flex flex-col gap-5" noValidate>
                        <div className="space-y-2">
                            <label htmlFor="auth-name" className={authLabelClass}>{t('auth.register.labelName')}</label>
                            <input id="auth-name" type="text" value={fullName} onChange={(event) => { setFullName(event.target.value); clearFieldError('name'); }} required autoComplete="name"
                                className={fieldClass('name')} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={describedBy('auth-name', 'name')} />
                            {fieldError('auth-name', 'name')}
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="auth-email" className={authLabelClass}>{t('auth.register.labelEmail')}</label>
                            <input id="auth-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); clearFieldError('email'); }} required autoComplete="email"
                                className={fieldClass('email')} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={describedBy('auth-email', 'email')} />
                            {fieldError('auth-email', 'email')}
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="auth-password" className={authLabelClass}>{t('auth.register.labelPassword')}</label>
                            <div className="relative">
                                <input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); clearFieldError('password'); }} required autoComplete="new-password"
                                    className={`${fieldClass('password')} pr-12`} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={describedBy('auth-password', 'password')} />
                                <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--color-secondary)] hover:text-[var(--color-text)]"
                                    aria-label={showPassword ? t('auth.register.hidePassword') : t('auth.register.showPassword')} aria-pressed={showPassword}>
                                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                                </button>
                            </div>
                            {password.length > 0 && (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                    {passwordRules.map((rule) => (
                                        <span key={rule.key} className={`flex items-center gap-1.5 text-[10px] font-semibold ${rule.test(password) ? 'text-[var(--color-accent)]' : 'text-[var(--color-secondary)]'}`}>
                                            <Check className="h-3.5 w-3.5" aria-hidden="true" /> {rule.label}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {fieldError('auth-password', 'password')}
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="auth-dob" className={authLabelClass}>{t('auth.register.labelDob')}</label>
                                <input id="auth-dob" type="date" value={dob} max={todayIso()} required autoComplete="bday" onChange={(event) => { setDob(event.target.value); clearFieldError('dob'); }}
                                    className={fieldClass('dob')} aria-invalid={Boolean(fieldErrors.dob)} aria-describedby={describedBy('auth-dob', 'dob', 'auth-dob-hint')} />
                                <p id="auth-dob-hint" className="text-[10px] leading-4 text-[var(--color-secondary)]">{t('auth.register.dobHint')}</p>
                                {fieldError('auth-dob', 'dob')}
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="auth-town" className={authLabelClass}>{t('auth.register.labelTown')}</label>
                                <select id="auth-town" value={town} onChange={(event) => setTown(event.target.value)} className={authInputClass} aria-describedby={locating === 'failed' ? 'auth-town-note' : undefined}>
                                    {TOWNS.map(option => <option key={option.name} value={option.name}>{option.name}</option>)}
                                </select>
                                <button type="button" onClick={() => void findMyTown()} disabled={locating === 'locating'} className="inline-flex min-h-7 items-center gap-1.5 text-[11px] font-semibold text-[var(--color-accent)] disabled:opacity-60">
                                    {locating === 'locating' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />}
                                    {locating === 'locating' ? t('auth.register.locating') : t('auth.register.useLocation')}
                                </button>
                                {locating === 'failed' && <p id="auth-town-note" role="status" className="text-[10px] leading-4 text-[var(--color-secondary)]">{t('auth.register.locationUnavailable')}</p>}
                            </div>
                        </div>
                        <button type="submit" disabled={isLoading} className={authPrimaryButtonClass}>
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('auth.register.submit')}
                        </button>
                    </form>
                    {!isAndroidApp && <div className={authDividerClass}>
                        <div className={authDividerLineClass} />
                        <span className={authDividerLabelClass}>{t('auth.login.orVia')}</span>
                        <div className={authDividerLineClass} />
                    </div>}
                    {!isAndroidApp && <GoogleLogin
                        theme="filled_black"
                        size="large"
                        width="100%"
                        text="signup_with"
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError(t('auth.common.googleClosed'))}
                    />}
                </>
            )}
        </AuthSplitShell>
    );
};
