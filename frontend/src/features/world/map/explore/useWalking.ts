import { useEffect, useRef, useState, type RefObject } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import { loadWalkingRoute } from '../../../../components/map/walkingRoutes';
import type { Coordinate, WalkingRoute } from '../../../../components/map/walkingGraph';
import { reducedMotion } from '../canvas/useMapTheme';

export interface WalkTarget { key: string; title: string; latitude: number; longitude: number }

/**
 * Your start point and walking directions to a place. Location is asked for only when you
 * press a location button, or used when the browser has already allowed it.
 */
export function useWalking(mapRef: RefObject<MapRef | null>, autoLocate: boolean) {
    const [origin, setOrigin] = useState<Coordinate | null>(null);
    const [target, setTarget] = useState<WalkTarget | null>(null);
    const [route, setRoute] = useState<WalkingRoute | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [picking, setPicking] = useState(false);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState('');
    const request = useRef<AbortController | null>(null);
    const locateRequest = useRef(0);
    useEffect(() => () => request.current?.abort(), []);

    // Use a location the browser already shares; never prompt on page load.
    useEffect(() => {
        if (!autoLocate || !navigator.permissions || !navigator.geolocation) return;
        let active = true;
        const ticket = locateRequest.current;
        void navigator.permissions.query({ name: 'geolocation' }).then(permission => {
            if (!active || permission.state !== 'granted') return;
            navigator.geolocation.getCurrentPosition(position => {
                if (active && ticket === locateRequest.current) setOrigin([position.coords.longitude, position.coords.latitude]);
            }, () => undefined, { maximumAge: 60000, timeout: 10000 });
        }).catch(() => undefined);
        return () => { active = false; };
    }, [autoLocate]);

    const calculate = async (from: Coordinate, to: WalkTarget | null = target) => {
        if (!to) return;
        request.current?.abort();
        const controller = new AbortController(); request.current = controller;
        setOrigin(from); setLoading(true); setError(''); setRoute(null); setPicking(false);
        try {
            const result = await loadWalkingRoute(from, [to.longitude, to.latitude], controller.signal);
            if (controller.signal.aborted) return;
            setRoute(result);
            const path = [from, ...result.coordinates, [to.longitude, to.latitude]];
            const lngs = path.map(point => point[0]), lats = path.map(point => point[1]);
            mapRef.current?.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 72, maxZoom: 16, duration: reducedMotion() ? 0 : 500 });
        } catch (cause) {
            if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Walking route unavailable.');
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    };
    const locate = (then?: (point: Coordinate) => void) => {
        if (!navigator.geolocation) { setLocationError('Location is unavailable here. Choose a point on the map instead.'); return; }
        const ticket = ++locateRequest.current;
        setLocating(true); setLocationError('');
        navigator.geolocation.getCurrentPosition(position => {
            if (ticket !== locateRequest.current) return;
            const point: Coordinate = [position.coords.longitude, position.coords.latitude];
            setLocating(false); setOrigin(point); then?.(point);
        }, failure => {
            if (ticket !== locateRequest.current) return;
            setLocating(false);
            setLocationError(failure.code === 1 ? 'Location access is off. Allow it in your browser, or choose a point on the map.' : 'Your location could not be found. Try again or choose a point on the map.');
        }, { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true });
    };
    const stop = () => { request.current?.abort(); setTarget(null); setRoute(null); setPicking(false); setLoading(false); setError(''); };

    return {
        origin, target, route, loading, error, picking, locating, locationError,
        start: (to: WalkTarget) => { request.current?.abort(); setTarget(to); setRoute(null); setError(''); setLoading(false); if (origin) void calculate(origin, to); else setPicking(true); },
        stop,
        locate,
        locateAndWalk: () => locate(point => { if (target) void calculate(point); }),
        beginPicking: () => { locateRequest.current++; setLocating(false); request.current?.abort(); setLoading(false); setError(''); setPicking(true); },
        cancelPicking: () => setPicking(false),
        chooseOrigin: (point: Coordinate) => { locateRequest.current++; setLocating(false); setLocationError(''); setOrigin(point); setPicking(false); if (target) void calculate(point); },
    };
}
export type Walking = ReturnType<typeof useWalking>;
