import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../layout/BrandMark';

const categories = {
    store: { label: 'Store' },
    jobs: { label: 'Jobs & volunteering' },
    campaigns: { label: 'Fundraising' },
};

/** One of the three places (Store, Jobs & volunteering, Fundraising) as a row in Home's right rail. */
export function OpportunityLink({ kind, to, description }: { kind: keyof typeof categories; to: string; description: string }) {
    const { label } = categories[kind];
    return <Link to={to} className={`opportunity-link opportunity-link--${kind} home-opportunity-link`}>
        <span className="home-opportunity-icon"><BrandMark variant={kind} /></span>
        <span className="home-opportunity-copy"><span className="home-opportunity-title">{label}</span><span className="opportunity-link__description">{description}</span></span>
        <ChevronRight size={14} strokeWidth={1.6} aria-hidden="true" className="home-opportunity-chevron" />
    </Link>;
}
