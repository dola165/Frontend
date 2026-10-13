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
    /**
     * The Map tab: a solid column stands on the map's left (`StageSide`), the map fills the screen under the World
     * bar, with no header row and nothing below, and it answers the wheel directly (the page does not scroll).
     */
    side?: boolean;
    /** The map's view after every move, the person's and the map's own (framing, a flight), so a list can follow what is on screen. */
    onView?: (bounds: MapBounds) => void;
    /** Fly to this pin; a new token flies again. While set, new pins never reframe the map. */ focus?: MapFocus;
    /** A new value frames every pin again ("Show all"). */ frame?: number;
    /** False while the page shows the chosen pin's result itself (its Browse row), so the map's own card stays hidden. */ card?: boolean;
    /** Places that are not results but give them context (the ground of the match being staffed): bright, never chosen. */ context?: WorldMapPoint[];
    /** A stated reach drawn as a dashed ring (the chosen referee's area). */ reach?: MapReach;
    /** Room kept free at the top for something floating over the map (the day strip), in pixels. */ insetTop?: number;
    /** The chosen match's away day: a dashed line from the travelling side to the ground. */ away?: MapLine;
}

/** A straight line between two places with its label at the middle ("≈ 10 km") and what the label means ("As the crow flies"). */
export interface MapLine { from: { lat: number; lng: number; name?: string }; to: { lat: number; lng: number }; label: string; title: string }

/** A circle of `km` around a place, as someone states it (approximate). */
export interface MapReach { lat: number; lng: number; km: number; label: string }

/** A flight to a pin. The token is unique for the whole visit (the map outlives every list), so a new one always flies. */
export interface MapFocus { id: string; token: string; /** Frame this box instead of flying close to the pin (a stated area around it). */ bounds?: MapBounds }

export interface StageValue {
    /** False outside World (tests, previews): the page's header and panel then render where they are. */ inStage: boolean;
    head: HTMLElement | null; panel: HTMLElement | null; /** The strip docked at the map's bottom left. */ dock: HTMLElement | null;
    /** The column standing on the map's left (the Map tab's search, kinds and filters). */ side: HTMLElement | null;
    /** The slot at the map's top left (the day strip). */ top: HTMLElement | null; setMap: (map: StageMap | null) => void;
    /** The map is open (not folded to a strip). */ mapOpen: boolean; toggleMap: () => void;
    /** The panel is folded to its header. */ panelFolded: boolean; togglePanel: () => void;
    /** The list column that can show the pane beside it, while one is on screen. */ paneHost: HTMLElement | null; setPaneHost: (host: HTMLElement | null) => void;
}

const outside: StageValue = { inStage: false, head: null, panel: null, dock: null, side: null, top: null, setMap: () => undefined, mapOpen: false, toggleMap: () => undefined, panelFolded: false, togglePanel: () => undefined,
    paneHost: null, setPaneHost: () => undefined };
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
