import { useSearchParams } from 'react-router-dom';
import type { AnySource, DirectoryQuery, DirectoryView, FilterDef } from './types';

const VIEWS: DirectoryView[] = ['list', 'split', 'map'];
/** Context that follows the person around World (their area, the child they are searching for). */
export const CARRIED = ['near', 'player'];
/** How many pages of results were shown, so Back returns to the same place in the list. */
export const SHOWN = 'shown';

/** The source a directory opens on: the first one, or for guests the first one they can see without signing in. */
export const defaultSource = (sources: AnySource[], signedIn: boolean) =>
    (signedIn ? undefined : sources.find(source => !source.signInReason)) ?? sources[0];

const remembered = (filter: FilterDef) => {
    if (filter.kind !== 'choice' || !filter.remember) return undefined;
    const value = filter.remember.read();
    return value && filter.options.some(option => option.value === value) ? value : undefined;
};

/**
 * The query a source sees: search, sort and the values of the filters that apply. A filter that
 * does not apply (its `when` is false) has no value, and only applying filters get their fallback.
 */
export function readQuery(source: AnySource, params: URLSearchParams): { query: DirectoryQuery; active: FilterDef[] } {
    const given = (filter: FilterDef) => params.getAll(filter.key).filter(Boolean);
    const valueOf = (filter: FilterDef) => {
        const values = given(filter);
        if (values.length) return values;
        const kept = remembered(filter);
        if (kept) return [kept];
        return filter.kind === 'choice' && filter.fallback ? [filter.fallback] : [];
    };
    const sort = params.get('sort') ?? source.sorts?.[0]?.value ?? '';
    // `when` conditions read the other filters' values, so they are worked out against everything given.
    const draft: DirectoryQuery = { q: params.get('q') ?? '', sort, values: Object.fromEntries(source.filters.map(filter => [filter.key, valueOf(filter)])) };
    const applies = (filter: FilterDef) => !filter.when || filter.when(draft);
    const values: Record<string, string[]> = {};
    for (const filter of source.filters) if (!values[filter.key]?.length) values[filter.key] = applies(filter) ? valueOf(filter) : [];
    const query: DirectoryQuery = { ...draft, values };
    const active = source.filters.filter(filter => applies(filter) && (given(filter).length > 0 || Boolean(remembered(filter))));
    return { query, active };
}

/**
 * Directory state lives in the URL: tab (`tabParam`), search, filters, sort, view and how many
 * pages were shown. `tabAlias` is an older name of the tab parameter that links may still use.
 */
export function useDirectoryState(sources: AnySource[], { tabParam = 'tab', tabAlias, signedIn = true }: { tabParam?: string; tabAlias?: string; signedIn?: boolean } = {}) {
    const [params, setParams] = useSearchParams();
    const opening = defaultSource(sources, signedIn);
    const requested = params.get(tabParam) ?? (tabAlias ? params.get(tabAlias) : null);
    const source = sources.find(item => item.id === requested) ?? opening;
    const rawView = params.get('view') as DirectoryView | null;
    const view: DirectoryView = source.point && rawView && VIEWS.includes(rawView) ? rawView : 'list';
    const { query, active: activeFilters } = readQuery(source, params);
    const shown = Math.min(Math.max(Number(params.get(SHOWN)) || 1, 1), 10);

    const update = (mutate: (next: URLSearchParams) => void, replace = true) => setParams(current => {
        const next = new URLSearchParams(current);
        mutate(next);
        return next;
    }, { replace, preventScrollReset: true });

    const setValues = (key: string, values: string[]) => {
        const filter = source.filters.find(item => item.key === key);
        if (filter?.kind === 'choice') filter.remember?.write(values[0] ?? '');
        update(next => {
            next.delete(key);
            next.delete(SHOWN);
            const fallback = filter?.kind === 'choice' ? filter.fallback : undefined;
            values.filter(value => value && value !== fallback).forEach(value => next.append(key, value));
            // A filter that depends on this one no longer applies when it changes.
            const after: DirectoryQuery = { ...query, values: { ...query.values, [key]: values } };
            source.filters.filter(item => item.when && item.key !== key && !item.when(after)).forEach(item => next.delete(item.key));
        });
    };

    return {
        source,
        query,
        view,
        activeFilters,
        shown,
        setValues,
        toggleValue: (key: string, value: string, multi: boolean) => {
            const current = query.values[key] ?? [];
            setValues(key, multi ? (current.includes(value) ? current.filter(item => item !== value) : [...current, value]) : current[0] === value ? [] : [value]);
        },
        setSearch: (value: string) => update(next => { next.delete(SHOWN); if (value) next.set('q', value); else next.delete('q'); }),
        setSort: (value: string) => update(next => { next.delete(SHOWN); if (value && value !== source.sorts?.[0]?.value) next.set('sort', value); else next.delete('sort'); }),
        setView: (value: DirectoryView) => update(next => { if (value === 'list') next.delete('view'); else next.set('view', value); }, false),
        /** Records how many pages are on screen, without adding a history entry. */
        setShown: (pages: number) => update(next => { if (pages > 1) next.set(SHOWN, String(pages)); else next.delete(SHOWN); }),
        setTab: (id: string) => update(next => {
            sources.forEach(item => item.filters.forEach(filter => { if (!CARRIED.includes(filter.key)) next.delete(filter.key); }));
            ['sort', SHOWN, ...(tabAlias ? [tabAlias] : [])].forEach(key => next.delete(key));
            if (id === opening.id) next.delete(tabParam); else next.set(tabParam, id);
        }, false),
        clearFilters: () => update(next => {
            source.filters.forEach(filter => { if (!CARRIED.includes(filter.key)) next.delete(filter.key); });
            next.delete('q');
            next.delete(SHOWN);
        }),
    };
}
export type DirectoryState = ReturnType<typeof useDirectoryState>;
