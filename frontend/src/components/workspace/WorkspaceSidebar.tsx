import { ArrowLeft, BellRing } from 'lucide-react';
import { clubRoleLabel, type ClubManagementOverview } from '../../features/clubs/domain';
import type { TabItem, WorkspaceTab } from './types';

interface WorkspaceSidebarProps {
    clubId: number;
    overview: ClubManagementOverview | null;
    activeTab: WorkspaceTab;
    tabs: TabItem[];
    unreadInboxCount: number;
    onTabChange: (tab: WorkspaceTab) => void;
    onNavigate: (path: string) => void;
}

export const WorkspaceSidebar = ({
    clubId, overview, activeTab, tabs, unreadInboxCount,
    onTabChange, onNavigate,
}: WorkspaceSidebarProps) => (
    <aside className="flex w-[210px] shrink-0 flex-col border-r border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)]">
        {/* Header */}
        <div className="border-b border-[var(--fc-border)] px-3 py-4">
            <button
                type="button"
                onClick={() => onNavigate(`/clubs/${clubId}`)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)] transition-colors"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Club
            </button>
            <h1 className="mt-2.5 text-sm font-semibold text-[var(--fc-text-primary)] truncate">
                {overview?.currentUserRole ? clubRoleLabel(overview.currentUserRole) : 'Workspace'}
            </h1>
            <p className="mt-0.5 text-xs font-medium text-[var(--fc-text-muted)] truncate">
                Club Management
            </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onTabChange(tab.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                            isActive
                                ? 'bg-[var(--fc-accent-soft)] text-[var(--fc-accent)] border-l-[3px] border-[var(--fc-accent)]'
                                : 'text-[var(--fc-text-secondary)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)] border-l-[3px] border-transparent'
                        }`}
                    >
                        <span className="flex items-center gap-2.5">
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </span>
                        {tab.badge && (
                            <span className={`rounded-xl px-1.5 py-0.5 text-[11px] font-semibold ${
                                isActive
                                    ? 'bg-[var(--fc-accent-soft)] text-[var(--fc-accent)]'
                                    : 'bg-[var(--fc-surface-hover)] text-[var(--fc-text-muted)]'
                            }`}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                );
            })}

            <div className="my-2 border-t border-[var(--fc-border)]" />

            {/* Inbox */}
            <button
                type="button"
                onClick={() => onTabChange('inbox')}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                    activeTab === 'inbox'
                        ? 'bg-[var(--fc-accent-soft)] text-[var(--fc-accent)] border-l-[3px] border-[var(--fc-accent)]'
                        : 'text-[var(--fc-text-secondary)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)] border-l-[3px] border-transparent'
                }`}
            >
                <span className="flex items-center gap-2.5">
                    <BellRing className="h-4 w-4" />
                    Inbox
                </span>
                {unreadInboxCount > 0 && (
                    <span className={`rounded-xl px-1.5 py-0.5 text-[11px] font-semibold ${
                        activeTab === 'inbox'
                            ? 'bg-[var(--fc-accent-soft)] text-[var(--fc-accent)]'
                            : 'bg-[var(--fc-surface-hover)] text-[var(--fc-text-muted)]'
                    }`}>
                        {String(unreadInboxCount)}
                    </span>
                )}
            </button>
        </nav>
    </aside>
);
