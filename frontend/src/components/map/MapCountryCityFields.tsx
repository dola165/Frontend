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
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Country</span>
                <select
                    value={selectedCountry?.name ?? ''}
                    onChange={(event) => {
                        onCountryChange(event.target.value);
                        onCityChange('');
                        setSuggestions([]);
                    }}
                    className="mt-2 h-10 w-full border border-slate-300 bg-transparent px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#3f7666] dark:border-white/15 dark:text-white"
                >
                    <option value="">Any country</option>
                    {ISO_COUNTRIES.map((option) => <option key={option.code} value={option.name}>{option.name}</option>)}
                </select>
                <span className="mt-1.5 block text-[10px] leading-4 text-slate-500 dark:text-slate-400">Or write a city/country in “Find a place” above.</span>
            </label>
            <div className="relative">
                <label htmlFor="advanced-map-city" className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">City</label>
                <div className={`mt-2 flex h-10 items-center gap-2 border-b border-slate-300 dark:border-white/15 ${selectedCountry ? '' : 'opacity-50'}`}>
                    <MapPin className="h-4 w-4 text-slate-400" />
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
                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-white"
                    />
                    {loading && <Loader2 className="h-4 w-4 animate-spin text-[#3f7666] dark:text-[#78a394]" />}
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
