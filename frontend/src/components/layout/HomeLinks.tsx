import { Link, useLocation } from 'react-router-dom';
import { BriefcaseBusiness, ChevronRight, Coins, Plus, Shirt, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { capabilitiesKnown } from '../../context/navigationCapabilities';
import { usePagesCopy } from '../../features/pages/copy';
import { createHref, hasOwnPage } from '../../features/pages/create/entry';
import { useAction } from '../../features/actions/useAction';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import '../ui/opportunity-link.css';

/** The three places beside Home, in one list: the store, jobs and volunteering, fundraising. */
const PLACES: { kind: 'store' | 'jobs' | 'campaigns'; to: string; icon: LucideIcon; label: [string, string]; hint: [string, string] }[] = [
    { kind: 'store', to: '/store', icon: Shirt, label: ['Store', 'მაღაზია'], hint: ['Kit & merchandise from clubs', 'ფორმა და ნივთები კლუბებისგან'] },
    { kind: 'jobs', to: '/jobs', icon: BriefcaseBusiness, label: ['Jobs & volunteering', 'სამუშაო და მოხალისეობა'], hint: ['Work and volunteer in football', 'იმუშავეთ ან იყავით მოხალისე ფეხბურთში'] },
    { kind: 'campaigns', to: '/campaigns', icon: Coins, label: ['Fundraising', 'ფონდების მოზიდვა'], hint: ['Support club projects', 'დაუჭირეთ მხარი კლუბის პროექტებს'] },
];

/**
 * Home's side links, built once and placed twice: as rows in the right rail where it fits (`rail`), and as a strip
 * above the feed where it doesn't (`strip`, also Dola's panel). The strip adds "Start your club" for someone without a
 * page of their own, since a phone hides the left rail's card.
 */
export function HomeLinks({ variant, className = '', onNavigate }: { variant: 'rail' | 'strip'; className?: string; onNavigate?: () => void }) {
    const copy = useJourneyCopy();
    const label = copy('Store, jobs and fundraising', 'მაღაზია, სამუშაო და ფონდების მოზიდვა');
    if (variant === 'rail') return <nav className={`home-rail-card home-opportunities-card ${className}`} aria-label={label}>
        <div className="space-y-2.5 p-3">
            {PLACES.map(({ kind, to, icon: Icon, label: words, hint }) => <Link key={kind} to={to} onClick={onNavigate} className={`opportunity-link opportunity-link--${kind} home-opportunity-link`}>
                <span className="home-opportunity-icon"><Icon size={16} strokeWidth={1.6} aria-hidden="true" /></span>
                <span className="home-opportunity-copy"><span className="home-opportunity-title">{copy(...words)}</span><span className="opportunity-link__description">{copy(...hint)}</span></span>
                <ChevronRight size={14} strokeWidth={1.6} aria-hidden="true" className="home-opportunity-chevron" />
            </Link>)}
        </div>
    </nav>;
    return <nav className={`home-commercial-nav ${className}`} aria-label={label}>
        {PLACES.map(({ kind, to, icon: Icon, label: words }) => <Link key={kind} to={to} onClick={onNavigate} className={`home-opportunity-shortcut home-opportunity-shortcut--${kind === 'campaigns' ? 'fundraising' : kind}`}>
            <Icon size={16} aria-hidden /><span>{copy(...words)}</span></Link>)}
        <StartClubLink onNavigate={onNavigate} />
    </nav>;
}

/** The strip's way to start a club, for someone without a page of their own. */
function StartClubLink({ onNavigate }: { onNavigate?: () => void }) {
    const t = usePagesCopy();
    const location = useLocation();
    const capabilities = useAuth().user?.navigationCapabilities;
    const mayStartClub = useAction('start_club').allowed;
    if (!mayStartClub || !capabilitiesKnown(capabilities) || hasOwnPage(capabilities)) return null;
    return <Link to={createHref(location, 'CLUB', 'home')} onClick={onNavigate} className="home-opportunity-shortcut home-opportunity-shortcut--start">
        <Plus size={16} aria-hidden /><span>{t('Start your club')}</span></Link>;
}
