import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { MapBounds } from '../../../components/map/areaSearch';
import type { WorldMapPoint } from '../map/WorldMap';

/** What a World page tells the shared map: its pins, how they link to its results, and what floats on it. */
export interface StageMap {
    label: string; points: WorldMapPoint[];
    selectedId?: string; onSelect?: (id?: string) => void; highlightId?: string; onHover?: (id?: string) => void;
    onMoveEnd?: (bounds: MapBounds) => void; cardActions?: (point: WorldMapPoint) => ReactNode;
    /** Glass pills at the bottom (counts, the full map); the stage adds its fold. */ pills?: ReactNode;
    /** Something floating at the top centre, such as "Search Rustavi". */ top?: ReactNode;
    /** What the folded strip says ("10 clubs"). */ summary?: string;
    /** The page puts a panel over the map's right side: the map keeps clear of it. */ panel?: boolean;
}

export interface StageValue {
    /** False outside World (tests, previews): the page's header and panel then render where they are. */ inStage: boolean;
    head: HTMLElement | null; panel: HTMLElement | null; setMap: (map: StageMap | null) => void;
    /** The map is open (not folded to a strip). */ mapOpen: boolean; toggleMap: () => void;
    /** The panel is folded to its header. */ panelFolded: boolean; togglePanel: () => void;
}

const outside: StageValue = { inStage: false, head: null, panel: null, setMap: () => undefined, mapOpen: false, toggleMap: () => undefined, panelFolded: false, togglePanel: () => undefined };
export const StageContext = createContext<StageValue>(outside);

/** The World stage around this page; outside World (tests, previews) nothing is drawn into it. */
export const useStage = () => useContext(StageContext);

/** Wide enough for the panel to float over the map (stage.css); narrower, it sits under the map. */
export const WIDE = '(min-width: 1100px)';

/** What the map shows for this page; it keeps showing it until the page changes it or leaves. */
export function useStageMap(map: StageMap) {
    const { setMap } = useStage();
    useEffect(() => { setMap(map); });
    useEffect(() => () => setMap(null), [setMap]);
}
