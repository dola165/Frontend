import { ct, useCommerceCopy } from '../../store/copy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, Eye, EyeOff, Package, Pencil, Plus } from 'lucide-react';
import { CommerceDraftScope } from '../../../components/workspace/CommerceDraftScope';
import { useClearCommerceForm, useCommerceDraftState } from '../../../components/workspace/commerceDraftState';
import { MediaImage } from '../../../components/ui/MediaImage';
import { Dialog } from '../../../design/Dialog';
import { Badge, Button, ButtonLink, EmptyNote, PageFrame, PageHeader, SearchInput, Skeleton } from '../../../design/primitives';
import { fetchAllClubStoreProducts, formatStorePrice, STORE_CATEGORIES, type StoreProduct } from '../../store/api';
import { useStoreMutationRecovery } from '../../store/mutationRecovery';
import { StoreCreateReviewNotice, StoreProductCreate } from './StoreProductCreate';
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
    useCommerceCopy();
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
    const mutation = useStoreMutationRecovery(clubId);
    const loadRequest = useRef({ value: 0 });
    const load = useCallback(async () => {
        const request = ++loadRequest.current.value;
        setError(''); setArchive(null);
        try { const records = await fetchAllClubStoreProducts(clubId); if (request === loadRequest.current.value) setProducts(records); }
        catch (failure) { if (request === loadRequest.current.value) setError(extractApiErrorMessage(failure, ct("Could not load products."))); }
    }, [clubId]);
    useEffect(() => { const requests = loadRequest.current; void load(); return () => { requests.value++; }; }, [load, revision]);
    const change = async (product: StoreProduct, remove: boolean) => {
        if (busy || mutation.attempt) return;
        // A confirmed archive closes its dialog at once; the pending change shows on the page.
        setArchive(null); setBusy(true); setActionError(''); setError(''); setMessage('');
        try { await mutation.run({ productId: product.id, input: { ...(remove ? {} : { active: !product.active }), version: product.version }, archive: remove }, () => {
            setMessage(remove ? ct("Product archived.") : product.active ? ct("Product hidden.") : ct("Product published."));
            setRevision(n => n + 1);
        }); }
        finally { setBusy(false); }
    };
    const locked = busy || !!editing || !!mutation.attempt;
    const recovered = () => { clearForm(); setEditing(null); setMessage(ct('Change confirmed. The latest saved products are loaded.')); setRevision(n => n + 1); };
    const recoveryNotice = (mutation.attempt || mutation.error) && <div className="gk-notice gk-notice--warning">
        {mutation.error && <p role="alert">{mutation.error}</p>}
        {mutation.attempt && <>
            <p>{ct('This product change needs confirmation. New changes are paused; your entered details stay here.')}</p>
            {mutation.attempt.state === 'uncertain' && <Button disabled={busy} onClick={() => void mutation.run(undefined, recovered)}>{ct('Retry original change')}</Button>}
            <Button variant="ghost" disabled={mutation.attempt.state === 'pending'} onClick={() => { if (mutation.review()) { setActionError(''); setRevision(n => n + 1); } }}>{ct('Reload products')}</Button>
        </>}
    </div>;
    const visible = (products ?? []).filter(product => matches(product, filter) && (categoryFilter === 'ALL' || product.category === categoryFilter) && (product.name ?? '').toLowerCase().includes(query.toLowerCase()));
    const filtered = Boolean(query || filter !== 'ALL' || categoryFilter !== 'ALL');

    let body;
    if (products === null) body = error ? null : <div className="gk-panel cm-list" role="status" aria-label={ct("Loading products")}><div className="cm-skeletons">{[0, 1, 2].map(i => <Skeleton key={i} height={56} />)}</div></div>;
    else if (!visible.length) body = <div className="gk-panel cm-list">{products.length
        ? <EmptyNote title={ct("No products match these filters")} action={filtered && <Button size="sm" onClick={() => { setQuery(''); setFilter('ALL'); setCategoryFilter('ALL'); }}>{ct("Clear filters")}</Button>}>{ct("Try another category, visibility or search.")}</EmptyNote>
        : <EmptyNote title={ct("No products yet")}>{ct("Use Add product to list an item with its price and stock. It stays a draft until you publish it.")}</EmptyNote>}</div>;
    else body = <div className="gk-panel cm-list"><ul className="gk-list" aria-label={ct("Products")}>{visible.map(product => {
        const stock = productStock(product), name = product.name ?? ct("Product");
        return <li key={product.id}><div className="gk-list-row cm-row">
            <span className="cm-thumb" aria-hidden="true">{product.images?.[0] ? <MediaImage src={resolveMediaUrl(product.images[0])} alt="" /> : <Package />}</span>
            <span className="gk-list-row__main">
                <h3 className="cm-row__title">{product.name}</h3>
                <span className="gk-list-row__meta">{categoryLabel(product.category)} · {product.variants?.length ?? 0} {product.variants?.length === 1 ? 'variant' : 'variants'}</span>
                <span className="cm-row__facts"><strong className="gk-num">{formatStorePrice(product.price ?? 0, product.currency)}</strong>
                    <span className={stock <= 5 ? 'cm-low' : undefined}>{stock === 0 ? ct("Out of stock") : ct("{v0} in stock{v1}", { v0: stock, v1: stock <= 5 ? ' · running low' : '' })}</span></span>
            </span>
            <span className="cm-row__trail">
                <Badge tone={product.active ? 'accent' : 'neutral'}>{product.active ? ct("Published") : ct("Draft")}</Badge>
                <Button size="sm" aria-label={ct("Edit {v0}", { v0: product.name })} disabled={locked} onClick={() => { setEditing(product); setFormError(''); setMessage(''); }}><Pencil aria-hidden="true" />{ct("Edit")}</Button>
                <RowMenu name={name} disabled={locked}>
                    <button type="button" className="cm-menu__item" aria-label={`${product.active ? ct("Hide") : ct("Publish")} ${product.name}`} disabled={locked} onClick={() => void change(product, false)}>{product.active ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{product.active ? ct("Hide from store") : ct("Publish product")}</button>
                    <button type="button" className="cm-menu__item cm-menu__item--danger" aria-label={ct("Archive {v0}", { v0: product.name })} disabled={locked} onClick={() => setArchive(product)}><Archive aria-hidden="true" />{ct("Archive product")}</button>
                </RowMenu>
            </span>
        </div></li>;
    })}</ul></div>;

    return <>
        <PageFrame className="cw-page cm-page" hidden={!!editing}>
            <PageHeader title={ct("Store")} subtitle={ct("Products, prices and stock for your club store.")}
                actions={<><ButtonLink variant="ghost" to={`/clubs/${clubId}/store`}>{ct("View public store")}</ButtonLink>
                    <Button variant="primary" disabled={locked} onClick={() => { setEditing('new'); setFormError(''); }}><Plus aria-hidden="true" />{ct("Add product")}</Button></>} />
            <div className="gk-stack">
                {!editing && <StoreCreateReviewNotice clubId={clubId} />}
                {!editing && recoveryNotice}
                <p className="gk-notice">{ct("Supporters can browse products and prepare a cart. Online checkout is not available yet.")}</p>
                {products !== null && products.length > 0 && <div className="rec-toolbar">
                    <SearchInput className="rec-toolbar__search" aria-label={ct("Search products")} placeholder={ct("Search products")} value={query} onChange={event => setQuery(event.target.value)} />
                    <select className="gk-input" aria-label={ct("Filter by visibility")} value={filter} onChange={event => setFilter(event.target.value)}>
                        {VISIBILITY.map(([value, label]) => <option key={value} value={value}>{label} ({products.filter(product => matches(product, value)).length})</option>)}</select>
                    <select className="gk-input" aria-label={ct("Filter product category")} value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
                        <option value="ALL">{ct("All categories")}</option>{STORE_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabel(value)}</option>)}</select>
                    <span className="rec-toolbar__count" role="status">{visible.length} {visible.length === 1 ? 'product' : 'products'}</span>
                </div>}
                {error && <div className="gk-notice gk-notice--danger"><span role="alert">{error}</span><Button size="sm" onClick={() => void load()}>{ct("Retry loading products")}</Button></div>}
                {actionError && <div className="gk-notice gk-notice--danger"><span role="alert">{actionError}</span><Button size="sm" onClick={() => { setActionError(''); void load(); }}>{ct("Reload products")}</Button></div>}
                {busy && !editing && <p className="gk-notice" role="status">{ct("Saving your change…")}</p>}
                {message && <p className="gk-notice" role="status">{message}</p>}
                {body}
            </div>
        </PageFrame>
        <Dialog open={archive !== null} role="alertdialog" size="sm" title={ct("Archive product?")} onClose={() => { if (!busy) setArchive(null); }}
            description={archive ? ct("“{v0}” leaves the store, and carts that contain it can no longer use it.", { v0: archive.name }) : undefined}
            footer={<><Button variant="ghost" disabled={busy} onClick={() => setArchive(null)}>{ct("Cancel archive")}</Button>
                <Button variant="danger" disabled={busy} onClick={() => archive && void change(archive, true)}>{ct("Confirm archive")}</Button></>} />
        {editing === 'new' && <StoreProductCreate clubId={clubId} onCancel={() => setEditing(null)} onReview={() => { setEditing(null); setRevision(n => n + 1); }}
            onDone={() => { setEditing(null); setMessage(ct('Product saved.')); setRevision(n => n + 1); }} />}
        {editing && editing !== 'new' && <StoreCreateReviewNotice clubId={clubId} />}
        {editing && editing !== 'new' && <StoreProductForm key={editing.id} product={editing} saving={busy || mutation.attempt?.state === 'pending'} locked={!!mutation.attempt} formError={formError} recoveryNotice={recoveryNotice}
            onCancel={() => { clearForm(); setEditing(null); }}
            onSubmit={async payload => {
                if (busy || mutation.attempt) return;
                setBusy(true); setFormError(''); setMessage('');
                try { await mutation.run({ productId: editing.id, input: payload, archive: false }, () => {
                    clearForm(); setEditing(null); setMessage(ct("Product saved.")); setRevision(n => n + 1);
                }); }
                finally { setBusy(false); }
            }} />}
    </>;
}

export const StoreProductsPage = ({ clubId }: { clubId: number }) => <CommerceDraftScope clubId={clubId} feature="StoreTab"><StoreProducts clubId={clubId} /></CommerceDraftScope>;
