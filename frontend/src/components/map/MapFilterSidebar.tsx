import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';

export type MapEntityType = 'CLUB' | 'TRYOUT' | 'MATCH';
export type MapSortMode = 'RELEVANCE' | 'SOONEST' | 'DISTANCE' | 'NAME';
export type MapTimeWindow = 'Morning' | 'Afternoon' | 'Evening';
export type MapDateWindow = 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'NEXT_90_DAYS';
export type MapGender = 'Boys' | 'Girls' | 'Men' | 'Women' | 'Mixed';
export type MapLevel = 'Youth' | 'Academy' | 'Amateur' | 'Grassroots';
export type MapMatchSubtype = 'FRIENDLY' | 'COMPETITIVE';
export type MapTravelPreference = 'HOME_ONLY' | 'WILL_TRAVEL' | 'NEUTRAL' | 'FLEXIBLE';
export type MapLocationState = 'PINNED' | 'OPEN_VENUE';
export type MapChallengeState = 'OPEN' | 'PENDING' | 'CONFIRMED';

interface ClubFilters {
    officialOnly: boolean;
    city: string;
    country: string;
}

interface TryoutFilters {
    city: string;
    country: string;
    dateWindow: MapDateWindow;
    timeWindows: MapTimeWindow[];
    genders: MapGender[];
    levels: MapLevel[];
    ageGroups: string[];
}

interface MatchFilters {
    city: string;
    country: string;
    dateWindow: MapDateWindow;
    timeWindows: MapTimeWindow[];
    genders: MapGender[];
    levels: MapLevel[];
    ageGroups: string[];
    subtypes: MapMatchSubtype[];
    challengeStates: MapChallengeState[];
    locationStates: MapLocationState[];
    travelPreferences: MapTravelPreference[];
}

export interface MapFilters {
    entityType: MapEntityType;
    sortBy: MapSortMode;
    distanceKm: number;
    clubs: ClubFilters;
    tryouts: TryoutFilters;
    matches: MatchFilters;
}

interface MapFilterSidebarProps {
    isVisible: boolean;
    filters: MapFilters;
    onFiltersChange: (filters: MapFilters) => void;
    onClose: () => void;
}

const AGE_GROUPS = ['U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U21', 'Senior'];
const GENDER_OPTIONS: MapGender[] = ['Boys', 'Girls', 'Men', 'Women', 'Mixed'];
const LEVEL_OPTIONS: MapLevel[] = ['Youth', 'Academy', 'Amateur', 'Grassroots'];
const TIME_WINDOWS: MapTimeWindow[] = ['Morning', 'Afternoon', 'Evening'];
const DATE_WINDOWS: Array<{ value: MapDateWindow; label: string }> = [
    { value: 'NEXT_7_DAYS', label: 'Next 7 days' },
    { value: 'NEXT_30_DAYS', label: 'Next 30 days' },
    { value: 'NEXT_90_DAYS', label: 'Next 90 days' }
];
const SORT_OPTIONS: Array<{ value: MapSortMode; label: string }> = [
    { value: 'RELEVANCE', label: 'Best fit' },
    { value: 'SOONEST', label: 'Soonest' },
    { value: 'DISTANCE', label: 'Distance' },
    { value: 'NAME', label: 'Name' }
];
const MATCH_SUBTYPE_OPTIONS: Array<{ value: MapMatchSubtype; label: string }> = [
    { value: 'FRIENDLY', label: 'Friendly' },
    { value: 'COMPETITIVE', label: 'Competitive' }
];
const MATCH_STATE_OPTIONS: Array<{ value: MapChallengeState; label: string }> = [
    { value: 'OPEN', label: 'Open' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'CONFIRMED', label: 'Confirmed' }
];
const LOCATION_STATE_OPTIONS: Array<{ value: MapLocationState; label: string }> = [
    { value: 'PINNED', label: 'Location set' },
    { value: 'OPEN_VENUE', label: 'Venue open' }
];
const TRAVEL_PREFERENCE_OPTIONS: Array<{ value: MapTravelPreference; label: string }> = [
    { value: 'WILL_TRAVEL', label: 'Willing to travel' },
    { value: 'HOME_ONLY', label: 'Home only' },
    { value: 'NEUTRAL', label: 'Neutral venue' },
    { value: 'FLEXIBLE', label: 'Flexible' }
];

export const defaultMapFilters: MapFilters = {
    entityType: 'CLUB',
    sortBy: 'RELEVANCE',
    distanceKm: 25,
    clubs: {
        officialOnly: false,
        city: '',
        country: ''
    },
    tryouts: {
        city: '',
        country: '',
        dateWindow: 'NEXT_30_DAYS',
        timeWindows: [],
        genders: [],
        levels: [],
        ageGroups: []
    },
    matches: {
        city: '',
        country: '',
        dateWindow: 'NEXT_30_DAYS',
        timeWindows: [],
        genders: [],
        levels: [],
        ageGroups: [],
        subtypes: ['FRIENDLY', 'COMPETITIVE'],
        challengeStates: ['OPEN', 'PENDING', 'CONFIRMED'],
        locationStates: ['PINNED', 'OPEN_VENUE'],
        travelPreferences: []
    }
};

const ENTITY_LABELS: Record<MapEntityType, string> = {
    CLUB: 'Clubs / HQs',
    TRYOUT: 'Tryouts',
    MATCH: 'Matches'
};

const ENTITY_HINTS: Record<MapEntityType, string> = {
    CLUB: 'Browse clubs and headquarters by trust, city, and proximity.',
    TRYOUT: 'Recruitment-focused filters for public club tryouts and trials.',
    MATCH: 'Operational match discovery for published needs from Schedule.'
};

const toggleValue = <T extends string>(current: T[], value: T) =>
    current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];

const countArrayDelta = (current: string[], initial: string[]) => {
    const left = [...current].sort().join('|');
    const right = [...initial].sort().join('|');
    return left === right ? 0 : current.length || 1;
};

const countActiveFilters = (filters: MapFilters) => {
    let count = 0;

    if (filters.sortBy !== defaultMapFilters.sortBy) count += 1;
    if (filters.distanceKm !== defaultMapFilters.distanceKm) count += 1;
    if (filters.clubs.officialOnly) count += 1;
    if (filters.clubs.city) count += 1;
    if (filters.clubs.country) count += 1;
    if (filters.tryouts.city) count += 1;
    if (filters.tryouts.country) count += 1;
    if (filters.tryouts.dateWindow !== defaultMapFilters.tryouts.dateWindow) count += 1;
    count += countArrayDelta(filters.tryouts.timeWindows, defaultMapFilters.tryouts.timeWindows);
    count += countArrayDelta(filters.tryouts.genders, defaultMapFilters.tryouts.genders);
    count += countArrayDelta(filters.tryouts.levels, defaultMapFilters.tryouts.levels);
    count += countArrayDelta(filters.tryouts.ageGroups, defaultMapFilters.tryouts.ageGroups);
    if (filters.matches.city) count += 1;
    if (filters.matches.country) count += 1;
    if (filters.matches.dateWindow !== defaultMapFilters.matches.dateWindow) count += 1;
    count += countArrayDelta(filters.matches.timeWindows, defaultMapFilters.matches.timeWindows);
    count += countArrayDelta(filters.matches.genders, defaultMapFilters.matches.genders);
    count += countArrayDelta(filters.matches.levels, defaultMapFilters.matches.levels);
    count += countArrayDelta(filters.matches.ageGroups, defaultMapFilters.matches.ageGroups);
    count += countArrayDelta(filters.matches.subtypes, defaultMapFilters.matches.subtypes);
    count += countArrayDelta(filters.matches.challengeStates, defaultMapFilters.matches.challengeStates);
    count += countArrayDelta(filters.matches.locationStates, defaultMapFilters.matches.locationStates);
    count += countArrayDelta(filters.matches.travelPreferences, defaultMapFilters.matches.travelPreferences);

    return count;
};

const RailSection = ({
    title,
    subtitle,
    expanded,
    onToggle,
    children
}: {
    title: string;
    subtitle?: string;
    expanded: boolean;
    onToggle: () => void;
    children: ReactNode;
}) => (
    <section className="map-filter-card">
        <button type="button" onClick={onToggle} className="map-filter-card__header">
            <div className="min-w-0">
                <div className="map-eyebrow">Filter group</div>
                <h3 className="mt-1 text-sm font-bold text-primary">{title}</h3>
                {subtitle && <p className="mt-1 text-xs leading-5 text-secondary">{subtitle}</p>}
            </div>
            {expanded ? <ChevronDown className="h-4 w-4 text-secondary" /> : <ChevronRight className="h-4 w-4 text-secondary" />}
        </button>
        {expanded && <div className="map-filter-card__body">{children}</div>}
    </section>
);

const TextField = ({
    label,
    placeholder,
    value,
    onChange
}: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
}) => (
    <label className="space-y-2">
        <span className="map-field-label">{label}</span>
        <div className="map-input-shell">
            <Search className="h-4 w-4 text-secondary" />
            <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="map-input"
            />
        </div>
    </label>
);

const ToggleChip = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className={`map-chip ${active ? 'map-chip--active' : ''}`}>
        {label}
    </button>
);

const CheckRow = ({
    checked,
    label,
    hint,
    onChange
}: {
    checked: boolean;
    label: string;
    hint?: string;
    onChange: () => void;
}) => (
    <label className="map-option-row cursor-pointer">
        <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">{label}</p>
            {hint && <p className="mt-1 text-xs leading-5 text-secondary">{hint}</p>}
        </div>
        <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--accent-primary)]" />
    </label>
);

const RadioRow = ({
    checked,
    name,
    label,
    onChange
}: {
    checked: boolean;
    name: string;
    label: string;
    onChange: () => void;
}) => (
    <label className="map-option-row cursor-pointer">
        <span className="text-sm font-semibold text-primary">{label}</span>
        <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--accent-primary)]" />
    </label>
);

export const MapFilterSidebar = ({ isVisible, filters, onFiltersChange, onClose }: MapFilterSidebarProps) => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        entity: true,
        browse: true,
        location: true,
        clubs: true,
        tryouts: true,
        matches: true
    });

    const activeCount = useMemo(() => countActiveFilters(filters), [filters]);
    const entityTitle = ENTITY_LABELS[filters.entityType];

    const updateFilters = (updater: (current: MapFilters) => MapFilters) => {
        onFiltersChange(updater(filters));
    };

    const toggleExpanded = (key: string) => {
        setExpanded((current) => ({ ...current, [key]: !current[key] }));
    };

    return (
        <>
            <div
                className={`theme-overlay fixed inset-0 z-[1090] transition-opacity xl:hidden ${
                    isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={onClose}
            />
            <aside
                className={`map-rail fixed inset-y-0 left-0 z-[1100] w-[min(92vw,370px)] transition-transform duration-200 xl:static xl:z-auto xl:w-[360px] xl:translate-x-0 ${
                    isVisible ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex h-full min-h-0 flex-col">
                    <header className="map-rail-header">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                    <span className="map-rail-icon">
                                        <SlidersHorizontal className="h-4 w-4" />
                                    </span>
                                    <div>
                                        <p className="map-eyebrow">Discovery filters</p>
                                        <h2 className="mt-1 text-lg font-bold text-primary">Refine results</h2>
                                    </div>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-secondary">
                                    Live filters for public discovery. Search jumps the map; this rail narrows what stays visible.
                                </p>
                            </div>
                            <button type="button" onClick={onClose} className="map-icon-button xl:hidden">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-subtle bg-accent-primary-soft px-4 py-3">
                            <div>
                                <p className="text-xs font-semibold text-secondary">Active filters</p>
                                <p className="mt-1 text-sm font-bold text-primary">
                                    {activeCount === 0 ? 'Default discovery setup' : `${activeCount} active`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onFiltersChange(defaultMapFilters)}
                                className="map-secondary-button whitespace-nowrap"
                                disabled={activeCount === 0}
                            >
                                Reset all
                            </button>
                        </div>
                    </header>

                    <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
                        <div className="space-y-4">
                            <RailSection
                                title="What are you browsing?"
                                subtitle="Pick the public discovery lane first. The rail updates to show only the filters that matter for that entity."
                                expanded={expanded.entity}
                                onToggle={() => toggleExpanded('entity')}
                            >
                                <div className="grid gap-2">
                                    {(['CLUB', 'TRYOUT', 'MATCH'] as MapEntityType[]).map((entityType) => (
                                        <button
                                            key={entityType}
                                            type="button"
                                            onClick={() => updateFilters((current) => ({ ...current, entityType }))}
                                            className={`map-entity-tile ${filters.entityType === entityType ? 'map-entity-tile--active' : ''}`}
                                        >
                                            <div>
                                                <p className="text-sm font-bold text-primary">{ENTITY_LABELS[entityType]}</p>
                                                <p className="mt-1 text-xs leading-5 text-secondary">{ENTITY_HINTS[entityType]}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </RailSection>

                            <RailSection
                                title="Browse settings"
                                subtitle={`${entityTitle} can be sorted and scanned without changing the underlying public event logic.`}
                                expanded={expanded.browse}
                                onToggle={() => toggleExpanded('browse')}
                            >
                                <div className="space-y-5">
                                    <div>
                                        <span className="map-field-label">Sort results</span>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            {SORT_OPTIONS.map((option) => (
                                                <ToggleChip
                                                    key={option.value}
                                                    active={filters.sortBy === option.value}
                                                    label={option.label}
                                                    onClick={() => updateFilters((current) => ({ ...current, sortBy: option.value }))}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="map-field-label">Radius</span>
                                            <span className="rounded-full border border-subtle bg-base px-2.5 py-1 text-xs font-semibold text-primary">
                                                {filters.distanceKm} km
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={5}
                                            max={150}
                                            step={5}
                                            value={filters.distanceKm}
                                            onChange={(event) =>
                                                updateFilters((current) => ({ ...current, distanceKm: Number(event.target.value) }))
                                            }
                                            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[color:var(--theme-surface-inset)] accent-[var(--accent-primary)]"
                                        />
                                        <div className="mt-2 flex items-center justify-between text-xs text-secondary">
                                            <span>Close by</span>
                                            <span>Wider search</span>
                                        </div>
                                    </div>
                                </div>
                            </RailSection>

                            <RailSection
                                title="Shared location filters"
                                subtitle="Use these to narrow results by place. Search at the top still handles jumping the map instantly."
                                expanded={expanded.location}
                                onToggle={() => toggleExpanded('location')}
                            >
                                <div className="grid gap-4">
                                    <TextField
                                        label="City"
                                        placeholder="Filter by city"
                                        value={
                                            filters.entityType === 'CLUB'
                                                ? filters.clubs.city
                                                : filters.entityType === 'TRYOUT'
                                                    ? filters.tryouts.city
                                                    : filters.matches.city
                                        }
                                        onChange={(value) =>
                                            updateFilters((current) =>
                                                current.entityType === 'CLUB'
                                                    ? { ...current, clubs: { ...current.clubs, city: value } }
                                                    : current.entityType === 'TRYOUT'
                                                        ? { ...current, tryouts: { ...current.tryouts, city: value } }
                                                        : { ...current, matches: { ...current.matches, city: value } }
                                            )
                                        }
                                    />
                                    <TextField
                                        label="Country"
                                        placeholder="Filter by country"
                                        value={
                                            filters.entityType === 'CLUB'
                                                ? filters.clubs.country
                                                : filters.entityType === 'TRYOUT'
                                                    ? filters.tryouts.country
                                                    : filters.matches.country
                                        }
                                        onChange={(value) =>
                                            updateFilters((current) =>
                                                current.entityType === 'CLUB'
                                                    ? { ...current, clubs: { ...current.clubs, country: value } }
                                                    : current.entityType === 'TRYOUT'
                                                        ? { ...current, tryouts: { ...current.tryouts, country: value } }
                                                        : { ...current, matches: { ...current.matches, country: value } }
                                            )
                                        }
                                    />
                                </div>
                            </RailSection>

                            {filters.entityType === 'CLUB' && (
                                <RailSection
                                    title="Club filters"
                                    subtitle="Lightweight trust and location controls for directory browsing."
                                    expanded={expanded.clubs}
                                    onToggle={() => toggleExpanded('clubs')}
                                >
                                    <CheckRow
                                        checked={filters.clubs.officialOnly}
                                        label="Official clubs only"
                                        hint="Show only verified public club records."
                                        onChange={() =>
                                            updateFilters((current) => ({
                                                ...current,
                                                clubs: { ...current.clubs, officialOnly: !current.clubs.officialOnly }
                                            }))
                                        }
                                    />
                                </RailSection>
                            )}

                            {filters.entityType === 'TRYOUT' && (
                                <RailSection
                                    title="Tryout filters"
                                    subtitle="Recruitment-oriented controls only. Tryouts do not inherit the match-specific workflow filters."
                                    expanded={expanded.tryouts}
                                    onToggle={() => toggleExpanded('tryouts')}
                                >
                                    <div className="space-y-5">
                                        <div>
                                            <span className="map-field-label">Date window</span>
                                            <div className="mt-2 grid gap-2">
                                                {DATE_WINDOWS.map((option) => (
                                                    <RadioRow
                                                        key={option.value}
                                                        name="tryout-date-window"
                                                        label={option.label}
                                                        checked={filters.tryouts.dateWindow === option.value}
                                                        onChange={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                tryouts: { ...current.tryouts, dateWindow: option.value }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Time of day</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {TIME_WINDOWS.map((window) => (
                                                    <ToggleChip
                                                        key={window}
                                                        active={filters.tryouts.timeWindows.includes(window)}
                                                        label={window}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                tryouts: {
                                                                    ...current.tryouts,
                                                                    timeWindows: toggleValue(current.tryouts.timeWindows, window)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Gender</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {GENDER_OPTIONS.map((gender) => (
                                                    <ToggleChip
                                                        key={gender}
                                                        active={filters.tryouts.genders.includes(gender)}
                                                        label={gender}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                tryouts: {
                                                                    ...current.tryouts,
                                                                    genders: toggleValue(current.tryouts.genders, gender)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Level</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {LEVEL_OPTIONS.map((level) => (
                                                    <ToggleChip
                                                        key={level}
                                                        active={filters.tryouts.levels.includes(level)}
                                                        label={level}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                tryouts: {
                                                                    ...current.tryouts,
                                                                    levels: toggleValue(current.tryouts.levels, level)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Age group</span>
                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                {AGE_GROUPS.map((ageGroup) => (
                                                    <ToggleChip
                                                        key={ageGroup}
                                                        active={filters.tryouts.ageGroups.includes(ageGroup)}
                                                        label={ageGroup}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                tryouts: {
                                                                    ...current.tryouts,
                                                                    ageGroups: toggleValue(current.tryouts.ageGroups, ageGroup)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </RailSection>
                            )}
                            {filters.entityType === 'MATCH' && (
                                <RailSection
                                    title="Match filters"
                                    subtitle="All published match needs still come from Schedule. This rail only controls discovery, not the data model."
                                    expanded={expanded.matches}
                                    onToggle={() => toggleExpanded('matches')}
                                >
                                    <div className="space-y-5">
                                        <div>
                                            <span className="map-field-label">Match type</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {MATCH_SUBTYPE_OPTIONS.map((option) => (
                                                    <ToggleChip
                                                        key={option.value}
                                                        active={filters.matches.subtypes.includes(option.value)}
                                                        label={option.label}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                matches: {
                                                                    ...current.matches,
                                                                    subtypes: toggleValue(current.matches.subtypes, option.value)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Challenge state</span>
                                            <div className="mt-2 grid gap-2">
                                                {MATCH_STATE_OPTIONS.map((option) => (
                                                    <CheckRow
                                                        key={option.value}
                                                        checked={filters.matches.challengeStates.includes(option.value)}
                                                        label={option.label}
                                                        onChange={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                matches: {
                                                                    ...current.matches,
                                                                    challengeStates: toggleValue(current.matches.challengeStates, option.value)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Location status</span>
                                            <div className="mt-2 grid gap-2">
                                                {LOCATION_STATE_OPTIONS.map((option) => (
                                                    <CheckRow
                                                        key={option.value}
                                                        checked={filters.matches.locationStates.includes(option.value)}
                                                        label={option.label}
                                                        onChange={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                matches: {
                                                                    ...current.matches,
                                                                    locationStates: toggleValue(current.matches.locationStates, option.value)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Travel preference</span>
                                            <div className="mt-2 grid gap-2">
                                                {TRAVEL_PREFERENCE_OPTIONS.map((option) => (
                                                    <CheckRow
                                                        key={option.value}
                                                        checked={filters.matches.travelPreferences.includes(option.value)}
                                                        label={option.label}
                                                        onChange={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                matches: {
                                                                    ...current.matches,
                                                                    travelPreferences: toggleValue(current.matches.travelPreferences, option.value)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Date window</span>
                                            <div className="mt-2 grid gap-2">
                                                {DATE_WINDOWS.map((option) => (
                                                    <RadioRow
                                                        key={option.value}
                                                        name="match-date-window"
                                                        label={option.label}
                                                        checked={filters.matches.dateWindow === option.value}
                                                        onChange={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                matches: { ...current.matches, dateWindow: option.value }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Time of day</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {TIME_WINDOWS.map((window) => (
                                                    <ToggleChip
                                                        key={window}
                                                        active={filters.matches.timeWindows.includes(window)}
                                                        label={window}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                matches: {
                                                                    ...current.matches,
                                                                    timeWindows: toggleValue(current.matches.timeWindows, window)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Gender</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {GENDER_OPTIONS.map((gender) => (
                                                    <ToggleChip
                                                        key={gender}
                                                        active={filters.matches.genders.includes(gender)}
                                                        label={gender}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                matches: {
                                                                    ...current.matches,
                                                                    genders: toggleValue(current.matches.genders, gender)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Level</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {LEVEL_OPTIONS.map((level) => (
                                                    <ToggleChip
                                                        key={level}
                                                        active={filters.matches.levels.includes(level)}
                                                        label={level}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                matches: {
                                                                    ...current.matches,
                                                                    levels: toggleValue(current.matches.levels, level)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="map-field-label">Age group</span>
                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                {AGE_GROUPS.map((ageGroup) => (
                                                    <ToggleChip
                                                        key={ageGroup}
                                                        active={filters.matches.ageGroups.includes(ageGroup)}
                                                        label={ageGroup}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                matches: {
                                                                    ...current.matches,
                                                                    ageGroups: toggleValue(current.matches.ageGroups, ageGroup)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </RailSection>
                            )}
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};
