import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { CreateLink } from '../../pages/create/CreateLink';
import { useMayCreatePages } from '../../pages/create/useMayCreatePages';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { useWorldChild } from '../players';
import { useClubLocations, useWorldArea } from '../useWorldArea';
import { WorldLoading } from '../WorldLoading';
import { childLabel, clubsSource } from './clubSources';
import { useFinderCentre } from '../finder/finderContext';

/**
 * World › Clubs. The child a parent chose in the World bar decides what every card answers. `finder`: the same tab as
 * Parent Hub's club finder, measured from the person ("You") with the ways in on each club.
 */
export default function ClubsDirectory({ finder = false }: { finder?: boolean }) {
    const t = useWorldCopy();
    const { status } = useAuth();
    const mayCreate = useMayCreatePages();
    const [params] = useSearchParams();
    const following = params.get('view') === 'following';
    const { child, pending } = useWorldChild();
    const { area } = useWorldArea();
    const you = useFinderCentre();
    const lat = (finder ? you : area.centre)?.lat, lng = (finder ? you : area.centre)?.lng;
    const locations = useClubLocations();
    const source = useMemo(() => clubsSource({ following: following && !finder, child, centre: lat != null && lng != null ? { lat, lng } : null, locations, finder }), [following, child, lat, lng, locations, finder]);
    // A link for one child waits for the person's children, so the first search already fits that child.
    if (pending) return <WorldLoading />;
    const who = childLabel(child);
    return (
        <DirectoryPage
            title={t(following ? 'Clubs you follow' : 'Clubs')}
            subtitle={following ? t('The clubs you follow, everywhere') : who ? (area.anywhere ? t('For {who}, everywhere', { who }) : t('For {who}, near {city}', { who, city: area.city }))
                : area.anywhere ? t('Everywhere') : t('Near {city}', { city: area.city })}
            sources={[source]}
            actions={finder ? undefined : <>
                {status === 'authenticated' && <ButtonLink variant="ghost" to={following ? "/world/clubs" : "/world/clubs?view=following"}>{t(following ? 'All clubs' : 'Clubs you follow')}</ButtonLink>}
                {status === 'authenticated' && mayCreate && <CreateLink kind="CLUB" from="world-clubs" variant="primary">{t('Create a page')}</CreateLink>}
            </>}
        />
    );
}
