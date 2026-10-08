import type { ClubTab } from '../../pages/ClubProfilePage';
import { clubNavigationItems } from './clubNavigation';

interface ClubProfileStickyHeaderProps {
    activeTab: ClubTab;
    onTabChange: (tab: ClubTab) => void;
    club: { presentation?: { profileKind: string } | null; honours?: unknown[]; opportunities?: unknown[] };
}
export function ClubProfileStickyHeader({activeTab,onTabChange,club}:ClubProfileStickyHeaderProps) {
    return <nav className="club-profile-nav" aria-label="Club sections"><div className="club-profile-frame club-profile-nav-inner">
        {clubNavigationItems.map(item => { const Icon=item.icon;const count=item.badge?.(club);return <button type="button" key={item.id} aria-current={activeTab===item.id?'page':undefined} onClick={()=>onTabChange(item.id)}><Icon size={15}/>{item.label}{count ? <span>{count}</span> : null}</button>;})}
    </div></nav>;
}
