import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { credentialUpdate } from '../api/credentialUpdates';
import { assertCurrentAuthSession, setRefreshedAccessToken } from '../utils/authStorage';
import { isAndroidApp } from '../android/bridge';
import { AccountRoleSelector } from '../components/auth/AccountRoleSelector';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { ageFromDob, isUnder13, todayIso } from '../utils/age';
import { isRegistrationRole, type RegistrationRole } from '../utils/registrationRoles';
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
} from '../utils/authRedirect';

export const OnboardingPage = () => {
    const { user, sessionId } = useAuth();
    return <OnboardingForm key={`${user?.id}:${sessionId}`} />;
};

const OnboardingForm = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, sessionId, bootstrapSession } = useAuth();
    const request = useRef<AbortController | null>(null);
    useEffect(() => () => request.current?.abort(), [sessionId]);
    const [fullName, setFullName] = useState(() => user?.fullName && user.fullName !== 'New User' ? user.fullName : user?.name ?? '');
    const [role, setRole] = useState<RegistrationRole>(() => isRegistrationRole(user?.role) ? user.role : 'PLAYER');
    const [dateOfBirth, setDateOfBirth] = useState(user?.dob ?? '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [nameError, setNameError] = useState('');
    const [dobError, setDobError] = useState('');

    const existingRoleIsSelectable = isRegistrationRole(user?.role);

    useEffect(() => {
        if (user && !requiredAccountStep(user)) {
            const flow = getAuthFlow();
            const destination = completedAuthDestination(user, flow.nextPath, flow.newAccount);
            navigate(destination, { replace: true });
        }
    }, [navigate, user]);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (request.current || !user) return;
        const trimmedName = fullName.trim();
        const nextNameError = trimmedName.length < 2
            ? t('auth.register.errNameTooShort')
            : trimmedName.length > 100 ? t('authRoles.nameTooLong') : '';
        const nextDobError = !dateOfBirth
            ? t('auth.register.errDobRequired')
            : !Number.isFinite(ageFromDob(dateOfBirth)) || dateOfBirth > todayIso()
                ? t('authRoles.dobInvalid')
                : isUnder13(dateOfBirth) ? t('auth.register.errUnder13')
                : ['PARENT', 'AGENT', 'ORGANIZER', 'VENUE_MANAGER'].includes(role) && ageFromDob(dateOfBirth) < 18 ? 'This profile requires an adult account.' : '';
        setNameError(nextNameError);
        setDobError(nextDobError);
        if (nextNameError || nextDobError) return;

        setIsLoading(true);
        setError('');
        const controller = new AbortController(); request.current = controller;
        try {
            await credentialUpdate(config => apiClient.put<{ accessToken?: string }>('/users/me/onboarding', {
                fullName: trimmedName,
                role: existingRoleIsSelectable ? role : user?.role,
                dateOfBirth,
            }, config), response => {
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
            const stillRequired = requiredAccountStep(refreshedUser);
            if (stillRequired) {
                setError(t('onboarding.incompleteError'));
                return;
            }
            const flow = getAuthFlow();
            const destination = completedAuthDestination(refreshedUser, flow.nextPath, flow.newAccount);
            navigate(destination, { replace: true });
        } catch (requestError) {
            if (!controller.signal.aborted) setError(extractApiErrorMessage(requestError, t('onboarding.saveFailed')));
        } finally {
            if (request.current === controller) request.current = null;
            if (!controller.signal.aborted) setIsLoading(false);
        }
    };

    return (
        <div className="min-h-full bg-[var(--color-surface)] px-4 py-10 text-[var(--color-text)] sm:px-6">
            <div className="mx-auto w-full max-w-2xl">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                        <ShieldCheck className="h-7 w-7" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">{t('onboarding.essentials')}</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('onboarding.title')}</h1>
                    <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--color-secondary)]">{t('onboarding.subtitleSimple')}</p>
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

                    {existingRoleIsSelectable ? (
                        <AccountRoleSelector value={role} onChange={setRole} disabled={isLoading} />
                    ) : (
                        <div className="rounded-lg border border-[color:var(--color-border)]/10 bg-[color:var(--color-ink)]/5 px-4 py-3">
                            <p className={authLabelClass}>{t('auth.register.labelRole')}</p>
                            <p className="mt-1 text-sm font-semibold">{user?.role}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="onboarding-dob" className={authLabelClass}>{t('authRoles.yourDob')}</label>
                        <input
                            id="onboarding-dob"
                            type="date"
                            value={dateOfBirth}
                            max={todayIso()}
                            required
                            autoComplete="bday"
                            disabled={Boolean(user?.dob)}
                            onChange={(event) => { setDateOfBirth(event.target.value); setDobError(''); }}
                            className={dobError ? authInputErrorClass : authInputClass}
                            aria-invalid={Boolean(dobError)}
                            aria-describedby={`onboarding-dob-hint${dobError ? ' onboarding-dob-error' : ''}`}
                        />
                        <p id="onboarding-dob-hint" className="text-[10px] leading-4 text-[var(--color-secondary)]">{user?.dob ? t('onboarding.dobLocked') : t('auth.register.dobHint')}</p>
                        {dobError && <p id="onboarding-dob-error" className={authFieldErrorClass}>{dobError}</p>}
                    </div>

                    <div className="rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-4 py-3 text-xs leading-5 text-[var(--color-secondary)]">
                        {t('onboarding.optionalLater')}
                    </div>

                    <button type="submit" disabled={isLoading} className={authPrimaryButtonClass}>
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('onboarding.continue')}
                    </button>
                </form>
            </div>
        </div>
    );
};
