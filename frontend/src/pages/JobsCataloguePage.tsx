import { ct, useCommerceCopy } from '../features/store/copy';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ButtonLink, GkRoot, PageFrame } from '../design/primitives';
import { JobsCatalogue } from '../features/jobs/JobsCatalogue';
import { jobsHeading, readJobs } from '../features/jobs/query';
import { fetchStoreClub } from '../features/store/api';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';
import '../features/jobs/jobs.css';

/** Every listing (`/jobs/all`): named after the choice made on the front, the list on the left and the listing open beside it. */
export const JobsCataloguePage = () => {
    useCommerceCopy();
    const [params] = useSearchParams();
    const query = readJobs(params);
    const club = useWorldData(query.clubId ? `store-club:${query.clubId}` : null, signal => fetchStoreClub(query.clubId!, signal));
    const { title, hint } = jobsHeading(query, club.data?.name);
    return (
        <GkRoot className="gk-store gk-page" data-market="jobs">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}><Link to="/jobs">{ct("Jobs & volunteering")}</Link><span aria-hidden="true">/</span><span>{title}</span></nav>
                <header className="gk-store-heading">
                    <div className="gk-store-heading__text"><h1>{title}</h1>{hint && <p className="gk-store-heading__hint">{hint}</p>}</div>
                    <div className="gk-store-club__actions"><ButtonLink variant="primary" to="/jobs/new"><Plus aria-hidden="true" />{ct("Post a job")}</ButtonLink></div>
                </header>
                <JobsCatalogue />
            </PageFrame>
        </GkRoot>
    );
};
