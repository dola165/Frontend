import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { isAndroidApp } from '../android/bridge';
import { AlertCircle, Check, Eye, EyeOff, Loader2, LocateFixed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { AuthSplitShell } from '../components/auth/AuthSplitShell';
import { ageRefusedRecently, rememberAgeRefusal } from '../components/auth/ageRefusal';
import { UnderThirteenNotice } from '../components/auth/UnderThirteenNotice';
import { Turnstile } from '../components/auth/Turnstile';
import { BOT_CHECK_CODES } from '../components/auth/turnstileConfig';
import { useBotCheck } from '../components/auth/useBotCheck';
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
import { extractApiErrorCode, extractApiErrorMessage } from '../utils/apiError';
import { ageFromDob, isUnder13, todayIso } from '../utils/age';
import { isEmail } from '../utils/registration';
import { getAuthSessionId, isCurrentAuthSession, subscribeAuthSession } from '../utils/authStorage';
import { DEFAULT_TOWN, TOWNS, locateTown } from '../features/start/towns';
import {
    buildLoginPath,
    completedAuthDestination,
    getAuthFlow,
    publicContinuationPath,
    rememberAuthFlow,
    requiredAccountStep,
    resolvePostAuthRedirect,
    type AccountState,
} from '../utils/authRedirect';

type RegisterField = 'name' | 'email' | 'password' | 'dob' | 'parent';

/** The backend's answer to an email that already has an account: a code, never who owns it. */
const accountExists = (error: unknown) => {
    const response = (error as { response?: { status?: number; data?: { code?: string } } } | null)?.response;
    return response?.status === 409 && response.data?.code === 'ACCOUNT_EXISTS';
};

/**
 * One screen: Google first, then name, email, password, date of birth and town (filled in). The birth date says
 * nothing about a minimum age; under 13 gets a kind "join through a parent" screen instead of an account, and that
 * answer stands on this device for a day. At 13 to 15 the same form then asks for a parent's email, which the account
 * is created with, and the person lands on "Waiting for your parent". A known email is offered sign-in. A new account
 * otherwise goes to its welcome.
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
    // An email typed on sign-in ("No account with this email. Create one?") comes along.
    const [email, setEmail] = useState(() => getAuthFlow().email ?? '');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [dob, setDob] = useState('');
    const [town, setTown] = useState(DEFAULT_TOWN.name);
    const [locating, setLocating] = useState<'idle' | 'locating' | 'failed'>('idle');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    // Sign-in is offered under the email: a known email, or an account just made whose automatic sign-in failed.
    const [signIn, setSignIn] = useState<'known' | 'created' | null>(null);
    // The Google birth-date step sends an under-13 answer here, signed out.
    const [underThirteen, setUnderThirteen] = useState(() => (location.state as { underThirteen?: boolean } | null)?.underThirteen === true);
    // 13 to 15: a parent approves the account, so its email goes with the sign-up.
    const [parentStep, setParentStep] = useState(false);
    const [parentEmail, setParentEmail] = useState('');
    // The bot check, when the server asks for one: a token is good for one try, so each try gets a new check.
    const bot = useBotCheck();
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
        if (parentStep && (!isEmail(parentEmail) || parentEmail.trim().toLowerCase() === email.trim().toLowerCase())) errors.parent = t('auth.parentWait.errEmail');
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const findMyTown = async () => {
        setLocating('locating');
        const found = await locateTown();
        if (found) { setTown(found.name); setLocating('idle'); } else setLocating('failed');
    };

    const signInInstead = () => {
        setPassword('');
        rememberAuthFlow({ email: email.trim().toLowerCase(), nextPath, town, newAccount: signIn === 'created' });
        navigate(buildLoginPath(nextPath), { replace: true });
    };

    const handleRegister = async (event: React.FormEvent) => {
        event.preventDefault();
        if (registration.current || isLoading || !validate() || !bot.ready) return;
        // Under 13, or a refusal on this device in the last day: no account and nothing sent.
        if (isUnder13(dob) || ageRefusedRecently()) {
            rememberAgeRefusal();
            setPassword('');
            setUnderThirteen(true);
            return;
        }
        if (!parentStep && ageFromDob(dob) < 16) { setParentStep(true); return; }

        setIsLoading(true);
        setError('');
        setSignIn(null);
        const controller = new AbortController();
        registration.current = controller;
        const normalizedEmail = email.trim().toLowerCase();
        let installingSession = false;
        let created = false;
        try {
            // The town travels with the sign-up flow to the welcome, which saves it; the request keeps the backend's own shape.
            const response = await apiClient.post<{ accountState?: AccountState }>('/auth/register', {
                fullName: fullName.trim(),
                email: normalizedEmail,
                password,
                dateOfBirth: dob,
                continuationPath: publicContinuationPath(nextPath),
                ...(parentStep ? { parentEmail: parentEmail.trim().toLowerCase() } : {}),
                ...(bot.token ? { turnstileToken: bot.token } : {}),
            }, { signal: controller.signal });
            if (controller.signal.aborted || !isCurrentAuthSession(registrationOwner.current)) return;
            created = true;

            rememberAuthFlow({ email: normalizedEmail, nextPath, newAccount: true, town });
            // An unconfirmed email no longer stops sign-in: the account is in at once.
            const result = await secondFactor.authenticate({ kind: 'password', email: normalizedEmail, password });
            if (!result) return;
            setPassword('');
            installingSession = true;
            const authenticatedUser = await loginWithAccessToken(result.accessToken);
            const requiredStep = requiredAccountStep({
                ...authenticatedUser,
                mustChangePassword: result.mustChangePassword || authenticatedUser.mustChangePassword,
                accountState: result.accountState ?? response.data?.accountState ?? authenticatedUser.accountState,
            });
            navigate(requiredStep ?? completedAuthDestination(authenticatedUser, nextPath, true), { replace: true });
        } catch (requestError) {
            if (!installingSession && (controller.signal.aborted || !isCurrentAuthSession(registrationOwner.current))) return;
            // The account exists but signing in failed: offer sign-in, not an error (the welcome or the parent wait follows).
            if (created && !installingSession) { setPassword(''); setSignIn('created'); return; }
            if (!installingSession && bot.enabled) bot.renew();
            // A known email is offered sign-in instead of a second account, whatever the age. Nothing about it is shown.
            if (!installingSession && accountExists(requestError)) { setSignIn('known'); return; }
            const code = extractApiErrorCode(requestError);
            if (!installingSession && code === 'AGE_BELOW_MINIMUM') { rememberAgeRefusal(); setPassword(''); setUnderThirteen(true); return; }
            if (!installingSession && code === 'PARENT_EMAIL_REQUIRED') { setParentStep(true); return; }
            if (!installingSession && code === 'PARENT_EMAIL_INVALID') { setFieldErrors({ parent: t('auth.parentWait.errEmail') }); return; }
            // The server saw an older date right after an age answer from here: say nothing about why.
            if (!installingSession && code === 'AGE_RETRY_BLOCKED') { setError(t('auth.register.tryLater')); return; }
            if (!installingSession && code && (BOT_CHECK_CODES as readonly string[]).includes(code)) { setError(code === 'BOT_CHECK_FAILED' ? t('auth.register.botCheck') : t('auth.register.botUnavailable')); return; }
            setError(extractApiErrorMessage(requestError, t('auth.register.errSubmitFallback')));
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
            const requiredStep = requiredAccountStep({ ...authenticatedUser, mustChangePassword: result.mustChangePassword === true || authenticatedUser.mustChangePassword, accountState: result.accountState ?? authenticatedUser.accountState });
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
            cardHeader={underThirteen ? <GrasskickzLogo wordmark className="mb-6 lg:hidden" /> : (
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
            {underThirteen ? <UnderThirteenNotice /> : <>
            {error && (
                <div role="alert" className="mb-6 flex items-center gap-2 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                    <AlertCircle className="h-5 w-5 shrink-0" /> {error}
                </div>
            )}

            {secondFactor.challenge ? <SecondFactorPrompt pending={secondFactor.pending} error={secondFactor.error} onSubmit={code => void secondFactor.submit(code)} onCancel={() => { secondFactor.cancel(); setPassword(''); }} /> : (
                <>
                    {!isAndroidApp && <>
                        <GoogleLogin
                            theme="filled_black"
                            size="large"
                            width="100%"
                            text="continue_with"
                            onSuccess={handleGoogleSuccess}
                            onError={() => setError(t('auth.common.googleClosed'))}
                        />
                        <div className={authDividerClass}>
                            <div className={authDividerLineClass} />
                            <span className={authDividerLabelClass}>{t('auth.register.orEmail')}</span>
                            <div className={authDividerLineClass} />
                        </div>
                    </>}
                    <form onSubmit={handleRegister} className="flex flex-col gap-5" noValidate>
                        <div className="space-y-2">
                            <label htmlFor="auth-name" className={authLabelClass}>{t('auth.register.labelName')}</label>
                            <input id="auth-name" type="text" value={fullName} onChange={(event) => { setFullName(event.target.value); clearFieldError('name'); }} required autoComplete="name"
                                className={fieldClass('name')} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={describedBy('auth-name', 'name')} />
                            {fieldError('auth-name', 'name')}
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="auth-email" className={authLabelClass}>{t('auth.register.labelEmail')}</label>
                            <input id="auth-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); clearFieldError('email'); setSignIn(null); }} required autoComplete="email"
                                className={fieldClass('email')} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={describedBy('auth-email', 'email', signIn ? 'auth-email-known' : undefined)} />
                            {fieldError('auth-email', 'email')}
                            {signIn && <div id="auth-email-known" role="status" className="flex flex-wrap items-center justify-between gap-2 border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-text)]">
                                <span>{signIn === 'known' ? t('auth.register.knownEmail') : t('auth.register.createdSignIn')}</span>
                                <button type="button" onClick={signInInstead} className="min-h-9 px-3 text-xs font-semibold text-[var(--color-on-accent)] bg-[var(--color-accent)]">{t('auth.register.goLogin')}</button>
                            </div>}
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
                                <input id="auth-dob" type="date" value={dob} max={todayIso()} required autoComplete="bday" onChange={(event) => { setDob(event.target.value); clearFieldError('dob'); setParentStep(false); }}
                                    className={fieldClass('dob')} aria-invalid={Boolean(fieldErrors.dob)} aria-describedby={describedBy('auth-dob', 'dob')} />
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
                        {parentStep && <div className="space-y-2 border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-3">
                            <p className="text-sm font-semibold text-[var(--color-text)]">{t('auth.register.parentTitle')}</p>
                            <p className="text-xs text-[var(--color-secondary)]">{t('auth.register.parentLine')}</p>
                            <label htmlFor="auth-parent-email" className={authLabelClass}>{t('auth.parentWait.emailLabel')}</label>
                            <input id="auth-parent-email" type="email" value={parentEmail} autoFocus autoComplete="off" onChange={(event) => { setParentEmail(event.target.value); clearFieldError('parent'); }}
                                className={fieldClass('parent')} aria-invalid={Boolean(fieldErrors.parent)} aria-describedby={describedBy('auth-parent-email', 'parent')} />
                            {fieldError('auth-parent-email', 'parent')}
                        </div>}
                        <Turnstile check={bot} />
                        <button type="submit" disabled={isLoading || !bot.ready} className={authPrimaryButtonClass}>
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : parentStep ? t('auth.register.parentSubmit') : t('auth.register.submit')}
                        </button>
                    </form>
                </>
            )}
            </>}
        </AuthSplitShell>
    );
};
