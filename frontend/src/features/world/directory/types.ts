import type { ComponentType, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { MapLine, MapReach } from '../stage/stageContext';
import type { ResultGroup } from './groups';
import type { PinSummary } from './panelGroups';
import type { AuthSessionId } from '../../../utils/authStorage';
import type { Approximate, WorldMapTone } from '../map/WorldMap';
import type { WorldRole } from '../front/roles';
import type { PlaceKind, Places } from './places';

export interface FilterOption {
    value: string; label: string; /** Offered only to signed-in people. */ signedIn?: boolean;
    /** A symbol shown beside the label (service tiles, a format's picture). */ icon?: ComponentType<{ 'aria-hidden'?: boolean | 'true' }>;
    /** Drawn apart from a ladder's rungs (a goalkeeper licence). */ apart?: boolean;
}

/** A choice the browser remembers between World pages (for example the child a parent is searching for). */
export interface RememberedChoice { read: () => string | undefined; write: (value: string) => void }

interface FilterBase {
    key: string;
    label: string;
    /** Shown as a pill (or a line) of its own; the rest sit in More filters. */
    primary?: boolean;
    /** Shown only when this returns true, for filters that apply to one choice of another filter. */
    when?: (query: DirectoryQuery) => boolean;
    /**
     * Where the list is rather than what narrows it (a day on the strip, the results end). It has no control of its own
     * (its page draws one), is never "a filter" (no chip, not cleared, no "nothing matches this search") and is dropped
     * with the tab. `load` and links still see it.
     */
    nav?: true;
}
/** A set of options. */
export interface ChoiceFilter extends FilterBase {
    kind: 'choice'; options: FilterOption[]; multi?: boolean; allLabel?: string;
    /** Used when the URL has no value; omit for an "all" choice. */ fallback?: string;
    /** Used when the URL has no value, and updated when the person chooses. */ remember?: RememberedChoice;
    /**
     * How the choices are drawn: a small pitch to pick positions on, a ladder of levels (each "or higher"), or tiles
     * with symbols. A plain list when absent.
     */
    look?: 'pitch' | 'ladder' | 'tiles';
}
/** An on/off filter sent as `key=true`. */
export interface ToggleFilter extends FilterBase { kind: 'toggle' }
export interface TextFilter extends FilterBase { kind: 'text'; placeholder?: string; /** The keyboard a phone shows ("numeric" for whole numbers). */ inputMode?: 'numeric' | 'text' }
export interface DateFilter extends FilterBase { kind: 'date'; /** Dates before this day (YYYY-MM-DD) cannot be chosen. */ min?: () => string }
/** From–to whole numbers (a training fee), kept as one value `min-max` where either end may be empty ("50-", "-150"). */
export interface RangeFilter extends FilterBase { kind: 'range'; /** Said after the numbers ("GEL / month"). */ unit?: string }
/** The two ends of a range filter's value. */
export const rangeOf = (value: string): [string, string] => { const [min = '', max = ''] = value.split('-'); return [min, max]; };
/** A range filter's value for its two ends; empty when both are. */
export const rangeValue = (min: string, max: string) => min || max ? `${min}-${max}` : '';
/** What a range says on its pill or line: "50–150 GEL / month", "from 50", "up to 150", else "Any". */
export function rangeLabel(filter: RangeFilter, value: string, t: (en: string, vars?: Record<string, string | number>) => string) {
    const [min, max] = rangeOf(value);
    const unit = filter.unit ? ` ${filter.unit}` : '';
    return min && max ? `${min}–${max}${unit}` : min ? t('from {value}', { value: min + unit }) : max ? t('up to {value}', { value: max + unit }) : t('Any');
}
/** A scope that arrives in a link (one club, one competition). It has no control; it shows as a removable chip. */
export interface ScopeFilter extends FilterBase {
    kind: 'scope';
    /** What the chip calls this scope, such as the club's name; `label` is shown until it is known or if it is not. */
    name?: (value: string, signal: AbortSignal) => Promise<string | null>;
}
/** Results within `km` of the person's device location, sent as "lat,lng". Location is asked for only when chosen. */
export interface NearbyFilter extends FilterBase { kind: 'nearby'; km: number }
export type FilterDef = ChoiceFilter | ToggleFilter | TextFilter | DateFilter | RangeFilter | ScopeFilter | NearbyFilter;

/** The choices a person may make: some are offered only once signed in. */
export const offered = (filter: ChoiceFilter, signedIn: boolean) => filter.options.filter(option => signedIn || !option.signedIn);

/** The position a nearby filter holds, if it is a valid one. */
export function nearbyPoint(query: DirectoryQuery, key: string) {
    const [lat, lng] = (query.values[key]?.[0] ?? '').split(',').map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
}

export interface DirectoryQuery {
    q: string;
    sort: string;
    /** Values of the filters that apply to this query; a filter that does not apply has none. */
    values: Record<string, string[]>;
}
export const first = (query: DirectoryQuery, key: string) => query.values[key]?.[0] ?? '';

export interface DirectoryPage<T> {
    items: T[]; total: number | null; hasMore: boolean;
    /** Shown instead of results when the search cannot be answered as asked. */ notice?: string;
}
/** The World area a list is narrowed to: the city and its centre, or a null city for everywhere ("Anywhere"). */
export interface DirectoryArea { city: string | null; centre: { lat: number; lng: number } | null }
export interface LoadContext {
    signal: AbortSignal; sessionId: AuthSessionId; authenticated: boolean; /** Set for sources with `area`. */ area?: DirectoryArea;
    /** The signed-in person (whether they run a tournament is in its staff list). */ userId?: number | null;
}

/**
 * Where a result goes on the map. `pin` groups results at one place (jobs at a club) into one pin with a count;
 * `approximate` marks a result placed at its club (or its competition's ground) because its own place is not known.
 */
export interface Placement {
    lat: number; lng: number; tone: WorldMapTone; label: string; meta?: string; to?: string;
    pin?: string; approximate?: Approximate; /** How a group of these is counted on its pin: [one, other]. */ noun?: [string, string];
    /** The crest of the club the pin is (people counted at their club). */ crest?: string | null;
    /** What the pin's card calls opening `to` ("Open club"); the result's own action when the pin is the result. */ action?: string;
}

/** One side of a match on a Browse line: crest, name, star, score. */
export interface LineSide { name: string; crest?: string | null; mine?: boolean; score?: number | null }
/**
 * A result as one line of the map's "Browse area" panel, in the score-site shape: a time when it is on a date,
 * a crest or face, the name and one line of detail, and one fact on the right.
 */
export interface BrowseLine {
    title: string; detail?: string; to?: string;
    /** A match's two sides, stacked as on a score line, instead of the crest and title. */ sides?: { home: LineSide; away: LineSide };
    /** What opening `to` is called on the chosen line ("Open club", "Open profile"), already translated. */ action?: string;
    /** Opening it shows a peek over the map instead of leaving World (`person:12`); the full page stays one click away. */ peek?: string;
    crest?: { src?: string | null; name: string; round?: boolean };
    when?: { time: string; day?: string };
    fact?: string; factTone?: 'accent' | 'warning' | 'danger';
}

/** What a source's own controls get: the query, and one write of several values (`{ day: ['2026-10-13'], period: [] }`). */
export interface NavProps { query: DirectoryQuery; go: (values: Record<string, string[]>) => void }

/** Who is looking, for a source's defaults: their World role and whether they chose a child. */
export interface DefaultsContext { role: WorldRole; child: boolean; signedIn: boolean }

/** One searchable list in a directory. A directory with several sources shows them as tabs. */
export interface DirectorySource<T> {
    id: string;
    label: string;
    /** The tab's name when it differs from `label` (for example "All competitions"). */
    tabLabel?: string;
    /** The tab's symbol. */
    icon?: LucideIcon;
    /** The colour of this list's pins, shown as a dot on its kind in the Map tab's column. */
    tone?: WorldMapTone;
    /**
     * How many results the list has before any filter, for the tab (following the World area when `area` is set); a count
     * of things waiting for the person comes with the warning tone ("My arrangements ●3").
     */
    count?: (context: LoadContext) => Promise<number | { count: number; tone: 'warning'; /** What the count is, in words ("need you"). */ label: string } | null>;
    /** The page's subtitle while this list is shown. */
    subtitle?: string;
    noun: [one: string, other: string];
    searchLabel: string;
    searchPlaceholder: string;
    filters: FilterDef[];
    sorts?: FilterOption[];
    /** Whether the sort applies to this query (some lists keep their own order). */
    sortable?: (query: DirectoryQuery) => boolean;
    pageSize: number;
    /** When set, signed-out visitors see this reason and a sign-in action instead of results. */
    signInReason?: string;
    /** A personal list (my arrangements, my competitions): its tab is shown only to signed-in people. */
    personal?: boolean;
    /** Changes when something outside the query changes what `load` returns, so results reload. */
    version?: string;
    /** A live list (fixtures and results): reloaded quietly this often, and when the window regains focus; per query when a function. */
    refreshMs?: number | ((query: DirectoryQuery) => number | undefined);
    load: (query: DirectoryQuery, page: number, context: LoadContext) => Promise<DirectoryPage<T>>;
    key: (item: T) => string;
    /** The result as one row of the list (`ResultRow`, the clubs list's row: every list reads the same way); it returns a list item. */
    Item: ComponentType<{ item: T }>;
    /** The result as one line of the map's "Browse area" panel; `places` give it crests (looked up while the map is open). */
    line: (item: T, places?: Places) => BrowseLine;
    /** Work that belongs beside these results, shown above them (for example adding a past match). */
    Tools?: ComponentType<NavProps & { refresh: () => void }>;
    /** Where the list is, floating at the map's top left (the day strip); under the header when the map is folded or narrow. */
    Top?: ComponentType<NavProps>;
    /** The heading under the map, when it is not the list's name ("Tuesday 13 October"). */
    heading?: (query: DirectoryQuery) => string | undefined;
    /** Controls beside that heading (the day before and after). */
    HeadTools?: ComponentType<NavProps>;
    /** What an empty list says, when the source knows better than "nothing here" (the next matchday). */
    Empty?: ComponentType<NavProps & { filtered: boolean; onClear?: () => void }>;
    /**
     * The list follows the World area (`near`): the area reaches `load` in its context, and results wait for it. `true`
     * narrows the list to the area; `'nearest'` keeps everyone and puts the nearest first; `'partly'` narrows what the list
     * finds but keeps the person's own wherever they are, so its count does not say "near".
     */
    area?: boolean | 'nearest' | 'partly';
    /** Who the list is narrowed to (the child chosen in the World bar, "Nino (9)"), so an empty list can say so. */
    forWhom?: string;
    /** Where a result goes on the map. Results without a place stay in the list and are counted as such. */
    place?: (item: T, places: Places) => Placement | null;
    /** A stated reach drawn around the chosen result (a referee's area). */
    reach?: (item: T) => MapReach | null;
    /** The chosen result's away day: a line from where the travelling side (or the viewer's club) comes from to its ground. */
    away?: (item: T, places: Places, viewer: { clubId: number | null }) => MapLine | null;
    /**
     * Results shown in groups, in the Browse area and below the map (people by their club). A group is a pin when its
     * results share one. Groups of one result join a last group called `rest`, when given, unless they have a `rank`.
     */
    groups?: {
        of: (item: T, query: DirectoryQuery) => ResultGroup; rest?: string;
        /** Shown even when empty (lanes), in rank order. */ always?: ResultGroup[];
        /** A group's detail from its results (the ground they all share). */ describe?: (items: T[]) => string | undefined;
        /** The loaded results are not each group's whole (the backend pages them in another order): headers show no count. */ uncounted?: boolean;
    };
    /** The Browse area groups by where (one group per pin, or by a place the result names, its city) instead of by the list's groups. */
    panel?: 'pin' | ((item: T) => ResultGroup);
    /** What the results at one pin have in common: the place's name, a detail ("10:30–15:00") and the pin's chip ("11:00"). */
    where?: (items: T[]) => PinSummary;
    /** Places looked up for results that carry no coordinates of their own (clubs, trials, competitions…). */
    placeKinds?: PlaceKind[];
    /** False when this query has nothing to put on a map (referees cover areas, not places). */
    mapped?: (query: DirectoryQuery) => boolean;
    /** Filters pre-chosen for who is looking, written once when the tab opens without filters of its own. */
    defaults?: (context: DefaultsContext) => Record<string, string[]>;
    empty: { title: string; body: string; action?: ReactNode };
}

// The engine handles sources of different item types side by side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySource = DirectorySource<any>;
