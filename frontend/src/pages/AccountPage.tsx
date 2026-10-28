import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { confirmSecurityNavigation } from '../features/twoFactor/useSecurityNavigationGuard';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { EntityTabs } from '../components/layout/EntityTabs';
import { useAccountCopy } from '../features/profiles/account/accountCopy';
import { accountErrorText, accountTabItems, btnPrimaryClass, normalizeAccountTab, surfaceClass } from '../features/profiles/account/accountModel';
import { useAccountCenter } from '../features/profiles/account/useAccountCenter';
import { usePlayerCardActivation } from '../features/profiles/account/usePlayerCardActivation';
import { AccountHeader } from '../features/profiles/account/AccountHeader';
import { LinkedPlayerCards, PlayerCardActivationDialog } from '../features/profiles/account/LinkedPlayerCards';
import { AccountTryoutApplications } from '../features/profiles/account/AccountTryoutApplications';
import { AccountProfileTab } from '../features/profiles/account/AccountProfileTab';
import { AccountSecurityTab } from '../features/profiles/account/AccountSecurityTab';
import { AccountSessionsTab } from '../features/profiles/account/AccountSessionsTab';
import { AccountNotificationsTab } from '../features/notifications/AccountNotificationsTab';
import { AccountLinkedAccountsTab } from '../features/profiles/account/AccountLinkedAccountsTab';
import { AccountDangerTab } from '../features/profiles/account/AccountDangerTab';
import '../components/workspace/workspace-shell.css';

export const AccountPage = () => {
    const copy = useAccountCopy();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const center = useAccountCenter();
    const { account, form, loading, error, message } = center;
    const activation = usePlayerCardActivation(center.setMyCards);
    // The API build leaves out the two-factor and Google-provider endpoints until they are released
    // (backend deploy/release-source-selection.json), so only the explicit flag shows these panels, dev servers included.
    const securityExtensions = import.meta.env.VITE_ACCOUNT_SECURITY_EXTENSIONS === 'true';

    const activeTab = normalizeAccountTab(searchParams.get('tab'));
    const profileHref = user?.id ? `/profile/${user.id}` : '/home';
    const bannerPreview = useMemo(
        () =>
            resolveMediaUrl(form?.bannerUrl) ||
            resolveMediaUrl(account?.bannerUrl),
        [account?.bannerUrl, form?.bannerUrl]
    );
    const avatarPreview = useMemo(() => resolveMediaUrl(form?.avatarUrl) || resolveMediaUrl(account?.avatarUrl), [account?.avatarUrl, form?.avatarUrl]);
    const initials = (account?.displayName || account?.username || 'TA').substring(0, 2).toUpperCase();

    // --- Loading state ---
    if (loading) {
        return (
            <div role="status" aria-label={copy('Loading your account…')} className="workspace-page-shell flex min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-[color:var(--fc-accent)]" />
            </div>
        );
    }

    // --- Error / offline state ---
    if (!account || !form) {
        return (
            <div className="workspace-page-shell flex min-h-[calc(100vh-var(--app-header-height))] items-center justify-center px-6">
                <div className={`${surfaceClass} max-w-xl px-8 py-10 text-center`}>
                    <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-[color:var(--fc-state-danger)]" />
                    <h1 className="text-xl font-bold text-[color:var(--fc-text-primary)]">{copy("Account Center Offline")}</h1>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--fc-text-secondary)]">{error ? accountErrorText(error, copy) : copy('Your account settings could not be loaded right now.')}</p>
                    <button type="button" onClick={() => void center.loadAccount()} className={`${btnPrimaryClass} mt-6`}>
                        {copy("Retry")}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="account-page workspace-page-shell min-h-full pb-10">
            <div className="flex w-full flex-col gap-5">
                <AccountHeader account={account} profileHref={profileHref} avatarPreview={avatarPreview} initials={initials}
                    tryoutApps={center.tryoutApps} showTryoutApps={center.showTryoutApps}
                    onSecurity={() => setSearchParams({ tab: 'security' })}
                    onToggleTryouts={() => { void center.loadTryoutApplications(); center.setShowTryoutApps((v) => !v); }} />

                {/* Tabs */}
                <EntityTabs items={accountTabItems.map(tab => ({ ...tab, label: copy(tab.label) }))} activeId={activeTab} onChange={(tab) => { if (confirmSecurityNavigation()) setSearchParams({ tab }); }} />

                {/* Messages */}
                {message && (
                    <div className="rounded-xl border border-[color:var(--fc-accent-border)] bg-[color:var(--fc-accent-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--fc-accent)]">
                        {copy(message)}
                    </div>
                )}
                {error && (
                    <div className="rounded-xl border border-[color:var(--fc-state-danger)]/30 bg-[color:var(--fc-state-danger)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--fc-state-danger)]">
                        {accountErrorText(error, copy)}
                    </div>
                )}

                {center.myCards.length > 0 && <LinkedPlayerCards cards={center.myCards} onActivate={activation.setActivatingCard} />}

                {center.showTryoutApps && (
                    <AccountTryoutApplications apps={center.tryoutApps} loading={center.tryoutsLoading} error={center.tryoutsError}
                        onHide={() => center.setShowTryoutApps(false)} onReload={() => void center.loadTryoutApplications()} />
                )}

                {activation.activatingCard && <PlayerCardActivationDialog card={activation.activatingCard} activation={activation} />}

                {activeTab === 'profile' && (
                    <AccountProfileTab account={account} form={form} setForm={center.setForm} isPlayer={center.isPlayer}
                        profileDraft={center.profileDraft} avatarPreview={avatarPreview} bannerPreview={bannerPreview}
                        initials={initials} profileHref={profileHref} />
                )}
                {activeTab === 'security' && <AccountSecurityTab {...center} account={account} securityExtensions={securityExtensions} />}
                {activeTab === 'notifications' && <AccountNotificationsTab />}
                {activeTab === 'sessions' && <AccountSessionsTab {...center} account={account} />}
                {activeTab === 'accounts' && <AccountLinkedAccountsTab account={account} securityExtensions={securityExtensions} refreshOverview={center.refreshOverview} />}
                {activeTab === 'danger' && <AccountDangerTab />}
            </div>
        </div>
    );
};
