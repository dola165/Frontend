import { TrainingPriceFields } from './TrainingPriceFields';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    Building2,
    ChevronDown,
    Loader2,
    MapPin,
    Navigation,
    RotateCcw,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    Trophy,
    X
} from 'lucide-react';
import { geocodePlace, type GeocodeResult, type MapEntityType } from '../../api/map';
import { ISO_COUNTRIES, findIsoCountry, type IsoCountry } from '../../data/isoCountries';
import type { ClubCategory, MapFilters, MapGender, MapLevel } from './MapFilterSidebar';
import type { SearchCoverage } from './areaSearch';

interface SimpleMapFiltersProps {
    admissionControls?: ReactNode;
    isVisible: boolean;
    /** Render the drawer inside an embedding surface (for example the landing-page map). */
    embedded?: boolean;
    /** Use a compact horizontal filter strip instead of the full side drawer. */
    layout?: 'side' | 'top' | 'external';
    draftFilters: MapFilters;
    appliedFilters: MapFilters;
    onDraftChange: (filters: MapFilters) => void;
    onApply: () => void | Promise<void>;
    onReset: () => void;
    applying: boolean;
    resultCount: number | null;
    searchValue: string;
    onSearchChange: (value: string) => void;
    onPlaceSearchChange: (value: string) => void;
    allowedEntityTypes: MapEntityType[];
    viewerMode: 'guest' | 'player' | 'staff';
    showAdvancedFilters?: boolean;
    showPlayerFitFilters?: boolean;
    /** Hide optional fields when a composed guest surface needs a very small strip. */
    showSearchField?: boolean;
    showVerificationFilter?: boolean;
    showDescription?: boolean;
    onOpenAdvanced: () => void;
    onOpenPlanning?: () => void;
    onClose: () => void;
    originLabel?: string;
    onPickOrigin?: () => void;
    onLocate?: () => void;
    locating?: boolean;
    locationError?: string | null;
    coverage?: SearchCoverage;
    appliedCoverage?: SearchCoverage;
    coverageSummary?: string;
    onCoverageChange?: (coverage: SearchCoverage) => void;
}

const ENTITY_OPTIONS: Array<{ value: MapEntityType; label: string; icon: typeof Building2 }> = [
    { value: 'CLUB', label: 'Clubs', icon: Building2 },
    { value: 'STADIUM', label: 'Stadiums', icon: MapPin },
    { value: 'MATCH', label: 'Matches', icon: Trophy },
    { value: 'TOURNAMENT', label: 'Tournaments', icon: Trophy }
];

const CLUB_TYPES: Array<{ value: ClubCategory; label: string }> = [
    { value: 'PROFESSIONAL_ACADEMY', label: 'Professional academy' },
    { value: 'PRIVATE_ACADEMY', label: 'Private academy' },
    { value: 'SCHOOL_CLUB', label: 'School club' },
    { value: 'AMATEUR_CLUB', label: 'Amateur club' },
    { value: 'OTHER', label: 'Other' }
];

const AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'U19', 'U21', 'Senior'];
const GENDERS: MapGender[] = ['Boys', 'Girls', 'Men', 'Women', 'Mixed'];
const LEVELS: MapLevel[] = ['Youth', 'Academy', 'Amateur', 'Grassroots'];

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

const selectClassName = 'atlas-filter-select';

export const SimpleMapFilters = ({
    admissionControls,
    isVisible,
    embedded = false,
    layout = 'side',
    draftFilters,
    appliedFilters,
    onDraftChange,
    onApply,
    onReset,
    applying,
    resultCount,
    searchValue,
    onSearchChange,
    onPlaceSearchChange,
    allowedEntityTypes,
    showAdvancedFilters = true,
    showPlayerFitFilters = true,
    showSearchField = true,
    showVerificationFilter = true,
    showDescription = true,
    onOpenAdvanced,
    onOpenPlanning,
    onClose,
    originLabel,
    onPickOrigin,
    onLocate,
    locating,
    locationError,
    coverage = 'radius',
    appliedCoverage = 'radius',
    coverageSummary,
    onCoverageChange
}: SimpleMapFiltersProps) => {
    const [countryOpen, setCountryOpen] = useState(false);
    const [cityOpen, setCityOpen] = useState(false);
    const [citySuggestions, setCitySuggestions] = useState<GeocodeResult[]>([]);
    const [cityLoading, setCityLoading] = useState(false);
    const countryBoxRef = useRef<HTMLDivElement | null>(null);
    const cityBoxRef = useRef<HTMLDivElement | null>(null);
    const countryValue = draftFilters.clubs.country;
    const cityValue = draftFilters.clubs.city;
    const selectedCountry = findIsoCountry(countryValue);
    const hasPendingChanges = coverage !== appliedCoverage || JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);
    const isTopLayout = layout === 'top';
    const isExternalLayout = layout === 'external';
    const backdropPosition = isExternalLayout
        ? 'fixed inset-0'
        : embedded ? 'absolute inset-0' : 'fixed inset-x-0 bottom-0 top-[var(--app-active-header-height)]';
    const railPosition = isTopLayout
        ? 'absolute inset-x-4 top-4'
        : isExternalLayout
            ? 'fixed inset-x-0 bottom-0 sm:relative sm:inset-auto'
        : embedded
            ? 'absolute inset-y-0 left-0'
            : 'fixed bottom-0 left-0 top-[var(--app-active-header-height)]';
    const backdropVisibility = isExternalLayout
        ? `sm:hidden ${isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`
        : isTopLayout
        ? 'pointer-events-none opacity-0'
        : isVisible
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0';
    const railVisibility = isExternalLayout
        ? (isVisible ? 'translate-y-0 opacity-100' : 'hidden')
        : isTopLayout
        ? (isVisible ? 'translate-y-0 opacity-100' : '-translate-y-[calc(100%+1rem)] opacity-0 pointer-events-none')
        : (isVisible ? 'translate-x-0' : '-translate-x-full');

    useEffect(() => {
        document.documentElement.style.setProperty('--map-filter-w', '320px');
    }, []);

    const countryMatches = useMemo(() => {
        const query = normalize(countryValue.trim());
        if (selectedCountry) return [selectedCountry];
        if (!query) return ISO_COUNTRIES.slice(0, 8);
        return ISO_COUNTRIES
            .filter((country) => normalize(country.name).includes(query) || country.code.toLocaleLowerCase().startsWith(query))
            .slice(0, 8);
    }, [countryValue, selectedCountry]);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (countryBoxRef.current && !countryBoxRef.current.contains(target)) setCountryOpen(false);
            if (cityBoxRef.current && !cityBoxRef.current.contains(target)) setCityOpen(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    useEffect(() => {
        let active = true;
        const query = cityValue.trim();
        if (!selectedCountry || query.length < 2) {
            return () => {
                active = false;
            };
        }

        const timer = window.setTimeout(() => {
            if (active) setCityLoading(true);
            void geocodePlace(query, { countryCode: selectedCountry.code, type: 'CITY' })
                .then((results) => {
                    if (!active) return;
                    setCitySuggestions(results.filter((result) =>
                        result.type === 'CITY' && (
                            result.countryCode?.toLocaleUpperCase() === selectedCountry.code ||
                            normalize(result.countryName ?? '') === normalize(selectedCountry.name)
                        )
                    ));
                })
                .catch(() => {
                    if (active) setCitySuggestions([]);
                })
                .finally(() => {
                    if (active) setCityLoading(false);
                });
        }, 280);

        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [cityValue, selectedCountry]);

    const updateFilters = (updater: (current: MapFilters) => MapFilters) => onDraftChange(updater(draftFilters));

    const updateLocation = (country: string, city: string) => {
        updateFilters((current) => ({
            ...current,
            clubs: { ...current.clubs, country, city },
            tryouts: { ...current.tryouts, country, city },
            matches: { ...current.matches, country, city }
        }));
    };

    const selectCountry = (country: IsoCountry) => {
        updateLocation(country.name, '');
        onPlaceSearchChange(country.name);
        setCountryOpen(false);
        setCitySuggestions([]);
    };

    const selectCity = (city: GeocodeResult) => {
        updateLocation(selectedCountry?.name ?? city.countryName ?? countryValue, city.cityName ?? city.name);
        onPlaceSearchChange(city.cityName ?? city.name);
        setCityOpen(false);
    };

    const toggleEntity = (entityType: MapEntityType) => {
        updateFilters((current) => {
            const active = current.entityType.includes(entityType);
            if (active && current.entityType.length === 1) return current;
            return {
                ...current,
                entityType: active
                    ? current.entityType.filter((type) => type !== entityType)
                    : [...current.entityType, entityType]
            };
        });
    };

    const setSingleClubFilter = <T extends string>(key: 'categories' | 'ageGroups' | 'genders' | 'levels', value: T) => {
        updateFilters((current) => ({
            ...current,
            clubs: { ...current.clubs, [key]: value ? [value] : [] },
            matches: key !== 'categories' ? { ...current.matches, [key]: value ? [value] : [] } : current.matches,
            tryouts: key === 'ageGroups' || key === 'genders' ? { ...current.tryouts, [key]: value ? [value] : [] } : current.tryouts
        }));
    };

    return (
        <>
            <div
                className={`map-modal-backdrop ${backdropPosition} z-[1080] bg-[color:var(--color-ink)]/30 backdrop-blur-[2px] transition-opacity ${backdropVisibility}`}
                onClick={onClose}
            />
            <aside
                id={isExternalLayout ? 'landing-map-filter-panel' : undefined}
                aria-label="Simple map filters"
                inert={!isVisible}
                data-visible={isVisible}
                className={`map-simple-rail ${isTopLayout ? 'map-simple-rail--top' : ''} ${isExternalLayout ? 'map-simple-rail--external w-full rounded-t-3xl border-t sm:max-h-[420px] sm:rounded-2xl sm:border' : ''} pointer-events-auto ${railPosition} z-[1100] flex flex-col ${isTopLayout ? 'w-auto rounded-2xl border' : isExternalLayout ? '' : 'w-[min(92vw,332px)] border-r'} border-[var(--map-panel-border)] bg-[var(--map-panel-bg)] shadow-[var(--map-shadow-strong)] transition-[transform,top,opacity] duration-200 ${railVisibility}`}
            >
                <header className={`shrink-0 border-b border-[var(--map-panel-border)] ${isTopLayout ? 'px-4 py-2.5' : isExternalLayout ? 'px-4 py-3 sm:px-5 sm:py-4' : 'px-5 pb-4 pt-5'}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="atlas-eyebrow"><span className="atlas-brand-mark">G</span> GRASSKICKZ <span className="atlas-world-tag">WORLD</span></p>
                            <h2 className="atlas-filter-title">Find your football<span>.</span></h2>
                            {showDescription && (
                                <p className={`mt-1 text-xs leading-5 text-[var(--text-secondary)] ${isTopLayout ? 'hidden sm:block' : ''}`}>
                                    A place to play. A team to belong to.
                                </p>
                            )}
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close filters" className="map-icon-button h-8 w-8 shrink-0">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className={`${isTopLayout ? 'mt-1' : 'mt-4'} flex items-center justify-between border-l-2 border-[var(--map-panel-border)] pl-3`}>
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">
                            {applying ? 'Updating the map…' : hasPendingChanges ? 'Changes ready' : `${resultCount ?? 0} loaded results`}
                        </span>
                        {hasPendingChanges && <span className="h-2 w-2 rounded-full bg-[color:var(--color-warning)]" aria-label="Unapplied filter changes" />}
                    </div>
                    {coverageSummary && <p className="atlas-coverage-summary">{coverageSummary}</p>}
                </header>

                <div className={`scrollbar-hide min-h-0 flex-1 overflow-y-auto ${isTopLayout ? 'px-4 py-3' : 'px-5 py-5'}`}>
                    <div className={isTopLayout ? `grid grid-cols-2 items-end gap-x-4 gap-y-3 sm:grid-cols-4 ${showSearchField ? 'xl:grid-cols-8' : 'xl:grid-cols-7'}` : 'space-y-6'}>
                        {allowedEntityTypes.length > 1 && (
                            <fieldset>
                                <legend className="map-simple-label">01 / What brings you here?</legend>
                                <div className="atlas-entity-options">
                                    {ENTITY_OPTIONS.filter((option) => allowedEntityTypes.includes(option.value)).map((option) => {
                                        const Icon = option.icon;
                                        const active = draftFilters.entityType.includes(option.value);
                                        return (
                                            <label
                                                key={option.value}
                                                className="map-simple-check"
                                            >
                                                <span className="flex items-center gap-3"><Icon className="h-4 w-4" />{option.label}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={active}
                                                    disabled={active && draftFilters.entityType.length === 1}
                                                    onChange={() => toggleEntity(option.value)}
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        )}

                        {onPickOrigin && <section className="atlas-search-from" aria-label="Search origin">
                            <span className="map-simple-label">02 / Search from</span>
                            <div><MapPin size={17} /><p><strong>{originLabel ? 'Your starting location' : 'Choose your location'}</strong><small>{originLabel || 'For nearby clubs, distances and walking routes.'}</small></p></div>
                            <div className="atlas-origin-choices"><button type="button" onClick={onLocate} disabled={locating}>{locating ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}{locating ? 'Locating…' : 'Use my location'}</button><button type="button" onClick={onPickOrigin}>{originLabel ? 'Change on map' : 'Choose on map'}</button></div>
                            {locationError && <p className="atlas-location-error" role="status">{locationError}</p>}
                            {(countryValue || cityValue) && <small className="atlas-origin-region-note">Country/city chooses where to browse. Your location stays available for distances and walks.</small>}
                        </section>}
                        {admissionControls}
                        <div ref={countryBoxRef} className="relative">
                            <label className="map-simple-label" htmlFor="map-country">Country</label>
                            <div className="map-simple-line">
                                <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                                <input
                                    id="map-country"
                                    value={countryValue}
                                    onFocus={() => setCountryOpen(true)}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        updateLocation(value, '');
                                        setCityLoading(false);
                                        setCitySuggestions([]);
                                        onPlaceSearchChange(value);
                                        setCountryOpen(true);
                                    }}
                                    placeholder="Type or choose a country"
                                    autoComplete="off"
                                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                                />
                                <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                            </div>
                            {countryOpen && countryMatches.length > 0 && (
                                <div className="map-simple-suggestions">
                                    {countryMatches.map((country) => (
                                        <button key={country.code} type="button" onClick={() => selectCountry(country)} className="map-simple-suggestion">
                                            <span>{country.name}</span><span className="text-[10px] font-bold text-[var(--text-muted)]">{country.code}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div ref={cityBoxRef} className="relative">
                            <label className="map-simple-label" htmlFor="map-city">City</label>
                            <div className={`map-simple-line ${!selectedCountry ? 'opacity-55' : ''}`}>
                                <MapPin className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                                <input
                                    id="map-city"
                                    value={cityValue}
                                    disabled={!selectedCountry}
                                    onFocus={() => setCityOpen(true)}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        updateLocation(countryValue, value);
                                        setCitySuggestions([]);
                                        setCityLoading(value.trim().length >= 2);
                                        onPlaceSearchChange(value || countryValue);
                                        setCityOpen(true);
                                    }}
                                    placeholder={selectedCountry ? 'Start typing a city' : 'Choose a country first'}
                                    autoComplete="off"
                                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed"
                                />
                                {cityLoading && <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-primary)]" />}
                            </div>
                            {cityOpen && cityValue.trim().length >= 2 && !cityLoading && (
                                <div className="map-simple-suggestions">
                                    {citySuggestions.length > 0 ? citySuggestions.map((city) => (
                                        <button key={`${city.countryCode}-${city.name}`} type="button" onClick={() => selectCity(city)} className="map-simple-suggestion">
                                            <span>{city.name}</span><span className="truncate text-[10px] text-[var(--text-muted)]">{city.countryName}</span>
                                        </button>
                                    )) : <p className="px-3 py-3 text-xs text-[var(--text-secondary)]">No matching city in {selectedCountry?.name}.</p>}
                                </div>
                            )}
                        </div>

                        {showSearchField && (
                            <label>
                                <span className="map-simple-label">Name, street or address</span>
                                <span className="map-simple-line">
                                    <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                                    <input
                                        value={searchValue}
                                        onChange={(event) => onSearchChange(event.target.value)}
                                        placeholder="Club, stadium or street…"
                                        maxLength={100}
                                        onKeyDown={event => { if (event.key === 'Enter') void onApply(); }}
                                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                                    />
                                </span>
                            </label>
                        )}

                        <div className={isTopLayout ? 'grid grid-cols-2 gap-x-4 gap-y-3 sm:col-span-2 sm:grid-cols-4 xl:contents' : 'atlas-fit-grid'}>
                            <label>
                                <span className="map-simple-label">Club type</span>
                                <select aria-label="Club type" value={draftFilters.clubs.categories[0] ?? ''} onChange={(event) => setSingleClubFilter('categories', event.target.value)} className={selectClassName}>
                                    <option value="">Any type</option>
                                    {CLUB_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </label>
                            <label>
                                <span className="map-simple-label">Age group</span>
                                <select aria-label="Age group" value={draftFilters.clubs.ageGroups[0] ?? ''} onChange={(event) => setSingleClubFilter('ageGroups', event.target.value)} className={selectClassName}>
                                    <option value="">Any age</option>
                                    {AGE_GROUPS.map((value) => <option key={value} value={value}>{value}</option>)}
                                </select>
                            </label>
                            <label>
                                <span className="map-simple-label">Gender</span>
                                <select aria-label="Gender" value={draftFilters.clubs.genders[0] ?? ''} onChange={(event) => setSingleClubFilter('genders', event.target.value)} className={selectClassName}>
                                    <option value="">Any team</option>
                                    {GENDERS.map((value) => <option key={value} value={value}>{value}</option>)}
                                </select>
                            </label>
                            <label>
                                <span className="map-simple-label">Level</span>
                                <select aria-label="Level" value={draftFilters.clubs.levels[0] ?? ''} onChange={(event) => setSingleClubFilter('levels', event.target.value)} className={selectClassName}>
                                    <option value="">Any level</option>
                                    {LEVELS.map((value) => <option key={value} value={value}>{value}</option>)}
                                </select>
                            </label>
                        </div>

                        {draftFilters.entityType.includes('CLUB') && <TrainingPriceFields filters={draftFilters} onChange={onDraftChange} />}

                        <div className="atlas-coverage-settings">
                            {onCoverageChange && <fieldset className="atlas-coverage-choice"><legend className="map-simple-label">Search coverage</legend>
                                <div>{([['radius', 'Within radius'], ['area', 'Visible map'], ...((countryValue || cityValue) ? [['region', cityValue ? 'Whole city' : 'Whole country']] : [])] as [SearchCoverage, string][]).map(([value, label]) => <button key={value} type="button" aria-pressed={coverage === value} onClick={() => onCoverageChange(value)}>{label}</button>)}</div>
                            </fieldset>}
                            {coverage !== 'radius' && <p className="atlas-coverage-explanation">{coverage === 'area' ? 'Only clubs in the searched map area. Show results keeps this area; Search visible map updates it.' : `Browse all of ${cityValue || countryValue}. Your starting point does not limit this region.`}</p>}
                            <div className={coverage !== 'radius' ? 'atlas-radius-inactive' : ''}>
                            <div className="flex items-center justify-between">
                                <label className="map-simple-label" htmlFor="map-search-radius">{coverage === 'radius' ? 'Search radius' : 'Saved radius · inactive'}</label>
                                <span className="text-xs font-black text-[var(--text-primary)]">{draftFilters.distanceKm} km</span>
                            </div>
                            <input
                                type="range"
                                id="map-search-radius"
                                min={1}
                                max={400}
                                step={1}
                                disabled={coverage !== 'radius'}
                                value={draftFilters.distanceKm}
                                onChange={(event) => updateFilters((current) => ({ ...current, distanceKm: Number(event.target.value) }))}
                                className="map-simple-range mt-3 w-full"
                            />
                            <div className="atlas-radius-presets">{[1, 5, 15, 50, 100, 400].map(km => <button key={km} type="button" disabled={coverage !== 'radius'} aria-pressed={draftFilters.distanceKm === km} onClick={() => updateFilters(current => ({ ...current, distanceKm: km }))}>{km} km</button>)}</div>
                            </div>
                        </div>

                        {(showVerificationFilter || showPlayerFitFilters) && (
                            <div className="space-y-1">
                                {showVerificationFilter && (
                                    <label className="map-simple-check">
                                        <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--text-muted)]" />Verified clubs only</span>
                                        <input type="checkbox" checked={draftFilters.clubs.officialOnly} onChange={() => updateFilters((current) => ({ ...current, clubs: { ...current.clubs, officialOnly: !current.clubs.officialOnly } }))} />
                                    </label>
                                )}
                                {showPlayerFitFilters && (
                                    <label className="map-simple-check">
                                        <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[var(--text-muted)]" />Accepting players</span>
                                        <input type="checkbox" checked={draftFilters.clubs.openTryoutsOnly} onChange={() => updateFilters((current) => ({ ...current, clubs: { ...current.clubs, openTryoutsOnly: !current.clubs.openTryoutsOnly } }))} />
                                    </label>
                                )}
                            </div>
                        )}

                        {(draftFilters.clubs.categories.length > 1 || draftFilters.clubs.ageGroups.length > 1 || draftFilters.clubs.genders.length > 1 || draftFilters.clubs.levels.length > 1 || draftFilters.positions.length > 0) && (
                            <p className="border-l-2 border-[color:var(--color-purple)] pl-3 text-xs leading-5 text-[var(--text-secondary)]">Some advanced choices are still active. Open Advanced to review every selected value.</p>
                        )}
                    </div>
                </div>

                <footer className="shrink-0 border-t border-[var(--map-panel-border)] bg-[var(--map-panel-bg)] px-5 py-4">
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                        <button type="button" onClick={onApply} disabled={applying} className="map-simple-primary">
                            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            {applying ? 'Searching…' : 'Show results'}
                        </button>
                        <button type="button" onClick={onReset} aria-label="Reset map filters" className="map-simple-reset"><RotateCcw className="h-4 w-4" /></button>
                    </div>
                    {onOpenPlanning && <button type="button" onClick={onOpenPlanning} className="mt-3 flex w-full items-center justify-between border-t border-[var(--map-panel-border)] pt-3 text-xs font-bold text-[var(--text-primary)]"><span className="flex items-center gap-2"><MapPin className="h-4 w-4"/>Plan a football journey</span><span aria-hidden>→</span></button>}
                    {showAdvancedFilters && (
                        <button type="button" onClick={onOpenAdvanced} className="mt-3 flex w-full items-center justify-between border-t border-[var(--map-panel-border)] pt-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                            <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />More filters · positions, dates and multiple choices</span>
                            <span aria-hidden>→</span>
                        </button>
                    )}
                </footer>
            </aside>
        </>
    );
};
