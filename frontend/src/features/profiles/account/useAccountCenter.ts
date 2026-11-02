import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import { credentialUpdate } from '../../../api/credentialUpdates';
import { useAuth } from '../../../context/AuthContext';
import { confirmSecurityNavigation } from '../../twoFactor/useSecurityNavigationGuard';
import { isCurrentAuthSession } from '../../../utils/authStorage';
import { fetchMyPlayerCards, type PlayerCard } from '../../clubs/api';
import { buildProfileForm as buildForm, useAccountProfileDraft, type ProfileForm } from './useAccountProfileDraft';
import { accountError, type Account, type AccountError, type PasswordForm, type SessionSummary, type TryoutApp } from './accountModel';

/** Account center reads and actions. Profile and password drafts live here, above the tabs, so tab and language switches keep them. */
export function useAccountCenter() {
    const { user, sessionId, bootstrapSession, logout } = useAuth();
    const accountRequest = useRef<AbortController | null>(null);
    const sessionsRequest = useRef<AbortController | null>(null);
    const tryoutsRequest = useRef<AbortController | null>(null);
    const actionRequest = useRef<AbortController | null>(null);

    const [account, setAccount] = useState<Account | null>(null);
    // Player details follow the player profile the server keeps for the person, never the account role.
    const isPlayer = Boolean(account?.playerProfile);
    const [form, setForm] = useState<ProfileForm | null>(null);
    const [sessions, setSessions] = useState<SessionSummary | null>(null);
    const [passwordForm, setPasswordForm] = useState<PasswordForm>({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [loading, setLoading] = useState(true);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<AccountError | null>(null);
    const [sessionsError, setSessionsError] = useState<AccountError | null>(null);
    const [sendingVerification, setSendingVerification] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [revokingSessions, setRevokingSessions] = useState(false);
    const [endingSessionId, setEndingSessionId] = useState<number | null>(null);
    const [tryoutApps, setTryoutApps] = useState<TryoutApp[]>([]);
    const [showTryoutApps, setShowTryoutApps] = useState(false);
    const [tryoutsLoading, setTryoutsLoading] = useState(false);
    const [tryoutsError, setTryoutsError] = useState<string | null>(null);
    const [myCards, setMyCards] = useState<PlayerCard[]>([]);

    const loadAccount = useCallback(async (preserveDraft = false) => {
        accountRequest.current?.abort();
        const controller = new AbortController();
        accountRequest.current = controller;
        const current = () => !controller.signal.aborted && isCurrentAuthSession(sessionId);
        if (!preserveDraft) setLoading(true);
        try {
            const response = await apiClient.get<Account>('/users/me/account', { signal: controller.signal });
            if (!current()) return false;
            if (response.data.id !== user?.id) throw new Error('Account details did not match the signed-in account.');
            setAccount(response.data);
            if (!preserveDraft) setForm(buildForm(response.data));
            setError(null);
            return true;
        } catch (requestError) {
            if (current()) setError(accountError(requestError, 'Failed to load your account center.'));
            return false;
        } finally {
            if (current() && !preserveDraft) setLoading(false);
        }
    }, [sessionId, user?.id]);

    const refreshProfile = useCallback(() => loadAccount(true), [loadAccount]);
    const profileDraft = useAccountProfileDraft({ form, setForm, isPlayer, refresh: refreshProfile });

    const loadSessions = useCallback(async () => {
        sessionsRequest.current?.abort();
        const controller = new AbortController();
        sessionsRequest.current = controller;
        const current = () => !controller.signal.aborted && isCurrentAuthSession(sessionId);
        setSessionsLoading(true);
        try {
            const response = await apiClient.get<SessionSummary>('/auth/sessions', { signal: controller.signal });
            if (!current()) return;
            setSessions(response.data);
            setSessionsError(null);
        } catch (requestError) {
            if (!current()) return;
            setSessions(null);
            setSessionsError(accountError(requestError, 'Failed to load remembered sessions.'));
        } finally {
            if (current()) setSessionsLoading(false);
        }
    }, [sessionId]);

    const refreshOverview = useCallback(() => {
        if (!isCurrentAuthSession(sessionId)) return;
        // Background metadata refresh must not unmount the authenticator or reset profile drafts.
        void loadAccount(true);
        void loadSessions();
    }, [loadAccount, loadSessions, sessionId]);

    const loadTryoutApplications = useCallback(async () => {
        tryoutsRequest.current?.abort();
        const controller = new AbortController();
        tryoutsRequest.current = controller;
        const current = () => !controller.signal.aborted && isCurrentAuthSession(sessionId);
        setTryoutsLoading(true); setTryoutsError(null);
        try {
            const { fetchMyTryoutApplications } = await import('../../../api/tryouts');
            if (!current()) return;
            const apps = await fetchMyTryoutApplications(controller.signal);
            if (current()) setTryoutApps(apps);
        } catch {
            if (current()) setTryoutsError('Could not load your tryout applications. Please try again.');
        } finally {
            if (current()) setTryoutsLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        let active = true;
        setAccount(null); setForm(null); setSessions(null);
        setMyCards([]); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setMessage(null); setError(null); setSessionsError(null);
        setSendingVerification(false); setChangingPassword(false); setRevokingSessions(false); setEndingSessionId(null);
        setTryoutApps([]); setShowTryoutApps(false); setTryoutsError(null); setTryoutsLoading(false);
        void loadAccount();
        void loadSessions();
        void fetchMyPlayerCards()
            .then(cards => { if (active && isCurrentAuthSession(sessionId)) setMyCards(cards); })
            .catch(() => { if (active && isCurrentAuthSession(sessionId)) setMyCards([]); });
        return () => {
            active = false;
            accountRequest.current?.abort(); sessionsRequest.current?.abort();
            tryoutsRequest.current?.abort();
            actionRequest.current?.abort(); actionRequest.current = null;
        };
    }, [loadAccount, loadSessions, sessionId]);

    useEffect(() => {
        if (account) {
            void loadTryoutApplications();
        }
    }, [account, loadTryoutApplications]);

    const resendVerification = async () => {
        if (actionRequest.current || !isCurrentAuthSession(sessionId)) return;
        const controller = new AbortController(); actionRequest.current = controller;
        const current = () => !controller.signal.aborted && isCurrentAuthSession(sessionId);
        setSendingVerification(true);
        setMessage(null); setError(null);
        let accepted = false;
        try {
            const config: AuthSessionRequestConfig = { signal: controller.signal, _authSessionId: sessionId };
            const response = await apiClient.post<{ message?: string }>('/auth/send-verification', { continuationPath: '/account?tab=security' }, config);
            if (!current()) return;
            accepted = true;
            setMessage(response.data?.message || 'Verification email requested. Check your inbox and spam folder; retry if it does not arrive.');
            await loadAccount(true);
            if (!current()) return;
            await bootstrapSession();
        } catch (requestError) {
            if (current()) setError(accountError(requestError, accepted ? 'Email requested, but account status could not be refreshed. Retry loading your account.' : 'Failed to send verification email.'));
        } finally {
            if (actionRequest.current === controller) actionRequest.current = null;
            if (current()) setSendingVerification(false);
        }
    };

    const changePassword = async (event: FormEvent) => {
        event.preventDefault();
        if (actionRequest.current || !isCurrentAuthSession(sessionId)) return;
        if (!confirmSecurityNavigation()) return;
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setError({ fallback: 'New password and confirmation do not match.' });
            return;
        }
        setChangingPassword(true);
        const controller = new AbortController(); actionRequest.current = controller;
        const current = () => !controller.signal.aborted && isCurrentAuthSession(sessionId);
        setMessage(null); setError(null);
        try {
            const response = await credentialUpdate(config => apiClient.post<{ message?: string }>('/auth/change-password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            }, config), response => response, controller.signal);
            if (!current()) return;
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setMessage(response.data?.message || 'Password changed. Sign in again with your new password.');
            await logout();
        } catch (requestError) {
            if (current()) setError(accountError(requestError, 'Failed to change password.'));
        } finally {
            if (actionRequest.current === controller) actionRequest.current = null;
            if (current()) setChangingPassword(false);
        }
    };

    const revokeOtherSessions = async () => {
        if (actionRequest.current || !isCurrentAuthSession(sessionId)) return;
        const controller = new AbortController(); actionRequest.current = controller;
        const current = () => !controller.signal.aborted && isCurrentAuthSession(sessionId);
        setRevokingSessions(true);
        try {
            const response = await credentialUpdate(config => apiClient.post<{ message?: string }>('/auth/sessions/revoke-others', {}, config), response => response, controller.signal);
            if (!current()) return;
            await loadSessions();
            if (current()) setMessage(response.data?.message || 'Other remembered sessions have been signed out.');
        } catch (requestError) {
            if (current()) setSessionsError(accountError(requestError, 'Failed to sign out other remembered sessions.'));
        } finally {
            if (actionRequest.current === controller) actionRequest.current = null;
            if (current()) setRevokingSessions(false);
        }
    };

    // Signs out one other device, for example a lost phone. Its next request is refused.
    const endSession = async (id: number) => {
        if (actionRequest.current || !isCurrentAuthSession(sessionId)) return;
        const controller = new AbortController(); actionRequest.current = controller;
        const current = () => !controller.signal.aborted && isCurrentAuthSession(sessionId);
        setEndingSessionId(id);
        try {
            const config: AuthSessionRequestConfig = { signal: controller.signal, _authSessionId: sessionId };
            const response = await apiClient.delete<{ message?: string }>(`/auth/sessions/${id}`, config);
            if (!current()) return;
            await loadSessions();
            if (current()) setMessage(response.data?.message || 'The session has been signed out.');
        } catch (requestError) {
            if (current()) setSessionsError(accountError(requestError, 'Failed to sign out that session.'));
        } finally {
            if (actionRequest.current === controller) actionRequest.current = null;
            if (current()) setEndingSessionId(null);
        }
    };

    return {
        account, isPlayer, form, setForm, profileDraft, loading, message, error, loadAccount, refreshOverview,
        sessions, sessionsLoading, sessionsError, loadSessions, revokingSessions, revokeOtherSessions, endingSessionId, endSession,
        passwordForm, setPasswordForm, changingPassword, changePassword, sendingVerification, resendVerification,
        tryoutApps, showTryoutApps, setShowTryoutApps, tryoutsLoading, tryoutsError, loadTryoutApplications,
        myCards, setMyCards,
    };
}

export type AccountCenter = ReturnType<typeof useAccountCenter>;
