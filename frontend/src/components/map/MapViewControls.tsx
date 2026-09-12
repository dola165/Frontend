import { useEffect, useState } from 'react';
import { Compass, RotateCcw, X } from 'lucide-react';
import { useMap } from 'react-map-gl/maplibre';

/** Quiet, opt-in discovery of the existing camera gestures, with keyboard/touch alternatives. */
export function MapViewControls() {
    const { current: map } = useMap();
    const [open, setOpen] = useState(false);
    const [pitch, setPitch] = useState(0);
    useEffect(() => {
        if (!map) return;
        const update = () => setPitch(Math.round(map.getPitch()));
        map.on('moveend', update);
        return () => { map.off('moveend', update); };
    }, [map]);
    const duration = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500;
    return <div className="atlas-view-controls">
        <button aria-label="Map view and gestures" aria-expanded={open} onClick={() => setOpen(!open)} title="Tilt, rotate and reset the map"><Compass size={15} />Map view</button>
        {open && <section aria-label="Map view controls">
            <header><strong>A different perspective</strong><button aria-label="Close map view controls" onClick={() => setOpen(false)}><X size={15} /></button></header>
            <p>Right-click and drag to tilt or rotate. On touch screens, use two fingers.</p>
            <small>Keyboard: focus the map, then Shift + arrow keys.</small>
            <label>Tilt <span>{pitch}°</span><input aria-label="Map tilt" type="range" min={0} max={60} value={pitch} onChange={e => { const value = Number(e.target.value); setPitch(value); map?.easeTo({ pitch: value, duration: 0 }); }} /></label>
            <div><button onClick={() => map?.easeTo({ bearing: (map.getBearing() ?? 0) - 30, duration: duration() })}>Rotate left</button><button onClick={() => map?.easeTo({ bearing: (map.getBearing() ?? 0) + 30, duration: duration() })}>Rotate right</button></div>
            <button className="atlas-view-reset" onClick={() => { setPitch(0); map?.easeTo({ bearing: 0, pitch: 0, duration: duration() }); }}><RotateCcw size={13} />Reset view</button>
        </section>}
    </div>;
}
