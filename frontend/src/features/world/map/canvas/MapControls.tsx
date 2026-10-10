import { useEffect, useId, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import { Expand, Layers3, LocateFixed, Loader2, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button, ButtonLink } from '../../../../design/primitives';
import { Segmented } from '../../../../design/Tabs';
import { usePersistedState } from '../../../../utils/usePersistedState';
import { reducedMotion } from './useMapTheme';
import './canvas.css';

type Projection = 'flat' | 'globe';

/** Zoom, your location and the map view (globe, tilt, rotation), as keyboard-reachable buttons. A contained map can link to the full one. */
export function MapControls({ onLocate, locating = false, showView = true, fullMap }: { onLocate?: () => void; locating?: boolean; showView?: boolean; fullMap?: string }) {
    const { current: map } = useMap();
    const [open, setOpen] = useState(false);
    const [projection, setProjection] = usePersistedState<Projection>('map.projection', 'flat');
    const [pitch, setPitch] = useState(0);
    const panelId = useId();
    const duration = () => (reducedMotion() ? 0 : 400);
    useEffect(() => {
        if (!map) return;
        const raw = map.getMap();
        const apply = () => { try { raw.setProjection({ type: projection === 'globe' ? 'globe' : 'mercator' }); } catch { /* Projection unsupported: stay flat. */ } };
        if (raw.isStyleLoaded()) apply();
        raw.on('style.load', apply);
        const track = () => setPitch(Math.round(raw.getPitch()));
        raw.on('moveend', track);
        return () => { raw.off('style.load', apply); raw.off('moveend', track); };
    }, [map, projection]);
    return (
        <div className="gk-map-controls">
            <div className="gk-map-controls__group" role="group" aria-label="Zoom">
                <Button iconOnly variant="secondary" aria-label="Zoom in" onClick={() => map?.zoomIn({ duration: duration() })}><Plus aria-hidden="true" /></Button>
                <Button iconOnly variant="secondary" aria-label="Zoom out" onClick={() => map?.zoomOut({ duration: duration() })}><Minus aria-hidden="true" /></Button>
            </div>
            {onLocate && (
                <Button iconOnly variant="secondary" aria-label={locating ? 'Finding your location' : 'Use my location'} title="Use my location" onClick={onLocate} disabled={locating}>
                    {locating ? <Loader2 className="gk-spin" aria-hidden="true" /> : <LocateFixed aria-hidden="true" />}
                </Button>
            )}
            {fullMap && <ButtonLink iconOnly variant="secondary" to={fullMap} aria-label="Open the full map" title="Open the full map"><Expand aria-hidden="true" /></ButtonLink>}
            {showView && (
                <div className="gk-map-controls__view">
                    <Button iconOnly variant="secondary" aria-label="Map view" title="Map view" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}><Layers3 aria-hidden="true" /></Button>
                    {open && (
                        <section id={panelId} className="gk-map-popover" aria-label="Map view">
                            <Segmented label="Projection" value={projection} onChange={setProjection} items={[{ id: 'flat', label: 'Flat' }, { id: 'globe', label: 'Globe' }]} />
                            {projection === 'globe' && <p className="gk-faint">The globe uses more battery and data on phones.</p>}
                            <label className="gk-map-popover__range">
                                <span>Tilt <span className="gk-num">{pitch}°</span></span>
                                <input type="range" min={0} max={60} value={pitch} onChange={event => { const value = Number(event.target.value); setPitch(value); map?.easeTo({ pitch: value, duration: 0 }); }} />
                            </label>
                            <div className="gk-row">
                                <Button size="sm" onClick={() => map?.easeTo({ bearing: (map.getBearing() ?? 0) - 30, duration: duration() })}>Rotate left</Button>
                                <Button size="sm" onClick={() => map?.easeTo({ bearing: (map.getBearing() ?? 0) + 30, duration: duration() })}>Rotate right</Button>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => { setPitch(0); map?.easeTo({ bearing: 0, pitch: 0, duration: duration() }); }}><RotateCcw aria-hidden="true" />Reset view</Button>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
