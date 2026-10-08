import { MediaImage } from '../components/ui/MediaImage';
import { OpportunityNavigation } from '../components/discovery/OpportunityNavigation';
import {useEffect,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import { toast } from 'sonner';
import {fetchStoreProduct,formatStorePrice,type StoreProduct} from '../features/store/api';
import {addCartItem} from '../features/store/cart';
import {resolveMediaUrl} from '../utils/resolveMediaUrl';
import { ShoppingBag, ChevronRight, Shield, CircleCheck, CircleAlert, Mail, MessageCircle } from 'lucide-react';
import { PaymentPreviewNotice } from '../features/paymentPreview/PaymentPreview';
import { paymentPreviewEnabled } from '../features/paymentPreview/config';
import { toWhatsappHref } from '../components/club/clubProfileInfo';
import '../features/store/store.css';
export const StoreProductPage=()=>{
    const navigate = useNavigate();
    const {id}=useParams();const [product,setProduct]=useState<StoreProduct|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
    const [photo, setPhoto] = useState(0);
    const [variantId,setVariantId]=useState(0),[quantity,setQuantity]=useState(1),[feedback,setFeedback]=useState<{kind: 'success' | 'error'; message: string} | null>(null);
    // Reset obsolete product/quote data before synchronizing with the next request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(()=>{let active=true;const controller=new AbortController();setProduct(null);setError('');setLoading(true);setFeedback(null);setQuantity(1);setPhoto(0);
        void fetchStoreProduct(Number(id),controller.signal).then(data=>{if(active){setProduct(data);setVariantId(data.variants?.find(v=>v.stock>0)?.id??data.variants?.[0]?.id??0);}})
            .catch(()=>{if(active)setError('This product is unavailable or could not be loaded.');}).finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;controller.abort();};},[id,reload]);
    const variant=product?.variants?.find(v=>v.id===variantId);
    const enquiry = product && variant ? `Product enquiry: ${product.name ?? 'Product'} · ${variant.label} × ${quantity}` : '';
    const whatsappHref = toWhatsappHref(product?.clubWhatsappNumber);
    const chooseVariant = (id: number) => { setVariantId(id); setQuantity(1); setFeedback(null); };
    const add = () => {
        if (!product || !variant?.id || !product.clubId || !Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(99, variant.stock)) return;
        try {
            addCartItem({ variantId: variant.id, quantity, productId: product.id, name: product.name ?? 'Product', variant: variant.label, clubId: product.clubId, currency: product.currency ?? 'GEL' });
            const message = `${product.name ?? 'Product'} · ${variant.label} × ${quantity}`;
            setFeedback({ kind: 'success', message });
            toast.success('Added to your cart', {
                id: 'store-cart-added',
                position: 'top-right',
                description: message,
                duration: 5000,
                closeButton: true,
                className: 'store-cart-toast',
                style: { background: 'var(--color-inset)', color: 'var(--color-info)', border: '1px solid var(--color-info)' },
                action: { label: 'View cart', onClick: () => navigate('/store/cart') },
                actionButtonStyle: { background: 'var(--color-info)', color: 'var(--color-text)' },
            });
        } catch (error) { toast.dismiss('store-cart-added'); setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'The cart could not be saved.' }); }
    };
    return <main className="store-page store-detail-page">
        <div className="store-detail-top"><OpportunityNavigation section="store" clubId={product?.clubId} detail/><Link className="store-cart-link" to="/store/cart"><ShoppingBag size={18}/>Open cart</Link></div>
        {loading ? <p role="status">Loading product...</p> : error ? <div role="alert" className="store-empty">{error} <button className="app-text-action" onClick={() => setReload(n => n + 1)}>Retry</button></div> : product && <div className="store-detail-grid">
            <section className="store-gallery" aria-label="Product photos">
                <div className="store-main-photo">{product.images?.length ? <MediaImage src={resolveMediaUrl(product.images[photo] ?? product.images[0])} alt={`${product.name} - photo ${photo + 1}`}/> : <span><ShoppingBag size={40}/>No product photo</span>}</div>
                {(product.images?.length ?? 0) > 1 && <div className="store-thumbnails">{product.images!.map((url, index) => <button key={`${url}-${index}`} aria-label={`View photo ${index + 1}`} aria-pressed={photo === index} onClick={() => setPhoto(index)}><MediaImage src={resolveMediaUrl(url)} alt=""/></button>)}</div>}
            </section>
            <section className="store-product-summary">
                <Link className="store-seller" to={`/clubs/${product.clubId}/store`}>{product.clubLogoUrl ? <MediaImage src={resolveMediaUrl(product.clubLogoUrl)} alt=""/> : <Shield size={22}/>}<span><small>From the club</small><strong>{product.clubName}</strong></span><ChevronRight size={16}/></Link>
                <div><h1>{product.name}</h1><p className="store-detail-price">{formatStorePrice(product.price ?? 0, product.currency)}</p><p className={`store-stock-state ${variant?.stock ? 'available' : ''}`}>{variant?.stock ? `${variant.stock} available in ${variant.label}` : 'Out of stock'} </p></div>
                <p className="store-description">{product.description}</p>
                {(product.variants?.length ?? 0) <= 8 ? <fieldset className="store-size-group"><legend>Size / variant</legend><div>{product.variants?.map(v => <button key={v.id} type="button" aria-label={v.stock ? v.label : `${v.label} - out of stock`} aria-pressed={variantId === v.id && v.stock > 0} disabled={!v.stock} title={!v.stock ? `${v.label} - out of stock` : `${v.stock} available`} onClick={() => chooseVariant(v.id ?? 0)}>{v.label}{!v.stock && <span className="sr-only"> - out of stock</span>}</button>)}</div></fieldset> : <label className="store-field">Size / variant<select value={variantId} onChange={e => chooseVariant(Number(e.target.value))}>{product.variants?.map(v => <option key={v.id} value={v.id} disabled={!v.stock}>{v.label}{!v.stock ? ' - out of stock' : ''}</option>)}</select></label>}
                <PaymentPreviewNotice />{!paymentPreviewEnabled() && <p className="store-notice">Your cart is only a saved list. Adding this item does not reserve stock, place an order, or take payment.</p>}
                <div className="store-purchase-row"><label className="store-field">Quantity<input type="number" min={1} max={Math.max(1, Math.min(99, variant?.stock ?? 0))} disabled={!variant?.stock} value={quantity} onChange={e => { setQuantity(Number(e.target.value)); setFeedback(null); }}/></label>
                    <button className="store-add-button" disabled={!variant?.stock || !Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(99, variant.stock)} onClick={add}><ShoppingBag size={18}/>Add to cart</button>
                </div>
                {feedback && <div role={feedback.kind === 'success' ? 'status' : 'alert'} className={`store-add-feedback ${feedback.kind === 'error' ? 'is-error' : ''}`}>
                    <span className="store-add-feedback-icon" aria-hidden="true">{feedback.kind === 'success' ? <CircleCheck size={25} /> : <CircleAlert size={25} />}</span>
                    <div><strong>{feedback.kind === 'success' ? 'Added to your cart!' : 'Couldn’t add this item'}</strong><p>{feedback.message}</p>{feedback.kind === 'success' && <small>Ready when you are. Review your items in the cart.</small>}</div>
                    <Link to="/store/cart">View cart <ChevronRight size={16} /></Link>
                </div>}
                {variant && (whatsappHref || product.clubEmail) && <div className="store-purchase-row" aria-label="Ask the club about this item">
                    {whatsappHref && <a className="store-cart-link" href={`${whatsappHref}?text=${encodeURIComponent(enquiry)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/>Ask via WhatsApp</a>}
                    {product.clubEmail && <a className="store-cart-link" href={`mailto:${product.clubEmail}?subject=${encodeURIComponent(enquiry)}&body=${encodeURIComponent(`Please confirm availability and how to buy ${product.name ?? 'this product'} · ${variant.label} × ${quantity} directly from the club.`)}`}><Mail size={16}/>Email product enquiry</a>}
                </div>}
            </section>
        </div>}
    </main>;
};
