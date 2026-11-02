import { useContext, useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { LocateFixed, MapPin } from 'lucide-react';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { MapExtrasContext } from '../directory/mapExtras';
import { first, type NavProps } from '../directory/types';
import { keepPane } from '../peek/usePeek';
import { rememberDevice, useFinderCentre } from './finderContext';

/**
 * "You", where the finder measures from: the town given at sign-up, a place "You" was dragged to on the map, or the
 * device's position after "Use my location" (asked once; never stored, never in the address). The distance chosen in
 * the filters is drawn around it.
 */
export function FinderYou({ query }: NavProps) {
    const copy = useJourneyCopy();
    const set = useContext(MapExtrasContext);
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const centre = useFinderCentre();
    const [asking, setAsking] = useState(false), [refused, setRefused] = useState(false);
    const km = Number(first(query, 'km')) || 0;
    const write = (from: string | null) => setParams(current => {
        const next = new URLSearchParams(current);
        if (from) next.set('from', from); else next.delete('from');
        next.delete('selected');
        return next;
    }, { replace: true, preventScrollReset: true, state: keepPane(location.state) });
    const label = !centre ? copy('Somewhere near you', 'სადღაც ახლოს') : centre.source === 'device' ? copy('Your location', 'თქვენი ადგილმდებარეობა') : centre.source === 'chosen' ? copy('The place you chose', 'თქვენ მიერ არჩეული ადგილი')
        : centre.town ? copy(`Near ${centre.town}`, `${centre.town}-ის ახლოს`) : copy('Near you', 'ახლოს');
    const lat = centre?.lat, lng = centre?.lng;
    useEffect(() => {
        set(lat != null && lng != null ? {
            you: { lat, lng, label: copy('You', 'თქვენ'), onMove: (nextLat, nextLng) => write(`${nextLat.toFixed(3)},${nextLng.toFixed(3)}`) },
            reach: km ? { lat, lng, km, label: `${km} km` } : undefined,
        } : { you: undefined, reach: undefined });
        // `write` and `copy` are stable for what they do here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lat, lng, km, set]);
    useEffect(() => () => set({ you: undefined, reach: undefined }), [set]);
    const locate = () => {
        if (!navigator.geolocation) { setRefused(true); return; }
        setAsking(true); setRefused(false);
        navigator.geolocation.getCurrentPosition(position => {
            rememberDevice({ lat: position.coords.latitude, lng: position.coords.longitude });
            setAsking(false);
            write('device');
        }, () => { setAsking(false); setRefused(true); }, { maximumAge: 300000, timeout: 10000 });
    };
    return <div className="gk-finder-you" data-guide="near-you">
        <span className="gk-world-glass"><MapPin aria-hidden="true" />{label}{km ? ` · ${km} km` : ''}</span>
        <button type="button" className="gk-world-glass" onClick={locate} disabled={asking} data-guide="use-my-location"><LocateFixed aria-hidden="true" />{asking ? copy('Finding you…', 'გეძებთ…') : copy('Use my location', 'ჩემი ადგილმდებარეობა')}</button>
        {params.get('from') && <button type="button" className="gk-world-glass" onClick={() => write(null)}>{copy('Back to my town', 'ჩემს ქალაქში დაბრუნება')}</button>}
        {refused && <span className="gk-world-glass gk-finder-you__note" role="status">{copy('Location is off. Drag “You” on the map instead.', 'ადგილმდებარეობა გამორთულია. გადაიტანეთ „თქვენ“ რუკაზე.')}</span>}
    </div>;
}
