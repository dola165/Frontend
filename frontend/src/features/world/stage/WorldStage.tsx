import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Map as MapIcon } from 'lucide-react';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { useWorldCopy } from '../copy';
import { useMapFold } from '../directory/mapFold';
import { WorldMap, type WorldMapPoint } from '../map/WorldMap';
import { useMediaQuery } from '../useMediaQuery';
import { MapBoundary } from './MapBoundary';
import { StageContext, useStage, WIDE, type StageMap } from './stageContext';
import './stage.css';

/** The width of the panel floating over the map's right side on wide screens (stage.css), plus its margin. */
const PANEL = 380 + 2 * 16;
const NO_POINTS: WorldMapPoint[] = [];

/**
 * The frame every World page shares: its header row, the map of the area (the overview's, kept alive between tabs
 * so it never reloads) with a glass panel over its right side, and the page itself below. A page fills the header
 * and the panel and tells the map what to show; moving between tabs changes only that, so nothing jumps.
 */
export function WorldStage({ children }: { children: ReactNode }) {
    const t = useWorldCopy();
    const { pathname } = useLocation();
    const [head, setHead] = useState<HTMLElement | null>(null);
    const [panel, setPanel] = useState<HTMLElement | null>(null);
    const [map, setMap] = useState<StageMap | null>(null);
    const fold = useMapFold();
    const [params, setParams] = useSearchParams();
    const panelFolded = params.get('panel') === 'folded';
    const togglePanel = () => setParams(current => {
        const next = new URLSearchParams(current);
        if (panelFolded) next.delete('panel'); else next.set('panel', 'folded');
        return next;
    }, { replace: true, preventScrollReset: true });
    const wide = useMediaQuery(WIDE, true);
    const floating = wide && Boolean(map?.panel) && !panelFolded;
    // Folding swaps one button for another; focus follows to the one that undoes it.
    const toggled = useRef(false);
    const foldRef = useRef<HTMLButtonElement>(null), showRef = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (toggled.current) { toggled.current = false; (fold.open ? foldRef : showRef).current?.focus(); } }, [fold.open]);
    // The value pages read stays the same object until something they show changes, so a page telling the map what
    // to show never re-renders itself through it.
    const toggles = useRef({ map: fold.toggle, panel: togglePanel });
    useEffect(() => { toggles.current = { map: fold.toggle, panel: togglePanel }; });
    const toggleMap = useCallback(() => { toggled.current = true; toggles.current.map(); }, []);
    const togglePanelStable = useCallback(() => toggles.current.panel(), []);
    const value = useMemo(() => ({ inStage: true, head, panel, setMap, mapOpen: fold.open, toggleMap, panelFolded, togglePanel: togglePanelStable }),
        [head, panel, fold.open, toggleMap, panelFolded, togglePanelStable]);
    return (
        <StageContext.Provider value={value}>
            <div className="gk-world-stage">
                <div className="gk-world-stage__head" ref={setHead} />
                <div className="gk-world-stage__lead" data-folded={fold.open ? undefined : true} data-panel={map?.panel ? true : undefined}>
                    {fold.open
                        ? <div className="gk-world-stage__map"><MapBoundary resetKey={pathname} fallback={retry => (
                            <div className="gk-world-map gk-world-map--hero"><div className="gk-world-map__canvas">
                                <p className="gk-world-map__note" role="alert">{t('Map unavailable')} <button type="button" className="gk-browse__retry" onClick={retry}>{t('Try again')}</button></p>
                            </div></div>)}>
                            <WorldMap variant="hero" label={map?.label ?? t('Map')} points={map?.points ?? NO_POINTS}
                                selectedId={map?.selectedId} onSelect={map?.onSelect} highlightId={map?.highlightId} onHover={map?.onHover}
                                onMoveEnd={map?.onMoveEnd} cardActions={map?.cardActions} insetRight={floating ? PANEL : 0}
                                focus={map?.focus} frame={map?.frame} card={map?.card ?? true}
                                overlay={<>{map?.top}<div className="gk-world-map__overlay">
                                    {map?.pills}
                                    <button ref={foldRef} type="button" className="gk-world-glass" onClick={toggleMap} aria-expanded><ChevronUp aria-hidden="true" />{t('Fold map')}</button>
                                </div></>} />
                        </MapBoundary></div>
                        : <div className="gk-world-mapstrip">
                            <MapIcon aria-hidden="true" />
                            <span className="gk-world-grow">{t('Map')}{map?.summary ? ` · ${map.summary}` : ''}</span>
                            <button ref={showRef} type="button" className="gk-world-mapstrip__toggle" onClick={toggleMap} aria-expanded={false}><ChevronDown aria-hidden="true" />{t('Show map')}</button>
                        </div>}
                    <div className="gk-world-stage__panel" ref={setPanel} data-folded={panelFolded || undefined} />
                </div>
                {/* The page itself: it fades in when the tab changes, while the frame above stays put. A page that
                    fails shows its error here, and the next page starts clean. */}
                <div className="gk-world-stage__body" key={pathname}><ErrorBoundary>{children}</ErrorBoundary></div>
            </div>
        </StageContext.Provider>
    );
}

/** The page's header row: title, search, filters and actions, above the map. Outside World it renders in place. */
export function StageHead({ children }: { children: ReactNode }) {
    const { inStage, head } = useStage();
    if (!inStage) return <>{children}</>;
    return head ? createPortal(children, head) : null;
}

/** The glass panel over the map's right side (below the map on narrow screens). Outside World it renders in place. */
export function StagePanel({ children }: { children: ReactNode }) {
    const { inStage, panel } = useStage();
    if (!inStage) return <>{children}</>;
    return panel ? createPortal(children, panel) : null;
}
