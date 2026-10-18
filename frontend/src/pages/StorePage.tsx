import { ct, useCommerceCopy } from '../features/store/copy';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GkRoot, PageFrame } from '../design/primitives';
import { fetchStoreCatalog, fetchStoreFront } from '../features/store/api';
import { CATALOGUE_KEYS, cataloguePath } from '../features/store/query';
import { MarketTabs } from '../features/store/front/MarketTabs';
import { Categories, StoreDoors, StoreHead } from '../features/store/front/StoreFrontTop';
import { AreaPicker, Collections, Sellers } from '../features/store/front/StoreFrontRows';
import { StoreSlides } from '../features/store/front/StoreSlides';
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
    useCommerceCopy();
    const [params] = useSearchParams();
    const { status } = useAuth();
    const { area, setCity } = useWorldArea();
    const near = area.anywhere ? undefined : area.city;
    const front = useWorldData(area.ready ? `store-front:${near ?? ''}` : null, signal => fetchStoreFront(near, signal), ct("The store could not load."));
    const picks = useWorldData(area.ready ? `store-picks:${near ?? ''}` : null, signal => fetchStoreCatalog({ sort: 'RELEVANCE', near, size: 10 }, signal), ct("These products could not load."));
    const fresh = useWorldData('store-new', signal => fetchStoreCatalog({ sort: 'NEWEST', size: 10 }, signal), ct("These products could not load."));
    // Old links to a search (`/store?category=…`) open the catalogue with the same search.
    if (CATALOGUE_KEYS.some(key => key !== 'page' && params.has(key)) || params.has('q')) return <Navigate to={`/store/all?${params}`} replace />;
    const signedIn = status === 'authenticated';
    const followed = front.data?.followed ?? [];
    return (
        <GkRoot className="gk-store gk-page" data-market="store">
            <PageFrame>
                <MarketTabs current="store" />
                <StoreHead />
                <div className="gk-store-stack">
                    <StoreDoors own={front.data?.own} sellers={front.data?.sellers} />
                    <Categories />
                    <StoreSlides />
                    <Collections front={front.data} float="right" tone="a" />
                    <Sellers id="store-near" float="left" tone="b" title={ct("Clubs near you")} sellers={front.data?.near ?? []} loading={front.loading} error={front.error} retry={front.retry}
                        hint={near ? <AreaPicker city={front.data?.city ?? near} onChange={setCity} /> : ct("Clubs with something on sale")}
                        empty={near ? ct("No club near {v0} sells anything yet", { v0: near }) : ct("No club sells anything yet")} action={{ label: ct("All club stores"), to: cataloguePath({ seller: "clubs" }) }} />
                    {signedIn && (front.loading || followed.length > 0) && <Sellers id="store-followed" float="right" tone="a" title={ct("From clubs you follow")} hint={ct("Clubs you follow with something on sale")} sellers={followed} loading={front.loading} error={front.error} retry={front.retry} empty={ct("None of the clubs you follow sells anything yet")} />}
                    <ProductRow float="left" tone="b" title={ct("Picked for you")} hint={near ? ct("In stock first, then clubs you follow and clubs in {v0}", { v0: near }) : ct("In stock first, then clubs you follow")} to={cataloguePath({ sort: 'RELEVANCE' })}
                        products={picks.data?.content ?? []} loading={picks.loading} error={picks.error} retry={picks.retry} empty={ct("Nothing to show yet")} />
                    <ProductRow float="right" tone="a" title={ct("New arrivals")} hint={ct("The latest products from GrassKickZ and the clubs")} to={cataloguePath({ sort: 'NEWEST' })}
                        products={fresh.data?.content ?? []} loading={fresh.loading} error={fresh.error} retry={fresh.retry} empty={ct("Nothing new yet")} />
                </div>
            </PageFrame>
        </GkRoot>
    );
};
