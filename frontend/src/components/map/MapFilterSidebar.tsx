import { useMemo, useState, type ReactNode } from 'react';
import { Building2, ChevronDown, ChevronRight, Crosshair, Filter, Loader2, MapPin, Navigation, Search, ShieldCheck, SlidersHorizontal, Trophy, Users, X } from 'lucide-react';
import { type MapEntityType } from '../../api/map';
export type { MapEntityType };
import { MapHelpHint } from './MapHelpHint';

export type MapSortMode = 'RELEVANCE' | 'SOONEST' | 'DISTANCE' | 'NAME';
export type MapTimeWindow = 'Morning' | 'Afternoon' | 'Evening';
export type MapDateWindow = 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'NEXT_90_DAYS' | 'ANY';
export type MapGender = 'Boys' | 'Girls' | 'Men' | 'Women' | 'Mixed';
export type MapLevel = 'Youth' | 'Academy' | 'Amateur' | 'Grassroots';
export type MapMatchSubtype = 'FRIENDLY' | 'COMPETITIVE';
export type MapTravelPreference = 'HOME_ONLY' | 'WILL_TRAVEL' | 'NEUTRAL' | 'FLEXIBLE';
export type MapLocationState = 'PINNED' | 'OPEN_VENUE';
export type MapChallengeState = 'OPEN' | 'PENDING' | 'CONFIRMED';
export type ClubCategory = 'PROFESSIONAL_ACADEMY' | 'PRIVATE_ACADEMY' | 'SCHOOL_CLUB' | 'AMATEUR_CLUB' | 'OTHER';

interface ClubFilters {
    officialOnly: boolean;
    openTryoutsOnly: boolean;
    city: string;
    country: string;
    categories: ClubCategory[];
    ageGroups: string[];
    genders: MapGender[];
    levels: MapLevel[];
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
    /** Working copy of the filters — every control writes here only. Nothing refetches until Apply. */
    draftFilters: MapFilters;
    onDraftChange: (filters: MapFilters) => void;
    /** Commits the draft: one API call + optional place geocode + camera fly. */
    onApply: () => void;
    /** Clears the draft back to defaults (Apply still required to re-fetch). */
    onResetAll: () => void;
    applying: boolean;
    resultCount: number | null;
    /** Fly-to place text — resolved against /map/geocode when Apply is pressed. */
    placeSearch: string;
    onPlaceSearchChange: (value: string) => void;
    onClose: () => void;
    /** Role-gated entity types (WEB_APP_MASTER_PLAN.md §3.3): restricted viewers only get CLUB + TRYOUT. */
    allowedEntityTypes: MapEntityType[];
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
const CLUB_CATEGORY_OPTIONS: Array<{ value: ClubCategory; label: string }> = [
    { value: 'PROFESSIONAL_ACADEMY', label: 'Pro academy' },
    { value: 'PRIVATE_ACADEMY', label: 'Private academy' },
    { value: 'SCHOOL_CLUB', label: 'School club' },
    { value: 'AMATEUR_CLUB', label: 'Amateur club' },
    { value: 'OTHER', label: 'Other' }
];

export const defaultMapFilters: MapFilters = {
    entityType: ['CLUB', 'TRYOUT', 'MATCH', 'TOURNAMENT'],
    sortBy: 'RELEVANCE',
    distanceKm: 200,
    clubs: {
        officialOnly: false,
        openTryoutsOnly: false,
        city: '',
        country: '',
        categories: [],
        ageGroups: [],
        genders: [],
        levels: []
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
    TOURNAMENT: 'Tournaments',
    CLUB_NEED: 'Club Needs'
};

const ENTITY_ICONS: Record<MapEntityType, ReactNode> = {
    CLUB: <Building2 className="h-4 w-4" />,
    TRYOUT: <Users className="h-4 w-4" />,
    MATCH: <Trophy className="h-4 w-4" />,
    TOURNAMENT: <Trophy className="h-4 w-4" />,
    CLUB_NEED: <Crosshair className="h-4 w-4" />
};

const ENTITY_DESCRIPTIONS: Record<MapEntityType, string> = {
    CLUB: 'Find football clubs near you',
    TRYOUT: 'Discover open tryout sessions',
    MATCH: 'Browse open match challenges',
    TOURNAMENT: 'Explore tournaments and cups',
    CLUB_NEED: 'See what positions clubs need'
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
    if (filters.clubs.openTryoutsOnly) count += 1;
    if (filters.clubs.city) count += 1;
    if (filters.clubs.country) count += 1;
    count += countArrayDelta(filters.clubs.categories, defaultMapFilters.clubs.categories);
    count += countArrayDelta(filters.clubs.ageGroups, defaultMapFilters.clubs.ageGroups);
    count += countArrayDelta(filters.clubs.genders, defaultMapFilters.clubs.genders);
    count += countArrayDelta(filters.clubs.levels, defaultMapFilters.clubs.levels);
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
                <h3 className="truncate text-sm font-bold text-[#f4f4f5]">{title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {helpText ? <MapHelpHint text={helpText} align="right" /> : null}
                {expanded ? <ChevronDown className="h-4 w-4 text-[#a1a1aa]" /> : <ChevronRight className="h-4 w-4 text-[#a1a1aa]" />}
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
            <Search className="h-4 w-4 text-[#a1a1aa]" />
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
        <span className="min-w-0 text-sm font-semibold text-[#f4f4f5]">{label}</span>
        <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[#16a34a]" />
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
        <span className="text-sm font-semibold text-[#f4f4f5]">{label}</span>
        <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-[#16a34a]" />
    </label>
);

export const MapFilterSidebar = ({
    isVisible,
    draftFilters,
    onDraftChange,
    onApply,
    onResetAll,
    applying,
    resultCount,
    placeSearch,
    onPlaceSearchChange,
    onClose,
    allowedEntityTypes
}: MapFilterSidebarProps) => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        place: true,
        entity: true,
        browse: true,
        location: true,
        clubs: true,
        tryouts: true,
        matches: true
    });

    const activeCount = useMemo(() => countActiveFilters(draftFilters), [draftFilters]);
    const updateFilters = (updater: (current: MapFilters) => MapFilters) => {
        onDraftChange(updater(draftFilters));
    };

    const toggleExpanded = (key: string) => {
        setExpanded((current) => ({ ...current, [key]: !current[key] }));
    };

    // Clubs don't have dates, so "Soonest" and "Best fit" are meaningless for club-only browsing.
    const clubsOnly = draftFilters.entityType.length === 1 && draftFilters.entityType[0] === 'CLUB';
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
                                        <h2 className="truncate text-lg font-bold text-[#f4f4f5]">Filters</h2>
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

                        <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] border border-[#ffffff0d] bg-[#16a34a]-soft px-4 py-3">
                            <div>
                                <p className="text-xs font-semibold text-[#a1a1aa]">Active</p>
                                <p className="mt-1 text-sm font-bold text-[#f4f4f5]">{activeCount === 0 ? 'Default' : `${activeCount} active`}</p>
                            </div>
                            <button
                                type="button"
                                onClick={onResetAll}
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
                                icon={<Navigation className="h-4 w-4" />}
                                title="Find a place"
                                helpText="Type a city or country, then Apply — the camera flies there and it becomes the search center."
                                expanded={expanded.place}
                                onToggle={() => toggleExpanded('place')}
                            >
                                <TextField
                                    label="City or country"
                                    placeholder="e.g. Tbilisi, Georgia"
                                    value={placeSearch}
                                    onChange={onPlaceSearchChange}
                                />
                            </RailSection>

                            <RailSection
                                icon={<Filter className="h-4 w-4" />}
                                title="Browse"
                                helpText="Pick a mode to discover clubs, tryouts, matches, tournaments, or club needs."
                                expanded={expanded.entity}
                                onToggle={() => toggleExpanded('entity')}
                            >
                                <div className="space-y-2">
                                    {allowedEntityTypes.map((entityType) => {
                                        const isActive = draftFilters.entityType.length === 1 && draftFilters.entityType[0] === entityType;
                                        return (
                                            <button
                                                key={entityType}
                                                type="button"
                                                onClick={() =>
                                                    updateFilters((current) => ({
                                                        ...current,
                                                        entityType: [entityType]
                                                    }))
                                                }
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                                                    isActive
                                                        ? 'bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b]'
                                                        : 'border border-transparent text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#f4f4f5]'
                                                }`}
                                            >
                                                <span className={isActive ? 'text-[#f59e0b]' : 'text-[#71717a]'}>{ENTITY_ICONS[entityType]}</span>
                                                <div>
                                                    <p className="text-sm font-semibold">{ENTITY_LABELS[entityType]}</p>
                                                    <p className="text-[10px] opacity-60">{ENTITY_DESCRIPTIONS[entityType]}</p>
                                                </div>
                                                {isActive && <span className="ml-auto w-2 h-2 rounded-full bg-[#f59e0b]" />}
                                            </button>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            updateFilters((current) => ({
                                                ...current,
                                                entityType: allowedEntityTypes
                                            }))
                                        }
                                        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs text-[#71717a] hover:text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.02)] transition-colors ${
                                            draftFilters.entityType.length > 1 ? 'text-[#f59e0b]/70' : ''
                                        }`}
                                    >
                                        Show all types
                                    </button>
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
                                                    active={draftFilters.sortBy === option.value}
                                                    label={option.label}
                                                    onClick={() => updateFilters((current) => ({ ...current, sortBy: option.value }))}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="map-field-label">Radius</span>
                                            <span className="rounded-full border border-[#ffffff0d] bg-[#0f1117] px-2.5 py-1 text-xs font-semibold text-[#f4f4f5]">
                                                {draftFilters.distanceKm} km
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={5}
                                            max={150}
                                            step={5}
                                            value={draftFilters.distanceKm}
                                            onChange={(event) =>
                                                updateFilters((current) => ({ ...current, distanceKm: Number(event.target.value) }))
                                            }
                                            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[color:var(--theme-surface-inset)] accent-[#16a34a]"
                                        />
                                        <div className="mt-2 flex items-center justify-between text-xs text-[#a1a1aa]">
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
                                            draftFilters.entityType.includes('CLUB')
                                                ? draftFilters.clubs.city
                                                : draftFilters.entityType.includes('TRYOUT')
                                                    ? draftFilters.tryouts.city
                                                    : draftFilters.matches.city
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
                                            draftFilters.entityType.includes('CLUB')
                                                ? draftFilters.clubs.country
                                                : draftFilters.entityType.includes('TRYOUT')
                                                    ? draftFilters.tryouts.country
                                                    : draftFilters.matches.country
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

                            {draftFilters.entityType.includes('CLUB') && (
                                <RailSection
                                    icon={<ShieldCheck className="h-4 w-4" />}
                                    title="Club filters"
                                    helpText="Choose club type, age group, gender, and level — plus verified or tryout-running clubs."
                                    expanded={expanded.clubs}
                                    onToggle={() => toggleExpanded('clubs')}
                                >
                                    <div className="space-y-5">
                                        <div className="space-y-3">
                                            <CheckRow
                                                checked={draftFilters.clubs.officialOnly}
                                                label="Official clubs only"
                                                onChange={() =>
                                                    updateFilters((current) => ({
                                                        ...current,
                                                        clubs: { ...current.clubs, officialOnly: !current.clubs.officialOnly }
                                                    }))
                                                }
                                            />
                                            <CheckRow
                                                checked={draftFilters.clubs.openTryoutsOnly}
                                                label="Open tryouts only"
                                                onChange={() =>
                                                    updateFilters((current) => ({
                                                        ...current,
                                                        clubs: { ...current.clubs, openTryoutsOnly: !current.clubs.openTryoutsOnly }
                                                    }))
                                                }
                                            />
                                        </div>

                                        <div>
                                            <span className="map-field-label">Club type</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {CLUB_CATEGORY_OPTIONS.map((option) => (
                                                    <ToggleChip
                                                        key={option.value}
                                                        active={draftFilters.clubs.categories.includes(option.value)}
                                                        label={option.label}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                clubs: {
                                                                    ...current.clubs,
                                                                    categories: toggleValue(current.clubs.categories, option.value)
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
                                                        active={draftFilters.clubs.ageGroups.includes(ageGroup)}
                                                        label={ageGroup}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                clubs: {
                                                                    ...current.clubs,
                                                                    ageGroups: toggleValue(current.clubs.ageGroups, ageGroup)
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
                                                        active={draftFilters.clubs.genders.includes(gender)}
                                                        label={gender}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                clubs: {
                                                                    ...current.clubs,
                                                                    genders: toggleValue(current.clubs.genders, gender)
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
                                                        active={draftFilters.clubs.levels.includes(level)}
                                                        label={level}
                                                        onClick={() =>
                                                            updateFilters((current) => ({
                                                                ...current,
                                                                clubs: {
                                                                    ...current.clubs,
                                                                    levels: toggleValue(current.clubs.levels, level)
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

                            {draftFilters.entityType.includes('TRYOUT') && (
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
                                                        checked={draftFilters.tryouts.dateWindow === option.value}
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
                                                        active={draftFilters.tryouts.timeWindows.includes(window)}
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
                                                        active={draftFilters.tryouts.genders.includes(gender)}
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
                                                        active={draftFilters.tryouts.ageGroups.includes(ageGroup)}
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
                            {draftFilters.entityType.includes('MATCH') && (
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
                                                        active={draftFilters.matches.subtypes.includes(option.value)}
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
                                                        checked={draftFilters.matches.dateWindow === option.value}
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
                                                        active={draftFilters.matches.timeWindows.includes(window)}
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
                                                        active={draftFilters.matches.genders.includes(gender)}
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
                                                        active={draftFilters.matches.levels.includes(level)}
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
                                                        active={draftFilters.matches.ageGroups.includes(ageGroup)}
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

                    <div className="shrink-0 border-t border-[#ffffff0d] px-4 py-4">
                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={onApply}
                                className="map-primary-button flex flex-1 items-center justify-center gap-2"
                            >
                                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                {applying ? 'Searching...' : 'Apply filters'}
                            </button>
                            <button
                                type="button"
                                onClick={onResetAll}
                                className="map-secondary-button whitespace-nowrap"
                                disabled={activeCount === 0}
                            >
                                Reset
                            </button>
                        </div>
                        {resultCount != null && (
                            <p className="mt-2 text-center text-xs font-semibold text-[#a1a1aa]">{resultCount} results</p>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
};
