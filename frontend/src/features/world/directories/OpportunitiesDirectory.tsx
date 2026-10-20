import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { playerPath } from '../../parents/playerSelection';
import { CreateMenu } from '../compose/CreateMenu';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { fetchClubLocationOptions } from '../../discovery/api';
import { useWorldChild } from '../players';
import { useWorldData } from '../useWorldData';
import { WorldLoading } from '../WorldLoading';
import { useWorldSession } from '../worldSession';
import { firstName } from '../players';
import { groupsSource, guestTrials, jobs, trials } from './opportunitySources';

/**
 * World › Opportunities: jobs and volunteering, trials, and training groups taking players. One route, but the page
 * speaks the language of the list that is open: a parent looking for a child's group sees "Training groups for Nino"
 * and their joining requests, never "Post a job".
 */
export default function OpportunitiesDirectory() {
    const t = useWorldCopy();
    const { status } = useAuth();
    const { participants } = useWorldSession();
    const { remember, pending, child } = useWorldChild();
    const [params] = useSearchParams();
    // `type` was this page's tab parameter; jobs open when the address names no list.
    const tab = params.get('tab') ?? params.get('type') ?? 'jobs';
    // Clubs to pick from in Places to train, loaded only on that tab.
    const onGroups = tab === 'groups';
    const clubs = useWorldData(onGroups ? 'groups-clubs' : null, () => fetchClubLocationOptions());
    const clubOptions = useMemo(() => clubs.data && [...new Map(clubs.data.map(club => [club.clubId, { value: String(club.clubId), label: club.clubName }])).values()]
        .sort((a, b) => a.label.localeCompare(b.label)), [clubs.data]);
    // A parent's children (and their own player card) decide which groups fit; nothing loads signed out.
    const groups = useMemo(() => groupsSource(participants ?? [], remember, clubOptions), [participants, remember, clubOptions]);
    // A link for one child waits for the person's children, so the first search already fits that child.
    if (pending) return <WorldLoading />;
    const forChild = onGroups && child?.minor ? child : undefined;
    const title = onGroups ? (forChild ? t('Training groups for {name}', { name: firstName(forChild.name) }) : t('Training groups'))
        : tab === 'trials' ? t('Trials') : t('Jobs & volunteering');
    const joining = status === 'authenticated' && tab !== 'jobs'
        && <ButtonLink variant="ghost" to={playerPath('/admissions', forChild?.id)}>{t('Joining football')}</ButtonLink>;
    return (
        <DirectoryPage
            title={title}
            subtitle={t('Jobs, trials and places to train')}
            tabAlias="type"
            sources={[jobs, status === 'authenticated' ? trials : guestTrials, groups]}
            // The main action follows the list: a job for club staff, the family's joining requests for a group.
            actions={<>{joining}{!onGroups && <CreateMenu face={tab === 'jobs' ? 'post-job' : undefined} />}</>}
        />
    );
}
