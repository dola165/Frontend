import { BriefcaseBusiness, ChevronRight, Coins, Shirt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import './opportunity-link.css';

const categories = {
    store: { label: ['Store', 'მაღაზია'], icon: Shirt },
    jobs: { label: ['Jobs & volunteering', 'სამუშაო და მოხალისეობა'], icon: BriefcaseBusiness },
    campaigns: { label: ['Fundraising', 'ფონდების მოზიდვა'], icon: Coins },
} as const;

/** One of the three places (Store, Jobs & volunteering, Fundraising) as a row in Home's right rail. */
export function OpportunityLink({ kind, to, description }: { kind: keyof typeof categories; to: string; description: string }) {
    const copy = useJourneyCopy();
    const { label: [english, georgian], icon: Icon } = categories[kind];
    const label = copy(english, georgian);
    return <Link to={to} className={`opportunity-link opportunity-link--${kind} home-opportunity-link`}>
        <span className="home-opportunity-icon"><Icon size={16} strokeWidth={1.6} aria-hidden="true" /></span>
        <span className="home-opportunity-copy"><span className="home-opportunity-title">{label}</span><span className="opportunity-link__description">{description}</span></span>
        <ChevronRight size={14} strokeWidth={1.6} aria-hidden="true" className="home-opportunity-chevron" />
    </Link>;
}
