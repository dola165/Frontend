import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {fetchStoreProduct,formatStorePrice,type StoreProduct} from '../features/store/api';
import {addCartItem} from '../features/store/cart';
import {resolveMediaUrl} from '../utils/resolveMediaUrl';
export const StoreProductPage=()=>{
    const {id}=useParams();const [product,setProduct]=useState<StoreProduct|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
    const [variantId,setVariantId]=useState(0),[quantity,setQuantity]=useState(1),[feedback,setFeedback]=useState('');
    // Reset obsolete product/quote data before synchronizing with the next request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(()=>{let active=true;const controller=new AbortController();setProduct(null);setError('');setLoading(true);setFeedback('');setQuantity(1);
        void fetchStoreProduct(Number(id),controller.signal).then(data=>{if(active){setProduct(data);setVariantId(data.variants?.find(v=>v.stock>0)?.id??data.variants?.[0]?.id??0);}})
            .catch(()=>{if(active)setError('This product is unavailable or could not be loaded.');}).finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;controller.abort();};},[id,reload]);
    const variant=product?.variants?.find(v=>v.id===variantId);
    return <main className="mx-auto max-w-5xl space-y-5 p-4 text-[var(--text-primary)] sm:p-6">
        <nav className="flex flex-wrap gap-4 underline"><Link to="/store">Browse all stores</Link>{product?.clubId&&<Link to={`/clubs/${product.clubId}/store`}>{product.clubName} store</Link>}<Link to="/store/cart">Open cart</Link></nav>
        {loading?<p role="status">Loading product...</p>:error?<div role="alert">{error} <button className="underline" onClick={()=>setReload(n=>n+1)}>Retry</button></div>:product&&<div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">{product.images?.length?product.images.map((url,i)=><img key={url} src={resolveMediaUrl(url)} alt={`${product.name} - photo ${i+1}`} className="w-full rounded-xl object-cover"/>):<div className="flex aspect-square items-center justify-center rounded-xl bg-black/10">No product photo</div>}</div>
            <section className="space-y-5"><h1 className="text-3xl font-bold">{product.name}</h1><p className="text-xl font-semibold">{formatStorePrice(product.price??0,product.currency)}</p><p className="whitespace-pre-wrap">{product.description}</p>
                <label className="grid gap-2">Size / variant<select className="rounded border bg-[var(--theme-surface)] p-3" value={variantId} onChange={e=>{setVariantId(Number(e.target.value));setFeedback('');}}>{product.variants?.map(v=><option key={v.id} value={v.id}>{v.label} - {v.stock>0?`${v.stock} available`:'out of stock'}</option>)}</select></label>
                <label className="grid gap-2">Quantity<input className="w-28 rounded border bg-[var(--theme-surface)] p-3" type="number" min={1} max={Math.min(99,variant?.stock??0)} value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
                <button type="button" disabled={!variant?.stock || !Number.isInteger(quantity) || quantity<1 || quantity>Math.min(99,variant.stock)} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-40" onClick={()=>{
                    if(!variant?.id || !product.clubId)return;
                    try{addCartItem({variantId:variant.id,quantity,productId:product.id,name:product.name??'Product',variant:variant.label,clubId:product.clubId,currency:product.currency??'GEL'});setFeedback('Added to your cart. Stock and prices are checked again when you open it.');}
                    catch(e){setFeedback(e instanceof Error?e.message:'The cart could not be saved.');}
                }}>Add to cart</button>
                {feedback&&<p role="status">{feedback}</p>}
                <p className="rounded-xl border border-amber-500/30 p-3 text-sm">Online checkout is not available yet. Adding an item does not reserve stock or place an order.</p>
            </section></div>}
    </main>;
};
