import { useMemo } from 'react';
import { PlacesLayer, type MapPlace } from '../canvas/PlacesLayer';
import { WalkLayer } from '../canvas/WalkLayer';
import type { PlacePalette } from '../canvas/useMapTheme';
import type { Explore } from './useExplore';

/** What explore draws on the map: the places, the selected one's label, and any walk. */
export function ExploreLayers({ explore, palette }: { explore: Explore; palette: PlacePalette }) {
    const { discovery, walking } = explore;
    const places = useMemo<MapPlace[]>(() => discovery.records.flatMap(record => record.latitude != null && record.longitude != null
        ? [{ key: record.key, latitude: record.latitude, longitude: record.longitude, title: record.title, tone: record.tone }] : []), [discovery.records]);
    const target = walking.target;
    return (
        <>
            <PlacesLayer places={places} palette={palette} selectedKey={explore.placeKey} hoveredKey={explore.hovered}
                interactive={!walking.picking} onHover={explore.setHovered}
                onSelect={key => { const record = discovery.records.find(item => item.key === key); if (record) explore.open(record, true); }} />
            <WalkLayer origin={walking.origin} destination={target ? [target.longitude, target.latitude] : null} route={walking.route} palette={palette} onOriginChange={walking.chooseOrigin} />
        </>
    );
}
