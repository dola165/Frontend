import { ct, useCommerceCopy } from '../features/store/copy';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, X } from 'lucide-react';
import { MediaImage } from '../components/ui/MediaImage';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Panel } from '../design/primitives';
import { CartPaymentPreview } from '../features/paymentPreview/CartPaymentPreview';
import { paymentPreviewEnabled } from '../features/paymentPreview/config';
import { fetchCartQuote, fetchStoreProduct, formatStorePrice, GRASSKICKZ, type CartQuote } from '../features/store/api';
import { readCart, saveCart, type CartItem } from '../features/store/cart';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/store/store.css';

/** The cart: one seller and one currency per cart; prices and stock are checked against the store before anything else. */
export const StoreCartPage = () => {
    useCommerceCopy();
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
        catch { setError(ct("Your cart could not be saved. Check browser storage and try again.")); }
    };
    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        // The catalogue's current photo for each line, once per product; a missing photo never blocks the price check.
        const ids = productIds ? productIds.split(',').map(Number) : [];
        void Promise.all(ids.map(async productId => {
            try { const product = await fetchStoreProduct(productId, controller.signal); return [productId, product?.images?.[0] ?? null] as const; }
            catch { return [productId, null] as const; }
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
            .catch(failure => { if (active) setError(extractApiErrorMessage(failure, ct("Prices or stock could not be checked. Please retry."))); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [items, itemsKey, reload]);
    const own = items[0]?.seller === 'GRASSKICKZ' || items[0]?.clubId === 0;
    const sellerLabel = quote ? (own ? GRASSKICKZ : quote.clubName) : own ? GRASSKICKZ : '';
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    return (
        <GkRoot className="gk-store gk-page" data-market="store">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}><Link to="/store">{ct("Store")}</Link><span aria-hidden="true">/</span><span>{ct("Cart")}</span></nav>
                <header className="gk-store-heading">
                    <div className="gk-store-heading__text"><h1>{ct("Your cart")}</h1><p className="gk-store-heading__hint">{items.length ? `${count} ${count === 1 ? 'item' : 'items'}${sellerLabel ? ` · ${sellerLabel}` : ''}` : ct("Nothing in it yet")}</p></div>
                    <ButtonLink to="/store">{ct("Keep shopping")}</ButtonLink>
                </header>
                {!items.length ? <EmptyNote title={ct("Your cart is empty")} action={<ButtonLink variant="primary" to="/store">{ct("Explore the store")}</ButtonLink>}>{ct("Choose something from GrassKickZ or a club you support.")}</EmptyNote> : <div className="gk-store-cart">
                    <Panel title={sellerLabel ? ct("From {v0}", { v0: sellerLabel }) : ct("Items")} action={<Button variant="ghost" size="sm" onClick={() => change([])}>{ct("Clear cart")}</Button>}>
                        <ul aria-label={ct("Cart items")}>{items.map(item => <li key={item.variantId} className="gk-store-cart__item">
                            <span className="gk-store-cart__pic" aria-hidden="true">{photos[item.productId] ? <MediaImage src={resolveMediaUrl(photos[item.productId])} alt="" loading="lazy" /> : <Package />}</span>
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
                            {paymentPreviewEnabled() && quote && !loading && !error
                                ? <CartPaymentPreview key={itemsKey} quote={quote} items={items} onQuote={next => setChecked({ itemsKey, quote: next })} />
                                : <>
                                    {quote && <p className="gk-store-cart__note">{ct("GrassKickZ does not reserve this stock, place an order or take payment yet. Contact ")}{sellerLabel}{ct(" to buy directly.")}</p>}
                                    <Button variant="primary" disabled>{ct("Checkout unavailable")}</Button>
                                    {quote && quote.clubId > 0 && <ButtonLink variant="ghost" to={`/clubs/${quote.clubId}?tab=contact`}>{ct("Contact ")}{quote.clubName}</ButtonLink>}
                                </>}
                        </div>
                    </Panel>
                </div>}
            </PageFrame>
        </GkRoot>
    );
};
