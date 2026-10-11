import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import type { MapPageResult } from '../../../api/map';
import { plural, useWorldCopy } from '../copy';
import { ErrorNote } from '../directory/DirectoryResults';
import { WorldMap, type WorldMapPoint } from '../map/WorldMap';
import type { WorldData } from '../useWorldData';
import type { WorldArea } from '../useWorldArea';
import type { FieldId } from './fields';
import type { FieldProps } from './fields/fieldProps';
import { FIELD_VIEWS } from './fieldViews';

/** The width of the field floating over the map's right side on wide screens (front.css), plus its margin. */
const PANEL = 380 + 2 * 16;
const wide = '(min-width: 1100px)';
const subscribe = (change: () => void) => { const query = window.matchMedia(wide); query.addEventListener('change', change); return () => query.removeEventListener('change', change); };
const useWide = () => useSyncExternalStore(subscribe, () => window.matchMedia(wide).matches, () => true);

/**
 * The map of clubs and venues around the area, as big as the screen allows: the field beside it floats over its
 * right side, and its counts and the way to the full map float on it, so nothing frames it smaller.
 */
export function AroundMapBlock({ area, markers, panelOpen = true }: { area: WorldArea; markers: WorldData<MapPageResult>; /** The field over the map's right side is open (not folded). */ panelOpen?: boolean }) {
    const t = useWorldCopy();
    const floating = useWide();
    const points: WorldMapPoint[] = (markers.data?.content ?? []).map(marker => ({
        id: `${marker.entityType}:${marker.entityId}`, lat: marker.latitude, lng: marker.longitude, label: marker.title,
        meta: marker.entityType === 'CLUB' ? [marker.subtitle, marker.addressText].filter(Boolean).join(' · ') : [marker.subtitle, marker.fee].filter(Boolean).join(' · '),
        tone: marker.entityType === 'CLUB' ? 'club' : 'venue',
        to: marker.entityType === 'CLUB' ? `/clubs/${marker.clubId ?? marker.entityId}` : `/stadiums/${marker.entityId}`,
    }));
    // Clubs usually sit at a venue; draw them last so they are not hidden under it.
    points.sort((a, b) => Number(a.tone === 'club') - Number(b.tone === 'club'));
    const clubs = points.filter(point => point.tone === 'club').length;
    return (
        <section id="world-around" className="gk-world-front__map" aria-label={t('Around {city}', { city: area.city })}>
            {markers.error
                ? <ErrorNote message={markers.error} onRetry={markers.retry} />
                : <WorldMap label={t('Clubs and venues around {city}', { city: area.city })} points={points} insetRight={floating && panelOpen ? PANEL : 0}
                    overlay={<div className="gk-world-front__overlay">
                        <span className="gk-world-front__glass gk-world-front__stat" role="status">
                            <span className="gk-world-front__live" aria-hidden="true" />
                            {markers.data ? t('{clubs} and {venues} within 25 km of {city}', { clubs: plural(clubs, 'club'), venues: plural(points.length - clubs, 'venue'), city: area.city }) : t('Finding clubs and venues…')}
                        </span>
                        <Link className="gk-world-front__glass gk-world-front__expand" to={`/world/map?region=${encodeURIComponent(area.city)}`}><Maximize2 aria-hidden="true" />{t('Open full map')}</Link>
                    </div>} />}
        </section>
    );
}

/** One field of the front page, by id. */
export function Field({ id, ...props }: FieldProps & { id: FieldId }) {
    const View = FIELD_VIEWS[id];
    return <View {...props} />;
}
