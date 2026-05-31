import type { ClubTab } from '../../pages/ClubProfilePage';
import { clubNavigationItems } from './clubNavigation';

interface ClubProfileStickyHeaderProps {
    activeTab: ClubTab;
    onTabChange: (tab: ClubTab) => void;
    club: {
        honours?: Array<unknown>;
        opportunities?: Array<unknown>;
    };
}

export const ClubProfileStickyHeader = ({
    activeTab,
    onTabChange,
    club
}: ClubProfileStickyHeaderProps) => (
    <div className="border-b border-[color:var(--club-theme-border-subtle)] bg-[rgba(7,11,17,0.94)]">
        <div className="mx-auto w-full overflow-x-auto px-6 sm:px-8">
            <div className="flex min-w-max items-stretch gap-2 py-3">
                {clubNavigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.id === activeTab;
                    const badge = item.badge?.(club) ?? null;

                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onTabChange(item.id)}
                            className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-left text-[12px] font-semibold transition-all ${
                                isActive
                                    ? 'border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green-soft)] text-[color:var(--club-theme-text-primary)]'
                                    : 'border-transparent bg-transparent text-[color:var(--club-theme-text-secondary)] hover:border-white/8 hover:bg-white/[0.04] hover:text-[color:var(--club-theme-text-primary)]'
                            }`}
                        >
                            <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[color:var(--club-tone-green)]' : 'text-[color:var(--club-theme-text-secondary)]'}`} />
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{item.label}</span>
                            {badge != null && badge > 0 ? (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${
                                    isActive
                                        ? 'bg-[rgba(255,255,255,0.08)] text-[color:var(--club-theme-text-primary)]'
                                        : 'bg-white/[0.04] text-[color:var(--club-theme-text-secondary)]'
                                }`}>
                                    {badge}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </div>
    </div>
);
