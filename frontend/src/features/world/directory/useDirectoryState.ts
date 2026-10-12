import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PEEK, SIDE } from '../peek/usePeek';
import type { AnySource, DirectoryQuery, FilterDef } from './types';

/** Context that follows the person around World (their area, the child they are searching for). */
export const CARRIED = ['near', 'player'];
/** How many pages of results were shown, so Back returns to the same place in the list. */
export const SHOWN = 'shown';
/** The one result chosen in the Browse area, by key, so Back and shared links return to it. */
export const SELECTED = 'selected';

/**
 * The source a directory opens on: the one chosen for who is looking (`opening`), else the first one; for guests the
 * first one they can see without signing in.
 */
export const defaultSource = (sources: AnySource[], signedIn: boolean, opening?: string) =>
    (signedIn ? sources.find(source => source.id === opening) : sources.find(source => !source.signInReason)) ?? sources[0];

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
    // Where the list is (a day) is not a filter the person set: it is never active, so never cleared or counted.
    const active = source.filters.filter(filter => !filter.nav && applies(filter) && (given(filter).length > 0 || Boolean(remembered(filter))));
    return { query, active };
}

/**
 * Directory state lives in the URL: tab (`tabParam`), search, filters, sort and how many
 * pages were shown. `tabAlias` is an older name of the tab parameter that links may still use, and `tabValues` maps
 * its older values to tabs (`role=REFEREE` opens `referees`). `opening` is the tab chosen for who is looking.
 */
export function useDirectoryState(sources: AnySource[], { tabParam = 'tab', tabAlias, tabValues, signedIn = true, opening: chosen }: {
    tabParam?: string; tabAlias?: string; tabValues?: Record<string, string>; signedIn?: boolean; opening?: string;
} = {}) {
    const [params, setParams] = useSearchParams();
    const opening = defaultSource(sources, signedIn, chosen);
    const alias = tabAlias ? params.get(tabAlias) : null;
    const requested = params.get(tabParam) ?? (alias ? tabValues?.[alias] ?? alias : null);
    const source = sources.find(item => item.id === requested) ?? opening;
    // The same query object until the address or a remembered choice changes, so lists derived from it (groups, pins) stay put.
    const kept = source.filters.map(filter => filter.kind === 'choice' && filter.remember ? filter.remember.read() ?? '' : '').join('|');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `kept` is what readQuery reads from storage
    const { query, active: activeFilters } = useMemo(() => readQuery(source, params), [source, params, kept]);
    const shown = Math.min(Math.max(Number(params.get(SHOWN)) || 1, 1), 10);
    const selected = params.get(SELECTED) || undefined;

    // Where the opening tab depends on who is looking, every write names the tab (in the same navigation, so nothing
    // written alongside it is lost), and a link copied from the page opens the same tab for anyone.
    const naming = Boolean(chosen) && signedIn;
    const update = (mutate: (next: URLSearchParams) => void, replace = true) => setParams(current => {
        const next = new URLSearchParams(current);
        mutate(next);
        if (naming && !next.has(tabParam) && !(tabAlias && next.has(tabAlias))) next.set(tabParam, source.id);
        return next;
    }, { replace, preventScrollReset: true });

    const setValues = (key: string, values: string[]) => {
        const filter = source.filters.find(item => item.key === key);
        if (filter?.kind === 'choice') filter.remember?.write(values[0] ?? '');
        update(next => {
            next.delete(key);
            next.delete(SHOWN);
            next.delete(SELECTED);
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
        activeFilters,
        /** The address does not name this tab yet, although it should (see `update`). */
        unnamed: naming && !params.has(tabParam) && !(tabAlias && params.has(tabAlias)),
        shown,
        selected,
        setValues,
        toggleValue: (key: string, value: string, multi: boolean) => {
            const current = query.values[key] ?? [];
            setValues(key, multi ? (current.includes(value) ? current.filter(item => item !== value) : [...current, value]) : current[0] === value ? [] : [value]);
        },
        setSearch: (value: string) => update(next => { next.delete(SHOWN); next.delete(SELECTED); if (value) next.set('q', value); else next.delete('q'); }),
        setSort: (value: string) => update(next => { next.delete(SHOWN); if (value && value !== source.sorts?.[0]?.value) next.set('sort', value); else next.delete('sort'); }),
        /** Writes several filters at once without a history entry: a tab's defaults for who is looking. */
        setMany: (values: Record<string, string[]>) => update(next => {
            for (const [key, list] of Object.entries(values)) { next.delete(key); list.filter(Boolean).forEach(value => next.append(key, value)); }
        }),
        /**
         * Writes several values in one replace, so none is lost (two writes in one tick would keep only the last): a day
         * chosen on the strip and the end it leaves. Like a filter change, it ends the choice of one result.
         */
        go: (values: Record<string, string[]>) => update(next => {
            for (const [key, list] of Object.entries(values)) { next.delete(key); list.filter(Boolean).forEach(value => next.append(key, value)); }
            next.delete(SHOWN);
            next.delete(SELECTED);
        }),
        /** Chooses one result (or none), without adding a history entry; sorting and showing more keep it. */
        setSelected: (key?: string) => update(next => { if (key) next.set(SELECTED, key); else next.delete(SELECTED); }),
        /** Records how many pages are on screen, without adding a history entry. */
        setShown: (pages: number) => update(next => { if (pages > 1) next.set(SHOWN, String(pages)); else next.delete(SHOWN); }),
        setTab: (id: string) => update(next => {
            sources.forEach(item => item.filters.forEach(filter => { if (!CARRIED.includes(filter.key)) next.delete(filter.key); }));
            ['sort', SHOWN, SELECTED, PEEK, SIDE, ...(tabAlias ? [tabAlias] : [])].forEach(key => next.delete(key));
            // Where the opening tab depends on who is looking, every tab is named, so a link opens the same tab for anyone.
            if (!chosen && id === opening.id) next.delete(tabParam); else next.set(tabParam, id);
        }, false),
        clearFilters: () => update(next => {
            // Where the list is (a day) stays: clearing filters never moves the list.
            source.filters.forEach(filter => { if (!CARRIED.includes(filter.key) && !filter.nav) next.delete(filter.key); });
            next.delete('q');
            next.delete(SHOWN);
            next.delete(SELECTED);
            next.delete(PEEK);
            next.delete(SIDE);
        }),
    };
}
export type DirectoryState = ReturnType<typeof useDirectoryState>;

/** Whether Clear filters has anything to clear: a search, or a filter other than the context carried around World. */
export const isClearable = (state: Pick<DirectoryState, 'query' | 'activeFilters'>) =>
    Boolean(state.query.q) || state.activeFilters.some(filter => !CARRIED.includes(filter.key));
