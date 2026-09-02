import { useMemo, useState } from 'react';
import { ChevronDown, MapPin, RotateCcw } from 'lucide-react';
import { EMPTY_CLUB_REGION, type ClubLocationItem, type ClubRegionSelection } from './clubLocationTypes';

interface ClubLocationFilterProps {
    items: ClubLocationItem[];
    value: ClubRegionSelection;
    onChange: (value: ClubRegionSelection) => void;
    label?: string;
    defaultOpen?: boolean;
    className?: string;
}

export const ClubLocationFilter = ({
    items,
    value,
    onChange,
    label = 'Filter by club',
    defaultOpen = false,
    className = '',
}: ClubLocationFilterProps) => {
    const [open, setOpen] = useState(defaultOpen);

    const locationTree = useMemo(() => {
        const map = new Map<string, Map<string, Map<number, string>>>();
        for (const item of items) {
            if (!item.countryName) continue;
            const country = item.countryName;
            const city = item.cityName ?? '';
            if (!map.has(country)) map.set(country, new Map());
            const cities = map.get(country)!;
            if (!cities.has(city)) cities.set(city, new Map());
            cities.get(city)!.set(item.clubId, item.clubName);
        }
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([country, cities]) => ({
                country,
                cities: Array.from(cities.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([city, clubs]) => ({
                        city,
                        clubs: Array.from(clubs.entries())
                            .sort((a, b) => a[1].localeCompare(b[1]))
                            .map(([id, name]) => ({ id, name })),
                    })),
            }));
    }, [items]);

    const clubs = useMemo(() => locationTree.flatMap((country) => {
        if (value.country && country.country !== value.country) return [];
        return country.cities.flatMap((city) => {
            if (value.city && city.city !== value.city) return [];
            return city.clubs;
        });
    }), [locationTree, value.city, value.country]);

    const active = value.country != null || value.city != null || value.clubId != null;
    const inputClass = 'h-11 w-full rounded-lg border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-page)] px-3 text-sm font-medium text-[color:var(--text-primary)] outline-none transition focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/15 disabled:cursor-not-allowed disabled:opacity-45';
    const selectedClub = clubs.find((club) => club.id === value.clubId)?.name;
    const summary = selectedClub ?? value.city ?? value.country ?? 'Any location';

    return (
        <div className={`w-full rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface)] p-3 ${className}`.trim()}>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left transition-colors ${
                    open || active
                        ? 'border-[#16a34a]/45 bg-[#16a34a]/10 text-[#168a4b] dark:text-[#6ee7a0]'
                        : 'border-[color:var(--theme-border)] bg-[color:var(--theme-page)] text-[color:var(--text-primary)] hover:border-[color:var(--theme-border-strong)]'
                }`}
            >
                <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#16a34a]/12 text-[#168a4b] dark:text-[#6ee7a0]">
                        <MapPin className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                        <span className="block text-[11px] font-bold uppercase tracking-[0.12em]">{label}</span>
                        <span className="mt-0.5 block truncate text-xs font-medium text-[color:var(--text-secondary)]">{summary}</span>
                    </span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="mt-3 grid w-full gap-3 border-t border-[color:var(--theme-border)] pt-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-1">
                    <label className="min-w-0">
                        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-secondary)]">Country</span>
                        <select
                            value={value.country ?? ''}
                            onChange={(event) => onChange({ country: event.target.value || null, city: null, clubId: null })}
                            className={inputClass}
                        >
                            <option value="">Any country</option>
                            {locationTree.map((country) => <option key={country.country} value={country.country}>{country.country}</option>)}
                        </select>
                    </label>
                    <label className="min-w-0">
                        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-secondary)]">City</span>
                        <select
                            value={value.city ?? ''}
                            disabled={!value.country}
                            onChange={(event) => onChange({ ...value, city: event.target.value || null, clubId: null })}
                            className={inputClass}
                        >
                            <option value="">Any city</option>
                            {(locationTree.find((country) => country.country === value.country)?.cities ?? []).map((city) => (
                                <option key={city.city || 'unknown'} value={city.city}>{city.city || 'Location not specified'}</option>
                            ))}
                        </select>
                    </label>
                    <label className="min-w-0">
                        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-secondary)]">Club</span>
                        <select
                            value={value.clubId ?? ''}
                            disabled={!value.country}
                            onChange={(event) => onChange({ ...value, clubId: event.target.value ? Number(event.target.value) : null })}
                            className={inputClass}
                        >
                            <option value="">Any club</option>
                            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
                        </select>
                    </label>
                    {active && (
                        <button type="button" onClick={() => onChange(EMPTY_CLUB_REGION)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[color:var(--theme-border)] px-3 text-xs font-bold text-[color:var(--text-secondary)] hover:bg-[color:var(--theme-surface-inset)] hover:text-[color:var(--text-primary)]">
                            <RotateCcw className="h-3.5 w-3.5" /> Reset location
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
