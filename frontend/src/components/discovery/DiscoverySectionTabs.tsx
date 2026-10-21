import { Link, useLocation } from 'react-router-dom';
import { isAndroidApp } from '../../android/bridge';
import { BriefcaseBusiness, ShoppingBag, HeartHandshake, LandPlot } from 'lucide-react';

const destinations = [
    { path: '/stadiums', label: 'Stadiums', icon: LandPlot, activeClass: 'border-[color:var(--color-cyan)]/50 bg-[color:var(--color-cyan)]/[0.07] text-[color:var(--color-cyan)] dark:border-[color:var(--color-cyan)]/50 dark:text-[color:var(--color-cyan)]' },
    { path: '/store', label: 'Store', icon: ShoppingBag, activeClass: 'border-[color:var(--color-accent)]/50 bg-[color:var(--color-accent)]/[0.07] text-[color:var(--color-accent)] dark:border-[color:var(--color-accent)]/50 dark:text-[color:var(--color-accent)]' },
    { path: '/campaigns', label: 'Fundraising & campaigns', icon: HeartHandshake, activeClass: 'border-[color:var(--color-warning)]/50 bg-[color:var(--color-warning)]/[0.07] text-[color:var(--color-warning)] dark:border-[color:var(--color-warning)]/50 dark:text-[color:var(--color-warning)]' },
    { path: '/jobs', label: 'Roles', icon: BriefcaseBusiness, activeClass: 'border-[var(--color-pink)]/50 bg-[var(--color-pink)]/[0.07] text-[var(--color-pink)] dark:border-[var(--color-pink)]/50 dark:text-[var(--color-pink)]' },
];

export const DiscoverySectionTabs = () => {
    const location = useLocation();
    const clubId = location.pathname.match(/^\/clubs\/(\d+)\/(?:store|campaigns)$/)?.[1];

    return (
        <nav aria-label="Opportunities" className="mb-5 flex flex-wrap items-center gap-2 border-b border-[color:var(--theme-border)] pb-4">
            {destinations.map((destination) => {
                const Icon = destination.icon;
                const active = location.pathname === destination.path || location.pathname.startsWith(destination.path + '/') || location.pathname.endsWith(destination.path);
                return (
                    <Link key={destination.path} to={clubId && destination.path !== '/stadiums' ? destination.path === '/jobs' ? `/clubs/${clubId}?tab=business&opportunity=jobs` : `/clubs/${clubId}${destination.path}` : destination.path} className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-xs font-bold transition-colors ${active ? destination.activeClass : 'border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--theme-surface-strong)] hover:text-[color:var(--text-primary)]'}`} aria-current={active ? 'page' : undefined}>
                        <Icon className="h-4 w-4" />
                        {destination.label}
                        {destination.path === '/jobs' && !isAndroidApp && <span className="rounded-full border border-[color:var(--color-warning)]/30 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-[color:var(--color-warning)] dark:text-[color:var(--color-warning)]">Preview</span>}
                    </Link>
                );
            })}
        </nav>
    );
};
