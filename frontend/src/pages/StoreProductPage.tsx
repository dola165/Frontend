import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, Mail, MessageCircle, Package, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { toWhatsappHref } from '../components/club/clubProfileInfo';
import { getOpportunityReturnTarget } from '../components/discovery/opportunityReturnContext';
import { MediaImage } from '../components/ui/MediaImage';
import { Button, ButtonLink, EmptyNote, Field, GkRoot, PageFrame, Skeleton } from '../design/primitives';
import { PaymentPreviewNotice } from '../features/paymentPreview/PaymentPreview';
import { availability, fetchStoreProduct, formatStorePrice, sellerName, sellerOf, type StoreProduct, type StoreVariant } from '../features/store/api';
import { addCartItem } from '../features/store/cart';
import { cataloguePath, clubStorePath } from '../features/store/query';
import { SellerMark } from '../features/store/ProductCard';
import { useWorldData } from '../features/world/useWorldData';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/store/store.css';

const inStock = (variant?: StoreVariant) => !!variant && variant.stock > 0;

/** The product itself: pictures on the left; who sells it, the price, sizes and Add to cart on the right. */
function Product({ product }: { product: StoreProduct }) {
    const navigate = useNavigate();
    const variants = product.variants ?? [];
    const [photo, setPhoto] = useState(0);
    const [variantId, setVariantId] = useState<number | undefined>(() => (variants.find(v => v.stock > 0) ?? variants[0])?.id);
    const [quantity, setQuantity] = useState(1);
    const [added, setAdded] = useState('');
    const [problem, setProblem] = useState('');
    const variant = variants.find(v => v.id === variantId);
    const own = sellerOf(product) === 'GRASSKICKZ';
    const stock = availability(product);
    const max = Math.max(1, Math.min(99, variant?.stock ?? 0));
    const valid = inStock(variant) && Number.isInteger(quantity) && quantity >= 1 && quantity <= max;
    const enquiry = variant ? `Product enquiry: ${product.name ?? 'Product'} · ${variant.label} × ${quantity}` : '';
    const whatsapp = toWhatsappHref(product.clubWhatsappNumber);
    const choose = (id?: number) => { setVariantId(id); setQuantity(1); setAdded(''); setProblem(''); };
    const add = () => {
        if (!product || !variant?.id || !valid) return;
        try {
            addCartItem({ variantId: variant.id, quantity, productId: product.id, name: product.name ?? 'Product', variant: variant.label, clubId: product.clubId ?? 0, seller: sellerOf(product), currency: product.currency ?? 'GEL' });
            const message = `${product.name ?? 'Product'} · ${variant.label} × ${quantity}`;
            setAdded(message); setProblem('');
            toast.success('Added to your cart', { id: 'store-cart-added', description: message, action: { label: 'View cart', onClick: () => navigate('/store/cart') } });
        } catch (failure) { toast.dismiss('store-cart-added'); setAdded(''); setProblem(failure instanceof Error ? failure.message : 'The cart could not be saved.'); }
    };
    const pictures = product.images ?? [];
    return (
        <div className="gk-store-product">
            <section className="gk-store-gallery" aria-label="Product photos">
                <div className="gk-store-gallery__main">{pictures.length ? <MediaImage src={resolveMediaUrl(pictures[photo] ?? pictures[0])} alt={`${product.name ?? 'Product'}, photo ${photo + 1}`} /> : <Package size={48} aria-hidden="true" />}</div>
                {pictures.length > 1 && <div className="gk-store-gallery__thumbs">{pictures.map((url, index) => <button key={`${url}-${index}`} type="button" aria-label={`Photo ${index + 1}`} aria-pressed={photo === index} onClick={() => setPhoto(index)}><MediaImage src={resolveMediaUrl(url)} alt="" /></button>)}</div>}
            </section>
            <section className="gk-store-buy" aria-label="Buy">
                <Link className="gk-store-seller-line" to={own ? cataloguePath({ seller: 'grasskickz' }) : clubStorePath(product.clubId!)}>
                    <SellerMark product={product} size={36} />
                    <span className="gk-store-seller-line__text"><small>{own ? 'Sold by' : 'From the club'}</small><strong>{sellerName(product)}</strong></span>
                    <ChevronRight size={16} aria-hidden="true" />
                </Link>
                <div>
                    <h1>{product.name}</h1>
                    <p><span className="gk-store-buy__price gk-num">{formatStorePrice(product.price ?? 0, product.currency)}</span><span className="gk-store-buy__stock" data-tone={variant ? (variant.stock === 0 ? 'out' : variant.stock <= 5 ? 'low' : 'in') : stock.tone}>{variant ? (variant.stock === 0 ? `${variant.label}: out of stock` : variant.stock <= 5 ? `Only ${variant.stock} left in ${variant.label}` : `${variant.stock} in stock`) : stock.label}</span></p>
                </div>
                {product.description && <p className="gk-store-buy__desc">{product.description}</p>}
                {variants.length > 0 && (variants.length <= 10
                    ? <fieldset><legend className="gk-field__label">{variants.length === 1 ? 'Variant' : 'Size'}</legend><div className="gk-store-sizes">{variants.map(v => <button key={v.id} type="button" className="gk-store-size" aria-pressed={variantId === v.id} disabled={!v.stock} title={v.stock ? `${v.stock} available` : 'Out of stock'} onClick={() => choose(v.id)}>{v.label}{!v.stock && <span className="gk-visually-hidden">, out of stock</span>}</button>)}</div></fieldset>
                    : <Field label="Size" htmlFor="product-variant"><select id="product-variant" className="gk-input" value={variantId} onChange={event => choose(Number(event.target.value))}>{variants.map(v => <option key={v.id} value={v.id} disabled={!v.stock}>{v.label}{!v.stock ? ' (out of stock)' : ''}</option>)}</select></Field>)}
                <div className="gk-store-buy__row">
                    <Field label="Quantity" htmlFor="product-quantity"><input id="product-quantity" className="gk-input" type="number" min={1} max={max} disabled={!inStock(variant)} value={quantity} onChange={event => { setQuantity(Number(event.target.value)); setAdded(''); }} /></Field>
                    <Button variant="primary" disabled={!valid} onClick={add}><ShoppingBag aria-hidden="true" />Add to cart</Button>
                </div>
                {added && <div className="gk-store-buy__added" role="status"><Check aria-hidden="true" /><span>Added: {added}</span><Link to="/store/cart">View cart</Link></div>}
                {problem && <p className="gk-notice gk-notice--danger" role="alert">{problem}</p>}
                <PaymentPreviewNotice />
                {!own && variant && (whatsapp || product.clubEmail) && <div className="gk-store-buy__ask" aria-label="Ask the club about this item">
                    {whatsapp && <a className="gk-btn gk-btn--secondary gk-btn--sm" href={`${whatsapp}?text=${encodeURIComponent(enquiry)}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Ask on WhatsApp</a>}
                    {product.clubEmail && <a className="gk-btn gk-btn--secondary gk-btn--sm" href={`mailto:${product.clubEmail}?subject=${encodeURIComponent(enquiry)}&body=${encodeURIComponent(`Please confirm availability and how to buy ${product.name ?? 'this product'} · ${variant.label} × ${quantity} directly from the club.`)}`}><Mail aria-hidden="true" />Email the club</a>}
                </div>}
            </section>
        </div>
    );
}

export const StoreProductPage = () => {
    const { id } = useParams();
    const location = useLocation();
    const productId = Number(id);
    const valid = Number.isSafeInteger(productId) && productId > 0;
    const product = useWorldData(valid ? `store-product:${productId}` : null, signal => fetchStoreProduct(productId, signal), 'This product is unavailable or could not be loaded.');
    const back = getOpportunityReturnTarget('store', location.state, product.data?.clubId);
    const data = product.data;
    const sellerCrumb = data ? (sellerOf(data) === 'GRASSKICKZ' ? { label: 'GrassKickZ equipment', to: cataloguePath({ seller: 'grasskickz' }) } : { label: `${data.clubName ?? 'Club'} store`, to: clubStorePath(data.clubId!) }) : null;
    return (
        <GkRoot className="gk-store gk-page">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label="Breadcrumb">
                    <Link to="/store">Store</Link>
                    {sellerCrumb && <><span aria-hidden="true">/</span><Link to={sellerCrumb.to}>{sellerCrumb.label}</Link></>}
                    {data?.name && <><span aria-hidden="true">/</span><span>{data.name}</span></>}
                </nav>
                <div className="gk-store-club__actions" style={{ paddingTop: 12 }}>
                    <ButtonLink variant="ghost" size="sm" to={`${back.pathname}${back.search}`}><ArrowLeft aria-hidden="true" />Back to results</ButtonLink>
                    <ButtonLink size="sm" to="/store/cart" style={{ marginLeft: 'auto' }}><ShoppingBag aria-hidden="true" />Cart</ButtonLink>
                </div>
                {!valid || product.error ? <div className="gk-store-results__empty"><EmptyNote title="This product is unavailable" action={valid ? <Button size="sm" onClick={product.retry}>Retry</Button> : undefined}>{product.error || 'The link does not point to a product.'}</EmptyNote></div>
                    : product.loading || !data ? <div className="gk-store-product" aria-busy="true"><Skeleton height={520} /><div className="gk-store-buy"><Skeleton height={28} width={220} /><Skeleton height={22} width={120} /><Skeleton height={60} /></div></div>
                    : <Product key={data.id} product={data} />}
            </PageFrame>
        </GkRoot>
    );
};
