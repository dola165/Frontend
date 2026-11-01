import { toWhatsappHref } from '../components/club/clubProfileInfo';
import { ct, useCommerceCopy } from '../features/store/copy';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StoreOrders } from '../features/store/orders/StoreOrders';
import { PurchaseRequestForm } from '../features/store/orders/PurchaseRequestForm';
import { CommerceDraftScope } from '../components/workspace/CommerceDraftScope';
import type { StoreOrder } from '../features/store/orders/api';
import { Package, X } from 'lucide-react';
import { MediaImage } from '../components/ui/MediaImage';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Panel } from '../design/primitives';
import { fetchCartQuote, fetchStoreProduct, formatStorePrice, type CartQuote, type StoreProduct } from '../features/store/api';
import { readCart, saveCart, type CartItem } from '../features/store/cart';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/store/store.css';

/** The cart: one seller and one currency per cart; prices and stock are checked against the store before anything else. */
const StoreCart = () => {
    const [params] = useSearchParams();
    const [receipt, setReceipt] = useState<{ itemsKey: string; order: StoreOrder } | null>(null);
    useCommerceCopy();
    const [items, setItems] = useState(readCart);
    const [checked, setChecked] = useState<{ itemsKey: string; quote: CartQuote } | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [reload, setReload] = useState(0);
    const [loadedProducts, setLoadedProducts] = useState<{ key: string; data: Record<number, StoreProduct | null> } | null>(null);
    const productIds = [...new Set(items.map(item => item.productId))].sort((a, b) => a - b).join(',');
    const products = loadedProducts?.key === productIds ? loadedProducts.data : {};
    const itemsKey = JSON.stringify(items);
    const created = receipt?.itemsKey === itemsKey ? receipt.order : null;
    const quote = checked?.itemsKey === itemsKey ? checked.quote : null;
    const contact = quote?.lines[0] ? products[quote.lines[0].productId] : null;
    const change = (next: CartItem[]) => {
        try { saveCart(next); setItems(next); }
        catch { setError(ct("Your cart could not be saved. Check browser storage and try again.")); }
    };
    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        // The catalogue's current photo for each line, once per product; a missing photo never blocks the price check.
        const ids = productIds ? productIds.split(',').map(Number) : [];
        void Promise.all(ids.map(async productId => {
            try { const product = await fetchStoreProduct(productId, controller.signal); return [productId, product] as const; }
            catch { return [productId, null] as const; }
        })).then(entries => { if (active) setLoadedProducts({ key: productIds, data: Object.fromEntries(entries) }); });
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
            .catch(failure => { if (active) setError(extractApiErrorMessage(failure, ct("Prices or stock could not be checked. Please retry."))); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [items, itemsKey, reload]);
    const sellerLabel = quote?.clubName ?? '';
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    return (
        <GkRoot className="gk-store gk-page" data-market="store">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}><Link to="/store">{ct("Store")}</Link><span aria-hidden="true">/</span><span>{ct("Cart")}</span></nav>
                <header className="gk-store-heading">
                    <div className="gk-store-heading__text"><h1>{params.get('view') === 'requests' ? 'My requests' : ct("Your cart")}</h1><p className="gk-store-heading__hint">{params.get('view') === 'requests' ? 'Purchase arrangements with your sellers' : items.length ? `${count} ${count === 1 ? 'item' : 'items'}${sellerLabel ? ` · ${sellerLabel}` : ''}` : ct("Nothing in it yet")}</p></div>
                    <div className="store-orders__doors"><ButtonLink to="/store/cart?view=requests">My requests</ButtonLink><ButtonLink to="/store">{ct("Keep shopping")}</ButtonLink></div>
                </header>
                {params.get("view") === "requests" ? <><ButtonLink to="/store/cart">Back to cart</ButtonLink><StoreOrders /></> : !items.length ? <EmptyNote title={ct("Your cart is empty")} action={<ButtonLink variant="primary" to="/store">{ct("Explore the store")}</ButtonLink>}>{ct("Choose something from GrassKickZ or a club you support.")}</EmptyNote> : <div className="gk-store-cart">
                    <Panel title={sellerLabel ? ct("From {v0}", { v0: sellerLabel }) : ct("Items")} action={<Button variant="ghost" size="sm" onClick={() => change([])}>{ct("Clear cart")}</Button>}>
                        <ul aria-label={ct("Cart items")}>{items.map(item => <li key={item.variantId} className="gk-store-cart__item">
                            <span className="gk-store-cart__pic" aria-hidden="true">{products[item.productId]?.images?.[0] ? <MediaImage src={resolveMediaUrl(products[item.productId]?.images?.[0])} alt="" loading="lazy" /> : <Package />}</span>
                            <div className="gk-store-cart__text"><Link to={`/store/products/${item.productId}`}>{item.name}</Link><span>{item.variant}</span></div>
                            <input className="gk-input gk-store-cart__qty" type="number" min={1} max={99} aria-label={ct("Quantity of {v0}, {v1}", { v0: item.name, v1: item.variant })} value={item.quantity} onChange={event => {
                                const quantity = Number(event.target.value);
                                if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 99) change(items.map(line => line.variantId === item.variantId ? { ...line, quantity } : line));
                            }} />
                            <Button variant="ghost" size="sm" iconOnly aria-label={ct("Remove {v0}, {v1}", { v0: item.name, v1: item.variant })} onClick={() => change(items.filter(line => line.variantId !== item.variantId))}><X aria-hidden="true" /></Button>
                        </li>)}</ul>
                    </Panel>
                    <Panel title={ct("Summary")} padded>
                        <div className="gk-stack">
                            {loading && <p role="status" className="gk-muted">{ct("Checking prices and stock…")}</p>}
                            {error && <div className="gk-notice gk-notice--danger"><span role="alert">{error}</span><Button size="sm" onClick={() => setReload(n => n + 1)}>{ct("Retry")}</Button></div>}
                            {quote && <>
                                {quote.lines.map(line => <p key={line.variantId} className="gk-store-cart__line"><span>{line.name} · {line.variant} × {line.quantity}</span><span className="gk-num">{formatStorePrice(line.lineAmount / 100, quote.currency)}</span></p>)}
                                <p className="gk-store-cart__total"><span>{ct("Subtotal")}</span><span className="gk-num">{formatStorePrice(quote.subtotal / 100, quote.currency)}</span></p>
                                <p className="gk-store-cart__note">{ct("Delivery, taxes and payment fees are not included.")}</p>
                            </>}
                            {quote && !loading && !error && (created ? <div role="status"><p>Request saved. Open My requests for its current status, the seller’s answer and next steps. No money was taken by this action.</p><ButtonLink to="/store/cart?view=requests">Open My requests</ButtonLink><Button onClick={() => { setReceipt(null); setChecked(null); setReload(n => n + 1); }}>Review current quote for another purchase</Button></div>
                                : <CommerceDraftScope clubId={quote.clubId} feature={`PurchaseRequest:${itemsKey}`}><PurchaseRequestForm quote={quote} onRefresh={() => setReload(n => n + 1)} onCreated={order => setReceipt({ itemsKey, order })} /></CommerceDraftScope>)}
                            {quote && contact && <div className="store-orders__doors" aria-label="Buy directly from the seller">
                                {toWhatsappHref(contact.clubWhatsappNumber) && <a className="gk-btn gk-btn--secondary" href={toWhatsappHref(contact.clubWhatsappNumber)!} target="_blank" rel="noopener noreferrer">Seller WhatsApp</a>}
                                {contact.clubEmail && <a className="gk-btn gk-btn--secondary" href={`mailto:${contact.clubEmail}`}>Seller email</a>}
                                {contact.sellerWebsite && <a className="gk-btn gk-btn--secondary" href={contact.sellerWebsite} target="_blank" rel="noopener noreferrer">Seller website</a>}
                            </div>}
                            {quote && quote.clubId > 0 && <ButtonLink variant="ghost" to={`/clubs/${quote.clubId}?tab=contact`}>Contact {quote.clubName}</ButtonLink>}
                        </div>
                    </Panel>
                </div>}
            </PageFrame>
        </GkRoot>
    );
};

export const StoreCartPage = () => {
    const { sessionId, status } = useAuth();
    return <StoreCart key={`${sessionId}:${status}`} />;
};
