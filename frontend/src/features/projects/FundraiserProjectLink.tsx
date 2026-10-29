import { FolderKanban } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ButtonLink } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { projectPath } from './projectWords';
import { useFundraiserPlace } from './useProjects';

/**
 * Where the club's people run a fundraiser: its project. The public fundraiser never says which project it is; the
 * server answers that only to someone who sees the project, so the link shows for them alone.
 */
export function FundraiserProjectLink({ campaign }: { campaign: { id: number } }) {
    const copy = useJourneyCopy();
    const { isAuthenticated } = useAuth();
    const place = useFundraiserPlace(isAuthenticated ? campaign.id : null);
    if (!place.data?.projectId) return null;
    return <ButtonLink size="sm" variant="ghost" to={projectPath(place.data.projectId)}><FolderKanban aria-hidden="true" />{copy('Open its project', 'პროექტის გახსნა')}</ButtonLink>;
}
