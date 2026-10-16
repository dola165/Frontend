import { Link } from 'react-router-dom';
import { Briefcase, HeartHandshake, ShoppingBag } from 'lucide-react';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';

/** The three places, in the store switch's order and colours, when the right rail will not fit beside the feed. */
export function HomeOpportunities({ className = '', onNavigate }: { className?: string; onNavigate?: () => void }) {
    const copy = useJourneyCopy();
    return <nav className={`home-commercial-nav ${className}`} aria-label={copy('Store, jobs and fundraising', 'მაღაზია, სამუშაო და ფონდების მოზიდვა')}>
        {[
            { to: '/store', label: copy('Store', 'მაღაზია'), Icon: ShoppingBag, kind: 'store' },
            { to: '/jobs', label: copy('Jobs & volunteering', 'სამუშაო და მოხალისეობა'), Icon: Briefcase, kind: 'jobs' },
            { to: '/campaigns', label: copy('Fundraising', 'ფონდების მოზიდვა'), Icon: HeartHandshake, kind: 'fundraising' },
        ].map(({ to, label, Icon, kind }) => <Link key={to} to={to} onClick={onNavigate} className={`home-opportunity-shortcut home-opportunity-shortcut--${kind}`}><Icon size={16} aria-hidden /><span>{label}</span></Link>)}
    </nav>;
}
