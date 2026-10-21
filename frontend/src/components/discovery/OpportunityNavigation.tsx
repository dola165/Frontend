import { ArrowLeft, Globe } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getOpportunityReturnTarget, type OpportunitySection } from './opportunityReturnContext';

const sections = {
    store: { all: 'Browse all stores', back: 'Back to store', global: '/store' },
    campaigns: { all: 'Browse all campaigns', back: 'Back to campaigns', global: '/campaigns' },
    jobs: { all: 'Browse all roles', back: 'Back to roles', global: '/jobs' },
};

export const OpportunityNavigation = ({ section, clubId, detail = false }: {
    section: OpportunitySection; clubId?: number | null; detail?: boolean;
}) => {
    const location = useLocation();
    const config = sections[section];
    const returnTarget = getOpportunityReturnTarget(section, location.state, clubId);
    return <nav className="opportunity-navigation" aria-label="Browse and return">
        {(detail || clubId) && <Link className="opportunity-nav-button" to={detail ? returnTarget : `/clubs/${clubId}?tab=business`}><ArrowLeft size={17} aria-hidden="true"/>{detail ? config.back : 'Back to club opportunities'}</Link>}
        <Link className="opportunity-nav-button" to={config.global}><Globe size={17} aria-hidden="true"/>{config.all}</Link>
    </nav>;
};
