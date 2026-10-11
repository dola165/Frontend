import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { useWorldChild } from '../players';
import { useWorldArea } from '../useWorldArea';
import { WorldLoading } from '../WorldLoading';
import { useWorldSession } from '../worldSession';
import { childLabel, clubsSource } from './clubSources';

/** World › Clubs. The child a parent chose in the World bar decides what every card answers. */
export default function ClubsDirectory() {
    const t = useWorldCopy();
    const { status } = useAuth();
    const { membership } = useWorldSession();
    const { child, pending } = useWorldChild();
    const { area } = useWorldArea();
    const lat = area.centre?.lat, lng = area.centre?.lng;
    const source = useMemo(() => clubsSource({ child, centre: lat != null && lng != null ? { lat, lng } : null, city: area.anywhere ? null : area.city }),
        [child, lat, lng, area.anywhere, area.city]);
    // A link for one child waits for the person's children, so the first search already fits that child.
    if (pending) return <WorldLoading />;
    const who = childLabel(child);
    return (
        <DirectoryPage
            title={t('Clubs')}
            subtitle={who ? (area.anywhere ? t('For {who}, everywhere', { who }) : t('For {who}, near {city}', { who, city: area.city }))
                : area.anywhere ? t('Everywhere') : t('Near {city}', { city: area.city })}
            sources={[source]}
            actions={status === 'authenticated' && <>
                <ButtonLink variant="ghost" to="/clubs/following">{t('Clubs you follow')}</ButtonLink>
                {membership?.canCreateClub && <ButtonLink to="/organizations/create?kind=CLUB"><Plus aria-hidden="true" />{t('Create a club')}</ButtonLink>}
            </>}
        />
    );
}
