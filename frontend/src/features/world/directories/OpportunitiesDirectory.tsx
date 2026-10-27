import { WorldRedirect } from '../WorldRedirect';
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
import { groupsSource, guestTrials, trials } from './opportunitySources';

/**
 * World › Opportunities: trials and training groups taking players. One route, but the page
 * speaks the language of the list that is open: a parent looking for a child's group sees "Training groups for Nino"
 * and their joining requests, never "Post a job".
 */
export default function OpportunitiesDirectory() {
    const t = useWorldCopy();
    const { status } = useAuth();
    const { participants } = useWorldSession();
    const { remember, pending, child } = useWorldChild();
    const [params] = useSearchParams();
    // `type` was this page's tab parameter; trials open when the address names no list.
    const tab = params.get('tab') ?? params.get('type') ?? 'trials';
    // Clubs to pick from in Places to train, loaded only on that tab.
    const onGroups = tab === 'groups';
    const clubs = useWorldData(onGroups ? 'groups-clubs' : null, () => fetchClubLocationOptions());
    const clubOptions = useMemo(() => clubs.data && [...new Map(clubs.data.map(club => [club.clubId, { value: String(club.clubId), label: club.clubName }])).values()]
        .sort((a, b) => a.label.localeCompare(b.label)), [clubs.data]);
    // A parent's children (and their own player card) decide which groups fit; nothing loads signed out.
    const groups = useMemo(() => groupsSource(participants ?? [], remember, clubOptions), [participants, remember, clubOptions]);
    // A link for one child waits for the person's children, so the first search already fits that child.
    if (pending) return <WorldLoading />;
    if (tab === 'jobs') return <WorldRedirect to="/jobs" rename={{ q: 'query', engagement: 'terms' }} />;
    const forChild = onGroups && child?.minor ? child : undefined;
    const title = onGroups ? (forChild ? t('Training groups for {name}', { name: firstName(forChild.name) }) : t('Training groups'))
        : t('Trials');
    const joining = status === 'authenticated'
        && <ButtonLink variant="ghost" to={playerPath('/admissions', forChild?.id)}>{t('Joining football')}</ButtonLink>;
    return (
        <DirectoryPage
            title={title}
            subtitle={t('Trials and places to train')}
            tabAlias="type"
            sources={[status === 'authenticated' ? trials : guestTrials, groups]}
            // Joining requests and a link to jobs stay beside the list.
            actions={<>{joining}<ButtonLink variant="ghost" to="/jobs">{t('Jobs & volunteering')}</ButtonLink>{!onGroups && <CreateMenu />}</>}
        />
    );
}
