import { OpportunityNavigation } from '../components/discovery/OpportunityNavigation';
import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {fetchStoreProduct,formatStorePrice,type StoreProduct} from '../features/store/api';
import {addCartItem} from '../features/store/cart';
import {resolveMediaUrl} from '../utils/resolveMediaUrl';
import { ShoppingBag, ChevronRight, Shield } from 'lucide-react';
import '../features/store/store.css';
export const StoreProductPage=()=>{
    const {id}=useParams();const [product,setProduct]=useState<StoreProduct|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
    const [photo, setPhoto] = useState(0);
    const [variantId,setVariantId]=useState(0),[quantity,setQuantity]=useState(1),[feedback,setFeedback]=useState('');
    // Reset obsolete product/quote data before synchronizing with the next request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(()=>{let active=true;const controller=new AbortController();setProduct(null);setError('');setLoading(true);setFeedback('');setQuantity(1);setPhoto(0);
        void fetchStoreProduct(Number(id),controller.signal).then(data=>{if(active){setProduct(data);setVariantId(data.variants?.find(v=>v.stock>0)?.id??data.variants?.[0]?.id??0);}})
            .catch(()=>{if(active)setError('This product is unavailable or could not be loaded.');}).finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;controller.abort();};},[id,reload]);
    const variant=product?.variants?.find(v=>v.id===variantId);
    const chooseVariant = (id: number) => { setVariantId(id); setQuantity(1); setFeedback(''); };
    const add = () => {
        if (!product || !variant?.id || !product.clubId || !Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(99, variant.stock)) return;
        try {
            addCartItem({ variantId: variant.id, quantity, productId: product.id, name: product.name ?? 'Product', variant: variant.label, clubId: product.clubId, currency: product.currency ?? 'GEL' });
            setFeedback('Added to your cart. Stock and prices are checked again when you open it.');
        } catch (error) { setFeedback(error instanceof Error ? error.message : 'The cart could not be saved.'); }
    };
    return <main className="store-page store-detail-page">
        <div className="store-detail-top"><OpportunityNavigation section="store" clubId={product?.clubId} detail/><Link className="store-cart-link" to="/store/cart"><ShoppingBag size={18}/>Open cart</Link></div>
        {loading ? <p role="status">Loading product...</p> : error ? <div role="alert" className="store-empty">{error} <button className="underline" onClick={() => setReload(n => n + 1)}>Retry</button></div> : product && <div className="store-detail-grid">
            <section className="store-gallery" aria-label="Product photos">
                <div className="store-main-photo">{product.images?.length ? <img src={resolveMediaUrl(product.images[photo] ?? product.images[0])} alt={`${product.name} - photo ${photo + 1}`}/> : <span><ShoppingBag size={40}/>No product photo</span>}</div>
                {(product.images?.length ?? 0) > 1 && <div className="store-thumbnails">{product.images!.map((url, index) => <button key={`${url}-${index}`} aria-label={`View photo ${index + 1}`} aria-pressed={photo === index} onClick={() => setPhoto(index)}><img src={resolveMediaUrl(url)} alt=""/></button>)}</div>}
            </section>
            <section className="store-product-summary">
                <Link className="store-seller" to={`/clubs/${product.clubId}/store`}>{product.clubLogoUrl ? <img src={resolveMediaUrl(product.clubLogoUrl)} alt=""/> : <Shield size={22}/>}<span><small>From the club</small><strong>{product.clubName}</strong></span><ChevronRight size={16}/></Link>
                <div><h1>{product.name}</h1><p className="store-detail-price">{formatStorePrice(product.price ?? 0, product.currency)}</p><p className={`store-stock-state ${variant?.stock ? 'available' : ''}`}>{variant?.stock ? `${variant.stock} available in ${variant.label}` : 'Out of stock'} </p></div>
                <p className="store-description">{product.description}</p>
                {(product.variants?.length ?? 0) <= 8 ? <fieldset className="store-size-group"><legend>Size / variant</legend><div>{product.variants?.map(v => <button key={v.id} type="button" aria-label={v.stock ? v.label : `${v.label} - out of stock`} aria-pressed={variantId === v.id && v.stock > 0} disabled={!v.stock} title={!v.stock ? `${v.label} - out of stock` : `${v.stock} available`} onClick={() => chooseVariant(v.id ?? 0)}>{v.label}{!v.stock && <span className="sr-only"> - out of stock</span>}</button>)}</div></fieldset> : <label className="store-field">Size / variant<select value={variantId} onChange={e => chooseVariant(Number(e.target.value))}>{product.variants?.map(v => <option key={v.id} value={v.id} disabled={!v.stock}>{v.label}{!v.stock ? ' - out of stock' : ''}</option>)}</select></label>}
                <div className="store-purchase-row"><label className="store-field">Quantity<input type="number" min={1} max={Math.max(1, Math.min(99, variant?.stock ?? 0))} disabled={!variant?.stock} value={quantity} onChange={e => { setQuantity(Number(e.target.value)); setFeedback(''); }}/></label>
                    <button className="store-add-button" disabled={!variant?.stock || !Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(99, variant.stock)} onClick={add}><ShoppingBag size={18}/>Add to cart</button>
                </div>
                {feedback && <p role="status" className="store-feedback">{feedback}</p>}
                <p className="store-notice">Online checkout is not available yet. Adding an item does not reserve stock or place an order.</p>
            </section>
        </div>}
    </main>;
};
