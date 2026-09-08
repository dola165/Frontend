import type { ClubTab } from '../../pages/ClubProfilePage';
import { clubNavigationItems, type ClubNavigationItem } from './clubNavigation';

interface ClubProfileStickyHeaderProps {
    activeTab: ClubTab;
    onTabChange: (tab: ClubTab) => void;
    club: {
        honours?: Array<unknown>;
        opportunities?: Array<unknown>;
    };
}

const mainItems = clubNavigationItems.filter((item) => (item.section ?? 'main') === 'main');
const mediaItems = clubNavigationItems.filter((item) => item.section === 'media');
const sideItems = clubNavigationItems.filter((item) => item.section === 'side');

export const ClubProfileStickyHeader = ({
    activeTab,
    onTabChange,
    club
}: ClubProfileStickyHeaderProps) => {
    const renderItem = (item: ClubNavigationItem) => {
        const Icon = item.icon;
        const isActive = item.id === activeTab;
        const badge = item.badge?.(club) ?? null;

        const inactiveClassName = item.accent === 'blue'
            ? // media tabs: very slight light-blue tint vs the transparent rest
              'border-transparent bg-[rgba(92,173,255,0.07)] text-[color:var(--club-theme-text-secondary)] hover:bg-[rgba(92,173,255,0.13)] hover:text-[color:var(--club-theme-text-primary)]'
            : item.accent === 'violet'
                ? // jobs tab: slight violet tint matching the opportunities board
                  'border-transparent bg-[rgba(192,132,255,0.08)] text-[color:var(--club-theme-text-secondary)] hover:bg-[rgba(192,132,255,0.14)] hover:text-[color:var(--club-theme-text-primary)]'
                : 'border-transparent bg-transparent text-[color:var(--club-theme-text-secondary)] hover:border-white/8 hover:bg-white/[0.04] hover:text-[color:var(--club-theme-text-primary)]';

        const iconClassName = isActive
            ? 'text-[color:var(--club-tone-green)]'
            : item.accent === 'violet'
                ? 'text-[color:var(--club-tone-violet)]'
                : 'text-[color:var(--club-theme-text-secondary)]';

        return (
            <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-left text-[12px] font-semibold transition-all ${
                    isActive
                        ? 'border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green-soft)] text-[color:var(--club-theme-text-primary)]'
                        : inactiveClassName
                }`}
            >
                <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} />
                <span className="text-[11px] font-semibold ">{item.label}</span>
                {badge != null && badge > 0 ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold  ${
                        isActive
                            ? 'bg-[rgba(255,255,255,0.08)] text-[color:var(--club-theme-text-primary)]'
                            : 'bg-white/[0.04] text-[color:var(--club-theme-text-secondary)]'
                    }`}>
                        {badge}
                    </span>
                ) : null}
            </button>
        );
    };

    return (
        <div className="border-b border-[color:var(--club-theme-border-subtle)] bg-[rgba(5,9,16,0.96)]">
            <div className="club-profile-frame mx-auto w-full overflow-x-auto">
                <div className="flex min-w-max items-stretch gap-2 py-3">
                    {mainItems.map(renderItem)}

                    {mediaItems.length > 0 && (
                        <div className="ml-8 flex items-stretch gap-2">
                            {mediaItems.map(renderItem)}
                        </div>
                    )}

                    {sideItems.length > 0 && (
                        <div className="ml-auto flex items-stretch gap-2">
                            {sideItems.map(renderItem)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
