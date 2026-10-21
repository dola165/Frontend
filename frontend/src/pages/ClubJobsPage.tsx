import { ct, useCommerceCopy } from '../features/store/copy';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ButtonLink, EmptyNote, GkRoot, PageFrame } from '../design/primitives';
import { canManageClubOperations } from '../features/clubs/domain';
import { JobsCatalogue } from '../features/jobs/JobsCatalogue';
import { fetchStoreClub } from '../features/store/api';
import { useAuth } from '../context/AuthContext';
import { Crest } from '../features/world/Crest';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';
import '../features/jobs/jobs.css';

/** A club's jobs: the catalogue fixed to the club with its crest over it; inside the club page only the catalogue shows. Staff post from here. */
export const ClubJobsPage = () => {
    useCommerceCopy();
    const { id } = useParams();
    const location = useLocation();
    const clubId = Number(id);
    const valid = Number.isSafeInteger(clubId) && clubId > 0;
    const embedded = !/\/jobs$/.test(location.pathname);
    const club = useWorldData(valid ? `store-club:${clubId}` : null, signal => fetchStoreClub(clubId, signal));
    const { status } = useAuth();
    const canPost = valid && status === 'authenticated' && canManageClubOperations(club.data?.myRole);
    const frame = (children: React.ReactNode) => embedded ? <GkRoot className="gk-store gk-store--embedded" data-market="jobs">{children}</GkRoot> : <GkRoot className="gk-store gk-page" data-market="jobs"><PageFrame>{children}</PageFrame></GkRoot>;
    if (!valid) return frame(<EmptyNote title={ct("This club could not be found.")} action={<ButtonLink to="/jobs">{ct("Back to jobs")}</ButtonLink>} />);
    const actions = <div className="gk-store-club__actions">
        {canPost && <ButtonLink variant="primary" to={`/jobs/new?club=${clubId}`}><Plus aria-hidden="true" />{ct("Post a job")}</ButtonLink>}
        {!embedded && <ButtonLink variant="ghost" to={`/clubs/${clubId}`}>{ct("Club page")}</ButtonLink>}
    </div>;
    return frame(<>
        {embedded ? <div className="gk-store-club gk-store-club--embedded">{actions}</div> : <>
            <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}><Link to="/jobs">{ct("Jobs & volunteering")}</Link><span aria-hidden="true">/</span><span>{club.data?.name ?? ct("Club")}</span></nav>
            <div className="gk-store-club">
                <Crest src={club.data?.logoUrl} name={club.data?.name ?? ct("Club")} size={56} />
                <div className="gk-store-club__text"><h1>{club.data?.name ?? ct("Club")}{ct(" jobs")}</h1><p className="gk-store-club__line">{[club.data?.cityName, ct("Jobs and volunteering at the club")].filter(Boolean).join(' · ')}</p></div>
                {actions}
            </div>
        </>}
        <JobsCatalogue fixedClubId={clubId} embedded={embedded} />
    </>);
};
