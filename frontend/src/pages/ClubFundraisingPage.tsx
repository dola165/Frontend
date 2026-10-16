import { Link, useLocation, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ButtonLink, EmptyNote, GkRoot, PageFrame } from '../design/primitives';
import { canManageClubOperations } from '../features/clubs/domain';
import { FundraisingCatalogue } from '../features/campaigns/FundraisingCatalogue';
import { fetchStoreClub } from '../features/store/api';
import { Crest } from '../features/world/Crest';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';

/** A club's fundraising: the catalogue fixed to the club, with its crest over it; inside the club page only the catalogue shows. Staff start a fundraiser from here. */
export const ClubFundraisingPage = () => {
    const { id } = useParams();
    const location = useLocation();
    const clubId = Number(id);
    const valid = Number.isSafeInteger(clubId) && clubId > 0;
    const embedded = !/\/campaigns$/.test(location.pathname);
    const club = useWorldData(valid ? `store-club:${clubId}` : null, signal => fetchStoreClub(clubId, signal));
    const canStart = valid && canManageClubOperations(club.data?.myRole);
    const frame = (children: React.ReactNode) => embedded ? <GkRoot className="gk-store gk-store--embedded" data-market="fundraising">{children}</GkRoot> : <GkRoot className="gk-store gk-page" data-market="fundraising"><PageFrame>{children}</PageFrame></GkRoot>;
    if (!valid) return frame(<EmptyNote title="This club could not be found." action={<ButtonLink to="/campaigns">Back to fundraising</ButtonLink>} />);
    const actions = <div className="gk-store-club__actions">
        {canStart && <ButtonLink variant="primary" to="/campaigns/new"><Plus aria-hidden="true" />Start a fundraiser</ButtonLink>}
        {!embedded && <ButtonLink variant="ghost" to={`/clubs/${clubId}`}>Club page</ButtonLink>}
    </div>;
    return frame(<>
        {embedded ? <div className="gk-store-club gk-store-club--embedded">{actions}</div> : <>
            <nav className="gk-store-crumbs" aria-label="Breadcrumb"><Link to="/campaigns">Fundraising</Link><span aria-hidden="true">/</span><span>{club.data?.name ?? 'Club'}</span></nav>
            <div className="gk-store-club">
                <Crest src={club.data?.logoUrl} name={club.data?.name ?? 'Club'} size={56} />
                <div className="gk-store-club__text"><h1>{club.data?.name ?? 'Club'} fundraising</h1><p className="gk-store-club__line">{[club.data?.cityName, 'Donations are taken on GoFundMe'].filter(Boolean).join(' · ')}</p></div>
                {actions}
            </div>
        </>}
        <FundraisingCatalogue fixedClubId={clubId} manage={canStart} />
    </>);
};
