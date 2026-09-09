import { Link, useLocation } from 'react-router-dom';
import { BriefcaseBusiness, ShoppingBag } from 'lucide-react';

const destinations = [
    { path: '/store', label: 'Store', icon: ShoppingBag, activeClass: 'border-emerald-400/50 text-emerald-300' },
    { path: '/jobs', label: 'Jobs & volunteering', icon: BriefcaseBusiness, activeClass: 'border-fuchsia-400/50 bg-fuchsia-400/[0.07] text-fuchsia-300' },
];

export const DiscoverySectionTabs = () => {
    const location = useLocation();

    return (
        <nav aria-label="Opportunities" className="mb-5 flex flex-wrap items-center gap-2 border-b border-[color:var(--theme-border)] pb-4">
            {destinations.map((destination) => {
                const Icon = destination.icon;
                const active = location.pathname === destination.path;
                return (
                    <Link key={destination.path} to={destination.path} className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-xs font-bold transition-colors ${active ? destination.activeClass : 'border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--theme-surface-strong)] hover:text-[color:var(--text-primary)]'}`} aria-current={active ? 'page' : undefined}>
                        <Icon className="h-4 w-4" />
                        {destination.label}
                        {destination.path === '/jobs' && <span className="rounded-full border border-amber-400/30 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-amber-300">Preview</span>}
                    </Link>
                );
            })}
        </nav>
    );
};
