import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GkRoot, PageFrame } from '../design/primitives';
import { fetchStoreCatalog, fetchStoreFront } from '../features/store/api';
import { CATALOGUE_KEYS, cataloguePath } from '../features/store/query';
import { Categories, StoreDoors, StoreHead } from '../features/store/front/StoreFrontTop';
import { AreaPicker, Collections, Sellers } from '../features/store/front/StoreFrontRows';
import { ProductRow } from '../features/store/ProductCard';
import { useWorldArea } from '../features/world/useWorldArea';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';

/**
 * The storefront, in the shape of Fanatics' football page: a title and one search, two big doors (GrassKickZ
 * equipment, club stores), compact categories, the equipment collections, clubs near the person and the ones they
 * follow, then products picked for them and new arrivals. Every door opens the catalogue with that choice applied.
 */
export const StorePage = () => {
    const [params] = useSearchParams();
    const { status } = useAuth();
    const { area, setCity } = useWorldArea();
    const near = area.anywhere ? undefined : area.city;
    const front = useWorldData(area.ready ? `store-front:${near ?? ''}` : null, signal => fetchStoreFront(near, signal), 'The store could not load.');
    const picks = useWorldData(area.ready ? `store-picks:${near ?? ''}` : null, signal => fetchStoreCatalog({ sort: 'RELEVANCE', near, size: 10 }, signal), 'These products could not load.');
    const fresh = useWorldData('store-new', signal => fetchStoreCatalog({ sort: 'NEWEST', size: 10 }, signal), 'These products could not load.');
    // Old links to a search (`/store?category=…`) open the catalogue with the same search.
    if (CATALOGUE_KEYS.some(key => key !== 'page' && params.has(key)) || params.has('q')) return <Navigate to={`/store/all?${params}`} replace />;
    const signedIn = status === 'authenticated';
    const followed = front.data?.followed ?? [];
    return (
        <GkRoot className="gk-store gk-page">
            <PageFrame>
                <StoreHead />
                <div className="gk-store-stack">
                    <StoreDoors own={front.data?.own} sellers={front.data?.sellers} />
                    <Categories />
                    <Collections front={front.data} />
                    <Sellers id="store-near" title="Clubs near you" sellers={front.data?.near ?? []} loading={front.loading} error={front.error} retry={front.retry}
                        hint={near ? <AreaPicker city={front.data?.city ?? near} onChange={setCity} /> : 'Clubs with something on sale'}
                        empty={near ? `No club near ${near} sells anything yet` : 'No club sells anything yet'} action={{ label: 'All club stores', to: cataloguePath({ seller: 'clubs' }) }} />
                    {signedIn && (front.loading || followed.length > 0) && <Sellers id="store-followed" title="From clubs you follow" hint="Clubs you follow with something on sale" sellers={followed} loading={front.loading} error={front.error} retry={front.retry} empty="None of the clubs you follow sells anything yet" />}
                    <ProductRow title="Picked for you" hint={near ? `In stock first, then clubs you follow and clubs in ${near}` : 'In stock first, then clubs you follow'} to={cataloguePath({ sort: 'RELEVANCE' })}
                        products={picks.data?.content ?? []} loading={picks.loading} error={picks.error} retry={picks.retry} empty="Nothing to show yet" />
                    <ProductRow title="New arrivals" hint="The latest products from GrassKickZ and the clubs" to={cataloguePath({ sort: 'NEWEST' })}
                        products={fresh.data?.content ?? []} loading={fresh.loading} error={fresh.error} retry={fresh.retry} empty="Nothing new yet" />
                </div>
            </PageFrame>
        </GkRoot>
    );
};
