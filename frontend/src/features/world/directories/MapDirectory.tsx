import { useMemo } from 'react';
import { CreateMenu } from '../compose/CreateMenu';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import type { AnySource } from '../directory/types';
import { useWorldChild } from '../players';
import { useClubLocations, useWorldArea } from '../useWorldArea';
import { WorldLoading } from '../WorldLoading';
import { clubsSource } from './clubSources';
import { events as allEvents } from './matches/otherSources';
import { trials as allTrials } from './opportunitySources';
import { allTournaments } from './tournaments/allSource';

/** The Map's kinds, named plainly and coloured as their pins: kinds of thing, not lists of a tab. */
const events: AnySource = { ...allEvents, tone: 'event' };
const trials: AnySource = { ...allTrials, tone: 'trial' };
const tournaments: AnySource = { ...allTournaments, id: 'tournaments', tabLabel: 'Tournaments', tone: 'tournament' };

/**
 * World › Map, the first thing World shows: the area's map filling the screen, with a column on its left that holds
 * the search, the kinds (clubs, events, trials, tournaments, one at a time), the kind's filters as long lines and
 * what is on screen. The other tabs are the same map specialised to one kind of thing.
 */
export default function MapDirectory() {
    const t = useWorldCopy();
    const { child, pending } = useWorldChild();
    const { area } = useWorldArea();
    const lat = area.centre?.lat, lng = area.centre?.lng;
    const locations = useClubLocations();
    const clubs = useMemo<AnySource>(() => ({ ...clubsSource({ child, centre: lat != null && lng != null ? { lat, lng } : null, locations }), tone: 'club' }), [child, lat, lng, locations]);
    // A link for one child waits for the person's children, so the first search already fits that child.
    if (pending) return <WorldLoading />;
    return (
        <DirectoryPage
            layout="side"
            title={t('Map')}
            subtitle={area.anywhere ? t('Everywhere') : t('Near {city}', { city: area.city })}
            sources={[clubs, events, trials, tournaments]}
            actions={<CreateMenu />}
        />
    );
}
