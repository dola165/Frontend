import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package } from 'lucide-react';
import { MediaImage } from '../../components/ui/MediaImage';
import { opportunityReturnState } from '../../components/discovery/opportunityReturnContext';
import { Badge, Button, EmptyNote, Section } from '../../design/primitives';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { Crest } from '../world/Crest';
import { availability, formatStorePrice, sellerName, sellerOf, type StoreProduct } from './api';
import { Row } from './front/Row';

/** Who sells a product, as a small crest (a club) or the GrassKickZ mark, with the name. */
export function SellerMark({ product, size = 16 }: { product: StoreProduct; size?: number }) {
    return sellerOf(product) === 'GRASSKICKZ'
        ? <img src="/brand/grasskickz-mark.svg" alt="" width={size} height={size} />
        : <Crest src={product.clubLogoUrl} name={product.clubName ?? 'Club'} size={size} round />;
}

/** One product the way a store lists it: the picture square, the name, who sells it, the price bright, honest availability. */
export function ProductCard({ product }: { product: StoreProduct }) {
    const location = useLocation();
    const stock = availability(product);
    const picture = product.images?.[0];
    return (
        <Link className="gk-product" to={`/store/products/${product.id}`} state={opportunityReturnState('store', location)}>
            <span className="gk-product__pic" data-out={stock.tone === 'out' || undefined}>
                {picture ? <MediaImage src={resolveMediaUrl(picture)} alt="" loading="lazy" /> : <Package aria-hidden="true" />}
                {stock.tone === 'out' && <Badge className="gk-product__flag">Out of stock</Badge>}
            </span>
            <span className="gk-product__name">{product.name ?? 'Product'}</span>
            <span className="gk-product__seller"><SellerMark product={product} /><span>{sellerName(product)}</span></span>
            <span className="gk-product__foot">
                <span className="gk-product__price gk-num">{formatStorePrice(product.price ?? 0, product.currency)}</span>
                {stock.tone !== 'out' && <span className="gk-product__stock" data-tone={stock.tone}>{stock.label}</span>}
            </span>
        </Link>
    );
}

/** Grey squares standing in for products while they load. */
export const ProductSkeletons = ({ count = 5 }: { count?: number }) => <>{Array.from({ length: count }, (_, i) => <li key={i}><span className="gk-skeleton gk-store-skeleton" style={{ display: 'block' }} aria-hidden="true" /></li>)}</>;

/** A storefront row of products with "View all" opening the same search in the catalogue. */
export function ProductRow({ title, hint, to, products, loading, error, retry, empty }: {
    title: string; hint?: ReactNode; to: string; products: StoreProduct[]; loading: boolean; error: string; retry: () => void; empty: string;
}) {
    return (
        <Section title={title} hint={hint} action={products.length ? { label: 'View all', to } : undefined}>
            {error ? <EmptyNote title="These products could not load" action={<Button size="sm" onClick={retry}>Retry</Button>}>{error}</EmptyNote>
                : loading && !products.length ? <ul className="gk-store-row gk-store-row--wide" aria-busy="true" aria-label="Loading products"><ProductSkeletons /></ul>
                : !products.length ? <EmptyNote title={empty} />
                : <Row label={title} wide>{products.map(product => <li key={product.id}><ProductCard product={product} /></li>)}</Row>}
        </Section>
    );
}
