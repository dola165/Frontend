import { useMemo, useState, type ReactNode } from 'react';
import { Building2, ChevronDown, ChevronRight, Filter, MapPin, Search, ShieldCheck, SlidersHorizontal, Trophy, Users, X } from 'lucide-react';
import { MapHelpHint } from './MapHelpHint';

export type MapEntityType = 'CLUB' | 'TRYOUT' | 'MATCH' | 'TOURNAMENT';
export type MapSortMode = 'RELEVANCE' | 'SOONEST' | 'DISTANCE' | 'NAME';
export type MapTimeWindow = 'Morning' | 'Afternoon' | 'Evening';
export type MapDateWindow = 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'NEXT_90_DAYS' | 'ANY';
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
}

export interface MapFilters {
    entityType: MapEntityType[];
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
    { value: 'NEXT_90_DAYS', label: 'Next 90 days' },
    { value: 'ANY', label: 'Any time' }
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
    entityType: ['CLUB', 'TRYOUT', 'MATCH', 'TOURNAMENT'],
    sortBy: 'RELEVANCE',
    distanceKm: 200,
    clubs: {
        officialOnly: false,
        city: '',
        country: ''
    },
    tryouts: {
        city: '',
        country: '',
        dateWindow: 'ANY',
        timeWindows: [],
        genders: [],
        ageGroups: []
    },
    matches: {
        city: '',
        country: '',
        dateWindow: 'ANY',
        timeWindows: [],
        genders: [],
        levels: [],
        ageGroups: [],
        subtypes: ['FRIENDLY', 'COMPETITIVE']
    }
};

const ENTITY_LABELS: Record<MapEntityType, string> = {
    CLUB: 'Clubs',
    TRYOUT: 'Tryouts',
    MATCH: 'Matches',
    TOURNAMENT: 'Tournaments'
};

const ENTITY_ICONS: Record<MapEntityType, ReactNode> = {
    CLUB: <Building2 className="h-4 w-4" />,
    TRYOUT: <Users className="h-4 w-4" />,
    MATCH: <Trophy className="h-4 w-4" />,
    TOURNAMENT: <Trophy className="h-4 w-4" />
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
    count += countArrayDelta(filters.tryouts.ageGroups, defaultMapFilters.tryouts.ageGroups);
    if (filters.matches.city) count += 1;
    if (filters.matches.country) count += 1;
    if (filters.matches.dateWindow !== defaultMapFilters.matches.dateWindow) count += 1;
    count += countArrayDelta(filters.matches.timeWindows, defaultMapFilters.matches.timeWindows);
    count += countArrayDelta(filters.matches.genders, defaultMapFilters.matches.genders);
    count += countArrayDelta(filters.matches.levels, defaultMapFilters.matches.levels);
    count += countArrayDelta(filters.matches.ageGroups, defaultMapFilters.matches.ageGroups);
    count += countArrayDelta(filters.matches.subtypes, defaultMapFilters.matches.subtypes);

    return count;
};

const RailSection = ({
    icon,
    title,
    helpText,
    expanded,
    onToggle,
    children
}: {
    icon: ReactNode;
    title: string;
    helpText?: string;
    expanded: boolean;
    onToggle: () => void;
    children: ReactNode;
}) => (
    <section className="map-filter-card">
        <button type="button" onClick={onToggle} className="map-filter-card__header">
            <div className="flex min-w-0 items-center gap-3">
                <span className="map-rail-icon">{icon}</span>
                <h3 className="truncate text-sm font-bold text-primary">{title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {helpText ? <MapHelpHint text={helpText} align="right" /> : null}
                {expanded ? <ChevronDown className="h-4 w-4 text-secondary" /> : <ChevronRight className="h-4 w-4 text-secondary" />}
            </div>
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
    onChange
}: {
    checked: boolean;
    label: string;
    onChange: () => void;
}) => (
    <label className="map-option-row cursor-pointer">
        <span className="min-w-0 text-sm font-semibold text-primary">{label}</span>
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
    const updateFilters = (updater: (current: MapFilters) => MapFilters) => {
        onFiltersChange(updater(filters));
    };

    const toggleExpanded = (key: string) => {
        setExpanded((current) => ({ ...current, [key]: !current[key] }));
    };

    // Clubs don't have dates, so "Soonest" and "Best fit" are meaningless for club-only browsing.
    const clubsOnly = filters.entityType.length === 1 && filters.entityType[0] === 'CLUB';
    const visibleSortOptions = useMemo(
        () => (clubsOnly ? SORT_OPTIONS.filter((o) => o.value === 'DISTANCE' || o.value === 'NAME') : SORT_OPTIONS),
        [clubsOnly]
    );

    return (
        <>
            <div
                className={`theme-overlay fixed inset-0 z-[1090] transition-opacity xl:hidden ${
                    isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={onClose}
            />
            <aside
                className={`pointer-events-auto map-rail fixed inset-y-0 left-0 z-[1100] w-[min(90vw,332px)] transition-transform duration-200 xl:w-[320px] ${
                    isVisible ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex h-full min-h-0 flex-col">
                    <header className="map-rail-header">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3">
                                    <span className="map-rail-icon">
                                        <SlidersHorizontal className="h-4 w-4" />
                                    </span>
                                    <div className="flex min-w-0 items-center gap-2">
                                        <h2 className="truncate text-lg font-bold text-primary">Filters</h2>
                                        <MapHelpHint
                                            text="Search moves the map. Filters narrow what stays visible or listed."
                                            align="right"
                                        />
                                    </div>
                                </div>
                            </div>
                            <button type="button" onClick={onClose} className="map-icon-button xl:hidden">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] border border-subtle bg-accent-primary-soft px-4 py-3">
                            <div>
                                <p className="text-xs font-semibold text-secondary">Active</p>
                                <p className="mt-1 text-sm font-bold text-primary">{activeCount === 0 ? 'Default' : `${activeCount} active`}</p>
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
                        <div className="space-y-3">
                            <RailSection
                                icon={<Filter className="h-4 w-4" />}
                                title="Browse"
                                helpText="Pick clubs, tryouts, or matches. The rail updates to fit that lane."
                                expanded={expanded.entity}
                                onToggle={() => toggleExpanded('entity')}
                            >
                                <div className="grid gap-2">
                                    {(['CLUB', 'TRYOUT', 'MATCH', 'TOURNAMENT'] as MapEntityType[]).map((entityType) => {
                                        const isActive = filters.entityType.includes(entityType);
                                        return (
                                            <button
                                                key={entityType}
                                                type="button"
                                                onClick={() =>
                                                    updateFilters((current) => {
                                                        const next = isActive
                                                            ? current.entityType.filter((t) => t !== entityType)
                                                            : [...current.entityType, entityType];
                                                        // Keep at least one type selected
                                                        if (next.length === 0) return current;
                                                        return { ...current, entityType: next };
                                                    })
                                                }
                                                className={`map-entity-tile ${isActive ? 'map-entity-tile--active' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="map-rail-icon">{ENTITY_ICONS[entityType]}</span>
                                                    <p className="text-sm font-bold text-primary">{ENTITY_LABELS[entityType]}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </RailSection>

                            <RailSection
                                icon={<SlidersHorizontal className="h-4 w-4" />}
                                title="Browse settings"
                                helpText="Sort changes the order. Radius changes what counts as nearby on the map."
                                expanded={expanded.browse}
                                onToggle={() => toggleExpanded('browse')}
                            >
                                <div className="space-y-5">
                                    <div>
                                        <span className="map-field-label">Sort results</span>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            {visibleSortOptions.map((option) => (
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
                                icon={<MapPin className="h-4 w-4" />}
                                title="Location"
                                helpText="Use city or country to narrow the current result type."
                                expanded={expanded.location}
                                onToggle={() => toggleExpanded('location')}
                            >
                                <div className="grid gap-4">
                                    <TextField
                                        label="City"
                                        placeholder="Filter by city"
                                        value={
                                            filters.entityType.includes('CLUB')
                                                ? filters.clubs.city
                                                : filters.entityType.includes('TRYOUT')
                                                    ? filters.tryouts.city
                                                    : filters.matches.city
                                        }
                                        onChange={(value) =>
                                            updateFilters((current) => {
                                                let next = current;
                                                if (current.entityType.includes('CLUB')) {
                                                    next = { ...next, clubs: { ...next.clubs, city: value } };
                                                }
                                                if (current.entityType.includes('TRYOUT')) {
                                                    next = { ...next, tryouts: { ...next.tryouts, city: value } };
                                                }
                                                if (current.entityType.includes('MATCH')) {
                                                    next = { ...next, matches: { ...next.matches, city: value } };
                                                }
                                                return next;
                                            })
                                        }
                                    />
                                    <TextField
                                        label="Country"
                                        placeholder="Filter by country"
                                        value={
                                            filters.entityType.includes('CLUB')
                                                ? filters.clubs.country
                                                : filters.entityType.includes('TRYOUT')
                                                    ? filters.tryouts.country
                                                    : filters.matches.country
                                        }
                                        onChange={(value) =>
                                            updateFilters((current) => {
                                                let next = current;
                                                if (current.entityType.includes('CLUB')) {
                                                    next = { ...next, clubs: { ...next.clubs, country: value } };
                                                }
                                                if (current.entityType.includes('TRYOUT')) {
                                                    next = { ...next, tryouts: { ...next.tryouts, country: value } };
                                                }
                                                if (current.entityType.includes('MATCH')) {
                                                    next = { ...next, matches: { ...next.matches, country: value } };
                                                }
                                                return next;
                                            })
                                        }
                                    />
                                </div>
                            </RailSection>

                            {filters.entityType.includes('CLUB') && (
                                <RailSection
                                    icon={<ShieldCheck className="h-4 w-4" />}
                                    title="Club filters"
                                    helpText="Show only verified public club profiles."
                                    expanded={expanded.clubs}
                                    onToggle={() => toggleExpanded('clubs')}
                                >
                                    <CheckRow
                                        checked={filters.clubs.officialOnly}
                                        label="Official clubs only"
                                        onChange={() =>
                                            updateFilters((current) => ({
                                                ...current,
                                                clubs: { ...current.clubs, officialOnly: !current.clubs.officialOnly }
                                            }))
                                        }
                                    />
                                </RailSection>
                            )}

                            {filters.entityType.includes('TRYOUT') && (
                                <RailSection
                                    icon={<Users className="h-4 w-4" />}
                                    title="Tryout filters"
                                    helpText="Use date, time, age group, and gender to narrow public tryouts."
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
                            {filters.entityType.includes('MATCH') && (
                                <RailSection
                                    icon={<Trophy className="h-4 w-4" />}
                                    title="Match filters"
                                    helpText="Use match type, level, age group, gender, and timing to narrow match discovery."
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
