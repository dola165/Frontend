import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CommerceDraftScope } from '../../../components/workspace/CommerceDraftScope';
import { PurchaseRequestForm } from '../orders/PurchaseRequestForm';
import { StoreOrderCard } from '../orders/StoreOrderCard';
import { StoreOrders } from '../orders/StoreOrders';
import { commandOrder, fetchOrder, fetchOrders, renewOrder, requestPurchase, type StoreOrder } from '../orders/api';
import { fetchCartQuote, type CartQuote } from '../api';
import { RenewRequest } from '../orders/RenewRequest';
import { purchaseMarkerKey } from '../orders/recovery';

const auth = vi.hoisted(() => ({ status: 'authenticated', sessionId: 'store-orders-session' }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../orders/api', () => ({ requestPurchase: vi.fn(), commandOrder: vi.fn(), fetchOrder: vi.fn(), fetchOrders: vi.fn(), renewOrder: vi.fn() }));
vi.mock('../api', async importOriginal => ({ ...await importOriginal<typeof import('../api')>(), fetchCartQuote: vi.fn() }));
const material = { description: 'Original shirt description', images: [], sizes: ['M'], category: 'SHIRT', collection: null, sellerArrangement: null };
const digest = 'a'.repeat(64);
const quote: CartQuote = { clubId: 10, clubName: 'Actual seller', currency: 'EUR', subtotal: 2468, checkoutEnabled: false, message: '',
    lines: [{ variantId: 7, productId: 1, productVersion: 3, material, materialDigest: digest, name: 'Shirt', variant: 'M', quantity: 2, unitAmount: 1234, lineAmount: 2468 }] };
const order: StoreOrder = { id: 'saved-order', buyerId: 2, clubId: 10, sellerName: 'Actual seller', currency: 'EUR', total: 24.68,
    fulfillment: 'COLLECTION', buyerContact: 'private buyer contact', buyerNote: '', sellerAnswer: '', status: 'REQUESTED', settlement: 'UNREPORTED', version: 0,
    createdAt: '2026-10-30T12:00:00Z', updatedAt: '2026-10-30T12:00:00Z', lines: [{ productId: 1, variantId: 7, originalVariantId: 7, productVersion: 3, name: 'Shirt', variant: 'M', quantity: 2, unitPrice: 12.34 }], history: [] };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(fetchOrder).mockResolvedValue(order); localStorage.clear(); sessionStorage.clear(); auth.sessionId = 'store-orders-session'; auth.status = 'authenticated'; localStorage.setItem('gk-session-id', auth.sessionId); localStorage.setItem('userId', '2'); });
afterEach(() => { localStorage.clear(); });
const form = (created = vi.fn(), refresh = vi.fn(), value = quote) => render(<MemoryRouter><CommerceDraftScope clubId={10} feature={`OrderTest:${crypto.randomUUID()}`}><PurchaseRequestForm quote={value} onCreated={created} onRefresh={refresh} /></CommerceDraftScope></MemoryRouter>);

it('sends the exact agreed currency, price, quantity and version once; keeps a useful pending state', async () => {
    let resolve!: (value: StoreOrder) => void;
    vi.mocked(requestPurchase).mockImplementation(() => new Promise(done => { resolve = done; }));
    const created = vi.fn(); form(created);
    fireEvent.change(screen.getByLabelText('Your contact for this request'), { target: { value: 'my chosen contact' } });
    const requestForm = screen.getByRole('form', { name: 'Purchase request' });
    fireEvent.submit(requestForm); fireEvent.submit(requestForm);
    expect(requestPurchase).toHaveBeenCalledTimes(1);
    expect(requestPurchase).toHaveBeenCalledWith(expect.objectContaining({ clubId: 10, currency: 'EUR', contact: 'my chosen contact', fulfillment: 'COLLECTION',
        lines: [{ variantId: 7, quantity: 2, productVersion: 3, unitPrice: 12.34, materialDigest: digest }] }), auth.sessionId);
    expect(screen.getByText(/reserved only after the seller accepts/)).toBeInTheDocument();
    await act(async () => resolve(order));
    expect(created).toHaveBeenCalledWith(order);
    expect(screen.queryByText(/payment successful/i)).not.toBeInTheDocument();
});

it('retries an uncertain request with the same body and identity while preserving private entered contact', async () => {
    vi.mocked(requestPurchase).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(order);
    const created = vi.fn(); form(created);
    fireEvent.change(screen.getByLabelText('Your contact for this request'), { target: { value: 'private contact' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request purchase' }));
    const retry = await screen.findByRole('button', { name: 'Retry same request' });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(screen.getByLabelText('Your contact for this request')).toHaveValue('private contact');
    expect(screen.getByLabelText('Your contact for this request')).toBeDisabled();
    fireEvent.click(retry);
    await waitFor(() => expect(created).toHaveBeenCalledWith(order));
    expect(vi.mocked(requestPurchase).mock.calls[0]).toEqual(vi.mocked(requestPurchase).mock.calls[1]);
});

it('a definite price/stock refusal offers a reviewed quote and keeps the buyer input', async () => {
    vi.mocked(requestPurchase).mockRejectedValue({ response: { status: 409, data: { message: 'Price or stock changed' } } });
    const refresh = vi.fn(); form(vi.fn(), refresh);
    fireEvent.change(screen.getByLabelText('Your contact for this request'), { target: { value: 'contact' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request purchase' }));
    const review = await screen.findByRole('button', { name: 'Review current quote' });
    fireEvent.click(review);
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Your contact for this request')).toHaveValue('contact');
    expect(screen.getByLabelText('Your contact for this request')).toBeEnabled();
});

it('ignores a completed write after the account/session changes', async () => {
    let resolve!: (value: StoreOrder) => void;
    vi.mocked(requestPurchase).mockImplementation(() => new Promise(done => { resolve = done; }));
    const created = vi.fn(); form(created);
    fireEvent.change(screen.getByLabelText('Your contact for this request'), { target: { value: 'private A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request purchase' }));
    localStorage.setItem('gk-session-id', 'different-session'); localStorage.setItem('userId', '3');
    await act(async () => resolve(order));
    expect(created).not.toHaveBeenCalled();
});

it('requires a versioned quote before saving and retains guest browsing', () => {
    form(vi.fn(), vi.fn(), { ...quote, lines: [{ ...quote.lines[0], productVersion: undefined }] });
    expect(screen.getByRole('button', { name: 'Request purchase' })).toBeDisabled();
});

it('a reload marker offers saved-record review instead of silently creating another purchase request', () => {
    sessionStorage.setItem(purchaseMarkerKey(quote), 'unresolved-request-key');
    form();
    expect(screen.getByRole('link', { name: 'Review My requests' })).toHaveAttribute('href', '/store/cart?view=requests');
    expect(screen.queryByRole('button', { name: 'Request purchase' })).not.toBeInTheDocument();
    expect(requestPurchase).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start a separate request' }));
    expect(screen.getByRole('button', { name: 'Request purchase' })).toBeInTheDocument();
    expect(sessionStorage.getItem(purchaseMarkerKey(quote))).toBeNull();
});

it('seller acceptance is explicit and submits the order version, rather than a payment action', async () => {
    vi.mocked(commandOrder).mockResolvedValue({ ...order, status: 'ACCEPTED', version: 1 });
    const changed = vi.fn();
    render(<MemoryRouter><StoreOrderCard order={order} seller onChanged={changed} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Answer or arrangement'), { target: { value: 'Collect at the office after we agree a time. Pay directly.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept and reserve stock' }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(commandOrder).toHaveBeenCalledWith(order.id, expect.objectContaining({ version: 0, action: 'ACCEPT', note: 'Collect at the office after we agree a time. Pay directly.' }), auth.sessionId);
    expect(screen.queryByText(/checkout/i)).not.toBeInTheDocument();
});

it('outside settlement uses the exact agreed amount and remains explicitly unverified', async () => {
    const accepted: StoreOrder = { ...order, status: 'ACCEPTED', version: 1 };
    vi.mocked(commandOrder).mockResolvedValue({ ...accepted, settlement: 'SELLER_REPORTED_EXTERNAL', version: 2 });
    render(<MemoryRouter><StoreOrderCard order={accepted} seller onChanged={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'REPORT_EXTERNAL_SETTLEMENT' } });
    fireEvent.change(screen.getByLabelText('Actual outside payment method and date'), { target: { value: 'Cash received in person on 30 October' } });
    fireEvent.click(screen.getByRole('button', { name: 'Report full settlement outside GrassKickZ' }));
    await waitFor(() => expect(commandOrder).toHaveBeenCalledWith(order.id, expect.objectContaining({ action: 'REPORT_EXTERNAL_SETTLEMENT', externalAmount: 24.68, externalCurrency: 'EUR' }), auth.sessionId));
});

it('a refused seller action keeps its note and offers a deliberate current-record review', async () => {
    vi.mocked(commandOrder).mockRejectedValue({ response: { status: 409, data: { message: 'Order changed' } } });
    const changed = vi.fn();
    render(<MemoryRouter><StoreOrderCard order={order} seller onChanged={changed} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Answer or arrangement'), { target: { value: 'My collection instructions' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept and reserve stock' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Review latest request' }));
    await waitFor(() => expect(screen.getByLabelText('Answer or arrangement')).toBeEnabled());
    expect(fetchOrder).toHaveBeenCalledWith(order.id, auth.sessionId);
    expect(screen.getByLabelText('Answer or arrangement')).toHaveValue('My collection instructions');
    expect(screen.getByLabelText('Answer or arrangement')).toBeEnabled();
});

it('a buyer sees seller-reported external settlement and no seller-only or public contact disclosure', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([{ ...order, status: 'ACCEPTED', settlement: 'SELLER_REPORTED_EXTERNAL' }]);
    render(<MemoryRouter><StoreOrders /></MemoryRouter>);
    expect(await screen.findByText(/not a processed or verified payment/)).toBeInTheDocument();
    expect(screen.queryByText(/private buyer contact/)).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Accept and reserve/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel and release any reservation' })).toBeInTheDocument();
});


it.each(['CANCELLED', 'FULFILLED'] as const)('a saved request followed by %s allows a new identity from the retained cart', async status => {
    const feature='repeat-'+crypto.randomUUID();
    const mount=()=>render(<MemoryRouter><CommerceDraftScope clubId={10} feature={feature}><PurchaseRequestForm quote={quote} onCreated={vi.fn()} onRefresh={vi.fn()} /></CommerceDraftScope></MemoryRouter>);
    vi.mocked(requestPurchase).mockResolvedValue(order);
    const first=mount();
    fireEvent.change(screen.getByLabelText('Your contact for this request'),{target:{value:'Chosen repeat contact'}});
    fireEvent.click(screen.getByRole('button',{name:'Request purchase'}));
    await waitFor(()=>expect(screen.getByLabelText('Your contact for this request')).toBeEnabled());
    const firstId=vi.mocked(requestPurchase).mock.calls[0][0].requestId;
    first.unmount();
    vi.mocked(fetchOrders).mockResolvedValue([{...order,status}]);
    const history=render(<MemoryRouter><StoreOrders /></MemoryRouter>);
    expect(await screen.findByText(new RegExp(status.toLowerCase()+' ·'))).toBeInTheDocument();
    history.unmount(); mount();
    expect(screen.getByLabelText('Your contact for this request')).toHaveValue('Chosen repeat contact');
    expect(screen.queryByRole('button',{name:'Retry same request'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Request purchase'}));
    await waitFor(()=>expect(requestPurchase).toHaveBeenCalledTimes(2));
    expect(vi.mocked(requestPurchase).mock.calls[1][0].requestId).not.toBe(firstId);
});

it.each(['DECLINE','CANCEL'])('withdrawn-listing 404 allows private recheck then %s with the note retained', async action => {
    vi.mocked(commandOrder).mockRejectedValueOnce({response:{status:404,data:{message:'Listing withdrawn'}}}).mockResolvedValueOnce({...order,status:'CANCELLED',version:3});
    vi.mocked(fetchOrder).mockResolvedValue({...order,version:2});
    render(<MemoryRouter><CommerceDraftScope clubId={10} feature={'withdraw-'+crypto.randomUUID()}><StoreOrderCard order={order} seller onChanged={vi.fn()} /></CommerceDraftScope></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Answer or arrangement'),{target:{value:'Retained collection note'}});
    fireEvent.click(screen.getByRole('button',{name:'Accept and reserve stock'}));
    fireEvent.click(await screen.findByRole('button',{name:'Review latest request'}));
    await waitFor(()=>expect(screen.getByLabelText('Action')).toBeEnabled());
    expect(screen.getByLabelText('Answer or arrangement')).toHaveValue('Retained collection note');
    fireEvent.change(screen.getByLabelText('Action'),{target:{value:action}});
    fireEvent.click(screen.getByRole('button',{name:action==='DECLINE'?'Decline request':'Cancel and release any reservation'}));
    await waitFor(()=>expect(commandOrder).toHaveBeenCalledTimes(2));
    const [first,second]=vi.mocked(commandOrder).mock.calls;
    expect(second[1]).toMatchObject({version:2,action,note:'Retained collection note'});
    expect(first[1].requestId).not.toBe(second[1].requestId);
});

it.each([403,404])('denied private reread %s hides history and buyer contact after a refused action', async status => {
    vi.mocked(commandOrder).mockRejectedValue({response:{status:404}});
    vi.mocked(fetchOrder).mockRejectedValue({response:{status}});
    render(<MemoryRouter><StoreOrderCard order={{...order,history:[{actorId:2,version:0,action:'REQUEST',note:'Private history detail',createdAt:order.createdAt}]}} seller onChanged={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Answer or arrangement'),{target:{value:'note'}});
    fireEvent.click(screen.getByRole('button',{name:'Accept and reserve stock'}));
    expect(await screen.findByText(/unavailable under your current access/)).toBeInTheDocument();
    expect(screen.queryByText(/Private history detail/)).not.toBeInTheDocument();
    expect(screen.queryByText(/private buyer contact/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Retry same action'})).not.toBeInTheDocument();
});

it('a 5xx seller result retains its original key and note across navigation and an order refresh', async () => {
    vi.mocked(commandOrder).mockRejectedValue({response:{status:503}});
    const feature='uncertain-'+crypto.randomUUID();
    const mount=(version:number)=>render(<MemoryRouter><CommerceDraftScope clubId={10} feature={feature}><StoreOrderCard order={{...order,version}} seller onChanged={vi.fn()} /></CommerceDraftScope></MemoryRouter>);
    const first=mount(0);
    fireEvent.change(screen.getByLabelText('Answer or arrangement'),{target:{value:'Uncertain note'}});
    fireEvent.click(screen.getByRole('button',{name:'Accept and reserve stock'}));
    await screen.findByRole('button',{name:'Retry same action'});
    first.unmount(); mount(1);
    expect(screen.queryByRole('button',{name:'Review latest request'})).not.toBeInTheDocument();
    expect(screen.getByLabelText('Answer or arrangement')).toHaveValue('Uncertain note');
    fireEvent.click(screen.getByRole('button',{name:'Retry same action'}));
    await waitFor(()=>expect(commandOrder).toHaveBeenCalledTimes(2));
    expect(vi.mocked(commandOrder).mock.calls[1]).toEqual(vi.mocked(commandOrder).mock.calls[0]);
    expect(fetchOrder).not.toHaveBeenCalled();
});

it('buyer creation 404 offers quote recovery while retaining input', async () => {
    vi.mocked(requestPurchase).mockRejectedValue({response:{status:404}});
    const refresh=vi.fn(); form(vi.fn(),refresh);
    fireEvent.change(screen.getByLabelText('Your contact for this request'),{target:{value:'Chosen contact'}});
    fireEvent.click(screen.getByRole('button',{name:'Request purchase'}));
    fireEvent.click(await screen.findByRole('button',{name:'Review current quote'}));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Your contact for this request')).toHaveValue('Chosen contact');
    expect(screen.getByLabelText('Your contact for this request')).toBeEnabled();
});

it('buyer reviews current description/photos then renews the same private order with explicit terms', async () => {
    const fresh={...quote,lines:[{...quote.lines[0],productVersion:4,materialDigest:'b'.repeat(64),material:{...material,description:'Repaired seam'}}]};
    vi.mocked(fetchCartQuote).mockResolvedValue(fresh);
    vi.mocked(renewOrder).mockResolvedValue({...order,version:1});
    const changed=vi.fn();
    render(<MemoryRouter><RenewRequest order={order} onRenewed={changed} onUnavailable={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Review current item terms'}));
    expect(await screen.findByText('Repaired seam')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Renew this request with these terms'}));
    await waitFor(()=>expect(changed).toHaveBeenCalledOnce());
    expect(renewOrder).toHaveBeenCalledWith(order.id,expect.objectContaining({version:0,currency:'EUR',lines:[{variantId:7,quantity:2,productVersion:4,unitPrice:12.34,materialDigest:'b'.repeat(64)}]}),auth.sessionId);
    expect(requestPurchase).not.toHaveBeenCalled();
});


it('an uncertain renewal retains its exact terms and identity across remounts', async () => {
    vi.mocked(fetchCartQuote).mockResolvedValue(quote);
    vi.mocked(renewOrder).mockRejectedValue({response:{status:503}});
    const feature='renewal-'+crypto.randomUUID();
    const mount=()=>render(<MemoryRouter><CommerceDraftScope clubId={10} feature={feature}><RenewRequest order={order} onRenewed={vi.fn()} onUnavailable={vi.fn()} /></CommerceDraftScope></MemoryRouter>);
    const first=mount();
    fireEvent.click(screen.getByRole('button',{name:'Review current item terms'}));
    fireEvent.click(await screen.findByRole('button',{name:'Renew this request with these terms'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Retry same renewal'})).toBeEnabled());
    first.unmount(); mount();
    expect(screen.getByRole('button',{name:'Review current item terms'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Retry same renewal'}));
    await waitFor(()=>expect(renewOrder).toHaveBeenCalledTimes(2));
    expect(vi.mocked(renewOrder).mock.calls[0]).toEqual(vi.mocked(renewOrder).mock.calls[1]);
});

it('a withdrawn public quote during buyer review keeps the private order available for cancellation', async () => {
    vi.mocked(fetchCartQuote).mockRejectedValue({response:{status:404}});
    const unavailable=vi.fn();
    render(<MemoryRouter><RenewRequest order={order} onRenewed={vi.fn()} onUnavailable={unavailable} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Review current item terms'}));
    expect(await screen.findByText(/old request remains; you can cancel it or contact the seller/)).toBeInTheDocument();
    expect(unavailable).not.toHaveBeenCalled();
    expect(renewOrder).not.toHaveBeenCalled();
});
