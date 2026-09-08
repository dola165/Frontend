import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, Loader2, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { isUnder13, todayIso } from '../utils/age';
import {
    authFieldErrorClass,
    authInputClass,
    authInputErrorClass,
    authLabelClass,
    authPrimaryButtonClass,
    authRoleCardClass,
} from '../components/auth/authClasses';
import {
    clearAuthFlow,
    completedAuthDestination,
    getAuthFlow,
    requiredAccountStep,
} from '../utils/authRedirect';

type OnboardingRole = 'PLAYER' | 'FAN' | 'ORGANIZER';

const selectableRoles: ReadonlyArray<{ id: OnboardingRole; icon: typeof UserRound }> = [
    { id: 'PLAYER', icon: UserRound },
    { id: 'ORGANIZER', icon: Building2 },
    { id: 'FAN', icon: UsersRound },
];

export const OnboardingPage = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, loginWithAccessToken } = useAuth();
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<OnboardingRole>('PLAYER');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [nameError, setNameError] = useState('');
    const [dobError, setDobError] = useState('');

    const existingRoleIsSelectable = user?.role === 'PLAYER' || user?.role === 'FAN' || user?.role === 'ORGANIZER';

    useEffect(() => {
        if (!user) return;
        setFullName(user.fullName && user.fullName !== 'New User' ? user.fullName : user.name ?? '');
        if (user.role === 'PLAYER' || user.role === 'FAN' || user.role === 'ORGANIZER') setRole(user.role);
        setDateOfBirth(user.dob ?? '');
    }, [user]);

    useEffect(() => {
        if (user && !requiredAccountStep(user)) {
            const flow = getAuthFlow();
            const destination = completedAuthDestination(user, flow.nextPath, flow.newAccount);
            clearAuthFlow();
            navigate(destination, { replace: true });
        }
    }, [navigate, user]);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedName = fullName.trim();
        const nextNameError = trimmedName.length < 2 ? t('auth.register.errNameTooShort') : '';
        const nextDobError = !dateOfBirth
            ? t('auth.register.errDobRequired')
            : isUnder13(dateOfBirth)
                ? t('auth.register.errUnder13')
                : '';
        setNameError(nextNameError);
        setDobError(nextDobError);
        if (nextNameError || nextDobError) return;

        setIsLoading(true);
        setError('');
        try {
            const response = await apiClient.put<{ accessToken?: string }>('/users/me/onboarding', {
                fullName: trimmedName,
                role: existingRoleIsSelectable ? role : user?.role,
                dateOfBirth,
            });
            if (!response.data.accessToken) {
                throw new Error(t('onboarding.sessionRefreshFailed'));
            }
            const refreshedUser = await loginWithAccessToken(response.data.accessToken);
            const stillRequired = requiredAccountStep(refreshedUser);
            if (stillRequired) {
                setError(t('onboarding.incompleteError'));
                return;
            }
            const flow = getAuthFlow();
            const destination = completedAuthDestination(refreshedUser, flow.nextPath, flow.newAccount);
            clearAuthFlow();
            navigate(destination, { replace: true });
        } catch (requestError) {
            setError(extractApiErrorMessage(requestError, t('onboarding.saveFailed')));
        } finally {
            setIsLoading(false);
        }
    };

    const roleText = (value: OnboardingRole, suffix: 'label' | 'description') => {
        const key = value === 'PLAYER' ? 'Player' : value === 'ORGANIZER' ? 'Organizer' : 'Fan';
        return t(`onboarding.role${key}${suffix === 'description' ? 'Desc' : ''}`);
    };

    return (
        <div className="min-h-full bg-[#0f1117] px-4 py-10 text-[#f4f4f5] sm:px-6">
            <div className="mx-auto w-full max-w-2xl">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-[#16a34a]/40 bg-[#16a34a]/10 text-[#16a34a]">
                        <ShieldCheck className="h-7 w-7" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#16a34a]">{t('onboarding.essentials')}</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('onboarding.title')}</h1>
                    <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#a1a1aa]">{t('onboarding.subtitleSimple')}</p>
                </div>

                <form onSubmit={submit} className="theme-surface theme-border space-y-6 rounded-xl border p-6 shadow-2xl sm:p-8" noValidate>
                    {error && (
                        <div className="flex items-start gap-2 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
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
                            className={nameError ? authInputErrorClass : authInputClass}
                        />
                        {nameError && <p className={authFieldErrorClass}>{nameError}</p>}
                    </div>

                    {existingRoleIsSelectable ? (
                        <div className="space-y-2">
                            <label className={authLabelClass}>{t('onboarding.designation')}</label>
                            <div className="grid gap-2 sm:grid-cols-3">
                                {selectableRoles.map(({ id, icon: Icon }) => (
                                    <button type="button" key={id} onClick={() => setRole(id)} className={authRoleCardClass(role === id)}>
                                        <Icon className="mb-3 h-5 w-5 text-[#16a34a]" />
                                        <p className="text-sm font-semibold text-[#f4f4f5]">{roleText(id, 'label')}</p>
                                        <p className="mt-1 text-[10px] leading-4 text-[#a1a1aa]">{roleText(id, 'description')}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                            <p className={authLabelClass}>{t('auth.register.labelRole')}</p>
                            <p className="mt-1 text-sm font-semibold">{user?.role}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="onboarding-dob" className={authLabelClass}>{t('auth.register.labelDob')}</label>
                        <input
                            id="onboarding-dob"
                            type="date"
                            value={dateOfBirth}
                            max={todayIso()}
                            disabled={Boolean(user?.dob)}
                            onChange={(event) => { setDateOfBirth(event.target.value); setDobError(''); }}
                            className={dobError ? authInputErrorClass : authInputClass}
                        />
                        <p className="text-[10px] leading-4 text-[#a1a1aa]">{user?.dob ? t('onboarding.dobLocked') : t('auth.register.dobHint')}</p>
                        {dobError && <p className={authFieldErrorClass}>{dobError}</p>}
                    </div>

                    <div className="rounded-lg border border-[#16a34a]/20 bg-[#16a34a]/5 px-4 py-3 text-xs leading-5 text-[#a1a1aa]">
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
