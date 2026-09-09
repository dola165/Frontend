import {useEffect,useState} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {fetchStoreCatalog,formatStorePrice,STORE_CATEGORIES,type StoreProduct} from '../features/store/api';
import {resolveMediaUrl} from '../utils/resolveMediaUrl';
import {DiscoverySectionTabs} from '../components/discovery/DiscoverySectionTabs';
import {apiClient} from '../api/axiosConfig';
const input='rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-sm';
export const StorePage = () => {
    const {id}=useParams(); const clubId=id ? Number(id):undefined;
    const [params,setParams]=useSearchParams();
    const [products,setProducts]=useState<StoreProduct[]>([]),[total,setTotal]=useState(0);
    const [loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[clubName,setClubName]=useState('');
    const query=params.toString();
    const page=Math.min(1000000,Math.max(0,Math.floor(Number(params.get('page'))||0)));
    const currency=['GEL','EUR','GBP','USD'].includes(params.get('currency')??'') ? params.get('currency')!:'GEL';
    const change=(name:string,value:string)=>setParams(current=>{const next=new URLSearchParams(current);if(value)next.set(name,value);else next.delete(name);if(name!=='page')next.delete('page');return next;});
    useEffect(()=>{
        const controller=new AbortController(); let active=true;
        // Clear the previous route/search while synchronizing with the next API request.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);setError('');setProducts([]);setClubName('');
        const search=new URLSearchParams(query);
        const requestedPage=Math.min(1000000,Math.max(0,Math.floor(Number(search.get('page'))||0)));
        const n=(key:string)=>search.get(key) && Number.isFinite(Number(search.get(key))) ? Number(search.get(key)):undefined;
        if(clubId!==undefined && (!Number.isSafeInteger(clubId)||clubId<1)){setError('This club could not be found.');setLoading(false);return;}
        const clubRequest=clubId ? apiClient.get<{name:string}>(`/clubs/${clubId}`,{signal:controller.signal}).then(r=>r.data.name):Promise.resolve('');
        void Promise.all([fetchStoreCatalog({page:requestedPage,size:12,clubId,query:search.get('query')||undefined,
            category:search.get('category')||undefined,currency,country:search.get('country')||undefined,city:search.get('city')||undefined,
            variant:search.get('variant')||undefined,minPrice:n('minPrice'),maxPrice:n('maxPrice'),sort:search.get('sort')||'NEWEST'},controller.signal),clubRequest])
            .then(([data,name])=>{if(active){setProducts(data.content??[]);setTotal(data.totalElements??0);setClubName(name);}})
            .catch(()=>{if(active)setError('The store could not load. Please try again.');})
            .finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;controller.abort();};
    },[query,clubId,currency,reload]);
    return <main className="mx-auto max-w-7xl space-y-6 p-4 text-[var(--text-primary)] sm:p-6">
        <DiscoverySectionTabs/>
        <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold">{clubId ? `${clubName||'Club'} store`:'Store'}</h1><p className="mt-2 text-[var(--text-secondary)]">{clubId?'Products from this club.':'Browse products from football clubs across the platform.'}</p></div><Link className="rounded-lg border px-4 py-2 font-semibold" to="/store/cart">Open cart</Link></header>
        {clubId && <nav className="flex gap-4 text-sm underline"><Link to={`/clubs/${clubId}`}>Back to club</Link><Link to="/store">Browse all stores</Link></nav>}
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">Browse and prepare your cart. Online checkout is not available yet.</p>
        <form className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4" onSubmit={e=>e.preventDefault()}>
            <label className="grid gap-1 text-sm">Search<input className={input} value={params.get('query')??''} maxLength={100} onChange={e=>change('query',e.target.value)} placeholder="Product or club"/></label>
            <label className="grid gap-1 text-sm">Category<select className={input} value={params.get('category')??''} onChange={e=>change('category',e.target.value)}><option value="">All categories</option>{STORE_CATEGORIES.map(c=><option key={c} value={c}>{c.replaceAll('_',' ')}</option>)}</select></label>
            <label className="grid gap-1 text-sm">Currency<select className={input} value={currency} onChange={e=>change('currency',e.target.value)}>{['GEL','EUR','GBP','USD'].map(c=><option key={c}>{c}</option>)}</select></label>
            <label className="grid gap-1 text-sm">Sort<select className={input} value={params.get('sort')??'NEWEST'} onChange={e=>change('sort',e.target.value)}><option value="NEWEST">Newest</option><option value="PRICE_LOW">Price: low to high</option><option value="PRICE_HIGH">Price: high to low</option></select></label>
            <details className="sm:col-span-3 lg:col-span-4"><summary className="cursor-pointer text-sm underline">More filters</summary><div className="mt-3 grid gap-3 sm:grid-cols-3">{[['country','Country'],['city','City'],['variant','Available size / variant'],['minPrice','Minimum price'],['maxPrice','Maximum price']].map(([key,label])=><label key={key} className="grid gap-1 text-sm">{label}<input className={input} value={params.get(key)??''} onChange={e=>change(key,e.target.value)} type={key.endsWith('Price')?'number':'text'} min="0" step="0.01" maxLength={key==='variant'?40:100}/></label>)}</div></details>
            <button type="button" className={input} onClick={()=>setParams({})}>Reset filters</button>
        </form>
        {loading ? <p role="status">Loading products...</p> : error ? <div role="alert">{error} <button className="underline" onClick={()=>setReload(n=>n+1)}>Retry</button></div> : <>
            <p role="status" className="text-sm text-[var(--text-secondary)]">{total} products matching this search</p>
            {products.length===0 ? <p>No products on this page. Change the filters or return to the first page.</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map(product=><article key={product.id} className="overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)]">
                <Link to={`/store/products/${product.id}`} className="block"><div className="flex aspect-[4/3] items-center justify-center bg-black/10">{product.images?.[0]?<img src={resolveMediaUrl(product.images[0])} alt={product.name??'Product'} className="h-full w-full object-cover"/>:<span className="text-[var(--text-secondary)]">No product photo</span>}</div><div className="space-y-2 p-4"><h2 className="text-lg font-bold">{product.name}</h2><p className="font-semibold">{formatStorePrice(product.price??0,product.currency)}</p><p className="text-sm">{product.variants?.some(v=>v.stock>0)?'In stock':'Out of stock'}</p></div></Link>
                <Link className="mx-4 mb-4 inline-block text-sm underline" to={`/clubs/${product.clubId}/store`}>{product.clubName}</Link>
            </article>)}</div>}
            <nav aria-label="Store pages" className="flex items-center gap-4"><button disabled={page===0} className="rounded border px-3 py-2 disabled:opacity-40" onClick={()=>change('page',String(Math.max(0,page-1)))}>Previous</button><span>Page {page+1} of {Math.max(1,Math.ceil(total/12))}</span><button disabled={(page+1)*12>=total} className="rounded border px-3 py-2 disabled:opacity-40" onClick={()=>change('page',String(page+1))}>Next</button></nav>
        </>}
    </main>;
};
