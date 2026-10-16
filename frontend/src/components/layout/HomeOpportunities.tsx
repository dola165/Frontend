import { Link, useLocation } from 'react-router-dom';
import { Briefcase, HeartHandshake, Plus, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { capabilitiesKnown } from '../../context/navigationCapabilities';
import { usePagesCopy } from '../../features/pages/copy';
import { createHref, hasOwnPage } from '../../features/pages/create/entry';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';

/**
 * The three places, in the store switch's order and colours, when the right rail will not fit beside the feed; and
 * for someone without a page of their own, the way to start their club (the left rail's card, which a phone hides).
 */
export function HomeOpportunities({ className = '', onNavigate }: { className?: string; onNavigate?: () => void }) {
    const copy = useJourneyCopy();
    const t = usePagesCopy();
    const location = useLocation();
    const capabilities = useAuth().user?.navigationCapabilities;
    const start = capabilitiesKnown(capabilities) && !hasOwnPage(capabilities);
    const items = [
        { to: '/store', label: copy('Store', 'მაღაზია'), Icon: ShoppingBag, kind: 'store' },
        { to: '/jobs', label: copy('Jobs & volunteering', 'სამუშაო და მოხალისეობა'), Icon: Briefcase, kind: 'jobs' },
        { to: '/campaigns', label: copy('Fundraising', 'ფონდების მოზიდვა'), Icon: HeartHandshake, kind: 'fundraising' },
        ...(start ? [{ to: createHref(location, 'CLUB', 'home'), label: t('Start your club'), Icon: Plus, kind: 'start' }] : []),
    ];
    return <nav className={`home-commercial-nav ${className}`} aria-label={copy('Store, jobs and fundraising', 'მაღაზია, სამუშაო და ფონდების მოზიდვა')}>
        {items.map(({ to, label, Icon, kind }) => <Link key={kind} to={to} onClick={onNavigate} className={`home-opportunity-shortcut home-opportunity-shortcut--${kind}`}><Icon size={16} aria-hidden /><span>{label}</span></Link>)}
    </nav>;
}
