import { ct, useCommerceCopy } from '../features/store/copy';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ButtonLink, EmptyNote, GkRoot, PageFrame } from '../design/primitives';
import { isLeadershipRole } from '../features/clubs/domain';
import { projectsPath } from '../features/projects/projectWords';
import { useMyProjects } from '../features/projects/useProjects';
import { FundraisingCatalogue } from '../features/campaigns/FundraisingCatalogue';
import { fetchStoreClub } from '../features/store/api';
import { Crest } from '../features/world/Crest';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';

/**
 * A club's fundraising: the catalogue fixed to the club, with its crest over it; inside the club page only the catalogue
 * shows. Anyone on the club's staff starts one here: a Raise money project, whose fundraiser is its money part.
 */
export const ClubFundraisingPage = () => {
    useCommerceCopy();
    const { id } = useParams();
    const location = useLocation();
    const clubId = Number(id);
    const valid = Number.isSafeInteger(clubId) && clubId > 0;
    const embedded = !/\/campaigns$/.test(location.pathname);
    const club = useWorldData(valid ? `store-club:${clubId}` : null, signal => fetchStoreClub(clubId, signal));
    const { status } = useAuth();
    const mine = useMyProjects(valid && status === 'authenticated');
    const canStart = valid && status === 'authenticated' && (isLeadershipRole(club.data?.myRole) || (Array.isArray(mine.data) && mine.data.some(entry => entry.club?.id === clubId && entry.canStart)));
    const frame = (children: React.ReactNode) => embedded ? <GkRoot className="gk-store gk-store--embedded" data-market="fundraising">{children}</GkRoot> : <GkRoot className="gk-store gk-page" data-market="fundraising"><PageFrame>{children}</PageFrame></GkRoot>;
    if (!valid) return frame(<EmptyNote title={ct("This club could not be found.")} action={<ButtonLink to="/campaigns">{ct("Back to fundraising")}</ButtonLink>} />);
    const actions = <div className="gk-store-club__actions">
        {canStart && <ButtonLink variant="primary" to={projectsPath(clubId, 'projects', { new: 'RAISE_MONEY' })}><Plus aria-hidden="true" />{ct("Start a fundraiser")}</ButtonLink>}
        {!embedded && <ButtonLink variant="ghost" to={`/clubs/${clubId}`}>{ct("Club page")}</ButtonLink>}
    </div>;
    return frame(<>
        {embedded ? <div className="gk-store-club gk-store-club--embedded">{actions}</div> : <>
            <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}><Link to="/campaigns">{ct("Fundraising")}</Link><span aria-hidden="true">/</span><span>{club.data?.name ?? ct("Club")}</span></nav>
            <div className="gk-store-club">
                <Crest src={club.data?.logoUrl} name={club.data?.name ?? ct("Club")} size={56} />
                <div className="gk-store-club__text"><h1>{club.data?.name ?? ct("Club")}{ct(" fundraising")}</h1><p className="gk-store-club__line">{[club.data?.cityName, ct("Donations are taken on GoFundMe")].filter(Boolean).join(' · ')}</p></div>
                {actions}
            </div>
        </>}
        <FundraisingCatalogue fixedClubId={clubId} manage={canStart} />
    </>);
};
