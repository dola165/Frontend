import type { ComponentType, ReactNode } from 'react';
import type { AuthSessionId } from '../../../utils/authStorage';
import type { Approximate, WorldMapTone } from '../map/WorldMap';
import type { WorldRole } from '../front/roles';
import type { PlaceKind, Places } from './places';

export interface FilterOption { value: string; label: string; /** Offered only to signed-in people. */ signedIn?: boolean }

/** A choice the browser remembers between World pages (for example the child a parent is searching for). */
export interface RememberedChoice { read: () => string | undefined; write: (value: string) => void }

interface FilterBase {
    key: string;
    label: string;
    /** Shown only when this returns true, for filters that apply to one choice of another filter. */
    when?: (query: DirectoryQuery) => boolean;
}
/** A set of options. `primary` choices show as chips above the results; the rest sit in More filters. */
export interface ChoiceFilter extends FilterBase {
    kind: 'choice'; options: FilterOption[]; multi?: boolean; primary?: boolean; allLabel?: string;
    /** Used when the URL has no value; omit for an "all" choice. */ fallback?: string;
    /** Used when the URL has no value, and updated when the person chooses. */ remember?: RememberedChoice;
}
/** An on/off filter sent as `key=true`. */
export interface ToggleFilter extends FilterBase { kind: 'toggle'; primary?: boolean }
export interface TextFilter extends FilterBase { kind: 'text'; placeholder?: string; /** The keyboard a phone shows ("numeric" for whole numbers). */ inputMode?: 'numeric' | 'text' }
export interface DateFilter extends FilterBase { kind: 'date'; /** Dates before this day (YYYY-MM-DD) cannot be chosen. */ min?: () => string }
/** A scope that arrives in a link (one club, one competition). It has no control; it shows as a removable chip. */
export interface ScopeFilter extends FilterBase {
    kind: 'scope';
    /** What the chip calls this scope, such as the club's name; `label` is shown until it is known or if it is not. */
    name?: (value: string, signal: AbortSignal) => Promise<string | null>;
}
/** Results within `km` of the person's device location, sent as "lat,lng". Location is asked for only when chosen. */
export interface NearbyFilter extends FilterBase { kind: 'nearby'; km: number }
export type FilterDef = ChoiceFilter | ToggleFilter | TextFilter | DateFilter | ScopeFilter | NearbyFilter;

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
export interface LoadContext { signal: AbortSignal; sessionId: AuthSessionId; authenticated: boolean; /** Set for sources with `area`. */ area?: DirectoryArea }

/**
 * Where a result goes on the map. `pin` groups results at one place (jobs at a club) into one pin with a count;
 * `approximate` marks a result placed at its club (or its competition's ground) because its own place is not known.
 */
export interface Placement {
    lat: number; lng: number; tone: WorldMapTone; label: string; meta?: string; to?: string;
    pin?: string; approximate?: Approximate; /** How a group of these is counted on its pin: [one, other]. */ noun?: [string, string];
    /** What the pin's card calls opening `to` ("Open club"); the result's own action when the pin is the result. */ action?: string;
}

/**
 * A result as one line of the map's "Browse area" panel, in the score-site shape: a time when it is on a date,
 * a crest or face, the name and one line of detail, and one fact on the right.
 */
export interface BrowseLine {
    title: string; detail?: string; to?: string;
    /** What opening `to` is called on the chosen line ("Open club", "Open profile"), already translated. */ action?: string;
    crest?: { src?: string | null; name: string; round?: boolean };
    when?: { time: string; day?: string };
    fact?: string; factTone?: 'accent' | 'warning' | 'danger';
}

/** Who is looking, for a source's defaults: their World role and whether they chose a child. */
export interface DefaultsContext { role: WorldRole; child: boolean; signedIn: boolean }

/** One searchable list in a directory. A directory with several sources shows them as tabs. */
export interface DirectorySource<T> {
    id: string;
    label: string;
    /** The tab's name when it differs from `label` (for example "All competitions"). */
    tabLabel?: string;
    noun: [one: string, other: string];
    searchLabel: string;
    searchPlaceholder: string;
    filters: FilterDef[];
    sorts?: FilterOption[];
    /** Whether the sort applies to this query (some lists keep their own order). */
    sortable?: (query: DirectoryQuery) => boolean;
    pageSize: number;
    layout: 'rows' | 'cards';
    /** When set, signed-out visitors see this reason and a sign-in action instead of results. */
    signInReason?: string;
    /** A personal list (my arrangements, my competitions): its tab is shown only to signed-in people. */
    personal?: boolean;
    /** Changes when something outside the query changes what `load` returns, so results reload. */
    version?: string;
    /** A live list (fixtures and results): reloaded quietly this often, and when the window regains focus. */
    refreshMs?: number;
    load: (query: DirectoryQuery, page: number, context: LoadContext) => Promise<DirectoryPage<T>>;
    key: (item: T) => string;
    Item: ComponentType<{ item: T }>;
    /** The result as one line of the map's "Browse area" panel. */
    line: (item: T) => BrowseLine;
    /** Work that belongs beside these results, shown above them (for example adding a past match). */
    Tools?: ComponentType<{ query: DirectoryQuery; refresh: () => void }>;
    /** The list is narrowed to the World area (`near`): the area reaches `load` in its context, and results wait for it. */
    area?: boolean;
    /** Who the list is narrowed to (the child chosen in the World bar, "Nino (9)"), so an empty list can say so. */
    forWhom?: string;
    /** Where a result goes on the map. Results without a place stay in the list and are counted as such. */
    place?: (item: T, places: Places) => Placement | null;
    /** Places looked up for results that carry no coordinates of their own (clubs, trials, competitions…). */
    placeKinds?: PlaceKind[];
    /** False when this query has nothing to put on a map (referees cover areas, not places). */
    mapped?: (query: DirectoryQuery) => boolean;
    /** Filters pre-chosen for who is looking, written once when the tab opens without filters of its own. */
    defaults?: (context: DefaultsContext) => Record<string, string[]>;
    /** The full World map showing the same search. Defaults to the map without filters. */
    mapLink?: (query: DirectoryQuery) => string;
    empty: { title: string; body: string; action?: ReactNode };
}

// The engine handles sources of different item types side by side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySource = DirectorySource<any>;
