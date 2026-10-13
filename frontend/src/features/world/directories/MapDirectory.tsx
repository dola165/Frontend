import { useMemo } from 'react';
import { CreateMenu } from '../compose/CreateMenu';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { useWorldChild } from '../players';
import { useWorldArea } from '../useWorldArea';
import { WorldLoading } from '../WorldLoading';
import { clubsSource } from './clubSources';
import { events } from './matches/otherSources';
import { trials } from './opportunitySources';
import { allTournaments } from './tournaments/allSource';

/** Every published tournament, named plainly here: the Map's layers are kinds of thing, not lists of a tab. */
const tournaments = { ...allTournaments, tabLabel: 'Tournaments' };

/**
 * World › Map, the first thing World shows: the area's map, large, with what is around the person on it and listed
 * beside it. One line of pills says what is shown (clubs, events, trials, tournaments) and narrows it; the other
 * tabs are the same map specialised to one kind of thing.
 */
export default function MapDirectory() {
    const t = useWorldCopy();
    const { child, pending } = useWorldChild();
    const { area } = useWorldArea();
    const lat = area.centre?.lat, lng = area.centre?.lng;
    const clubs = useMemo(() => clubsSource({ child, centre: lat != null && lng != null ? { lat, lng } : null }), [child, lat, lng]);
    // A link for one child waits for the person's children, so the first search already fits that child.
    if (pending) return <WorldLoading />;
    return (
        <DirectoryPage
            title={t('Map')}
            subtitle={area.anywhere ? t('Everywhere') : t('Near {city}', { city: area.city })}
            sources={[clubs, events, trials, tournaments]}
            actions={<CreateMenu />}
        />
    );
}
