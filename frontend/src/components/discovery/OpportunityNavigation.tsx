import { ArrowLeft, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

export type OpportunitySection = 'store' | 'campaigns' | 'jobs';
const sections = {
    store: { all: 'Browse all stores', back: 'Back to club store', global: '/store' },
    campaigns: { all: 'Browse all campaigns', back: 'Back to club campaigns', global: '/campaigns' },
    jobs: { all: 'Browse all jobs & volunteering', back: 'Back to club jobs', global: '/jobs' },
};
export const OpportunityNavigation = ({ section, clubId, detail = false }: {
    section: OpportunitySection; clubId?: number | null; detail?: boolean;
}) => {
    const config = sections[section];
    const clubPath = section === 'jobs' ? `/clubs/${clubId}?tab=business&opportunity=jobs` : `/clubs/${clubId}/${section}`;
    return <nav className="opportunity-navigation" aria-label="Browse and return">
        {clubId && <Link className="opportunity-nav-button" to={detail ? clubPath : `/clubs/${clubId}?tab=business`}><ArrowLeft size={17} aria-hidden="true"/>{detail ? config.back : 'Back to club opportunities'}</Link>}
        <Link className="opportunity-nav-button" to={config.global}><Globe size={17} aria-hidden="true"/>{config.all}</Link>
    </nav>;
};
