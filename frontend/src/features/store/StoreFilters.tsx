import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchStoreLocations, STORE_CATEGORIES, type StoreLocation } from './api';

import { categoryLabel } from './filterLabels';

export function StoreFilters({ clubId, params, currency, change, reset }: {
    clubId?: number; params: URLSearchParams; currency: string;
    change: (key: string, value: string) => void; reset: () => void;
}) {
    const [locations, setLocations] = useState<StoreLocation[]>([]);
    const [locationState, setLocationState] = useState('loading');
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        // Reset options when the storefront changes; an old club's options must not remain visible.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocations([]); setLocationState('loading');
        void fetchStoreLocations(clubId, controller.signal).then(data => {
            if (active) { setLocations(data); setLocationState('ready'); }
        }).catch(() => { if (active) setLocationState('error'); });
        return () => { active = false; controller.abort(); };
    }, [clubId, retry]);
    const country = params.get('country') ?? '';
    const city = params.get('city') ?? '';
    const countries = [...new Set(locations.map(item => item.country))];
    const cities = [...new Set(locations.filter(item => item.country === country).map(item => item.city).filter((value): value is string => !!value))];
    return <form className="store-filter-form" onSubmit={event => event.preventDefault()}>
        <div className="store-filter-title"><h2><SlidersHorizontal size={15}/>Filter products</h2><button type="button" onClick={reset}>Reset filters</button></div>
        <details open><summary>Category</summary><label className="store-field"><span className="sr-only">Category</span>
            <select value={params.get('category') ?? ''} onChange={e => change('category', e.target.value)}>
                <option value="">All categories</option>{STORE_CATEGORIES.map(category => <option key={category} value={category}>{categoryLabel(category)}</option>)}
            </select></label></details>
        <details open><summary>Price & currency</summary><div className="store-filter-fields">
            <label className="store-field">Currency<select value={currency} onChange={e => change('currency', e.target.value)}>{['GEL','EUR','GBP','USD'].map(c => <option key={c}>{c}</option>)}</select></label>
            <div className="store-price-range">{[['minPrice','Minimum price'],['maxPrice','Maximum price']].map(([key, label]) => <label key={key} className="store-field">{label}<input type="number" min="0" step="0.01" placeholder={key === 'minPrice' ? 'From' : 'To'} value={params.get(key) ?? ''} onChange={e => change(key, e.target.value)}/></label>)}</div>
        </div></details>
        <details open><summary>Size / variant</summary><label className="store-field"><span className="sr-only">Available size / variant</span><input maxLength={40} placeholder="e.g. M, XL, One size" value={params.get('variant') ?? ''} onChange={e => change('variant', e.target.value)}/></label><p className="store-hint">Matches variants currently in stock.</p></details>
        <details open={!!country || !!city}><summary>Club location</summary><div className="store-filter-fields">
            <p className="store-hint">Where the club is based, not its delivery area.</p>
            {locationState === 'error' && <p role="alert" className="store-hint">Locations could not load. <button type="button" className="underline" onClick={() => setRetry(n => n + 1)}>Retry locations</button></p>}
            <label className="store-field">Country<select disabled={locationState !== 'ready'} value={country} onChange={e => change('country', e.target.value)}>
                <option value="">{locationState === 'loading' ? 'Loading locations...' : 'All countries'}</option>
                {country && !countries.includes(country) && <option value={country}>{country} (no current products)</option>}
                {countries.map(c => <option key={c}>{c}</option>)}
            </select></label>
            <label className="store-field">City<select disabled={!country || locationState !== 'ready'} value={city} onChange={e => change('city', e.target.value)}>
                <option value="">{country ? 'All cities' : 'Choose a country first'}</option>
                {city && !cities.includes(city) && <option value={city}>{city} (no current products)</option>}
                {cities.map(c => <option key={c}>{c}</option>)}
            </select></label>
        </div></details>
    </form>;
}
