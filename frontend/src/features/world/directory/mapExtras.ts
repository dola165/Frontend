import { createContext, useContext, useEffect, useEffectEvent } from 'react';
import type { WorldMapPoint } from '../map/WorldMap';
import type { MapReach, MapYou } from '../stage/stageContext';

/**
 * What a part of the page adds to the map besides the results: places that give them context, and where the person
 * searches from ("You", with the distance around it). Each part sets only its own keys.
 */
export interface MapExtras { context?: WorldMapPoint[]; you?: MapYou; reach?: MapReach }
export const MapExtrasContext = createContext<(extras: MapExtras) => void>(() => undefined);

/** Puts places that give the results context on the map (the ground of the match being staffed) while mounted. */
export function useMapContextPoints(points: WorldMapPoint[] | undefined) {
    const set = useContext(MapExtrasContext);
    const key = points?.map(point => `${point.id}@${point.lat},${point.lng}`).join('|') ?? '';
    const apply = useEffectEvent(() => set({ context: points?.length ? points : undefined }));
    useEffect(() => { apply(); }, [key]);
    useEffect(() => () => set({ context: undefined }), [set]);
}
