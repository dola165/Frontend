import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Loader2, Pencil, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import {
    createStoreProduct, deleteStoreProduct, fetchAllClubStoreProducts, updateStoreProduct,
    STORE_CATEGORIES, type StoreProduct, type StoreProductCategory, type StoreProductPayload
} from '../../../features/store/api';
import { apiClient } from '../../../api/axiosConfig';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { ErrorBlock, PageSpinner, Pill, SectionHeader } from '../helpers';

interface StoreTabProps {
    clubId: number;
    pendingKey: string | null;
}

/**
 * Workspace Store tab (WEB_APP_MASTER_PLAN.md §4.1, Phase 3): owner/admin
 * CRUD over the club's merchandise. Catalog-only — no payments, no checkout;
 * the order CTA on the store pages opens the club's contact channels.
 */
export const StoreTab = ({ clubId, pendingKey }: StoreTabProps) => {
    const { t } = useTranslation();
    const [products, setProducts] = useState<StoreProduct[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<StoreProduct | 'new' | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setProducts(await fetchAllClubStoreProducts(clubId));
        } catch {
            setError('Could not load store products.');
        }
    }, [clubId]);

    useEffect(() => { void load(); }, [load]);

    if (products == null) {
        return error ? <ErrorBlock message={error} onRetry={() => void load()} /> : <PageSpinner />;
    }

    return (
        <div className="space-y-4">
            <SectionHeader
                eyebrow="Store"
                title="Merchandise"
                description="List the club's kit, scarves and training gear. Fans order directly through your club's contact channels — no payments on the platform."
                action={
                    <button
                        type="button"
                        onClick={() => setEditing('new')}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add Product
                    </button>
                }
            />

            {products.length === 0 ? (
                <p className="text-sm text-[var(--fc-text-secondary)]">No products yet.</p>
            ) : (
                <div className="space-y-1.5">
                    {products.map((product) => (
                        <div key={product.id} className="flex items-center gap-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3">
                            {product.images && product.images.length > 0 ? (
                                <img
                                    src={resolveMediaUrl(product.images[0])}
                                    alt=""
                                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                />
                            ) : (
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.05)]">
                                    <ShoppingBag className="h-4 w-4 text-[var(--fc-text-muted)]" />
                                </span>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--fc-text-primary)]">{product.name}</p>
                                <p className="text-xs text-[var(--fc-text-secondary)]">
                                    {product.category ? t(`store.categories.${product.category}`) : 'OTHER'}
                                    {' · '}{product.price ?? 0} ₾
                                    {product.sizes && product.sizes.length > 0 ? ` · ${product.sizes.join(', ')}` : ''}
                                </p>
                            </div>
                            <Pill label={product.active ? 'Active' : 'Inactive'} tone={product.active ? 'success' : 'neutral'} />
                            <button
                                type="button"
                                disabled={pendingKey === `store-${product.id}`}
                                onClick={() => void (async () => {
                                    try {
                                        await updateStoreProduct(clubId, product.id, { active: !product.active });
                                        await load();
                                    } catch { /* surfaced by reload */ }
                                })()}
                                className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] disabled:opacity-50"
                            >
                                {product.active ? 'Hide' : 'Show'}
                            </button>
                            <button type="button" onClick={() => setEditing(product)} className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => void (async () => {
                                    await deleteStoreProduct(clubId, product.id);
                                    await load();
                                })()}
                                className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-state-danger)]"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <StoreProductForm
                    product={editing === 'new' ? null : editing}
                    saving={saving}
                    formError={formError}
                    onCancel={() => { setEditing(null); setFormError(null); }}
                    onSubmit={async (payload) => {
                        setSaving(true);
                        setFormError(null);
                        try {
                            if (editing === 'new') {
                                await createStoreProduct(clubId, payload);
                            } else {
                                await updateStoreProduct(clubId, editing.id, payload);
                            }
                            setEditing(null);
                            await load();
                        } catch {
                            setFormError('Failed to save the product.');
                        } finally {
                            setSaving(false);
                        }
                    }}
                />
            )}
        </div>
    );
};

const StoreProductForm = ({
    product, saving, formError, onCancel, onSubmit
}: {
    product: StoreProduct | null;
    saving: boolean;
    formError: string | null;
    onCancel: () => void;
    onSubmit: (payload: StoreProductPayload) => Promise<void>;
}) => {
    const { t } = useTranslation();
    const [name, setName] = useState(product?.name ?? '');
    const [description, setDescription] = useState(product?.description ?? '');
    const [price, setPrice] = useState(product?.price != null ? String(product.price) : '');
    const [sizes, setSizes] = useState(product?.sizes?.join(', ') ?? '');
    const [category, setCategory] = useState<StoreProductCategory>(product?.category ?? 'OTHER');
    const [images, setImages] = useState<string[]>(product?.images ?? []);
    const [active, setActive] = useState(product?.active ?? true);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const inputClass = 'theme-surface-strong theme-border w-full border px-3 py-2 text-sm font-semibold text-[#f4f4f5] focus:border-[#16a34a] outline-none';

    const handleImagePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setUploadError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await apiClient.post<{ url: string }>('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: { context: 'store-product' },
            });
            setImages((prev) => [...prev, response.data.url]);
        } catch {
            setUploadError('Image upload failed.');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    return (
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-4">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--fc-text-primary)]">{product ? 'Edit product' : 'New product'}</p>
                <button type="button" onClick={onCancel} className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]">
                    <X className="h-4 w-4" />
                </button>
            </div>
            {formError && <p className="mt-2 text-xs font-semibold text-[var(--fc-state-danger)]">{formError}</p>}
            {uploadError && <p className="mt-2 text-xs font-semibold text-[var(--fc-state-danger)]">{uploadError}</p>}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void onSubmit({
                        name: name.trim(),
                        description: description || null,
                        price: price ? Number(price) : undefined,
                        sizes: sizes.split(',').map((s) => s.trim()).filter(Boolean),
                        images,
                        category,
                        ...(product ? { active } : {}),
                    });
                }}
                className="mt-3 grid gap-3"
            >
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120}
                    placeholder="Home Kit 2026/27" className={inputClass} />
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000}
                    placeholder="What it is, material, fit…" className={inputClass} />
                <div className="grid gap-3 sm:grid-cols-2">
                    <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required min="0.01" step="0.01"
                        placeholder="Price in GEL — 150.00" className={inputClass} />
                    <input type="text" value={sizes} onChange={(e) => setSizes(e.target.value)}
                        placeholder="Sizes, comma-separated — S, M, L (empty = one size)" className={inputClass} />
                </div>

                <select value={category} onChange={(e) => setCategory(e.target.value as StoreProductCategory)} className={inputClass}>
                    {STORE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{t(`store.categories.${c}`)}</option>
                    ))}
                </select>

                {/* Product photos */}
                <div>
                    <div className="flex flex-wrap gap-2">
                        {images.map((image) => (
                            <div key={image} className="relative h-16 w-16 overflow-hidden rounded-lg">
                                <img src={resolveMediaUrl(image)} alt="" className="h-full w-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setImages((prev) => prev.filter((i) => i !== image))}
                                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                        {images.length < 8 && (
                            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-[var(--fc-border)] text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)] transition-colors">
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleImagePick(e)} />
                            </label>
                        )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-[var(--fc-text-secondary)]">Up to 8 photos — first one is the cover.</p>
                </div>

                {product && (
                    <label className="flex items-center gap-2 text-sm font-semibold text-[#f4f4f5]">
                        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[#16a34a]" />
                        Visible in the store
                    </label>
                )}

                <button type="submit" disabled={saving || uploading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                </button>
            </form>
        </div>
    );
};
