import type { ComponentType, ReactNode } from 'react';
import type { AuthSessionId } from '../../../utils/authStorage';
import type { WorldMapPoint } from '../map/WorldMap';

export interface FilterOption { value: string; label: string; /** Offered only to signed-in people. */ signedIn?: boolean }

interface FilterBase {
    key: string;
    label: string;
    /** Shown only when this returns true, for filters that apply to one choice of another filter. */
    when?: (query: DirectoryQuery) => boolean;
}
/** A set of options. `primary` choices show as chips above the results; the rest sit in More filters. */
export interface ChoiceFilter extends FilterBase { kind: 'choice'; options: FilterOption[]; multi?: boolean; primary?: boolean; allLabel?: string; /** Used when the URL has no value; omit for an "all" choice. */ fallback?: string }
/** An on/off filter sent as `key=true`. */
export interface ToggleFilter extends FilterBase { kind: 'toggle'; primary?: boolean }
export interface TextFilter extends FilterBase { kind: 'text'; placeholder?: string }
export interface DateFilter extends FilterBase { kind: 'date' }
/** A scope that arrives in a link (one club, one competition). It has no control; it shows as a removable chip. */
export interface ScopeFilter extends FilterBase { kind: 'scope' }
export type FilterDef = ChoiceFilter | ToggleFilter | TextFilter | DateFilter | ScopeFilter;

export interface DirectoryQuery {
    q: string;
    sort: string;
    values: Record<string, string[]>;
}
export const first = (query: DirectoryQuery, key: string) => query.values[key]?.[0] ?? '';

export interface DirectoryPage<T> { items: T[]; total: number | null; hasMore: boolean }
export interface LoadContext { signal: AbortSignal; sessionId: AuthSessionId; authenticated: boolean }

export type DirectoryView = 'list' | 'split' | 'map';

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
    pageSize: number;
    layout: 'rows' | 'cards';
    /** When set, signed-out visitors see this reason and a sign-in action instead of results. */
    signInReason?: string;
    /** A personal list (my arrangements, my competitions): its tab is shown only to signed-in people. */
    personal?: boolean;
    /** Changes when something outside the query changes what `load` returns, so results reload. */
    version?: string;
    load: (query: DirectoryQuery, page: number, context: LoadContext) => Promise<DirectoryPage<T>>;
    key: (item: T) => string;
    Item: ComponentType<{ item: T }>;
    /** Work that belongs beside these results, shown above them (for example adding a past match). */
    Tools?: ComponentType<{ query: DirectoryQuery; refresh: () => void }>;
    /** Map position of a result. Results without one are simply not on the map. */
    point?: (item: T, coords?: { lat: number; lng: number }) => WorldMapPoint | null;
    /** For results that carry no coordinates themselves: positions looked up separately, by item key. */
    loadPoints?: (query: DirectoryQuery, context: LoadContext) => Promise<Map<string, { lat: number; lng: number }>>;
    empty: { title: string; body: string; action?: ReactNode };
}

// The engine handles sources of different item types side by side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySource = DirectorySource<any>;
