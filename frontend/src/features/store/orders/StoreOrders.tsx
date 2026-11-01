import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CommerceDraftScope } from '../../../components/workspace/CommerceDraftScope';
import { useAuth } from '../../../context/AuthContext';
import { Button, ButtonLink, EmptyNote } from '../../../design/primitives';
import { useWorldData } from '../../world/useWorldData';
import { fetchOrders, type StoreOrder } from './api';
import { StoreOrderCard } from './StoreOrderCard';
import './orders.css';

export function StoreOrders({ seller }: { seller?: number }) {
    const { status, sessionId } = useAuth();
    const [params, setParams] = useSearchParams();
    const rawPage = Number(params.get('ordersPage') ?? 0);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage <= 100000 ? rawPage : 0;
    const move = (next: number) => setParams(current => { const updated = new URLSearchParams(current); updated.set('ordersPage', String(next)); return updated; });
    const [revision, setRevision] = useState(0);
    const orders = useWorldData(status === 'authenticated' ? `store-orders:${sessionId}:${seller ?? 'buyer'}:${page}:${revision}` : null,
        signal => fetchOrders(seller, signal, page), 'Purchase requests could not load.');
    if (status !== 'authenticated') return <ButtonLink to="/login?returnTo=%2Fstore%2Fcart%3Fview%3Drequests">Sign in to see your requests</ButtonLink>;
    return <section className="store-orders" aria-label={seller === undefined ? 'My purchase requests' : 'Seller purchase requests'}>
        <div className="store-orders__heading"><h2>{seller === undefined ? 'My requests' : 'Purchase requests'}</h2><Button onClick={() => setRevision(n => n + 1)}>Refresh requests</Button></div>
        {orders.loading && <p role="status">Loading requests…</p>}
        {orders.error && <div role="alert">{orders.error}<Button onClick={orders.retry}>Retry loading requests</Button></div>}
        {!orders.loading && !orders.error && orders.data?.length === 0 && <EmptyNote title="No purchase requests yet">You can still arrange purchases directly with a seller.</EmptyNote>}
        {orders.data?.map((order: StoreOrder) => <CommerceDraftScope key={`${sessionId}:${order.id}`} clubId={order.clubId ?? 0} feature={`StoreOrder:${order.id}`}><StoreOrderCard order={order} seller={seller !== undefined} onChanged={() => setRevision(n => n + 1)} /></CommerceDraftScope>)}
        <nav className="store-orders__doors" aria-label="Request pages"><Button disabled={page === 0 || orders.loading} onClick={() => move(page - 1)}>Previous requests</Button><span>Page {page + 1}</span><Button disabled={orders.loading || (orders.data?.length ?? 0) < 100 || page >= 100000} onClick={() => move(page + 1)}>Older requests</Button></nav>
        <p className="gk-muted">100 requests per page. Outside payment and any refund are arranged directly with the seller. GrassKickZ does not process them.</p>
    </section>;
}
