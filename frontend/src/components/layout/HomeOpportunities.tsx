import { Link } from 'react-router-dom';
import { BriefcaseBusiness, HeartHandshake, LandPlot, ShoppingBag } from 'lucide-react';

/** Compact access when a full Opportunities rail will not fit beside the feed. */
export function HomeOpportunities({ className = '', onNavigate }: { className?: string; onNavigate?: () => void }) {
    return <nav className={`home-commercial-nav ${className}`} aria-label="Football opportunities">
        {[
            { to: '/store', label: 'Store', Icon: ShoppingBag, kind: 'store' },
            { to: '/stadiums', label: 'Stadiums', Icon: LandPlot, kind: 'stadiums' },
            { to: '/campaigns', label: 'Campaigns', Icon: HeartHandshake, kind: 'campaigns' },
            { to: '/jobs', label: 'Roles', Icon: BriefcaseBusiness, kind: 'jobs' },
        ].map(({ to, label, Icon, kind }) => <Link key={to} to={to} onClick={onNavigate} className={`home-opportunity-shortcut home-opportunity-shortcut--${kind}`}><Icon size={16} aria-hidden /><span>{label}</span></Link>)}
    </nav>;
}
