import { useMemo, useState, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Building2, ChevronDown, ChevronRight, Crosshair, Filter, GripVertical, Loader2, MapPin, Navigation, Search, ShieldCheck, SlidersHorizontal, Trophy, Users, X } from 'lucide-react';
import { type MapEntityType } from '../../api/map';
export type { MapEntityType };
import { TrainingPriceFields } from './TrainingPriceFields';
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
    birthYear?: number;
    includeWaitlist?: boolean;
    trainingMinPrice?: string;
    trainingMaxPrice?: string;
    trainingCurrency?: string;
    trainingPeriod?: string;
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
    entityType: ['CLUB', 'STADIUM', 'MATCH', 'TOURNAMENT'],
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
    STADIUM: 'Stadiums',
    CLUB: 'Clubs',
    TRYOUT: 'Tryouts',
    MATCH: 'Matches',
    TOURNAMENT: 'Tournaments',
    CLUB_NEED: 'Club Needs'
};

const ENTITY_ICONS: Record<MapEntityType, ReactNode> = {
    STADIUM: <MapPin className="h-4 w-4" />,
    CLUB: <Building2 className="h-4 w-4" />,
    TRYOUT: <Users className="h-4 w-4" />,
    MATCH: <Trophy className="h-4 w-4" />,
    TOURNAMENT: <Trophy className="h-4 w-4" />,
    CLUB_NEED: <Crosshair className="h-4 w-4" />
};

const ENTITY_DESCRIPTIONS: Record<MapEntityType, string> = {
    STADIUM: 'Find a pitch and see available times',
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

    if (filters.clubs.trainingMinPrice) count += 1;
    if (filters.clubs.trainingMaxPrice) count += 1;
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
    <section className="border-t border-[color:var(--color-border)] dark:border-[color:var(--color-border)]/15">
        <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 py-3 text-left">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-accent)] dark:text-[var(--color-secondary)]">{icon}</span>
                <h3 className="truncate text-xs font-black uppercase tracking-[0.12em] text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">{title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {helpText ? <MapHelpHint text={helpText} align="right" /> : null}
                {expanded ? <ChevronDown className="h-4 w-4 text-[color:var(--color-muted)]" /> : <ChevronRight className="h-4 w-4 text-[color:var(--color-muted)]" />}
            </div>
        </button>
        {expanded && <div className="space-y-4 border-l-2 border-[var(--color-accent)]/70 pb-5 pl-4 pt-1">{children}</div>}
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
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">{label}</span>
        <div className="flex min-h-[36px] items-center gap-2 border-b-2 border-[color:var(--color-border)] bg-transparent px-1 transition-colors focus-within:border-[var(--color-accent)] dark:border-[color:var(--color-border)]/20">
            <Search className="h-4 w-4 text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]" />
            <input
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full border-0 bg-transparent text-sm text-[color:var(--color-text)] outline-none placeholder:text-[color:var(--color-muted)] dark:text-[color:var(--color-text)] dark:placeholder:text-[color:var(--color-muted)]"
            />
        </div>
    </label>
);

const ToggleChip = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className={`inline-flex min-h-[28px] items-center justify-center gap-1 rounded-[3px] border px-2.5 text-[11px] font-bold transition-colors ${
            active ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)] dark:border-[var(--color-accent)] dark:bg-[var(--color-accent)] dark:text-[var(--color-on-accent)]' : 'border-[color:var(--color-border)] bg-transparent text-[color:var(--color-muted)] hover:border-[color:var(--color-border)] hover:text-[color:var(--color-text)] dark:border-[color:var(--color-border)]/15 dark:text-[color:var(--color-muted)] dark:hover:border-[color:var(--color-border)]/40 dark:hover:text-[color:var(--color-text)]'
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
    <label className="flex cursor-pointer items-center justify-between gap-2.5 border-b border-[color:var(--color-border)] py-2 transition-colors hover:border-[var(--color-accent)] dark:border-[color:var(--color-border)]/10">
        <span className="min-w-0 text-sm font-semibold text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">{label}</span>
        <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--color-accent)]" />
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
    <label className="flex cursor-pointer items-center justify-between gap-2.5 border-b border-[color:var(--color-border)] py-2 transition-colors hover:border-[var(--color-accent)] dark:border-[color:var(--color-border)]/10">
        <span className="text-sm font-semibold text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">{label}</span>
        <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-[var(--color-accent)]" />
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
                className={`map-modal-backdrop fixed bottom-0 left-0 right-0 top-[var(--app-active-header-height)] z-[1090] bg-[color:var(--color-overlay)]/40 transition-[opacity,top] dark:bg-[color:var(--color-overlay)]/60 ${
                    isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={onClose}
            />
            <aside
                data-visible={isVisible}
                style={{ width: `min(92vw, ${clampedWidth}px)` }}
                className={`map-advanced-rail pointer-events-auto fixed bottom-0 left-0 top-[var(--app-active-header-height)] z-[1100] border-r-2 border-[color:var(--color-border)] bg-[var(--color-elevated)] transition-[transform,top] duration-200 dark:border-[var(--color-accent)]/70 dark:bg-[var(--color-page)] ${
                    isVisible ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex h-full min-h-0 flex-col">
                    <header className="shrink-0 border-b-2 border-[color:var(--color-border)] bg-[var(--color-accent)] px-4 pb-3 pt-4 text-[var(--color-on-accent)] dark:border-[var(--color-accent)]/70 dark:bg-[var(--color-accent)]">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-[color:var(--color-border)]/60 text-[color:var(--color-text)]">
                                        <SlidersHorizontal className="h-4 w-4" />
                                    </span>
                                    <div className="flex min-w-0 items-center gap-2">
                                        <div>
                                            <h2 className="truncate text-lg font-black uppercase tracking-[0.08em] text-[color:var(--color-text)]">Advanced filters</h2>
                                            <p className="mt-0.5 text-xs text-[var(--color-text)]/80">
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
                            <button type="button" onClick={onClose} aria-label="Close filters" className="map-wide-hidden inline-flex h-7 w-7 items-center justify-center border border-[color:var(--color-border)]/60 text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-elevated)] hover:text-[var(--color-accent)]">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 border-l-2 border-[color:var(--color-border)] bg-[var(--color-accent)]/20 py-2 pl-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-text)]/70">Search status</p>
                                <p className="mt-0.5 text-sm font-bold text-[color:var(--color-text)]">
                                    {hasPendingChanges ? 'Changes ready to apply' : resultCount == null ? 'Ready' : `${resultCount} loaded results`}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onResetAll}
                                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap border border-[color:var(--color-border)]/60 bg-transparent px-3 py-1.5 text-xs font-bold text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-elevated)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={activeCount === 0 && !hasPendingChanges}
                            >
                                Reset all
                            </button>
                        </div>
                    </header>

                    <div className="shrink-0 border-b border-[color:var(--color-border)] px-4 pb-4 pt-4 dark:border-[color:var(--color-border)]/15">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--color-text)] dark:text-[color:var(--color-text)]">Show on map</p>
                            <span className="border-l-2 border-[var(--color-accent)] pl-2 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--color-accent)] dark:text-[var(--color-secondary)]">
                                {viewerMode === 'guest' ? 'Public football' : viewerMode === 'player' ? 'Player discovery' : 'Staff operations'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 border-l border-t border-[color:var(--color-border)] dark:border-[color:var(--color-border)]/25">
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
                                        className={`flex items-center justify-start gap-2 border-b border-r border-[color:var(--color-border)] px-3 py-2.5 text-xs font-bold transition-colors dark:border-[color:var(--color-border)]/25 ${
                                            isActive
                                                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] dark:bg-[var(--color-accent)] dark:text-[var(--color-on-accent)]'
                                                : 'bg-transparent text-[color:var(--color-muted)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-text)] dark:text-[color:var(--color-muted)] dark:hover:bg-[color:var(--color-elevated)] dark:hover:text-[color:var(--color-text)]'
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
                                    ? 'border-[var(--color-accent)] text-[var(--color-accent)] dark:border-[var(--color-accent)] dark:text-[var(--color-secondary)]'
                                    : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-[color:var(--color-border)] hover:text-[color:var(--color-text)] dark:border-[color:var(--color-border)]/20 dark:text-[color:var(--color-muted)] dark:hover:border-[color:var(--color-border)] dark:hover:text-[color:var(--color-text)]'
                            }`}
                        >
                            <Filter className="h-3.5 w-3.5" />
                            All types
                        </button>
                        {viewerMode === 'staff' && (
                            <div className="mt-3">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Staff shortcuts</p>
                                <div className="grid grid-cols-3 border-y border-[color:var(--color-border)] dark:border-[color:var(--color-border)]/15">
                                    <button type="button" onClick={() => applyPreset('RECRUIT')} className="border-r border-[color:var(--color-border)] px-2 py-2 text-[11px] font-black uppercase tracking-wide text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-on-accent)] dark:border-[color:var(--color-border)]/15 dark:text-[var(--color-on-accent)]">Recruit</button>
                                    <button type="button" onClick={() => applyPreset('FIXTURES')} className="border-r border-[color:var(--color-border)] px-2 py-2 text-[11px] font-black uppercase tracking-wide text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-on-accent)] dark:border-[color:var(--color-border)]/15 dark:text-[var(--color-on-accent)]">Fixtures</button>
                                    <button type="button" onClick={() => applyPreset('EVENTS')} className="px-2 py-2 text-[11px] font-black uppercase tracking-wide text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-on-accent)] dark:text-[var(--color-on-accent)]">Events</button>
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
                                        <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Sort results</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Radius</span>
                                            <span className="border-b border-[var(--color-accent)] px-1.5 py-0.5 text-xs font-bold text-[var(--color-accent)] dark:text-[var(--color-secondary)]">
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
                                            className="mt-3 h-2 w-full cursor-pointer appearance-none bg-[color:var(--color-inset)] accent-[var(--color-accent)] dark:bg-[color:var(--color-ink)]/10"
                                        />
                                        <div className="mt-2 flex items-center justify-between text-xs text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">
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
                                                <p className="border-l-2 border-[color:var(--color-warning)] bg-[color:var(--color-warning)]/60 px-3 py-2 text-[11px] leading-5 text-[color:var(--color-muted)] dark:bg-[color:var(--color-warning)]/[0.06] dark:text-[color:var(--color-muted)]">
                                                    Accepting players means the club is currently open to player enquiries or applications.
                                                </p>
                                            </div>
                                        )}

                                        <div>
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Position needed</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Age group</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Team</span>
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
                                <section className="border-y border-[var(--color-accent)]/40 bg-[var(--color-inset)]/60 py-3 dark:border-[var(--color-accent)]/25 dark:bg-[var(--color-accent)]/[0.05]">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-accent)] dark:text-[var(--color-secondary)]">Active filters</p>
                                        <span className="text-[11px] font-bold text-[var(--color-accent)] dark:text-[var(--color-secondary)]">{activeSummaries.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {activeSummaries.map((summary) => (
                                            <button
                                                key={summary.key}
                                                type="button"
                                                onClick={summary.remove}
                                                className="inline-flex min-h-7 items-center gap-1.5 rounded-[3px] border border-[var(--color-accent)]/50 bg-transparent px-2.5 text-[11px] font-bold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-on-accent)] dark:border-[var(--color-accent)]/30 dark:text-[var(--color-on-accent)]"
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
                                className="flex w-full items-center justify-between border-y border-[color:var(--color-border)] bg-transparent py-3 text-xs font-black uppercase tracking-[0.12em] text-[color:var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] dark:border-[color:var(--color-border)]/20 dark:text-[color:var(--color-secondary)] dark:hover:border-[var(--color-accent)] dark:hover:text-[var(--color-secondary)]"
                            >
                                <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Detailed filters</span>
                                <ChevronDown className={`h-4 w-4 transition-transform ${expanded.advanced ? 'rotate-180' : ''}`} />
                            </button>

                            {draftFilters.entityType.includes('CLUB') && <TrainingPriceFields filters={draftFilters} onChange={onDraftChange} />}
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Club type</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Age group</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Gender</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Level</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Date window</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Time of day</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Gender</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Age group</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Match type</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Date window</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Time of day</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Gender</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Level</span>
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
                                            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">Age group</span>
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

                    <div className="shrink-0 border-t-2 border-[color:var(--color-border)] bg-[var(--color-elevated)] px-4 py-3 dark:border-[var(--color-accent)]/70 dark:bg-[var(--color-page)]">
                        <button
                            type="button"
                            onClick={onApply}
                            disabled={applying}
                            className="flex w-full items-center justify-center gap-2 border-2 border-[var(--color-accent)] bg-[var(--color-accent)] py-3 text-sm font-black uppercase tracking-[0.08em] text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[var(--color-accent)]"
                        >
                            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            {applying ? 'Searching...' : hasPendingChanges ? 'Show updated results' : 'Refresh results'}
                        </button>
                        <div className="mt-2 flex items-center justify-between gap-2.5">
                            <button
                                type="button"
                                onClick={onResetAll}
                                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap border-b border-[color:var(--color-border)] px-1 py-1.5 text-xs font-bold text-[color:var(--color-muted)] transition-colors hover:border-[color:var(--color-border)] hover:text-[color:var(--color-text)] dark:border-[color:var(--color-border)]/20 dark:text-[color:var(--color-secondary)] dark:hover:border-[color:var(--color-border)] dark:hover:text-[color:var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={activeCount === 0 && !hasPendingChanges}
                            >
                                Reset
                            </button>
                            {resultCount != null && (
                                <p className="text-xs font-semibold text-[color:var(--color-muted)] dark:text-[color:var(--color-muted)]">{resultCount} loaded results</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onBackToSimple}
                            className="mt-3 flex w-full items-center justify-between border-t border-[color:var(--color-border)] pt-3 text-xs font-bold text-[color:var(--color-muted)] transition-colors hover:text-[color:var(--color-text)] dark:border-[color:var(--color-border)]/15 dark:text-[color:var(--color-secondary)] dark:hover:text-[color:var(--color-text)]"
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
                    className="absolute right-0 top-0 z-10 -mr-1 hidden h-full w-3 cursor-ew-resize touch-none select-none border-l border-transparent text-[color:var(--color-muted)] hover:border-l-[var(--color-accent)] hover:text-[var(--color-accent)] dark:text-[color:var(--color-muted)] dark:hover:border-l-[var(--color-accent)] dark:hover:text-[var(--color-secondary)] xl:block"
                >
                    <div className="flex h-full items-center justify-center">
                        <GripVertical className="h-4 w-4" />
                    </div>
                </div>
            </aside>
        </>
    );
};
