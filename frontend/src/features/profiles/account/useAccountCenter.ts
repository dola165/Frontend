import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { apiClient } from '../../../api/axiosConfig';
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
        };
    }, [loadAccount, loadSessions, sessionId]);

    useEffect(() => {
        if (account) {
            void loadTryoutApplications();
        }
    }, [account, loadTryoutApplications]);

    const resendVerification = async () => {
        setSendingVerification(true);
        try {
            const response = await apiClient.post<{ message?: string }>('/auth/send-verification');
            await loadAccount(true);
            await bootstrapSession();
            setMessage(response.data?.message || 'Verification email sent.');
        } catch (requestError) {
            setError(accountError(requestError, 'Failed to send verification email.'));
        } finally {
            setSendingVerification(false);
        }
    };

    const changePassword = async (event: FormEvent) => {
        event.preventDefault();
        if (!confirmSecurityNavigation()) return;
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setError({ fallback: 'New password and confirmation do not match.' });
            return;
        }
        setChangingPassword(true);
        try {
            const response = await credentialUpdate(config => apiClient.post<{ message?: string }>('/auth/change-password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            }, config), response => response);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setMessage(response.data?.message || 'Password changed. Sign in again with your new password.');
            await logout();
        } catch (requestError) {
            setError(accountError(requestError, 'Failed to change password.'));
        } finally {
            setChangingPassword(false);
        }
    };

    const revokeOtherSessions = async () => {
        setRevokingSessions(true);
        try {
            const response = await credentialUpdate(config => apiClient.post<{ message?: string }>('/auth/sessions/revoke-others', {}, config), response => response);
            await loadSessions();
            setMessage(response.data?.message || 'Other remembered sessions have been signed out.');
        } catch (requestError) {
            setSessionsError(accountError(requestError, 'Failed to sign out other remembered sessions.'));
        } finally {
            setRevokingSessions(false);
        }
    };

    return {
        account, isPlayer, form, setForm, profileDraft, loading, message, error, loadAccount, refreshOverview,
        sessions, sessionsLoading, sessionsError, loadSessions, revokingSessions, revokeOtherSessions,
        passwordForm, setPasswordForm, changingPassword, changePassword, sendingVerification, resendVerification,
        tryoutApps, showTryoutApps, setShowTryoutApps, tryoutsLoading, tryoutsError, loadTryoutApplications,
        myCards, setMyCards,
    };
}

export type AccountCenter = ReturnType<typeof useAccountCenter>;
