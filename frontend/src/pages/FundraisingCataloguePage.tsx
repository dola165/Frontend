import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ButtonLink, GkRoot, PageFrame } from '../design/primitives';
import { FundraisingCatalogue } from '../features/campaigns/FundraisingCatalogue';
import { fundraisingHeading, readFundraising } from '../features/campaigns/query';
import { fetchStoreClub } from '../features/store/api';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';

/** Every fundraiser (`/campaigns/all`): named after the choice made on the front, with the filter column beside the grid. */
export const FundraisingCataloguePage = () => {
    const [params] = useSearchParams();
    const query = readFundraising(params);
    const club = useWorldData(query.clubId ? `store-club:${query.clubId}` : null, signal => fetchStoreClub(query.clubId!, signal));
    const { title, hint } = fundraisingHeading(query, club.data?.name);
    return (
        <GkRoot className="gk-store gk-page">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label="Breadcrumb"><Link to="/campaigns">Fundraising</Link><span aria-hidden="true">/</span><span>{title}</span></nav>
                <header className="gk-store-heading">
                    <div className="gk-store-heading__text"><h1>{title}</h1>{hint && <p className="gk-store-heading__hint">{hint}</p>}</div>
                    <div className="gk-store-club__actions"><ButtonLink variant="primary" to="/campaigns/new"><Plus aria-hidden="true" />Start a fundraiser</ButtonLink></div>
                </header>
                <FundraisingCatalogue />
            </PageFrame>
        </GkRoot>
    );
};
