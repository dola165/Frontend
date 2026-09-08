import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BellRing, X } from 'lucide-react';
import { clubRoleLabel, type ClubManagementOverview } from '../../features/clubs/domain';
import type { TabItem, WorkspaceTab } from './types';
import { useDialogFocus } from './useDialogFocus';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

interface WorkspaceSidebarProps {
    clubId: number;
    overview: ClubManagementOverview | null;
    activeTab: WorkspaceTab;
    tabs: TabItem[];
    unreadInboxCount: number;
    clubName?: string | null;
    clubLogoUrl?: string | null;
    mobileOpen: boolean;
    onTabChange: (tab: WorkspaceTab) => void;
    onNavigate: (path: string) => void;
    onClose: () => void;
}

export const WorkspaceSidebar = ({
    clubId, overview, activeTab, tabs, unreadInboxCount, clubName, clubLogoUrl, mobileOpen,
    onTabChange, onNavigate, onClose,
}: WorkspaceSidebarProps) => (
    <SidebarContent
        clubId={clubId}
        overview={overview}
        activeTab={activeTab}
        tabs={tabs}
        unreadInboxCount={unreadInboxCount}
        clubName={clubName}
        clubLogoUrl={clubLogoUrl}
        mobileOpen={mobileOpen}
        onTabChange={onTabChange}
        onNavigate={onNavigate}
        onClose={onClose}
    />
);

const SidebarContent = ({
    clubId, overview, activeTab, tabs, unreadInboxCount, clubName, clubLogoUrl, mobileOpen,
    onTabChange, onNavigate, onClose,
}: WorkspaceSidebarProps) => {
    const { t } = useTranslation();
    const sidebarRef = useRef<HTMLElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const resolvedClubLogoUrl = resolveMediaUrl(clubLogoUrl);
    const [clubLogoFailedUrl, setClubLogoFailedUrl] = useState<string | null>(null);
    useDialogFocus(mobileOpen, sidebarRef, onClose, closeRef);
    const groupedTabs = [
        { label: 'Club', ids: ['overview', 'settings'] },
        { label: 'People', ids: ['personnel', 'players', 'invites', 'applications', 'roles', 'inbox'] },
        { label: 'Football', ids: ['squads', 'player-cards', 'tryouts'] },
        { label: 'Opportunities', ids: ['jobs'] },
    ].map((group) => ({
        ...group,
        tabs: [
            ...tabs,
            { id: 'inbox' as const, label: t('clubWorkspace.inbox'), icon: BellRing, badge: unreadInboxCount > 0 ? String(unreadInboxCount) : null },
        ].filter((tab) => group.ids.includes(tab.id)),
    })).filter((group) => group.tabs.length > 0);

    return <>
    {mobileOpen && <button type="button" aria-label={t('clubWorkspace.closeNavigation')} onClick={onClose} className="workspace-sidebar-backdrop" />}
    <aside ref={sidebarRef} id="workspace-navigation" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen ? true : undefined} aria-label="Club workspace navigation" className={`workspace-sidebar flex w-[210px] shrink-0 flex-col border-r border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] ${mobileOpen ? 'is-open' : ''}`}>
        {/* Header */}
        <div className="border-b border-[var(--fc-border)] px-3 py-4">
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => { onNavigate(`/clubs/${clubId}`); onClose(); }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)] transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {t('clubWorkspace.backToClub')}
                </button>
                <button ref={closeRef} type="button" onClick={onClose} aria-label={t('clubWorkspace.closeNavigation')} className="workspace-mobile-only rounded-lg p-1.5 text-[var(--fc-text-muted)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="mt-3 flex min-w-0 items-center gap-2.5">
                {resolvedClubLogoUrl && clubLogoFailedUrl !== resolvedClubLogoUrl ? (
                    <img src={resolvedClubLogoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" onError={() => setClubLogoFailedUrl(resolvedClubLogoUrl)} />
                ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--fc-accent-soft)] text-xs font-bold text-[var(--fc-accent)]">
                        {(clubName || 'C').charAt(0).toUpperCase()}
                    </span>
                )}
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--fc-text-primary)]">{clubName || `Club #${clubId}`}</p>
                    <p className="truncate text-[11px] font-medium text-[var(--fc-text-muted)]">{overview?.currentUserRole ? clubRoleLabel(overview.currentUserRole) : t('clubWorkspace.workspace')}</p>
                </div>
            </div>
            <p className="mt-0.5 text-xs font-medium text-[var(--fc-text-muted)] truncate">
                {t('clubWorkspace.clubManagement')}
            </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-4 overflow-y-auto p-2">
            {groupedTabs.map((group) => (
                <section key={group.label} aria-label={group.label}>
                    <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fc-text-muted)]">{group.label}</p>
                    <div className="space-y-0.5">
                        {group.tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    aria-current={isActive ? 'page' : undefined}
                                    onClick={() => { onTabChange(tab.id); onClose(); }}
                                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                                        isActive
                                            ? 'border-l-[3px] border-[var(--fc-accent)] bg-[var(--fc-accent-soft)] text-[var(--fc-accent)]'
                                            : 'border-l-[3px] border-transparent text-[var(--fc-text-secondary)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]'
                                    }`}
                                >
                                    <span className="flex items-center gap-2.5"><Icon className="h-4 w-4" />{tab.label}</span>
                                    {tab.badge ? <span className="rounded-xl bg-[var(--fc-surface-hover)] px-1.5 py-0.5 text-[11px] font-semibold">{tab.badge}</span> : null}
                                </button>
                            );
                        })}
                    </div>
                </section>
            ))}
        </nav>
    </aside>
    </>;
};
