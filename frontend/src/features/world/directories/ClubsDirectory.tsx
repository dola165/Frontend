import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { CreateMenu } from '../compose/CreateMenu';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { useWorldChild } from '../players';
import { useClubLocations, useWorldArea } from '../useWorldArea';
import { WorldLoading } from '../WorldLoading';
import { childLabel, clubsSource } from './clubSources';

/** World › Clubs. The child a parent chose in the World bar decides what every card answers. */
export default function ClubsDirectory() {
    const t = useWorldCopy();
    const { status } = useAuth();
    const [params] = useSearchParams();
    const following = params.get('view') === 'following';
    const { child, pending } = useWorldChild();
    const { area } = useWorldArea();
    const lat = area.centre?.lat, lng = area.centre?.lng;
    const locations = useClubLocations();
    const source = useMemo(() => clubsSource({ following, child, centre: lat != null && lng != null ? { lat, lng } : null, locations }), [following, child, lat, lng, locations]);
    // A link for one child waits for the person's children, so the first search already fits that child.
    if (pending) return <WorldLoading />;
    const who = childLabel(child);
    return (
        <DirectoryPage
            title={t(following ? 'Clubs you follow' : 'Clubs')}
            subtitle={following ? t('The clubs you follow, everywhere') : who ? (area.anywhere ? t('For {who}, everywhere', { who }) : t('For {who}, near {city}', { who, city: area.city }))
                : area.anywhere ? t('Everywhere') : t('Near {city}', { city: area.city })}
            sources={[source]}
            actions={<>
                {status === 'authenticated' && <ButtonLink variant="ghost" to={following ? "/world/clubs" : "/world/clubs?view=following"}>{t(following ? 'All clubs' : 'Clubs you follow')}</ButtonLink>}
                <CreateMenu face="create-page" />
            </>}
        />
    );
}
