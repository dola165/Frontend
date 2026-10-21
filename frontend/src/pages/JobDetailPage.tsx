import { ct, useCommerceCopy } from '../features/store/copy';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getOpportunityReturnTarget } from '../components/discovery/opportunityReturnContext';
import { ButtonLink, EmptyNote, GkRoot, PageFrame } from '../design/primitives';
import { JobDetail } from '../features/jobs/JobDetail';
import '../features/store/store.css';
import '../features/jobs/jobs.css';

/** A listing on its own page: the same detail as beside the list, with the way back to the results. */
export const JobDetailPage = () => {
    useCommerceCopy();
    const { id } = useParams();
    const location = useLocation();
    const jobId = Number(id);
    const valid = Number.isSafeInteger(jobId) && jobId > 0;
    const back = getOpportunityReturnTarget("jobs", location.state);
    return (
        <GkRoot className="gk-store gk-page" data-market="jobs">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}><Link to="/jobs">{ct("Jobs & volunteering")}</Link><span aria-hidden="true">/</span><span>{ct("Listing")}</span></nav>
                <div className="gk-store-club__actions" style={{ paddingTop: 12, paddingBottom: 16 }}>
                    <ButtonLink variant="ghost" size="sm" to={`${back.pathname}${back.search}`}><ArrowLeft aria-hidden="true" />{ct("Back to listings")}</ButtonLink>
                </div>
                {valid ? <JobDetail key={jobId} id={jobId} /> : <EmptyNote title={ct("This listing is unavailable")} action={<ButtonLink to="/jobs">{ct("Back to jobs")}</ButtonLink>}>{ct("The link does not point to a listing.")}</EmptyNote>}
            </PageFrame>
        </GkRoot>
    );
};
