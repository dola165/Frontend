import {useEffect,useState} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {fetchStoreCatalog,formatStorePrice,type StoreProduct} from '../features/store/api';
import {resolveMediaUrl} from '../utils/resolveMediaUrl';
import {DiscoverySectionTabs} from '../components/discovery/DiscoverySectionTabs';
import {apiClient} from '../api/axiosConfig';
import { ShoppingBag, SlidersHorizontal, X, Search } from 'lucide-react';
import { StoreFilters } from '../features/store/StoreFilters';
import { filterLabels, categoryLabel } from '../features/store/filterLabels';
import '../features/store/store.css';
export const StorePage = () => {
    const {id}=useParams(); const clubId=id ? Number(id):undefined;
    const [params,setParams]=useSearchParams();
    const [products,setProducts]=useState<StoreProduct[]>([]),[total,setTotal]=useState(0);
    const [loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[clubName,setClubName]=useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const query=params.toString();
    const page=Math.min(1000000,Math.max(0,Math.floor(Number(params.get('page'))||0)));
    const currency=['GEL','EUR','GBP','USD'].includes(params.get('currency')??'') ? params.get('currency')!:'GEL';
    const change=(name:string,value:string)=>setParams(current=>{const next=new URLSearchParams(current);if(value)next.set(name,value);else next.delete(name);if(name!=='page')next.delete('page');if(name==='country')next.delete('city');return next;});
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
    const selected = Object.entries(filterLabels).filter(([key]) => !!params.get(key) && !(key === 'currency' && currency === 'GEL'));
    return <main className="store-page">
        <DiscoverySectionTabs/>
        <header className="store-heading">
            <div><p className="store-eyebrow">Support the clubs you love</p><h1>{clubId ? `${clubName || 'Club'} store` : 'Store'}</h1><p className="store-subtitle">{clubId ? 'Products from this club.' : 'Discover kit, gear and more from football clubs.'}</p></div>
            <Link className="store-cart-link" to="/store/cart"><ShoppingBag size={18}/>Open cart</Link>
        </header>
        {clubId && <nav className="store-scope-links" aria-label="Store scope"><Link to={`/clubs/${clubId}`}>Back to club</Link><Link to="/store">Browse all stores</Link></nav>}
        <p className="store-notice"><span className="store-notice-dot"/>Browse and prepare your cart. Online checkout is not available yet.</p>
        <div className="store-toolbar">
            <label className="store-search"><Search size={18}/><span className="sr-only">Search</span><input value={params.get('query') ?? ''} maxLength={100} onChange={e => change('query', e.target.value)} placeholder="Search products or clubs"/></label>
            <label className="store-sort">Sort<select value={params.get('sort') ?? 'NEWEST'} onChange={e => change('sort', e.target.value)}><option value="NEWEST">Newest</option><option value="PRICE_LOW">Price: low to high</option><option value="PRICE_HIGH">Price: high to low</option></select></label>
            <button className="store-filter-toggle" aria-expanded={filtersOpen} aria-controls="store-filters" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={16}/>{filtersOpen ? 'Hide filters' : 'Filters'}{selected.length > 0 && ` (${selected.length})`}</button>
        </div>
        {selected.length > 0 && <div className="store-filter-chips" aria-label="Selected filters">{selected.map(([key, label]) => <button key={key} aria-label={`Remove ${label} filter`} onClick={() => change(key, '')}>{label}: {key === 'category' ? categoryLabel(params.get(key)!) : params.get(key)}<X size={13}/></button>)}</div>}
        <div className="store-catalog-layout">
            <aside id="store-filters" className={`store-filter-panel ${filtersOpen ? 'is-open' : ''}`} aria-label="Product filters">
                <StoreFilters clubId={clubId} params={params} currency={currency} change={change} reset={() => setParams({})}/>
                <button className="store-filter-done" onClick={() => {setFiltersOpen(false); document.querySelector<HTMLButtonElement>('.store-filter-toggle')?.focus();}}>Show products</button>
            </aside>
            <section className="store-results" aria-label="Products" aria-busy={loading}>
                {loading ? <p role="status">Loading products...</p> : error ? <div role="alert" className="store-empty">{error} <button className="underline" onClick={() => setReload(n => n + 1)}>Retry</button></div> : <>
                    <p role="status" className="store-result-count">{total} products matching this search</p>
                    {products.length === 0 ? <div className="store-empty"><ShoppingBag size={30}/><h2>No products found</h2><p>Try another search or clear your filters.</p><button onClick={() => setParams({})}>Clear search and filters</button></div> : <div className="store-product-grid">{products.map(product => <article key={product.id} className="store-product-card">
                        <Link to={`/store/products/${product.id}`} className="store-card-main"><div className="store-card-photo">{product.images?.[0] ? <img loading="lazy" src={resolveMediaUrl(product.images[0])} alt={product.name ?? 'Product'}/> : <span><ShoppingBag size={32}/>No product photo</span>}{!product.variants?.some(v => v.stock > 0) && <span className="store-stock-badge">Out of stock</span>}</div>
                            <div className="store-card-info"><h2>{product.name}</h2><p>{formatStorePrice(product.price ?? 0, product.currency)}</p></div></Link>
                        <Link className="store-card-club" to={`/clubs/${product.clubId}/store`}>{product.clubName}<span aria-hidden="true"> ↗</span></Link>
                    </article>)}</div>}
                    <nav aria-label="Store pages" className="store-pagination"><button disabled={page === 0} onClick={() => change('page', String(Math.max(0, page - 1)))}>Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil(total / 12))}</span><button disabled={(page + 1) * 12 >= total} onClick={() => change('page', String(page + 1))}>Next</button></nav>
                </>}
            </section>
        </div>
    </main>;
};
