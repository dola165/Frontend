import { ct, useCommerceCopy } from '../features/store/copy';
import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { ButtonLink, GkRoot, PageFrame } from '../design/primitives';
import { fetchStoreClub } from '../features/store/api';
import { Catalogue } from '../features/store/Catalogue';
import { catalogueHeading, readCatalogue } from '../features/store/query';
import { useWorldData } from '../features/world/useWorldData';
import '../features/store/store.css';

/** The whole catalogue (`/store/all`): named after what the person chose on the storefront, with the filter column beside the grid. */
export const StoreCataloguePage = () => {
    useCommerceCopy();
    const [params] = useSearchParams();
    const query = readCatalogue(params);
    const club = useWorldData(query.clubId ? `store-club:${query.clubId}` : null, signal => fetchStoreClub(query.clubId!, signal));
    const { title, hint } = catalogueHeading(query, club.data?.name);
    return (
        <GkRoot className="gk-store gk-page" data-market="store">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}><Link to="/store">{ct("Store")}</Link><span aria-hidden="true">/</span><span>{title}</span></nav>
                <header className="gk-store-heading">
                    <div className="gk-store-heading__text"><h1>{title}</h1>{hint && <p className="gk-store-heading__hint">{hint}</p>}</div>
                    <div className="gk-store-club__actions"><ButtonLink to="/store/cart"><ShoppingBag aria-hidden="true" />{ct("Cart")}</ButtonLink></div>
                </header>
                <Catalogue />
            </PageFrame>
        </GkRoot>
    );
};
