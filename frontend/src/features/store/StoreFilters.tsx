import { useId, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button, Chip, Field } from '../../design/primitives';
import { useWorldData } from '../world/useWorldData';
import { fetchStoreLocations } from './api';
import { activeFilters, withoutFilter, type CatalogueQuery } from './query';
import { CATEGORIES, COLLECTIONS, CURRENCIES } from './labels';

/** One choice in a filter group, drawn as a radio: the dot, the words, a quiet count at the end. */
function Option({ pressed, onPress, children, count }: { pressed: boolean; onPress: () => void; children: ReactNode; count?: number }) {
    return <button type="button" className="gk-store-option" aria-pressed={pressed} onClick={onPress}><span className="gk-store-option__dot" aria-hidden="true" />{children}{count != null && <span className="gk-store-option__count">{count}</span>}</button>;
}
function Group({ title, children }: { title: string; children: ReactNode }) {
    return <fieldset className="gk-store-fgroup"><legend className="gk-store-fgroup__title">{title}</legend>{children}</fieldset>;
}
/** A text field that changes the search when the person is done typing (Enter or leaving the field). */
function Committed({ value, onCommit, ...rest }: { value: string; onCommit: (value: string) => void; id: string; placeholder?: string; type?: 'text' | 'number'; min?: string; step?: string; maxLength?: number; inputMode?: 'numeric' | 'text'; 'aria-label'?: string }) {
    const [text, setText] = useState(value);
    const [seen, setSeen] = useState(value);
    if (seen !== value) { setSeen(value); setText(value); }
    const commit = () => { if (text !== value) onCommit(text); };
    return <input className="gk-input" {...rest} value={text} onChange={event => setText(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} />;
}

/**
 * The catalogue's filter column, as Fanatics draws it: the selections first (each removable), then one group per
 * filter the data answers. The same column fills the phone's filter sheet.
 */
export function StoreFilters({ query, onChange, fixedClub }: { query: CatalogueQuery; onChange: (next: CatalogueQuery) => void; fixedClub: boolean }) {
    const id = useId();
    const set = (change: Partial<CatalogueQuery>) => onChange({ ...query, ...change, page: 0 });
    const selections = activeFilters(query, fixedClub);
    const own = query.seller === 'grasskickz';
    const locations = useWorldData(own ? null : `store-locations:${query.clubId ?? ''}`, signal => fetchStoreLocations(query.clubId, signal));
    const countries = [...new Set((locations.data ?? []).map(item => item.country))];
    const cities = [...new Set((locations.data ?? []).filter(item => item.country === query.country).map(item => item.city).filter((city): city is string => !!city))];
    return (
        <div className="gk-store-filters__body">
            <div className="gk-store-filters__head"><span>Filters</span>{selections.length > 0 && <Button variant="ghost" size="sm" onClick={() => onChange({ ...query, seller: '', clubId: fixedClub ? query.clubId : undefined, collection: '', category: '', country: '', city: '', variant: '', minPrice: '', maxPrice: '', currency: 'GEL', page: 0 })}>Clear all</Button>}</div>
            {selections.length > 0 && <div className="gk-store-selections" aria-label="Your selections">{selections.map(filter => <Chip key={filter.key} aria-label={`Remove ${filter.label}`} onClick={() => onChange(withoutFilter(query, filter.key))}>{filter.label}<X aria-hidden="true" /></Chip>)}</div>}
            {!fixedClub && <Group title="Seller">
                <Option pressed={!query.seller} onPress={() => set({ seller: '' })}>Everyone</Option>
                <Option pressed={own} onPress={() => set({ seller: 'grasskickz', country: '', city: '' })}>GrassKickZ</Option>
                <Option pressed={query.seller === 'clubs'} onPress={() => set({ seller: 'clubs', collection: '' })}>Club stores</Option>
            </Group>}
            {(own || query.collection) && <Group title="Equipment">
                <Option pressed={!query.collection} onPress={() => set({ collection: '' })}>All equipment</Option>
                {COLLECTIONS.map(collection => <Option key={collection.id} pressed={query.collection === collection.id} onPress={() => set({ collection: collection.id })}>{collection.label}</Option>)}
            </Group>}
            <Group title="Category">
                <Option pressed={!query.category} onPress={() => set({ category: '' })}>All categories</Option>
                {CATEGORIES.map(category => <Option key={category.id} pressed={query.category === category.id} onPress={() => set({ category: category.id })}>{category.label}</Option>)}
            </Group>
            {!own && !fixedClub && <Group title="Club location">
                <Field label="Country" htmlFor={`${id}-country`}>
                    <select id={`${id}-country`} className="gk-input" value={query.country} disabled={locations.loading} onChange={event => set({ country: event.target.value, city: '' })}>
                        <option value="">{locations.loading ? 'Loading…' : 'Any country'}</option>
                        {query.country && !countries.includes(query.country) && <option value={query.country}>{query.country}</option>}
                        {countries.map(country => <option key={country} value={country}>{country}</option>)}
                    </select>
                </Field>
                <Field label="City" htmlFor={`${id}-city`}>
                    <select id={`${id}-city`} className="gk-input" value={query.city} disabled={!query.country || locations.loading} onChange={event => set({ city: event.target.value })}>
                        <option value="">{query.country ? 'Any city' : 'Choose a country first'}</option>
                        {query.city && !cities.includes(query.city) && <option value={query.city}>{query.city}</option>}
                        {cities.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                </Field>
                {locations.error && <p className="gk-field__error" role="alert">Locations could not load. <button type="button" className="gk-section__action" onClick={locations.retry}>Retry</button></p>}
            </Group>}
            <Group title="Price">
                <div className="gk-store-fgroup__pair">
                    <Field label="From" htmlFor={`${id}-min`}><Committed id={`${id}-min`} type="number" min="0" step="1" inputMode="numeric" placeholder="0" value={query.minPrice} onCommit={value => set({ minPrice: value })} /></Field>
                    <Field label="To" htmlFor={`${id}-max`}><Committed id={`${id}-max`} type="number" min="0" step="1" inputMode="numeric" placeholder="Any" value={query.maxPrice} onCommit={value => set({ maxPrice: value })} /></Field>
                </div>
                <Field label="Currency" htmlFor={`${id}-currency`}><select id={`${id}-currency`} className="gk-input" value={query.currency} onChange={event => set({ currency: event.target.value })}>{CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select></Field>
            </Group>
            <Group title="Size">
                <Field label="Size or variant" hint="Only sizes in stock match" htmlFor={`${id}-size`}><Committed id={`${id}-size`} maxLength={40} placeholder="M, XL, size 5…" value={query.variant} onCommit={value => set({ variant: value })} /></Field>
            </Group>
        </div>
    );
}
