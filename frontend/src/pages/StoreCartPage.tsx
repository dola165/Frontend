import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { readCart, saveCart, type CartItem } from '../features/store/cart';
import { fetchCartQuote, fetchStoreProduct, formatStorePrice, type CartQuote } from '../features/store/api';
import { CartProductImage } from '../components/store/CartProductImage';
import { extractApiErrorMessage } from '../utils/apiError';
import { paymentPreviewEnabled } from '../features/paymentPreview/config';
import { CartPaymentPreview } from '../features/paymentPreview/CartPaymentPreview';
import { PaymentPreviewNotice } from '../features/paymentPreview/PaymentPreview';
import '../features/store/store.css';

export const StoreCartPage = () => {
    const [items, setItems] = useState(readCart);
    const [checked, setChecked] = useState<{ itemsKey: string; quote: CartQuote } | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [reload, setReload] = useState(0);
    const [photos, setPhotos] = useState<Record<number, string | null>>({});
    const productIds = [...new Set(items.map(item => item.productId))].sort((a, b) => a - b).join(',');
    const itemsKey = JSON.stringify(items);
    const quote = checked?.itemsKey === itemsKey ? checked.quote : null;
    const change = (next: CartItem[]) => {
        try { saveCart(next); setItems(next); }
        catch { setError('Your cart could not be saved. Check browser storage and try again.'); }
    };
    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        // Load current catalog photos for saved carts too, once per distinct product.
        // Photo availability never blocks price checks or cart controls.
        const ids = productIds ? productIds.split(',').map(Number) : [];
        void Promise.all(ids.map(async productId => {
            try {
                const product = await fetchStoreProduct(productId, controller.signal);
                return [productId, product?.images?.[0] ?? null] as const;
            } catch { return [productId, null] as const; }
        })).then(entries => { if (active) setPhotos(Object.fromEntries(entries)); });
        return () => { active = false; controller.abort(); };
    }, [productIds]);
    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        // Clear results while synchronizing with the current cart request.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChecked(null); setError(''); setLoading(items.length > 0);
        if (items.length) void fetchCartQuote(items, controller.signal)
            .then(data => { if (active) setChecked({ itemsKey, quote: data }); })
            .catch(e => { if (active) setError(extractApiErrorMessage(e, 'Prices or stock could not be checked. Please retry.')); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [items, itemsKey, reload]);
    return <main className="store-page store-cart-page">
        <header className="store-heading"><div><p className="store-eyebrow">From your club store</p><h1>Your cart</h1></div><Link to="/store" className="store-cart-link">Browse all stores</Link></header>
        <PaymentPreviewNotice />
        {!items.length ? <div className="store-empty"><ShoppingBag size={32} /><h2>Your cart is empty.</h2><p>Choose something from a club you support.</p><Link to="/store" className="store-cart-link">Explore the store</Link></div> : <div className="store-checkout-layout">
            <section aria-label="Cart items"><p className="store-subtitle">One club and one currency per cart. Prices and stock are checked against the current store.</p>
                <ul className="store-checkout-items">{items.map(item => <li key={item.variantId}>
                    <div className="store-cart-product"><Link className="store-cart-product-link" to={`/store/products/${item.productId}`}><CartProductImage key={`${item.productId}:${photos[item.productId] ?? ''}`} src={photos[item.productId]} /><span className="store-cart-product-info"><strong>{item.name}</strong><span>{item.variant}</span></span></Link></div>
                    <label>Quantity for {item.variant}<input type="number" min={1} max={99} value={item.quantity} onChange={e => {
                        const quantity = Number(e.target.value);
                        if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 99) change(items.map(v => v.variantId === item.variantId ? { ...v, quantity } : v));
                    }} /></label><button onClick={() => change(items.filter(v => v.variantId !== item.variantId))}>Remove {item.variant}</button>
                </li>)}</ul>
                <button className="store-cart-link" onClick={() => change([])}>Clear cart</button>
            </section>
            <div className="store-checkout-summary">
                {loading && <p role="status">Checking prices and stock...</p>}
                {error && <div role="alert">{error} <button className="app-text-action" onClick={() => setReload(n => n + 1)}>Retry check</button></div>}
                {quote && <section className="store-checkout-quote"><Link to={`/clubs/${quote.clubId}/store`}>{quote.clubName} store</Link>
                    {quote.lines.map(line => <p key={line.variantId}>{line.name} ({line.variant}) × {line.quantity}: {formatStorePrice(line.lineAmount / 100, quote.currency)}</p>)}
                    <h2>Product subtotal: {formatStorePrice(quote.subtotal / 100, quote.currency)}</h2>
                    <p>Delivery, taxes and payment fees have not been calculated.</p>
                    {!paymentPreviewEnabled() && <p>GrassKickZ does not reserve this stock, place an order, or take payment. Contact {quote.clubName} to confirm availability and buy directly.</p>}
                    {!paymentPreviewEnabled() && <details><summary>Enquiry details to share with the club</summary><p>{quote.lines.map(line => `${line.name} · ${line.variant} × ${line.quantity}`).join(' | ')}</p></details>}
                    <button className="app-text-action" onClick={() => setReload(n => n + 1)}>Retry check</button>
                </section>}
                {paymentPreviewEnabled() && quote && !loading && !error ? <CartPaymentPreview key={itemsKey} quote={quote} items={items} onQuote={next => setChecked({ itemsKey, quote: next })} /> : <><button disabled className="store-cart-link">Checkout unavailable</button>{quote && <Link className="store-cart-link" to={`/clubs/${quote.clubId}?tab=contact`}>Contact {quote.clubName} about this cart</Link>}</>}
            </div>
        </div>}
    </main>;
};
