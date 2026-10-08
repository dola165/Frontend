import { useEffect, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { geocodePlace, type GeocodeResult } from '../../api/map';
import { ISO_COUNTRIES, findIsoCountry } from '../../data/isoCountries';

interface MapCountryCityFieldsProps {
    country: string;
    city: string;
    onCountryChange: (value: string) => void;
    onCityChange: (value: string) => void;
}

export const MapCountryCityFields = ({ country, city, onCountryChange, onCityChange }: MapCountryCityFieldsProps) => {
    const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const selectedCountry = findIsoCountry(country);

    useEffect(() => {
        let active = true;
        if (!selectedCountry || city.trim().length < 2) {
            return () => { active = false; };
        }
        const timer = window.setTimeout(() => {
            setLoading(true);
            void geocodePlace(city.trim(), { countryCode: selectedCountry.code, type: 'CITY' })
                .then((results) => {
                    if (active) setSuggestions(results.filter((result) => result.type === 'CITY'));
                })
                .catch(() => {
                    if (active) setSuggestions([]);
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
        }, 280);
        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [city, selectedCountry]);

    const visibleSuggestions = selectedCountry && city.trim().length >= 2 ? suggestions : [];

    return (
        <div className="grid gap-4">
            <label>
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Country</span>
                <select
                    value={selectedCountry?.name ?? ''}
                    onChange={(event) => {
                        onCountryChange(event.target.value);
                        onCityChange('');
                        setSuggestions([]);
                    }}
                    className="mt-2 h-10 w-full border border-[color:var(--color-border)] bg-transparent px-3 text-sm font-semibold text-[color:var(--color-text)] outline-none focus:border-[var(--color-accent)] dark:border-[color:var(--color-border)]/15 dark:text-[color:var(--color-text)]"
                >
                    <option value="">Any country</option>
                    {ISO_COUNTRIES.map((option) => <option key={option.code} value={option.name}>{option.name}</option>)}
                </select>
                <span className="mt-1.5 block text-[10px] leading-4 text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Or write a city/country in “Find a place” above.</span>
            </label>
            <div className="relative">
                <label htmlFor="advanced-map-city" className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">City</label>
                <div className={`mt-2 flex h-10 items-center gap-2 border-b border-[color:var(--color-border)] dark:border-[color:var(--color-border)]/15 ${selectedCountry ? '' : 'opacity-50'}`}>
                    <MapPin className="h-4 w-4 text-[color:var(--color-muted)]" />
                    <input
                        id="advanced-map-city"
                        disabled={!selectedCountry}
                        value={city}
                        onFocus={() => setOpen(true)}
                        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                        onChange={(event) => {
                            onCityChange(event.target.value);
                            setOpen(true);
                        }}
                        placeholder={selectedCountry ? 'Start typing a city' : 'Choose a country first'}
                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[color:var(--color-text)] outline-none placeholder:text-[color:var(--color-muted)] disabled:cursor-not-allowed dark:text-[color:var(--color-text)]"
                    />
                    {loading && <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)] dark:text-[var(--color-secondary)]" />}
                </div>
                {open && city.trim().length >= 2 && !loading && (
                    <div className="map-simple-suggestions">
                        {visibleSuggestions.length > 0 ? visibleSuggestions.map((suggestion) => (
                            <button
                                key={`${suggestion.countryCode}-${suggestion.name}`}
                                type="button"
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    onCityChange(suggestion.cityName ?? suggestion.name);
                                    setOpen(false);
                                }}
                                className="map-simple-suggestion"
                            >
                                <span>{suggestion.name}</span><span className="text-[10px] text-[var(--text-muted)]">{suggestion.countryName}</span>
                            </button>
                        )) : <p className="px-3 py-3 text-xs text-[var(--text-secondary)]">No city found in {selectedCountry?.name}.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};
