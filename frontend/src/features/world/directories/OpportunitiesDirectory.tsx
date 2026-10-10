import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { canManageClubOperations } from '../../clubs/domain';
import { fetchAdmissionHome } from '../../admissions/api';
import { DirectoryPage } from '../directory/DirectoryPage';
import { useWorldData } from '../useWorldData';
import { useWorldSession } from '../worldSession';
import { groupsSource, jobs, trials } from './opportunitySources';

/** World › Opportunities: jobs and volunteering, trials, and training groups taking players. */
export default function OpportunitiesDirectory() {
    const { status, sessionId } = useAuth();
    const { membership } = useWorldSession();
    // A parent's children (and their own player card) decide which groups fit; nothing loads signed out.
    const home = useWorldData(status === 'authenticated' ? `admission-home:${sessionId}` : null, signal => fetchAdmissionHome(sessionId, signal));
    const participants = home.data?.participants;
    const groups = useMemo(() => groupsSource(participants ?? []), [participants]);
    const canPost = Boolean(membership?.clubId) && canManageClubOperations(membership?.myRole);
    return (
        <DirectoryPage
            title="Opportunities"
            subtitle="Jobs, volunteering, trials and places to train, posted by clubs and organisations."
            tabParam="type"
            sources={[jobs, trials, groups]}
            actions={<>
                {status === 'authenticated' && <ButtonLink variant="ghost" to="/admissions">Joining football</ButtonLink>}
                {canPost && <ButtonLink variant="primary" to={`/clubs/${membership!.clubId}/workspace?tab=jobs`}><Plus aria-hidden="true" />Post a role</ButtonLink>}
            </>}
        />
    );
}
