import { useEffect } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmptyNote, PageFrame, Skeleton } from '../design/primitives';
import { fetchFundraiserPlace } from '../features/projects/api';
import { ProjectsPage as Projects } from '../features/projects/ProjectsPage';
import { projectPath, projectsPath } from '../features/projects/projectWords';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';

/** `/projects` and `/projects/:id`. A new account or session starts afresh. */
export default function ProjectsPage() {
    const { id } = useParams();
    const { isAuthenticated, sessionId } = useAuth();
    if (!isAuthenticated) return null;
    const projectId = Number(id);
    return <Projects key={`${sessionId}:${id ?? 'all'}`} projectId={id && Number.isSafeInteger(projectId) && projectId > 0 ? projectId : undefined} />;
}

/**
 * The old fundraiser screens land in Projects (step 4): starting one opens New project with Raise money chosen,
 * and a fundraiser's manager opens its project.
 */
export function FundraiserToProject() {
    const copy = useJourneyCopy();
    const { id } = useParams();
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const campaignId = Number(id);
    const known = Number.isSafeInteger(campaignId) && campaignId > 0;
    useEffect(() => {
        if (!known) return;
        const controller = new AbortController();
        fetchFundraiserPlace(campaignId, controller.signal).then(place => navigate(projectPath(place.projectId), { replace: true }))
            .catch(() => { if (!controller.signal.aborted) navigate('/projects', { replace: true }); });
        return () => controller.abort();
    }, [known, campaignId, navigate]);
    if (!id) {
        const club = Number(params.get('club') ?? params.get('clubId'));
        return <Navigate replace to={projectsPath(Number.isSafeInteger(club) && club > 0 ? club : null, 'projects', { new: 'RAISE_MONEY' })} />;
    }
    if (!known) return <PageFrame><EmptyNote title={copy('This fundraiser isn’t here', 'ეს შეგროვება აქ არ არის')} /></PageFrame>;
    return <PageFrame><div role="status" aria-label={copy('Opening the fundraiser’s project', 'შეგროვების პროექტი იხსნება')}><Skeleton height={120} /></div></PageFrame>;
}
