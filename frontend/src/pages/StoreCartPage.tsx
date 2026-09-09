import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {readCart,saveCart,type CartItem} from '../features/store/cart';
import {fetchCartQuote,formatStorePrice,type CartQuote} from '../features/store/api';
import {extractApiErrorMessage} from '../utils/apiError';
export const StoreCartPage=()=>{
    const [items,setItems]=useState(readCart),[quote,setQuote]=useState<CartQuote|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[reload,setReload]=useState(0);
    const change=(next:CartItem[])=>{try{saveCart(next);setItems(next);}catch{setError('Your cart could not be saved. Check browser storage and try again.');}};
    // Reset obsolete product/quote data before synchronizing with the next request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(()=>{let active=true;const controller=new AbortController();setQuote(null);setError('');setLoading(items.length>0);
        if(items.length)void fetchCartQuote(items,controller.signal).then(data=>{if(active)setQuote(data);}).catch(e=>{if(active)setError(extractApiErrorMessage(e,'Prices or stock could not be checked. Please retry.'));}).finally(()=>{if(active)setLoading(false);});
        return()=>{active=false;controller.abort();};},[items,reload]);
    return <main className="mx-auto max-w-3xl space-y-5 p-4 text-[var(--text-primary)] sm:p-6"><Link to="/store" className="underline">Browse all stores</Link><h1 className="text-3xl font-bold">Your cart</h1>
        {!items.length?<p>Your cart is empty.</p>:<><p>One club and one currency per cart. Prices and stock are checked against the current store.</p><ul className="space-y-3">{items.map(item=><li key={item.variantId} className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--theme-border)] p-4"><div className="min-w-0 flex-1"><Link to={`/store/products/${item.productId}`} className="font-bold underline">{item.name}</Link><p>{item.variant}</p></div><label className="grid gap-1 text-sm">Quantity for {item.variant}<input type="number" min={1} max={99} value={item.quantity} className="w-20 rounded border bg-[var(--theme-surface)] p-2" onChange={e=>{const quantity=Number(e.target.value);if(Number.isInteger(quantity)&&quantity>=1&&quantity<=99)change(items.map(v=>v.variantId===item.variantId?{...v,quantity}:v));}}/></label><button className="underline" onClick={()=>change(items.filter(v=>v.variantId!==item.variantId))}>Remove {item.variant}</button></li>)}</ul>
        {loading&&<p role="status">Checking prices and stock...</p>}{error&&<div role="alert">{error} <button className="underline" onClick={()=>setReload(n=>n+1)}>Retry check</button></div>}
        {quote&&<section className="space-y-3 rounded-xl border p-4"><Link to={`/clubs/${quote.clubId}/store`} className="underline">{quote.clubName} store</Link>{quote.lines.map(line=><p key={line.variantId}>{line.name} ({line.variant}) x {line.quantity}: {formatStorePrice(line.lineAmount/100,quote.currency)}</p>)}<p className="text-xl font-bold">Product subtotal: {formatStorePrice(quote.subtotal/100,quote.currency)}</p><p className="text-sm">Delivery, taxes and payment fees have not been calculated.</p><p>{quote.message}</p></section>}
        <button disabled className="rounded-xl bg-emerald-700 px-5 py-3 text-white opacity-50">Checkout unavailable</button><button className="ml-4 underline" onClick={()=>change([])}>Clear cart</button></>}
    </main>;
};
