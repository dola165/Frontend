import { MediaImage } from '../../ui/MediaImage';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { createStoreProduct, deleteStoreProduct, fetchAllClubStoreProducts, updateStoreProduct,
    formatStorePrice, STORE_CATEGORIES, type StoreProduct, type StoreProductPayload, type StoreVariant } from '../../../features/store/api';

const input = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-2 text-[var(--text-primary)]';
const button = 'rounded-lg border border-[var(--theme-border)] px-3 py-2 text-sm disabled:opacity-40';

export const StoreTab = ({ clubId }: { clubId: number; pendingKey?: string | null }) => {
    const [products, setProducts] = useState<StoreProduct[] | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [editing, setEditing] = useState<StoreProduct | 'new' | null>(null);
    const [archive, setArchive] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState('');
    const load = useCallback(async () => {
        setError('');
        try { setProducts(await fetchAllClubStoreProducts(clubId)); }
        catch (error) { setError(extractApiErrorMessage(error, 'Could not load products.')); }
    }, [clubId]);
    useEffect(() => { void load(); }, [load]);
    const action = async (product: StoreProduct, remove: boolean) => {
        setBusy(true); setError(''); setMessage('');
        try {
            if (remove) await deleteStoreProduct(clubId, product.id);
            else await updateStoreProduct(clubId, product.id, { active: !product.active, version: product.version });
            setArchive(null); setMessage(remove ? 'Product archived.' : product.active ? 'Product hidden.' : 'Product published.');
            await load();
        } catch (error) { setError(extractApiErrorMessage(error, 'The change could not be saved.')); }
        finally { setBusy(false); }
    };
    return <section className="space-y-4 text-[var(--text-primary)]">
        <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Club Store</h2><p className="text-sm">Manage products, sizes and available stock. Online checkout is not available yet.</p></div>
            <Link className="underline" to={`/clubs/${clubId}/store`}>View club store</Link>
            <button className={button} disabled={busy || !!editing} onClick={() => { setEditing('new'); setFormError(''); }}>Add product</button></header>
        {error && <p role="alert">{error} <button className="underline" onClick={() => void load()}>Reload products</button></p>}
        {message && <p role="status">{message}</p>}
        {products === null ? !error && <p role="status">Loading products...</p> : products.length === 0 ? <p>No products yet. Start with a draft.</p> : products.map(product => <article key={product.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--theme-border)] p-4">
            <div className="min-w-40 flex-1"><h3 className="font-semibold">{product.name}</h3><p className="text-sm">{formatStorePrice(product.price ?? 0, product.currency)} · {product.active ? 'Published' : 'Draft / hidden'} · {product.variants?.reduce((sum, v) => sum + v.stock, 0) ?? 0} in stock</p></div>
            <button className={button} disabled={busy || !!editing} onClick={() => { setEditing(product); setFormError(''); setMessage(''); }}>Edit {product.name}</button>
            <button className={button} disabled={busy || !!editing} onClick={() => void action(product, false)}>{product.active ? 'Hide' : 'Publish'} {product.name}</button>
            <button className={button} disabled={busy || !!editing} onClick={() => setArchive(product.id)}>Archive {product.name}</button>
            {archive === product.id && <div className="w-full space-x-3" role="group" aria-label={`Confirm archive ${product.name}`}><p>This removes the product from the Store and makes existing carts containing it unavailable.</p><button className={button} disabled={busy} onClick={() => void action(product, true)}>Confirm archive</button><button className={button} disabled={busy} onClick={() => setArchive(null)}>Cancel archive</button></div>}
        </article>)}
        {editing && <StoreProductForm key={editing === 'new' ? 'new' : editing.id} product={editing === 'new' ? null : editing} saving={busy} formError={formError} onCancel={() => setEditing(null)} onSubmit={async payload => {
            setBusy(true); setFormError(''); setMessage('');
            try {
                if (editing === 'new') await createStoreProduct(clubId, payload);
                else await updateStoreProduct(clubId, editing.id, payload);
                setEditing(null); setMessage('Product saved.'); await load();
            } catch (error) { setFormError(extractApiErrorMessage(error, 'Could not save. Your changes are still here.')); }
            finally { setBusy(false); }
        }}/>}
    </section>;
};

export const StoreProductForm = ({ product, saving, formError, onCancel, onSubmit }: {
    product: StoreProduct | null; saving: boolean; formError: string; onCancel: () => void; onSubmit: (payload: StoreProductPayload) => Promise<void>;
}) => {
    const [name, setName] = useState(product?.name ?? '');
    const [description, setDescription] = useState(product?.description ?? '');
    const [price, setPrice] = useState(String(product?.price ?? ''));
    const [currency, setCurrency] = useState(product?.currency ?? 'GEL');
    const [category, setCategory] = useState(product?.category ?? 'OTHER');
    const [variants, setVariants] = useState<StoreVariant[]>(product?.variants?.length ? product.variants.map(v => ({ ...v })) : [{ label: 'One size', stock: 0 }]);
    const [images, setImages] = useState(product?.images ?? []);
    const [active, setActive] = useState(product?.active ?? false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [discard, setDiscard] = useState(false);
    const editVariant = (index: number, change: Partial<StoreVariant>) => setVariants(current => current.map((v, i) => i === index ? { ...v, ...change } : v));
    return <form className="space-y-4 rounded-xl border border-[var(--theme-border)] p-4" onSubmit={event => {
        event.preventDefault();
        if (saving || uploading) return;
        void onSubmit({ name: name.trim(), description, price: Number(price), currency, category, variants, images, active, ...(product ? { version: product.version } : {}) });
    }}>
        <h3 className="text-lg font-bold">{product ? 'Edit product' : 'New product'}</h3>
        {formError && <p role="alert">{formError} Your edits have been kept. If another manager changed this product, copy your edits before closing and reopening its latest version.</p>}
        <fieldset disabled={saving || uploading} className="space-y-3">
            <label className="block">Product name<input autoFocus className={input} required maxLength={120} value={name} onChange={e => setName(e.target.value)}/></label>
            <label className="block">Description<textarea className={input} maxLength={2000} rows={3} value={description} onChange={e => setDescription(e.target.value)}/></label>
            <div className="grid gap-3 sm:grid-cols-3"><label>Price<input className={input} type="number" required min="0.01" max="99999999.99" step="0.01" value={price} onChange={e => setPrice(e.target.value)}/></label>
                <label>Currency<select className={input} value={currency} onChange={e => setCurrency(e.target.value)}>{['GEL','EUR','GBP','USD'].map(c => <option key={c}>{c}</option>)}</select></label>
                <label>Category<select className={input} value={category} onChange={e => setCategory(e.target.value as typeof category)}>{STORE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label></div>
            <fieldset className="space-y-2"><legend className="font-semibold">Sizes / variants and stock</legend><p className="text-sm">Enter the actual number available. Zero means out of stock.</p>
                {variants.map((variant, index) => <div key={index} className="flex flex-wrap items-end gap-2"><label className="flex-1">Variant {index + 1}<input className={input} required maxLength={40} value={variant.label} onChange={e => editVariant(index, { label: e.target.value })}/></label><label className="w-28">Stock {index + 1}<input className={input} type="number" required min="0" max="1000000" step="1" value={Number.isNaN(variant.stock) ? '' : variant.stock} onChange={e => editVariant(index, { stock: e.target.value === '' ? NaN : Number(e.target.value) })}/></label><button className={button} type="button" disabled={variants.length === 1} onClick={() => setVariants(current => current.filter((_, i) => i !== index))}>Remove variant {index + 1}</button></div>)}
                <button type="button" className={button} disabled={variants.length >= 20} onClick={() => setVariants(current => [...current, { label: '', stock: 0 }])}>Add variant</button>
            </fieldset>
            <div className="flex flex-wrap gap-3">{images.map((url, index) => <div key={index}><MediaImage src={resolveMediaUrl(url)} alt={`Product photo ${index + 1}`} className="h-20 w-20 rounded object-cover"/><button className={button} type="button" onClick={() => setImages(current => current.filter((_, i) => i !== index))}>Remove photo {index + 1}</button></div>)}</div>
            {images.length < 8 && <label className="block">Add product photo (up to 8)<input className={input} type="file" accept="image/*" onChange={async event => {
                const element = event.currentTarget, file = element.files?.[0]; if (!file) return;
                setUploading(true); setUploadError('');
                try { const data = new FormData(); data.append('file', file); const response = await apiClient.post<{url: string}>('/media/upload', data, { params: { context: 'store-product' } }); setImages(current => [...current, response.data.url]); }
                catch (error) { setUploadError(extractApiErrorMessage(error, 'Image upload failed. Please try again.')); }
                finally { setUploading(false); element.value = ''; }
            }}/></label>}
            <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}/>Published in the Store</label>
        </fieldset>
        {uploading && <p role="status">Uploading photo...</p>}{uploadError && <p role="alert">{uploadError}</p>}
        <div className="flex gap-3"><button className={button} disabled={saving || uploading} type="submit">{saving ? 'Saving...' : 'Save product'}</button><button className={button} disabled={saving || uploading} type="button" onClick={() => setDiscard(true)}>Close editor</button></div>
        {discard && <div role="group" aria-label="Discard edits"><p>Close and discard unsaved edits?</p><button type="button" className={button} onClick={onCancel}>Discard edits</button><button type="button" className={button} onClick={() => setDiscard(false)}>Keep editing</button></div>}
    </form>;
};
