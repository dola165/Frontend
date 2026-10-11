import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, RotateCw } from 'lucide-react';
import type { MapPageResult } from '../../../api/map';
import { plural, useWorldCopy } from '../copy';
import type { WorldMapPoint } from '../map/WorldMap';
import { useStageMap } from '../stage/stageContext';
import type { WorldData } from '../useWorldData';
import type { WorldArea } from '../useWorldArea';

/**
 * The overview's map: the clubs and venues around the area, with the person's field over its right side, and its
 * counts and the way to the full map floating on it in glass.
 */
export function useAroundMap(area: WorldArea, markers: WorldData<MapPageResult>) {
    const t = useWorldCopy();
    const [selected, setSelected] = useState<string>();
    const points = useMemo(() => {
        const all: WorldMapPoint[] = (markers.data?.content ?? []).map(marker => ({
            id: `${marker.entityType}:${marker.entityId}`, lat: marker.latitude, lng: marker.longitude, label: marker.title,
            meta: marker.entityType === 'CLUB' ? [marker.subtitle, marker.addressText].filter(Boolean).join(' · ') : [marker.subtitle, marker.fee].filter(Boolean).join(' · '),
            tone: marker.entityType === 'CLUB' ? 'club' : 'venue',
            to: marker.entityType === 'CLUB' ? `/clubs/${marker.clubId ?? marker.entityId}` : `/stadiums/${marker.entityId}`,
        }));
        // Clubs usually sit at a venue; draw them last so they are not hidden under it.
        return all.sort((a, b) => Number(a.tone === 'club') - Number(b.tone === 'club'));
    }, [markers.data]);
    const clubs = points.filter(point => point.tone === 'club').length;
    const count = markers.data ? t('{clubs} and {venues} within 25 km of {city}', { clubs: plural(clubs, 'club'), venues: plural(points.length - clubs, 'venue'), city: area.city }) : '';
    useStageMap({
        label: t('Clubs and venues around {city}', { city: area.city }), points, panel: true, summary: count, selectedId: selected, onSelect: setSelected,
        pills: <>
            {markers.error
                ? <><span role="alert" className="gk-world-glass">{t('Clubs and venues could not load.')}</span>
                    <button type="button" className="gk-world-glass" onClick={markers.retry}><RotateCw aria-hidden="true" />{t('Try again')}</button></>
                : <span role="status" className="gk-world-glass"><span className="gk-world-glass__live" aria-hidden="true" />{count || t('Finding clubs and venues…')}</span>}
            <Link className="gk-world-glass" to={`/world/map?region=${encodeURIComponent(area.city)}`}><Maximize2 aria-hidden="true" />{t('Open full map')}</Link>
        </>,
    });
}
