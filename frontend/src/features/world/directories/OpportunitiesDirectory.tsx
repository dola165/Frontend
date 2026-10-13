import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { CreateMenu } from '../compose/CreateMenu';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { fetchClubLocationOptions } from '../../discovery/api';
import { useWorldChild } from '../players';
import { useWorldData } from '../useWorldData';
import { WorldLoading } from '../WorldLoading';
import { useWorldSession } from '../worldSession';
import { groupsSource, jobs, trials } from './opportunitySources';

/** World › Opportunities: jobs and volunteering, trials, and training groups taking players. */
export default function OpportunitiesDirectory() {
    const t = useWorldCopy();
    const { status } = useAuth();
    const { participants } = useWorldSession();
    const { remember, pending } = useWorldChild();
    const [params] = useSearchParams();
    // Clubs to pick from in Places to train, loaded only on that tab.
    const onGroups = (params.get('tab') ?? params.get('type')) === 'groups';
    const clubs = useWorldData(onGroups ? 'groups-clubs' : null, () => fetchClubLocationOptions());
    const clubOptions = useMemo(() => clubs.data && [...new Map(clubs.data.map(club => [club.clubId, { value: String(club.clubId), label: club.clubName }])).values()]
        .sort((a, b) => a.label.localeCompare(b.label)), [clubs.data]);
    // A parent's children (and their own player card) decide which groups fit; nothing loads signed out.
    const groups = useMemo(() => groupsSource(participants ?? [], remember, clubOptions), [participants, remember, clubOptions]);
    // A link for one child waits for the person's children, so the first search already fits that child.
    if (pending) return <WorldLoading />;
    return (
        <DirectoryPage
            title={t('Jobs & volunteering')}
            subtitle={t('Jobs, trials and places to train')}
            // `type` was this page's tab parameter; older links still open the right tab.
            tabAlias="type"
            sources={[jobs, trials, groups]}
            actions={<>
                {status === 'authenticated' && <ButtonLink variant="ghost" to="/admissions">{t('Joining football')}</ButtonLink>}
                <CreateMenu face="post-job" />
            </>}
        />
    );
}
