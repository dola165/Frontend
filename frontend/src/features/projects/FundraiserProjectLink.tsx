import { FolderKanban } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ButtonLink } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { projectPath } from './projectWords';
import { useMyProjects } from './useProjects';

/**
 * Where the club's people run a fundraiser: its project. Shown on a fundraiser to someone who works with its club
 * (`known` when the page already knows); the project page then decides what they may change.
 */
export function FundraiserProjectLink({ campaign, known }: { campaign: { clubId: number; projectId?: number | null }; known?: boolean }) {
    const copy = useJourneyCopy();
    const { isAuthenticated } = useAuth();
    const mine = useMyProjects(known === undefined && isAuthenticated && Boolean(campaign.projectId));
    const works = known ?? (Array.isArray(mine.data) && mine.data.some(entry => entry.club?.id === campaign.clubId));
    if (!works || !campaign.projectId) return null;
    return <ButtonLink size="sm" variant="ghost" to={projectPath(campaign.projectId)}><FolderKanban aria-hidden="true" />{copy('Open its project', 'პროექტის გახსნა')}</ButtonLink>;
}
