import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { canManageClubOperations } from '../../clubs/domain';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { useWorldChild } from '../players';
import { WorldLoading } from '../WorldLoading';
import { useWorldSession } from '../worldSession';
import { groupsSource, jobs, trials } from './opportunitySources';

/** World › Opportunities: jobs and volunteering, trials, and training groups taking players. */
export default function OpportunitiesDirectory() {
    const t = useWorldCopy();
    const { status } = useAuth();
    const { membership, participants } = useWorldSession();
    const { remember, pending } = useWorldChild();
    // A parent's children (and their own player card) decide which groups fit; nothing loads signed out.
    const groups = useMemo(() => groupsSource(participants ?? [], remember), [participants, remember]);
    const canPost = Boolean(membership?.clubId) && canManageClubOperations(membership?.myRole);
    // A link for one child waits for the person's children, so the first search already fits that child.
    if (pending) return <WorldLoading />;
    return (
        <DirectoryPage
            title={t('Opportunities')}
            subtitle={t('Jobs, volunteering, trials and places to train, posted by clubs and organisations.')}
            // `type` was this page's tab parameter; older links still open the right tab.
            tabAlias="type"
            sources={[jobs, trials, groups]}
            actions={<>
                {status === 'authenticated' && <ButtonLink variant="ghost" to="/admissions">{t('Joining football')}</ButtonLink>}
                {canPost && <ButtonLink variant="primary" to={`/clubs/${membership!.clubId}/workspace?tab=jobs`}><Plus aria-hidden="true" />{t('Post a role')}</ButtonLink>}
            </>}
        />
    );
}
