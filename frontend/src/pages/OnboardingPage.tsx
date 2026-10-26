import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { credentialUpdate } from '../api/credentialUpdates';
import { assertCurrentAuthSession, setRefreshedAccessToken } from '../utils/authStorage';
import { isAndroidApp } from '../android/bridge';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorCode, extractApiErrorMessage } from '../utils/apiError';
import { ageFromDob, todayIso } from '../utils/age';
import { rememberAgeRefusal } from '../components/auth/ageRefusal';
import { isEmail } from '../utils/registration';
import { NEUTRAL_ONBOARDING_ROLE } from '../utils/registration';
import {
    authFieldErrorClass,
    authInputClass,
    authInputErrorClass,
    authLabelClass,
    authPrimaryButtonClass,
} from '../components/auth/authClasses';
import {
    completedAuthDestination,
    getAuthFlow,
    requiredAccountStep,
    type AccountState,
} from '../utils/authRedirect';

/** An account missing its name or date of birth (a Google sign-in, an invited account) completes them here. Nothing else is asked. */
export const OnboardingPage = () => {
    const { user, sessionId } = useAuth();
    return <OnboardingForm key={`${user?.id}:${sessionId}`} />;
};

const OnboardingForm = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, sessionId, bootstrapSession, logout } = useAuth();
    const request = useRef<AbortController | null>(null);
    useEffect(() => () => request.current?.abort(), [sessionId]);
    const [fullName, setFullName] = useState(() => user?.fullName && user.fullName !== 'New User' ? user.fullName : user?.name ?? '');
    const [dateOfBirth, setDateOfBirth] = useState(user?.dob ?? '');
    // 13 to 15: a parent approves the account, so its email goes with the birth date (as at sign-up).
    const [parentStep, setParentStep] = useState(false);
    const [parentEmail, setParentEmail] = useState('');
    const [parentError, setParentError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [nameError, setNameError] = useState('');
    const [dobError, setDobError] = useState('');

    useEffect(() => {
        if (user && !requiredAccountStep(user)) {
            const flow = getAuthFlow();
            navigate(completedAuthDestination(user, flow.nextPath, flow.newAccount), { replace: true });
        }
    }, [navigate, user]);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (request.current || !user) return;
        const trimmedName = fullName.trim();
        const nextNameError = trimmedName.length < 2
            ? t('auth.register.errNameTooShort')
            : trimmedName.length > 100 ? t('auth.register.nameTooLong') : '';
        const nextDobError = !dateOfBirth
            ? t('auth.register.errDobRequired')
            : !Number.isFinite(ageFromDob(dateOfBirth)) || dateOfBirth > todayIso()
                ? t('auth.register.dobInvalid') : '';
        setNameError(nextNameError);
        setDobError(nextDobError);
        if (nextNameError || nextDobError) return;
        // Under 13 is the server's to answer: it removes the account it just made (a Google sign-in).
        const age = ageFromDob(dateOfBirth);
        if (age >= 13 && age < 16 && !parentStep) { setParentStep(true); return; }
        if (parentStep && (!isEmail(parentEmail) || parentEmail.trim().toLowerCase() === user.email?.toLowerCase())) { setParentError(t('auth.parentWait.errEmail')); return; }

        setIsLoading(true);
        setError('');
        const controller = new AbortController(); request.current = controller;
        let accountState: AccountState | undefined;
        try {
            // The backend still wants a role here; an account keeps the one it has, a new one stays neutral.
            await credentialUpdate(config => apiClient.put<{ accessToken?: string; accountState?: AccountState }>('/users/me/onboarding', {
                fullName: trimmedName,
                role: user.role ?? NEUTRAL_ONBOARDING_ROLE,
                dateOfBirth,
                ...(parentStep ? { parentEmail: parentEmail.trim().toLowerCase() } : {}),
            }, config), response => {
                accountState = response.data.accountState;
                const token = response.data.accessToken;
                if (!token?.trim()) throw new Error(t('onboarding.sessionRefreshFailed'));
                if (isAndroidApp ? token !== 'native-session' : JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub !== String(user.id)) {
                    throw new Error('The replacement session did not match this account.');
                }
                setRefreshedAccessToken(token, sessionId);
            }, controller.signal);
            assertCurrentAuthSession(sessionId);
            const refreshedUser = await bootstrapSession();
            assertCurrentAuthSession(sessionId);
            if (!refreshedUser) throw new Error(t('onboarding.sessionRefreshFailed'));
            if (accountState === 'AWAITING_PARENT') { navigate(requiredAccountStep({ accountState }) ?? '/', { replace: true }); return; }
            if (requiredAccountStep(refreshedUser)) {
                setError(t('onboarding.incompleteError'));
                return;
            }
            const flow = getAuthFlow();
            navigate(completedAuthDestination(refreshedUser, flow.nextPath, flow.newAccount), { replace: true });
        } catch (requestError) {
            if (controller.signal.aborted) return;
            const code = extractApiErrorCode(requestError);
            // Under 13: the server removed the account. Signed out, to the "join through a parent" answer.
            if (code === 'AGE_BELOW_MINIMUM') { rememberAgeRefusal(); await logout().catch(() => undefined); navigate('/signup', { replace: true, state: { underThirteen: true } }); return; }
            if (code === 'PARENT_EMAIL_REQUIRED') { setParentStep(true); return; }
            if (code === 'PARENT_EMAIL_INVALID') { setParentError(t('auth.parentWait.errEmail')); return; }
            setError(code === 'AGE_RETRY_BLOCKED' ? t('auth.register.tryLater') : extractApiErrorMessage(requestError, t('onboarding.saveFailed')));
        } finally {
            if (request.current === controller) request.current = null;
            if (!controller.signal.aborted) setIsLoading(false);
        }
    };

    return (
        <div className="min-h-full bg-[var(--color-surface)] px-4 py-10 text-[var(--color-text)] sm:px-6">
            <div className="mx-auto w-full max-w-md">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                        <ShieldCheck className="h-7 w-7" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">{t('onboarding.essentials')}</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('onboarding.title')}</h1>
                    <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--color-secondary)]">{t('onboarding.subtitle')}</p>
                </div>

                <form onSubmit={submit} className="theme-surface theme-border space-y-6 rounded-xl border p-6 shadow-2xl sm:p-8" noValidate>
                    {error && (
                        <div role="alert" className="flex items-start gap-2 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="onboarding-name" className={authLabelClass}>{t('onboarding.labelName')}</label>
                        <input
                            id="onboarding-name"
                            value={fullName}
                            onChange={(event) => { setFullName(event.target.value); setNameError(''); }}
                            autoComplete="name"
                            required
                            className={nameError ? authInputErrorClass : authInputClass}
                            aria-invalid={Boolean(nameError)}
                            aria-describedby={nameError ? 'onboarding-name-error' : undefined}
                        />
                        {nameError && <p id="onboarding-name-error" className={authFieldErrorClass}>{nameError}</p>}
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="onboarding-dob" className={authLabelClass}>{t('auth.register.labelDob')}</label>
                        <input
                            id="onboarding-dob"
                            type="date"
                            value={dateOfBirth}
                            max={todayIso()}
                            required
                            autoComplete="bday"
                            disabled={Boolean(user?.dob)}
                            onChange={(event) => { setDateOfBirth(event.target.value); setDobError(''); setParentStep(false); }}
                            className={dobError ? authInputErrorClass : authInputClass}
                            aria-invalid={Boolean(dobError)}
                            aria-describedby={[user?.dob ? 'onboarding-dob-hint' : '', dobError ? 'onboarding-dob-error' : ''].filter(Boolean).join(' ') || undefined}
                        />
                        {user?.dob && <p id="onboarding-dob-hint" className="text-[10px] leading-4 text-[var(--color-secondary)]">{t('onboarding.dobLocked')}</p>}
                        {dobError && <p id="onboarding-dob-error" className={authFieldErrorClass}>{dobError}</p>}
                    </div>

                    {parentStep && <div className="space-y-2 border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-3">
                        <p className="text-sm font-semibold text-[var(--color-text)]">{t('auth.register.parentTitle')}</p>
                        <p className="text-xs text-[var(--color-secondary)]">{t('auth.register.parentLine')}</p>
                        <label htmlFor="onboarding-parent-email" className={authLabelClass}>{t('auth.parentWait.emailLabel')}</label>
                        <input id="onboarding-parent-email" type="email" value={parentEmail} autoFocus autoComplete="off" onChange={(event) => { setParentEmail(event.target.value); setParentError(''); }}
                            className={parentError ? authInputErrorClass : authInputClass} aria-invalid={Boolean(parentError)} aria-describedby={parentError ? 'onboarding-parent-error' : undefined} />
                        {parentError && <p id="onboarding-parent-error" className={authFieldErrorClass}>{parentError}</p>}
                    </div>}

                    <p className="text-xs leading-5 text-[var(--color-secondary)]">{t('onboarding.optionalLater')}</p>

                    <button type="submit" disabled={isLoading} className={authPrimaryButtonClass}>
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('onboarding.continue')}
                    </button>
                </form>
            </div>
        </div>
    );
};
