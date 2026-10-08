import { CommerceDraftScope, CommerceDraftNotice } from '../CommerceDraftScope';
import { useCommerceDraftState, useClearCommerceForm } from '../commerceDraftState';
import { MediaImage } from '../../ui/MediaImage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Package, Plus, Trash2 } from 'lucide-react';
import { EditorChecklist, EditorDiscardPrompt, EditorSection, WorkspaceEditor } from '../editor/WorkspaceEditor';
import { apiClient } from '../../../api/axiosConfig';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { createStoreProduct, deleteStoreProduct, fetchAllClubStoreProducts, updateStoreProduct,
    formatStorePrice, STORE_CATEGORIES, type StoreProduct, type StoreProductPayload, type StoreVariant } from '../../../features/store/api';

const button = 'rounded-lg border border-[var(--theme-border)] px-3 py-2 text-sm disabled:opacity-40';

const StoreTabContent = ({ clubId }: { clubId: number; pendingKey?: string | null }) => {
    const clearForm = useClearCommerceForm();
    const [products, setProducts] = useState<StoreProduct[] | null>(null);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useCommerceDraftState('actionError', '');
    const loadRequest = useRef({ value: 0 });
    const [message, setMessage] = useCommerceDraftState("message", '');
    const [editing, setEditing] = useCommerceDraftState<StoreProduct | 'new' | null>("editing", null);
    const [archive, setArchive] = useState<StoreProduct | null>(null);
    const [busy, setBusy] = useCommerceDraftState("busy", false);
    const [formError, setFormError] = useCommerceDraftState("formError", '');
    const [revision, setRevision] = useCommerceDraftState("revision", 0);
    const load = useCallback(async () => {
        const request = ++loadRequest.current.value;
        setError(''); setArchive(null);
        try { const records = await fetchAllClubStoreProducts(clubId); if (request === loadRequest.current.value) setProducts(records); }
        catch (error) { if (request === loadRequest.current.value) setError(extractApiErrorMessage(error, 'Could not load products.')); }
    }, [clubId]);
    useEffect(() => { const requests = loadRequest.current; void load(); return () => { requests.value++; }; }, [load, revision]);
    const action = async (product: StoreProduct, remove: boolean) => {
        if (busy) return;
        setBusy(true); setActionError(''); setError(''); setMessage('');
        try {
            if (remove) await deleteStoreProduct(clubId, product.id, product.version);
            else await updateStoreProduct(clubId, product.id, { active: !product.active, version: product.version });
            setArchive(null); setMessage(remove ? 'Product archived.' : product.active ? 'Product hidden.' : 'Product published.');
            setRevision(n => n + 1);
        } catch (error) { setActionError(extractApiErrorMessage(error, 'The change could not be saved.')); }
        finally { setBusy(false); }
    };
    return <section className="space-y-4 text-[var(--text-primary)]">
        <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Club Store</h2><p className="text-sm">Manage products, sizes and available stock. Online checkout is not available yet.</p></div>
            <Link className="underline" to={`/clubs/${clubId}/store`}>View club store</Link>
            <button className={button} disabled={busy || !!editing} onClick={() => { setEditing('new'); setFormError(''); }}>Add product</button></header>
        {(error || actionError) && <p role="alert">{error || actionError} <button className="underline" onClick={() => { setActionError(''); void load(); }}>Reload products</button></p>}
        {message && <p role="status">{message}</p>}
        {products === null ? !error && <p role="status">Loading products...</p> : products.length === 0 ? <p>No products yet. Start with a draft.</p> : products.map(product => <article key={product.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--theme-border)] p-4">
            <div className="min-w-40 flex-1"><h3 className="font-semibold">{product.name}</h3><p className="text-sm">{formatStorePrice(product.price ?? 0, product.currency)} · {product.active ? 'Published' : 'Draft / hidden'} · {product.variants?.reduce((sum, v) => sum + v.stock, 0) ?? 0} in stock</p></div>
            <button className={button} disabled={busy || !!editing} onClick={() => { setEditing(product); setFormError(''); setMessage(''); }}>Edit {product.name}</button>
            <button className={button} disabled={busy || !!editing} onClick={() => void action(product, false)}>{product.active ? 'Hide' : 'Publish'} {product.name}</button>
            <button className={button} disabled={busy || !!editing} onClick={() => setArchive(product)}>Archive {product.name}</button>
            {archive?.id === product.id && <div className="w-full space-x-3" role="group" aria-label={`Confirm archive ${product.name}`}><p>This removes the product from the Store and makes existing carts containing it unavailable.</p><button className={button} disabled={busy} onClick={() => void action(archive, true)}>Confirm archive</button><button className={button} disabled={busy} onClick={() => setArchive(null)}>Cancel archive</button></div>}
        </article>)}
        {editing && <StoreProductForm key={editing === 'new' ? 'new' : editing.id} product={editing === 'new' ? null : editing} saving={busy} formError={formError} onCancel={() => { clearForm(); setEditing(null); }} onSubmit={async payload => {
            setBusy(true); setFormError(''); setMessage('');
            try {
                if (editing === 'new') await createStoreProduct(clubId, payload);
                else await updateStoreProduct(clubId, editing.id, payload);
                clearForm(); setEditing(null); setMessage('Product saved.'); setRevision(n => n + 1);
            } catch (error) { setFormError(extractApiErrorMessage(error, 'Could not save. Your changes are still here.')); }
            finally { setBusy(false); }
        }}/>}
    </section>;
};

export const StoreProductForm = ({ product, saving, formError, onCancel, onSubmit }: {
    product: StoreProduct | null; saving: boolean; formError: string; onCancel: () => void; onSubmit: (payload: StoreProductPayload) => Promise<void>;
}) => {
    const [name, setName] = useCommerceDraftState("form:name", product?.name ?? '');
    const [description, setDescription] = useCommerceDraftState("form:description", product?.description ?? '');
    const [price, setPrice] = useCommerceDraftState("form:price", String(product?.price ?? ''));
    const [currency, setCurrency] = useCommerceDraftState("form:currency", product?.currency ?? 'GEL');
    const [category, setCategory] = useCommerceDraftState("form:category", product?.category ?? 'OTHER');
    const [variants, setVariants] = useCommerceDraftState<StoreVariant[]>("form:variants", product?.variants?.length ? product.variants.map(v => ({ ...v })) : [{ label: 'One size', stock: 0 }]);
    const [images, setImages] = useCommerceDraftState("form:images", product?.images ?? []);
    const [active, setActive] = useCommerceDraftState("form:active", product?.active ?? false);
    const [uploading, setUploading] = useCommerceDraftState("form:uploading", false);
    const [uploadError, setUploadError] = useCommerceDraftState("form:uploadError", '');
    const [discard, setDiscard] = useState(false);
    const editVariant = (index: number, change: Partial<StoreVariant>) => setVariants(current => current.map((v, i) => i === index ? { ...v, ...change } : v));
    const totalStock = variants.reduce((total, variant) => total + (Number.isFinite(variant.stock) ? variant.stock : 0), 0);
    return <WorkspaceEditor
        title={product ? 'Edit product' : 'New product'} eyebrow="Club store / Product editor" accent="store" formLabel="Product editor"
        description="Give your supporters a clear picture of what you sell. Add the details, set available sizes and review the product before it goes into your store."
        backLabel="Back to products" saving={saving} disabled={saving || uploading} saveLabel="Save product"
        footerNote={active ? 'Saving makes this product visible in your club store.' : 'Saved as a draft. Publish it when you are ready for supporters to see it.'}
        onRequestClose={() => setDiscard(true)} onSubmit={event => {
        event.preventDefault();
        if (saving || uploading) return;
        void onSubmit({ name: name.trim(), description, price: Number(price), currency, category, variants, images, active, ...(product ? { version: product.version } : {}) });
    }}
        feedback={(formError || uploading || uploadError) && <>{formError && <p role="alert">{formError} Your edits have been kept. If another manager changed this product, copy your edits before closing and reopening its latest version.</p>}{uploading && <p role="status">Uploading photo...</p>}{uploadError && <p role="alert">{uploadError}</p>}</>}
        confirmation={discard && <EditorDiscardPrompt disabled={saving || uploading} onKeepEditing={() => setDiscard(false)} onDiscard={onCancel}/>}
        preview={<>
            <section className="workspace-editor__preview" aria-label="Product preview">
                <div className="workspace-editor__preview-label"><span>Store preview</span><span>Unsaved</span></div>
                <div className="workspace-editor__preview-image">{images[0] ? <MediaImage src={resolveMediaUrl(images[0])} alt="Product cover preview"/> : <><Package size={32} strokeWidth={1.3} aria-hidden="true"/><span>Your product photo appears here</span></>}</div>
                <div className="workspace-editor__preview-body">
                    <span className="workspace-editor__badge">{active ? 'Published when saved' : 'Draft / hidden'}</span>
                    <h4>{name.trim() || 'Your product name'}</h4>
                    <p className="workspace-editor__preview-price">{price && Number(price) > 0 ? formatStorePrice(Number(price), currency) : `— ${currency}`}</p>
                    <p className="workspace-editor__preview-description">{description.trim() || 'Add a few details about the fit, material or what is included.'}</p>
                    <div className="workspace-editor__preview-tags">{variants.filter(v => v.label.trim()).map((v, i) => <span className="workspace-editor__badge" key={i}>{v.label}{v.stock === 0 ? ' · sold out' : ''}</span>)}</div>
                    <p>{totalStock} items available across {variants.length} variant{variants.length === 1 ? '' : 's'}</p>
                </div>
            </section>
            <EditorChecklist title="Product checklist" items={[
                { label: 'Product name and price', complete: !!name.trim() && Number(price) > 0 },
                { label: 'Named variants with stock quantities', complete: variants.every(v => !!v.label.trim() && Number.isInteger(v.stock) && v.stock >= 0) },
                { label: 'A helpful description (recommended)', complete: !!description.trim() },
                { label: 'A product photo (recommended)', complete: images.length > 0 },
            ]}>Zero stock means sold out. Photos and a description help supporters choose the right item.</EditorChecklist>
        </>}
    >
        <EditorSection number="01" title="Product details" description="Start with a clear name and the details your supporters will want to know.">
            <label className="workspace-editor__field"><span>Product name<span className="workspace-editor__required" aria-hidden="true">*</span></span><input autoFocus aria-label="Product name" required maxLength={120} placeholder="For example: 2026 home shirt" value={name} onChange={e => setName(e.target.value)}/></label>
            <label className="workspace-editor__field"><span>Description<span className="workspace-editor__count" aria-hidden="true">{description.length}/2000</span></span><textarea aria-label="Description" maxLength={2000} rows={4} placeholder="Describe the fit, material and anything included with the product." value={description} onChange={e => setDescription(e.target.value)}/></label>
            <label className="workspace-editor__field">Category<select value={category} onChange={e => setCategory(e.target.value as typeof category)}>{STORE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase().replaceAll('_', ' ')}</option>)}</select></label>
        </EditorSection>
        <EditorSection number="02" title="Price & stock" description="Set the price per item and the actual quantity available for each size or variant.">
            <div className="workspace-editor__row"><label className="workspace-editor__field"><span>Price<span className="workspace-editor__required" aria-hidden="true">*</span></span><input aria-label="Price" type="number" required min="0.01" max="99999999.99" step="0.01" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)}/></label>
                <label className="workspace-editor__field">Currency<select value={currency} onChange={e => setCurrency(e.target.value)}>{['GEL','EUR','GBP','USD'].map(c => <option key={c}>{c}</option>)}</select></label></div>
            <div className="workspace-editor__variants">
                {variants.map((variant, index) => <div key={index} className="workspace-editor__variant store-variant-row"><label className="workspace-editor__field"><span>Variant {index + 1}<span className="workspace-editor__required" aria-hidden="true">*</span></span><input aria-label={`Variant ${index + 1}`} required maxLength={40} placeholder="For example: Medium" value={variant.label} onChange={e => editVariant(index, { label: e.target.value })}/></label><label className="workspace-editor__field"><span>Stock {index + 1}<span className="workspace-editor__required" aria-hidden="true">*</span></span><input aria-label={`Stock ${index + 1}`} type="number" required min="0" max="1000000" step="1" value={Number.isNaN(variant.stock) ? '' : variant.stock} onChange={e => editVariant(index, { stock: e.target.value === '' ? NaN : Number(e.target.value) })}/></label><button className="workspace-editor__button" type="button" aria-label={`Remove variant ${index + 1}`} disabled={variants.length === 1} onClick={() => setVariants(current => current.filter((_, i) => i !== index))}><Trash2 size={16} aria-hidden="true"/></button></div>)}
            </div>
            <div><button type="button" className="workspace-editor__button" disabled={variants.length >= 20} onClick={() => setVariants(current => [...current, { label: '', stock: 0 }])}><Plus size={16} aria-hidden="true"/>Add variant</button></div>
            <p className="workspace-editor__hint">Use “One size” if this item has no size options. Zero means out of stock. You can add up to 20 variants.</p>
        </EditorSection>
        <EditorSection number="03" title="Product photos" description="The first photo is your cover. Add up to eight images to show details and different views.">
            {images.length > 0 && <div className="workspace-editor__photos">{images.map((url, index) => <div key={index} className="workspace-editor__photo"><MediaImage src={resolveMediaUrl(url)} alt={`Product photo ${index + 1}`}/><div><span>{index === 0 ? 'Cover photo' : `Photo ${index + 1}`}</span><button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => setImages(current => current.filter((_, i) => i !== index))}><Trash2 size={16} aria-hidden="true"/></button></div></div>)}</div>}
            {images.length < 8 && <div className="workspace-editor__upload"><ImagePlus size={22} aria-hidden="true"/><label className="workspace-editor__field">Add product photo (up to 8)<input type="file" accept="image/*" onChange={async event => {
                const element = event.currentTarget, file = element.files?.[0]; if (!file) return;
                setUploading(true); setUploadError('');
                try { const data = new FormData(); data.append('file', file); const response = await apiClient.post<{url: string}>('/media/upload', data, { params: { context: 'store-product' } }); setImages(current => [...current, response.data.url]); }
                catch (error) { setUploadError(extractApiErrorMessage(error, 'Image upload failed. Please try again.')); }
                finally { setUploading(false); element.value = ''; }
            }}/></label><p className="workspace-editor__hint">Choose a clear image of the actual product. {images.length} of 8 photos added.</p></div>}
        </EditorSection>
        <EditorSection number="04" title="Store visibility" description="Choose whether supporters can see this product after you save.">
            <label className="workspace-editor__toggle"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}/>Published in the Store</label>
            <p className="workspace-editor__hint">{active ? 'This product will appear in your public club store when saved.' : 'This product will stay hidden from supporters. You can publish it from your product list later.'}</p>
        </EditorSection>
    </WorkspaceEditor>;
};

export const StoreTab = (props: Parameters<typeof StoreTabContent>[0]) => <CommerceDraftScope clubId={props.clubId} feature="StoreTab"><CommerceDraftNotice/><StoreTabContent {...props}/></CommerceDraftScope>;
