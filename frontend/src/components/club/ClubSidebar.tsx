import { BellRing } from 'lucide-react';
import { clubNavigationItems, type ClubNavigationClubSummary, type ClubNavigationTab } from './clubNavigation';

interface ClubSidebarProps {
    activeTab: ClubNavigationTab;
    setActiveTab: (tab: ClubNavigationTab) => void;
    club: ClubNavigationClubSummary & {
        name?: string;
    };
    canManageClub: boolean;
    onOpenNotifications?: () => void;
}

export const ClubSidebar = ({ activeTab, setActiveTab, club, canManageClub, onOpenNotifications }: ClubSidebarProps) => (
    <aside className="min-w-0">
        <div className="lg:sticky lg:top-[calc(var(--app-header-height)+18px)]">
            <div className="mb-6 px-1">
                <p className="text-[11px] font-semibold  text-[#a1a1aa]">Club Navigation</p>
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-[#f4f4f5]">{club.name || 'Club Workspace'}</p>
            </div>

            <div className="space-y-2.5">
                {clubNavigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const badge = item.badge?.(club) ?? null;

                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveTab(item.id)}
                            className={`club-sidebar-item ${item.toneClassName} flex w-full items-center justify-between gap-3 rounded-[4px] px-4 py-3.5 text-left transition-all ${
                                isActive ? 'club-sidebar-item--active' : ''
                            }`}
                        >
                            <span className="flex items-center gap-3">
                                <Icon className="h-4 w-4" />
                                <span className="text-[11px] font-semibold ">{item.label}</span>
                            </span>

                            {badge != null && badge > 0 ? (
                                <span
                                    className={`club-sidebar-badge rounded-[4px] border px-2.5 py-1 text-[10px] font-semibold  ${
                                        isActive ? 'club-sidebar-badge--active' : 'border-[#ffffff0d] text-[#a1a1aa]'
                                    }`}
                                >
                                    {badge}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            {canManageClub && onOpenNotifications && (
                <div className="mt-8 border-t border-[#ffffff0d] pt-5">
                    <button
                        type="button"
                        onClick={onOpenNotifications}
                        className="club-sidebar-item club-tone-blue flex w-full items-center justify-between gap-3 rounded-[4px] px-4 py-3.5 text-left transition-colors"
                    >
                        <span className="flex items-center gap-3">
                            <BellRing className="h-4 w-4" />
                            <span className="text-[11px] font-semibold ">Notifications</span>
                        </span>
                    </button>
                </div>
            )}
        </div>
    </aside>
);
