import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, Eye, EyeOff, Package, Pencil, Plus } from 'lucide-react';
import { CommerceDraftScope } from '../../../components/workspace/CommerceDraftScope';
import { useClearCommerceForm, useCommerceDraftState } from '../../../components/workspace/commerceDraftState';
import { MediaImage } from '../../../components/ui/MediaImage';
import { Dialog } from '../../../design/Dialog';
import { Badge, Button, ButtonLink, EmptyNote, PageFrame, PageHeader, SearchInput, Skeleton } from '../../../design/primitives';
import { createStoreProduct, deleteStoreProduct, fetchAllClubStoreProducts, formatStorePrice, STORE_CATEGORIES, updateStoreProduct, type StoreProduct } from '../../store/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { RowMenu } from './RowMenu';
import { categoryLabel } from './labels';
import { StoreProductForm } from './StoreProductForm';
import '../../clubOperations/records/records.css';
import './commerce.css';

const productStock = (product: StoreProduct) => product.variants?.reduce((sum, variant) => sum + variant.stock, 0) ?? 0;
const VISIBILITY = [['ALL', 'All products'], ['PUBLISHED', 'Published'], ['DRAFT', 'Drafts'], ['OUT', 'Out of stock']] as const;
const matches = (product: StoreProduct, value: string) => value === 'ALL' || (value === 'PUBLISHED' ? product.active : value === 'DRAFT' ? !product.active : productStock(product) === 0);

/** The club's store products: stock and visibility at a glance, an editor for each product, and a confirmed archive. */
function StoreProducts({ clubId }: { clubId: number }) {
    const clearForm = useClearCommerceForm();
    const [query, setQuery] = useState(''), [filter, setFilter] = useState('ALL'), [categoryFilter, setCategoryFilter] = useState('ALL');
    const [products, setProducts] = useState<StoreProduct[] | null>(null), [error, setError] = useState('');
    const [actionError, setActionError] = useCommerceDraftState('actionError', '');
    const [message, setMessage] = useCommerceDraftState('message', '');
    const [editing, setEditing] = useCommerceDraftState<StoreProduct | 'new' | null>('editing', null);
    const [busy, setBusy] = useCommerceDraftState('busy', false);
    const [formError, setFormError] = useCommerceDraftState('formError', '');
    const [revision, setRevision] = useCommerceDraftState('revision', 0);
    const [archive, setArchive] = useState<StoreProduct | null>(null);
    const loadRequest = useRef({ value: 0 });
    const load = useCallback(async () => {
        const request = ++loadRequest.current.value;
        setError(''); setArchive(null);
        try { const records = await fetchAllClubStoreProducts(clubId); if (request === loadRequest.current.value) setProducts(records); }
        catch (failure) { if (request === loadRequest.current.value) setError(extractApiErrorMessage(failure, 'Could not load products.')); }
    }, [clubId]);
    useEffect(() => { const requests = loadRequest.current; void load(); return () => { requests.value++; }; }, [load, revision]);
    const change = async (product: StoreProduct, remove: boolean) => {
        if (busy) return;
        // A confirmed archive closes its dialog at once; the pending change shows on the page.
        setArchive(null); setBusy(true); setActionError(''); setError(''); setMessage('');
        try {
            if (remove) await deleteStoreProduct(clubId, product.id, product.version);
            else await updateStoreProduct(clubId, product.id, { active: !product.active, version: product.version });
            setMessage(remove ? 'Product archived.' : product.active ? 'Product hidden.' : 'Product published.');
            setRevision(n => n + 1);
        } catch (failure) { setActionError(extractApiErrorMessage(failure, 'The change could not be saved.')); }
        finally { setBusy(false); }
    };
    const locked = busy || !!editing;
    const visible = (products ?? []).filter(product => matches(product, filter) && (categoryFilter === 'ALL' || product.category === categoryFilter) && (product.name ?? '').toLowerCase().includes(query.toLowerCase()));
    const filtered = Boolean(query || filter !== 'ALL' || categoryFilter !== 'ALL');

    let body;
    if (products === null) body = error ? null : <div className="gk-panel cm-list" role="status" aria-label="Loading products"><div className="cm-skeletons">{[0, 1, 2].map(i => <Skeleton key={i} height={56} />)}</div></div>;
    else if (!visible.length) body = <div className="gk-panel cm-list">{products.length
        ? <EmptyNote title="No products match these filters" action={filtered && <Button size="sm" onClick={() => { setQuery(''); setFilter('ALL'); setCategoryFilter('ALL'); }}>Clear filters</Button>}>Try another category, visibility or search.</EmptyNote>
        : <EmptyNote title="No products yet">Use Add product to list an item with its price and stock. It stays a draft until you publish it.</EmptyNote>}</div>;
    else body = <div className="gk-panel cm-list"><ul className="gk-list" aria-label="Products">{visible.map(product => {
        const stock = productStock(product), name = product.name ?? 'Product';
        return <li key={product.id}><div className="gk-list-row cm-row">
            <span className="cm-thumb" aria-hidden="true">{product.images?.[0] ? <MediaImage src={resolveMediaUrl(product.images[0])} alt="" /> : <Package />}</span>
            <span className="gk-list-row__main">
                <h3 className="cm-row__title">{product.name}</h3>
                <span className="gk-list-row__meta">{categoryLabel(product.category)} · {product.variants?.length ?? 0} {product.variants?.length === 1 ? 'variant' : 'variants'}</span>
                <span className="cm-row__facts"><strong className="gk-num">{formatStorePrice(product.price ?? 0, product.currency)}</strong>
                    <span className={stock <= 5 ? 'cm-low' : undefined}>{stock === 0 ? 'Out of stock' : `${stock} in stock${stock <= 5 ? ' · running low' : ''}`}</span></span>
            </span>
            <span className="cm-row__trail">
                <Badge tone={product.active ? 'accent' : 'neutral'}>{product.active ? 'Published' : 'Draft'}</Badge>
                <Button size="sm" aria-label={`Edit ${product.name}`} disabled={locked} onClick={() => { setEditing(product); setFormError(''); setMessage(''); }}><Pencil aria-hidden="true" />Edit</Button>
                <RowMenu name={name} disabled={locked}>
                    <button type="button" className="cm-menu__item" aria-label={`${product.active ? 'Hide' : 'Publish'} ${product.name}`} disabled={locked} onClick={() => void change(product, false)}>{product.active ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{product.active ? 'Hide from store' : 'Publish product'}</button>
                    <button type="button" className="cm-menu__item cm-menu__item--danger" aria-label={`Archive ${product.name}`} disabled={locked} onClick={() => setArchive(product)}><Archive aria-hidden="true" />Archive product</button>
                </RowMenu>
            </span>
        </div></li>;
    })}</ul></div>;

    return <>
        <PageFrame className="cw-page cm-page" hidden={!!editing}>
            <PageHeader title="Store" subtitle="Products, prices and stock for your club store."
                actions={<><ButtonLink variant="ghost" to={`/clubs/${clubId}/store`}>View public store</ButtonLink>
                    <Button variant="primary" disabled={locked} onClick={() => { setEditing('new'); setFormError(''); }}><Plus aria-hidden="true" />Add product</Button></>} />
            <div className="gk-stack">
                <p className="gk-notice">Supporters can browse products and prepare a cart. Online checkout is not available yet.</p>
                {products !== null && products.length > 0 && <div className="rec-toolbar">
                    <SearchInput className="rec-toolbar__search" aria-label="Search products" placeholder="Search products" value={query} onChange={event => setQuery(event.target.value)} />
                    <select className="gk-input" aria-label="Filter by visibility" value={filter} onChange={event => setFilter(event.target.value)}>
                        {VISIBILITY.map(([value, label]) => <option key={value} value={value}>{label} ({products.filter(product => matches(product, value)).length})</option>)}</select>
                    <select className="gk-input" aria-label="Filter product category" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
                        <option value="ALL">All categories</option>{STORE_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabel(value)}</option>)}</select>
                    <span className="rec-toolbar__count" role="status">{visible.length} {visible.length === 1 ? 'product' : 'products'}</span>
                </div>}
                {error && <div className="gk-notice gk-notice--danger"><span role="alert">{error}</span><Button size="sm" onClick={() => void load()}>Retry loading products</Button></div>}
                {actionError && <div className="gk-notice gk-notice--danger"><span role="alert">{actionError}</span><Button size="sm" onClick={() => { setActionError(''); void load(); }}>Reload products</Button></div>}
                {busy && !editing && <p className="gk-notice" role="status">Saving your change…</p>}
                {message && <p className="gk-notice" role="status">{message}</p>}
                {body}
            </div>
        </PageFrame>
        <Dialog open={archive !== null} role="alertdialog" size="sm" title="Archive product?" onClose={() => { if (!busy) setArchive(null); }}
            description={archive ? `“${archive.name}” leaves the store, and carts that contain it can no longer use it.` : undefined}
            footer={<><Button variant="ghost" disabled={busy} onClick={() => setArchive(null)}>Cancel archive</Button>
                <Button variant="danger" disabled={busy} onClick={() => archive && void change(archive, true)}>Confirm archive</Button></>} />
        {editing && <StoreProductForm key={editing === 'new' ? 'new' : editing.id} product={editing === 'new' ? null : editing} saving={busy} formError={formError}
            onCancel={() => { clearForm(); setEditing(null); }}
            onSubmit={async payload => {
                setBusy(true); setFormError(''); setMessage('');
                try {
                    if (editing === 'new') await createStoreProduct(clubId, payload);
                    else await updateStoreProduct(clubId, editing.id, payload);
                    clearForm(); setEditing(null); setMessage('Product saved.'); setRevision(n => n + 1);
                } catch (failure) { setFormError(extractApiErrorMessage(failure, 'Could not save. Your changes are still here.')); }
                finally { setBusy(false); }
            }} />}
    </>;
}

export const StoreProductsPage = ({ clubId }: { clubId: number }) => <CommerceDraftScope clubId={clubId} feature="StoreTab"><StoreProducts clubId={clubId} /></CommerceDraftScope>;
