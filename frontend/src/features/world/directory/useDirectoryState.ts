import { useSearchParams } from 'react-router-dom';
import type { AnySource, DirectoryQuery, DirectoryView } from './types';

const VIEWS: DirectoryView[] = ['list', 'split', 'map'];
/** Context that follows the person around World (their area, the child they are searching for). */
const CARRIED = ['near', 'player'];

/** Directory state lives in the URL: tab (`tabParam`), search, filters, sort and view. */
export function useDirectoryState(sources: AnySource[], tabParam = 'tab') {
    const [params, setParams] = useSearchParams();
    const source = sources.find(item => item.id === params.get(tabParam)) ?? sources[0];
    const rawView = params.get('view') as DirectoryView | null;
    const view: DirectoryView = source.point && rawView && VIEWS.includes(rawView) ? rawView : 'list';
    const query: DirectoryQuery = {
        q: params.get('q') ?? '',
        sort: params.get('sort') ?? source.sorts?.[0]?.value ?? '',
        values: Object.fromEntries(source.filters.map(filter => {
            const values = params.getAll(filter.key).filter(Boolean);
            return [filter.key, values.length ? values : filter.kind === 'choice' && filter.fallback ? [filter.fallback] : []];
        })),
    };
    const activeFilters = source.filters.filter(filter => (!filter.when || filter.when(query)) && params.getAll(filter.key).some(Boolean));

    const update = (mutate: (next: URLSearchParams) => void, replace = true) => setParams(current => {
        const next = new URLSearchParams(current);
        mutate(next);
        return next;
    }, { replace, preventScrollReset: true });

    const setValues = (key: string, values: string[]) => update(next => {
        next.delete(key);
        const filter = source.filters.find(item => item.key === key);
        const fallback = filter?.kind === 'choice' ? filter.fallback : undefined;
        values.filter(value => value && value !== fallback).forEach(value => next.append(key, value));
        // A filter that depends on this one no longer applies when it changes.
        source.filters.filter(item => item.when && item.key !== key).forEach(item => {
            const after: DirectoryQuery = { ...query, values: { ...query.values, [key]: values } };
            if (!item.when!(after)) next.delete(item.key);
        });
    });

    return {
        source,
        query,
        view,
        activeFilters,
        setValues,
        toggleValue: (key: string, value: string, multi: boolean) => {
            const current = query.values[key] ?? [];
            setValues(key, multi ? (current.includes(value) ? current.filter(item => item !== value) : [...current, value]) : current[0] === value ? [] : [value]);
        },
        setSearch: (value: string) => update(next => { if (value) next.set('q', value); else next.delete('q'); }),
        setSort: (value: string) => update(next => { if (value && value !== source.sorts?.[0]?.value) next.set('sort', value); else next.delete('sort'); }),
        setView: (value: DirectoryView) => update(next => { if (value === 'list') next.delete('view'); else next.set('view', value); }, false),
        setTab: (id: string) => update(next => {
            sources.forEach(item => item.filters.forEach(filter => { if (!CARRIED.includes(filter.key)) next.delete(filter.key); }));
            next.delete('sort');
            if (id === sources[0].id) next.delete(tabParam); else next.set(tabParam, id);
        }, false),
        clearFilters: () => update(next => {
            source.filters.forEach(filter => { if (!CARRIED.includes(filter.key)) next.delete(filter.key); });
            next.delete('q');
        }),
    };
}
export type DirectoryState = ReturnType<typeof useDirectoryState>;
