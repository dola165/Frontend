import { useMemo, useState, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Building2, ChevronDown, ChevronRight, Crosshair, Filter, GripVertical, Loader2, MapPin, Navigation, Search, ShieldCheck, SlidersHorizontal, Trophy, Users, X } from 'lucide-react';
import { type MapEntityType } from '../../api/map';
export type { MapEntityType };
import { usePersistedState } from '../../utils/usePersistedState';
import { MapHelpHint } from './MapHelpHint';
import { MapCountryCityFields } from './MapCountryCityFields';

export type MapSortMode = 'RELEVANCE' | 'SOONEST' | 'DISTANCE' | 'NAME';
export type MapTimeWindow = 'Morning' | 'Afternoon' | 'Evening';
export type MapDateWindow = 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'NEXT_90_DAYS' | 'ANY';
export type MapGender = 'Boys' | 'Girls' | 'Men' | 'Women' | 'Mixed';
export type MapLevel = 'Youth' | 'Academy' | 'Amateur' | 'Grassroots';
export type MapMatchSubtype = 'FRIENDLY' | 'COMPETITIVE';
export type MapTravelPreference = 'HOME_ONLY' | 'WILL_TRAVEL' | 'NEUTRAL' | 'FLEXIBLE';
export type MapLocationState = 'PINNED' | 'OPEN_VENUE';
export type MapChallengeState = 'OPEN' | 'PENDING' | 'CONFIRMED';
export type MapPosition =
    | 'GOALKEEPER'
    | 'CENTER_BACK'
    | 'FULLBACK'
    | 'LEFT_BACK'
    | 'RIGHT_BACK'
    | 'DEFENSIVE_MIDFIELDER'
    | 'CENTRAL_MIDFIELDER'
    | 'ATTACKING_MIDFIELDER'
    | 'WINGER'
    | 'LEFT_WINGER'
    | 'RIGHT_WINGER'
    | 'STRIKER'
    | 'FORWARD';
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
    positions: MapPosition[];
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
    /** Role-gated entity types (WEB_APP_MASTER_PLAN.md §3.3): restricted viewers only get CLUB; staff may also get MATCH + TOURNAMENT. */
    allowedEntityTypes: MapEntityType[];
    /** Used to distinguish a changed draft from the filters currently painted on the map. */
    appliedFilters: MapFilters;
    viewerMode: 'guest' | 'player' | 'staff';
    onBackToSimple?: () => void;
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
const POSITION_OPTIONS: Array<{ value: MapPosition; label: string }> = [
    { value: 'GOALKEEPER', label: 'Goalkeeper' },
    { value: 'CENTER_BACK', label: 'Centre back' },
    { value: 'FULLBACK', label: 'Full-back' },
    { value: 'LEFT_BACK', label: 'Left-back' },
    { value: 'RIGHT_BACK', label: 'Right-back' },
    { value: 'DEFENSIVE_MIDFIELDER', label: 'Defensive mid' },
    { value: 'CENTRAL_MIDFIELDER', label: 'Central mid' },
    { value: 'ATTACKING_MIDFIELDER', label: 'Attacking mid' },
    { value: 'WINGER', label: 'Winger' },
    { value: 'LEFT_WINGER', label: 'Left winger' },
    { value: 'RIGHT_WINGER', label: 'Right winger' },
    { value: 'STRIKER', label: 'Striker' },
    { value: 'FORWARD', label: 'Forward' }
];
const QUICK_AGE_GROUPS = ['U12', 'U14', 'U16', 'U18', 'Senior'];

// Shared with MapPage; keeping the default beside the filter schema makes drift visible.
// eslint-disable-next-line react-refresh/only-export-components
export const defaultMapFilters: MapFilters = {
    entityType: ['CLUB', 'MATCH', 'TOURNAMENT'],
    sortBy: 'RELEVANCE',
    distanceKm: 50,
    positions: [],
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
    count += countArrayDelta(filters.positions, defaultMapFilters.positions);
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
    <section className="border-t border-slate-300 dark:border-white/15">
        <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 py-3 text-left">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[#3f7666] dark:text-[#78a394]">{icon}</span>
                <h3 className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-900 dark:text-slate-100">{title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {helpText ? <MapHelpHint text={helpText} align="right" /> : null}
                {expanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
            </div>
        </button>
        {expanded && <div className="space-y-4 border-l-2 border-[#5a8778]/70 pb-5 pl-4 pt-1">{children}</div>}
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
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</span>
        <div className="flex min-h-[36px] items-center gap-2 border-b-2 border-slate-300 bg-transparent px-1 transition-colors focus-within:border-[#4a796b] dark:border-white/20">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
        </div>
    </label>
);

const ToggleChip = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className={`inline-flex min-h-[28px] items-center justify-center gap-1 rounded-[3px] border px-2.5 text-[11px] font-bold transition-colors ${
            active ? 'border-[#315f53] bg-[#3f7666] text-white dark:border-[#78a394] dark:bg-[#557f70] dark:text-white' : 'border-slate-300 bg-transparent text-slate-600 hover:border-slate-700 hover:text-slate-900 dark:border-white/15 dark:text-slate-400 dark:hover:border-white/40 dark:hover:text-slate-100'
        }`}
    >
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
    <label className="flex cursor-pointer items-center justify-between gap-2.5 border-b border-slate-200 py-2 transition-colors hover:border-[#5a8778] dark:border-white/10">
        <span className="min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[#3f7666]" />
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
    <label className="flex cursor-pointer items-center justify-between gap-2.5 border-b border-slate-200 py-2 transition-colors hover:border-[#5a8778] dark:border-white/10">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-[#3f7666]" />
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
    allowedEntityTypes,
    appliedFilters,
    viewerMode,
    onBackToSimple = () => undefined
}: MapFilterSidebarProps) => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        place: true,
        browse: true,
        playerFit: true,
        advanced: true,
        location: false,
        clubs: false,
        tryouts: false,
        matches: false
    });

    const activeCount = useMemo(() => countActiveFilters(draftFilters), [draftFilters]);
    const hasPendingChanges = useMemo(
        () => JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters),
        [appliedFilters, draftFilters]
    );
    const updateFilters = (updater: (current: MapFilters) => MapFilters) => {
        onDraftChange(updater(draftFilters));
    };

    const toggleExpanded = (key: string) => {
        setExpanded((current) => ({ ...current, [key]: !current[key] }));
    };

    // Resizable drawer: full viewport height again (the old bottom grip +
    // height resize are gone); the WIDTH is dragged from the RIGHT-EDGE grip
    // (pull outward — right — to widen), persisted, and mirrored into the
    // --map-filter-w CSS var so other components can offset from the drawer.
    // A readable 340–440px range prevents dense football filters from collapsing.
    const [filterWidth, setFilterWidth] = usePersistedState<number>('map.filterWidth', 380);
    const FILTER_WIDTH_MIN = 340;
    const FILTER_WIDTH_MAX = 440;
    const clampedWidth = Math.min(Math.max(filterWidth, FILTER_WIDTH_MIN), FILTER_WIDTH_MAX);

    useEffect(() => {
        document.documentElement.style.setProperty('--map-filter-w', `${clampedWidth}px`);
    }, [clampedWidth]);

    // Native pointer drag: pointerdown records width + cursor X, the window
    // listeners own the move/up; moving the edge right (outward) widens.
    const resizeStartRef = useRef<{ startWidth: number; startX: number } | null>(null);
    useEffect(() => {
        const onPointerMove = (event: PointerEvent) => {
            const start = resizeStartRef.current;
            if (!start) return;
            const next = start.startWidth + (event.clientX - start.startX);
            setFilterWidth(Math.min(Math.max(next, FILTER_WIDTH_MIN), FILTER_WIDTH_MAX));
        };
        const onPointerUp = () => {
            resizeStartRef.current = null;
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        return () => {
            resizeStartRef.current = null;
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [setFilterWidth]);

    const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        resizeStartRef.current = { startWidth: clampedWidth, startX: event.clientX };
    };

    // Clubs don't have dates, so "Soonest" and "Best fit" are meaningless for club-only browsing.
    const clubsOnly = draftFilters.entityType.length === 1 && draftFilters.entityType[0] === 'CLUB';
    const visibleSortOptions = useMemo(
        () => (clubsOnly ? SORT_OPTIONS.filter((o) => o.value === 'DISTANCE' || o.value === 'NAME') : SORT_OPTIONS),
        [clubsOnly]
    );

    const toggleSharedAgeGroup = (ageGroup: string) => {
        updateFilters((current) => {
            const removing = current.clubs.ageGroups.includes(ageGroup) || current.tryouts.ageGroups.includes(ageGroup);
            const update = (values: string[]) => removing
                ? values.filter((entry) => entry !== ageGroup)
                : [...values.filter((entry) => entry !== ageGroup), ageGroup];
            return {
                ...current,
                clubs: { ...current.clubs, ageGroups: update(current.clubs.ageGroups) },
                tryouts: { ...current.tryouts, ageGroups: update(current.tryouts.ageGroups) }
            };
        });
    };

    const toggleSharedGender = (gender: MapGender) => {
        updateFilters((current) => {
            const removing = current.clubs.genders.includes(gender) || current.tryouts.genders.includes(gender);
            const update = (values: MapGender[]) => removing
                ? values.filter((entry) => entry !== gender)
                : [...values.filter((entry) => entry !== gender), gender];
            return {
                ...current,
                clubs: { ...current.clubs, genders: update(current.clubs.genders) },
                tryouts: { ...current.tryouts, genders: update(current.tryouts.genders) }
            };
        });
    };

    const applyPreset = (preset: 'RECRUIT' | 'FIXTURES' | 'EVENTS') => {
        if (preset === 'RECRUIT') {
            updateFilters((current) => ({ ...current, entityType: ['CLUB'] }));
            return;
        }
        if (preset === 'FIXTURES') {
            updateFilters((current) => ({ ...current, entityType: ['MATCH'] }));
            return;
        }
        updateFilters((current) => ({ ...current, entityType: ['TOURNAMENT'] }));
    };

    const activeSummaries: Array<{ key: string; label: string; remove: () => void }> = [];
    if (draftFilters.distanceKm !== defaultMapFilters.distanceKm) {
        activeSummaries.push({
            key: 'radius',
            label: `${draftFilters.distanceKm} km`,
            remove: () => updateFilters((current) => ({ ...current, distanceKm: defaultMapFilters.distanceKm }))
        });
    }
    if (draftFilters.clubs.openTryoutsOnly) {
        activeSummaries.push({
            key: 'accepting',
            label: 'Accepting players',
            remove: () => updateFilters((current) => ({ ...current, clubs: { ...current.clubs, openTryoutsOnly: false } }))
        });
    }
    if (draftFilters.clubs.officialOnly) {
        activeSummaries.push({
            key: 'verified',
            label: 'Verified',
            remove: () => updateFilters((current) => ({ ...current, clubs: { ...current.clubs, officialOnly: false } }))
        });
    }
    draftFilters.positions.forEach((position) => activeSummaries.push({
        key: `position-${position}`,
        label: POSITION_OPTIONS.find((option) => option.value === position)?.label ?? position,
        remove: () => updateFilters((current) => ({ ...current, positions: current.positions.filter((entry) => entry !== position) }))
    }));
    Array.from(new Set([...draftFilters.clubs.ageGroups, ...draftFilters.tryouts.ageGroups])).forEach((ageGroup) => activeSummaries.push({
        key: `age-${ageGroup}`,
        label: ageGroup,
        remove: () => updateFilters((current) => ({
            ...current,
            clubs: { ...current.clubs, ageGroups: current.clubs.ageGroups.filter((entry) => entry !== ageGroup) },
            tryouts: { ...current.tryouts, ageGroups: current.tryouts.ageGroups.filter((entry) => entry !== ageGroup) }
        }))
    }));
    Array.from(new Set([...draftFilters.clubs.genders, ...draftFilters.tryouts.genders])).forEach((gender) => activeSummaries.push({
        key: `gender-${gender}`,
        label: gender,
        remove: () => updateFilters((current) => ({
            ...current,
            clubs: { ...current.clubs, genders: current.clubs.genders.filter((entry) => entry !== gender) },
            tryouts: { ...current.tryouts, genders: current.tryouts.genders.filter((entry) => entry !== gender) }
        }))
    }));

    return (
        <>
            <div
                className={`map-modal-backdrop fixed bottom-0 left-0 right-0 top-[var(--app-active-header-height)] z-[1090] bg-slate-900/40 transition-[opacity,top] dark:bg-black/60 ${
                    isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={onClose}
            />
            <aside
                data-visible={isVisible}
                style={{ width: `min(92vw, ${clampedWidth}px)` }}
                className={`map-advanced-rail pointer-events-auto fixed bottom-0 left-0 top-[var(--app-active-header-height)] z-[1100] border-r-2 border-slate-900 bg-[#f7f6f0] transition-[transform,top] duration-200 dark:border-[#5a8778]/70 dark:bg-[#0d1016] ${
                    isVisible ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex h-full min-h-0 flex-col">
                    <header className="shrink-0 border-b-2 border-slate-900 bg-[#3f7666] px-4 pb-3 pt-4 text-white dark:border-[#5a8778]/70 dark:bg-[#163b32]">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/60 text-white">
                                        <SlidersHorizontal className="h-4 w-4" />
                                    </span>
                                    <div className="flex min-w-0 items-center gap-2">
                                        <div>
                                            <h2 className="truncate text-lg font-black uppercase tracking-[0.08em] text-white">Advanced filters</h2>
                                            <p className="mt-0.5 text-xs text-[#edf3f0]/80">
                                                {viewerMode === 'guest'
                                                    ? 'Public football discovery'
                                                    : viewerMode === 'player'
                                                        ? 'Fine-tune your football search'
                                                        : 'Scout clubs, matches and tournaments'}
                                            </p>
                                        </div>
                                        <MapHelpHint
                                            text="Search moves the map. Filters narrow what stays visible or listed."
                                            align="right"
                                        />
                                    </div>
                                </div>
                            </div>
                            <button type="button" onClick={onClose} aria-label="Close filters" className="map-wide-hidden inline-flex h-7 w-7 items-center justify-center border border-white/60 text-white transition-colors hover:bg-white hover:text-[#244c42]">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 border-l-2 border-white bg-[#163b32]/20 py-2 pl-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d7e5e0]/70">Search status</p>
                                <p className="mt-0.5 text-sm font-bold text-white">
                                    {hasPendingChanges ? 'Changes ready to apply' : resultCount == null ? 'Ready' : `${resultCount} loaded results`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onResetAll}
                                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap border border-white/60 bg-transparent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white hover:text-[#244c42] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={activeCount === 0 && !hasPendingChanges}
                            >
                                Reset all
                            </button>
                        </div>
                    </header>

                    <div className="shrink-0 border-b border-slate-300 px-4 pb-4 pt-4 dark:border-white/15">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-100">Show on map</p>
                            <span className="border-l-2 border-[#4a796b] pl-2 text-[9px] font-black uppercase tracking-[0.14em] text-[#315f53] dark:text-[#78a394]">
                                {viewerMode === 'guest' ? 'Public football' : viewerMode === 'player' ? 'Player discovery' : 'Staff operations'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 border-l border-t border-slate-400 dark:border-white/25">
                            {allowedEntityTypes.map((entityType) => {
                                const isActive = draftFilters.entityType.length === 1 && draftFilters.entityType[0] === entityType;
                                return (
                                    <button
                                        key={entityType}
                                        type="button"
                                        title={ENTITY_DESCRIPTIONS[entityType]}
                                        onClick={() =>
                                            updateFilters((current) => ({
                                                ...current,
                                                entityType: [entityType]
                                            }))
                                        }
                                        className={`flex items-center justify-start gap-2 border-b border-r border-slate-400 px-3 py-2.5 text-xs font-bold transition-colors dark:border-white/25 ${
                                            isActive
                                                ? 'bg-[#3f7666] text-white dark:bg-[#557f70] dark:text-white'
                                                : 'bg-transparent text-slate-600 hover:bg-slate-900 hover:text-white dark:text-slate-400 dark:hover:bg-white dark:hover:text-slate-950'
                                        }`}
                                    >
                                        {ENTITY_ICONS[entityType]}
                                        <span className="truncate">{ENTITY_LABELS[entityType]}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            title="Show every allowed entity type"
                            onClick={() =>
                                updateFilters((current) => ({
                                    ...current,
                                    entityType: allowedEntityTypes
                                }))
                            }
                            className={`mt-2 flex w-full items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition-colors ${
                                draftFilters.entityType.length > 1
                                    ? 'border-[#3f7666] text-[#315f53] dark:border-[#78a394] dark:text-[#90b2a6]'
                                    : 'border-slate-300 text-slate-600 hover:border-slate-800 hover:text-slate-900 dark:border-white/20 dark:text-slate-400 dark:hover:border-white dark:hover:text-white'
                            }`}
                        >
                            <Filter className="h-3.5 w-3.5" />
                            All types
                        </button>
                        {viewerMode === 'staff' && (
                            <div className="mt-3">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Staff shortcuts</p>
                                <div className="grid grid-cols-3 border-y border-slate-300 dark:border-white/15">
                                    <button type="button" onClick={() => applyPreset('RECRUIT')} className="border-r border-slate-300 px-2 py-2 text-[11px] font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-[#3f7666] hover:text-white dark:border-white/15 dark:text-slate-300">Recruit</button>
                                    <button type="button" onClick={() => applyPreset('FIXTURES')} className="border-r border-slate-300 px-2 py-2 text-[11px] font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-[#3f7666] hover:text-white dark:border-white/15 dark:text-slate-300">Fixtures</button>
                                    <button type="button" onClick={() => applyPreset('EVENTS')} className="px-2 py-2 text-[11px] font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-[#3f7666] hover:text-white dark:text-slate-300">Events</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-3">
                        <div>
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
                                icon={<SlidersHorizontal className="h-4 w-4" />}
                                title="Browse settings"
                                helpText="Sort changes the order. Radius changes what counts as nearby on the map."
                                expanded={expanded.browse}
                                onToggle={() => toggleExpanded('browse')}
                            >
                                <div className="space-y-5">
                                    <div>
                                        <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Sort results</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Radius</span>
                                            <span className="border-b border-[#4a796b] px-1.5 py-0.5 text-xs font-bold text-[#315f53] dark:text-[#78a394]">
                                                {draftFilters.distanceKm} km
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={5}
                                            max={400}
                                            step={5}
                                            value={draftFilters.distanceKm}
                                            onChange={(event) =>
                                                updateFilters((current) => ({ ...current, distanceKm: Number(event.target.value) }))
                                            }
                                            className="mt-3 h-2 w-full cursor-pointer appearance-none bg-slate-300 accent-[#3f7666] dark:bg-white/10"
                                        />
                                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                            <span>Close by</span>
                                            <span>Wider search</span>
                                        </div>
                                    </div>
                                </div>
                            </RailSection>

                            {viewerMode === 'player' && draftFilters.entityType.includes('CLUB') && (
                                <RailSection
                                    icon={<Users className="h-4 w-4" />}
                                    title="My player fit"
                                    helpText="Choose age, team and position preferences for clubs that are accepting players."
                                    expanded={expanded.playerFit}
                                    onToggle={() => toggleExpanded('playerFit')}
                                >
                                    <div className="space-y-5">
                                        {draftFilters.entityType.includes('CLUB') && (
                                            <div className="space-y-3">
                                                <CheckRow
                                                    checked={draftFilters.clubs.openTryoutsOnly}
                                                    label="Accepting player applications"
                                                    onChange={() => updateFilters((current) => ({
                                                        ...current,
                                                        clubs: { ...current.clubs, openTryoutsOnly: !current.clubs.openTryoutsOnly }
                                                    }))}
                                                />
                                                <CheckRow
                                                    checked={draftFilters.clubs.officialOnly}
                                                    label="Verified clubs only"
                                                    onChange={() => updateFilters((current) => ({
                                                        ...current,
                                                        clubs: { ...current.clubs, officialOnly: !current.clubs.officialOnly }
                                                    }))}
                                                />
                                                <p className="border-l-2 border-amber-500 bg-amber-50/60 px-3 py-2 text-[11px] leading-5 text-slate-600 dark:bg-amber-400/[0.06] dark:text-slate-400">
                                                    Accepting players means the club is currently open to player enquiries or applications.
                                                </p>
                                            </div>
                                        )}

                                        <div>
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Position needed</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {POSITION_OPTIONS.map((option) => (
                                                    <ToggleChip
                                                        key={option.value}
                                                        active={draftFilters.positions.includes(option.value)}
                                                        label={option.label}
                                                        onClick={() => updateFilters((current) => ({
                                                            ...current,
                                                            positions: toggleValue(current.positions, option.value)
                                                        }))}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Age group</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {QUICK_AGE_GROUPS.map((ageGroup) => (
                                                    <ToggleChip
                                                        key={ageGroup}
                                                        active={draftFilters.clubs.ageGroups.includes(ageGroup) || draftFilters.tryouts.ageGroups.includes(ageGroup)}
                                                        label={ageGroup}
                                                        onClick={() => toggleSharedAgeGroup(ageGroup)}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Team</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {GENDER_OPTIONS.map((gender) => (
                                                    <ToggleChip
                                                        key={gender}
                                                        active={draftFilters.clubs.genders.includes(gender) || draftFilters.tryouts.genders.includes(gender)}
                                                        label={gender}
                                                        onClick={() => toggleSharedGender(gender)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </RailSection>
                            )}

                            {activeSummaries.length > 0 && (
                                <section className="border-y border-[#3f7666]/40 bg-[#edf3f0]/60 py-3 dark:border-[#78a394]/25 dark:bg-[#78a394]/[0.05]">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#315f53] dark:text-[#90b2a6]">Active filters</p>
                                        <span className="text-[11px] font-bold text-[#3f7666] dark:text-[#90b2a6]">{activeSummaries.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {activeSummaries.map((summary) => (
                                            <button
                                                key={summary.key}
                                                type="button"
                                                onClick={summary.remove}
                                                className="inline-flex min-h-7 items-center gap-1.5 rounded-[3px] border border-[#3f7666]/50 bg-transparent px-2.5 text-[11px] font-bold text-[#244c42] transition-colors hover:bg-[#3f7666] hover:text-white dark:border-[#78a394]/30 dark:text-[#b6cec5]"
                                                title={`Remove ${summary.label}`}
                                            >
                                                {summary.label}<X className="h-3 w-3" />
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            )}

                            <button
                                type="button"
                                onClick={() => toggleExpanded('advanced')}
                                aria-expanded={expanded.advanced}
                                className="flex w-full items-center justify-between border-y border-slate-400 bg-transparent py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition-colors hover:border-[#3f7666] hover:text-[#315f53] dark:border-white/20 dark:text-slate-300 dark:hover:border-[#78a394] dark:hover:text-[#90b2a6]"
                            >
                                <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Detailed filters</span>
                                <ChevronDown className={`h-4 w-4 transition-transform ${expanded.advanced ? 'rotate-180' : ''}`} />
                            </button>

                            {expanded.advanced && <>
                            <RailSection
                                icon={<MapPin className="h-4 w-4" />}
                                title="Location"
                                helpText="Use city or country to narrow the current result type."
                                expanded={expanded.location}
                                onToggle={() => toggleExpanded('location')}
                            >
                                <MapCountryCityFields
                                    country={draftFilters.clubs.country || draftFilters.matches.country}
                                    city={draftFilters.clubs.city || draftFilters.matches.city}
                                    onCountryChange={(value) => updateFilters((current) => ({
                                        ...current,
                                        clubs: { ...current.clubs, country: value },
                                        tryouts: { ...current.tryouts, country: value },
                                        matches: { ...current.matches, country: value }
                                    }))}
                                    onCityChange={(value) => updateFilters((current) => ({
                                        ...current,
                                        clubs: { ...current.clubs, city: value },
                                        tryouts: { ...current.tryouts, city: value },
                                        matches: { ...current.matches, city: value }
                                    }))}
                                />
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Club type</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Age group</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Gender</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Level</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Date window</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Time of day</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Gender</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Age group</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Match type</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Date window</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Time of day</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Gender</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Level</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Age group</span>
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
                            </>}
                        </div>
                    </div>

                    <div className="shrink-0 border-t-2 border-slate-900 bg-[#f7f6f0] px-4 py-3 dark:border-[#5a8778]/70 dark:bg-[#0d1016]">
                        <button
                            type="button"
                            onClick={onApply}
                            disabled={applying}
                            className="flex w-full items-center justify-center gap-2 border-2 border-[#315f53] bg-[#3f7666] py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#315f53] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#78a394]"
                        >
                            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            {applying ? 'Searching...' : hasPendingChanges ? 'Show updated results' : 'Refresh results'}
                        </button>
                        <div className="mt-2 flex items-center justify-between gap-2.5">
                            <button
                                type="button"
                                onClick={onResetAll}
                                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap border-b border-slate-400 px-1 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900 dark:border-white/20 dark:text-slate-300 dark:hover:border-white dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={activeCount === 0 && !hasPendingChanges}
                            >
                                Reset
                            </button>
                            {resultCount != null && (
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{resultCount} loaded results</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onBackToSimple}
                            className="mt-3 flex w-full items-center justify-between border-t border-slate-300 pt-3 text-xs font-bold text-slate-600 transition-colors hover:text-slate-950 dark:border-white/15 dark:text-slate-300 dark:hover:text-white"
                        >
                            <span>Back to simple filters</span>
                            <span aria-hidden>→</span>
                        </button>
                    </div>
                </div>

                {/* Right-edge resize grip: drag outward (right) to widen, inward to
                    narrow. Absolute overlay, kept out of the content flow; the -mr-1
                    overhang sits on the map edge (overflow is intentionally not
                    clipped so the full strip stays hittable). */}
                <div
                    onPointerDown={startResize}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize filters drawer"
                    className="absolute right-0 top-0 z-10 -mr-1 hidden h-full w-3 cursor-ew-resize touch-none select-none border-l border-transparent text-slate-400 hover:border-l-[#4a796b] hover:text-[#3f7666] dark:text-slate-500 dark:hover:border-l-[#78a394] dark:hover:text-[#78a394] xl:block"
                >
                    <div className="flex h-full items-center justify-center">
                        <GripVertical className="h-4 w-4" />
                    </div>
                </div>
            </aside>
        </>
    );
};
