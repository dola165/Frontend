import { ct } from './copy';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorldArea } from '../world/useWorldArea';
import { useWorldData } from '../world/useWorldData';
import { fetchStoreCatalog } from './api';
import { CATALOGUE_KEYS, catalogueSearch, PAGE_SIZE, readCatalogue, type CatalogueQuery } from './query';

/**
 * The catalogue as the address describes it: reads the search from the URL, loads the matching page, and writes
 * every change back so refresh, sharing and Back return to the same results. `fixedClubId` is a club's own store.
 * `revision` asks again after something changed (a product was added).
 */
export function useCatalogue(fixedClubId?: number, revision = 0) {
    const [params, setParams] = useSearchParams();
    const query = useMemo(() => readCatalogue(params, fixedClubId), [params, fixedClubId]);
    const { area } = useWorldArea();
    const near = area.anywhere ? undefined : area.city;
    const key = `${JSON.stringify(query)}|${near ?? ''}|${revision}`;
    const result = useWorldData(key, signal => fetchStoreCatalog({
        page: query.page, size: PAGE_SIZE, clubId: query.clubId, seller: query.seller || undefined, query: query.query || undefined, category: query.category || undefined,
        collection: query.collection || undefined, currency: query.currency, country: query.country || undefined, city: query.city || undefined, variant: query.variant || undefined,
        minPrice: query.minPrice ? Number(query.minPrice) : undefined, maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined, sort: query.sort, near,
    }, signal), ct("The store could not load. Please try again."), { keep: true });
    const update = (next: CatalogueQuery, replace = false) => setParams(current => {
        const copy = new URLSearchParams(current);
        for (const name of CATALOGUE_KEYS) copy.delete(name);
        copy.delete('q');
        catalogueSearch({ ...next, clubId: fixedClubId ? undefined : next.clubId }).forEach((value, name) => copy.set(name, value));
        return copy;
    }, { replace, preventScrollReset: true });
    return { query, update, products: result.data?.content ?? [], total: result.data?.totalElements ?? 0, loading: result.loading, error: result.error, retry: result.retry };
}
