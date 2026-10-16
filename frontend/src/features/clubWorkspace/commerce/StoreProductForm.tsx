import { useState } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';
import { MediaImage } from '../../../components/ui/MediaImage';
import { useCommerceDraftState } from '../../../components/workspace/commerceDraftState';
import { Badge, Button, Field } from '../../../design/primitives';
import { formatStorePrice, STORE_CATEGORIES, type StoreProduct, type StoreProductPayload, type StoreVariant } from '../../store/api';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { CommerceEditor, EditorChecklist, EditorDiscardPrompt, EditorPreview, EditorSection } from './CommerceEditor';
import { categoryLabel } from './labels';
import { PhotoField } from './PhotoField';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const initialVariants = (product: StoreProduct | null): StoreVariant[] => product?.variants?.length ? product.variants.map(variant => ({ ...variant })) : [{ label: 'One size', stock: 0 }];

/** Adding or editing a store product on one page: details and photos, price and stock, and visibility. */
export const StoreProductForm = ({ product, saving, formError, onCancel, onSubmit, defaultActive = false, draftHint = 'Supporters cannot see this product. You can publish it from the product list later.' }: {
    product: StoreProduct | null; saving: boolean; formError: string; onCancel: () => void; onSubmit: (payload: StoreProductPayload) => Promise<void>;
    /** A new product starts published (the club's public store, where a draft would vanish from view). */ defaultActive?: boolean; /** Where an unpublished product can be found again. */ draftHint?: string;
}) => {
    const [name, setName] = useCommerceDraftState('form:name', product?.name ?? '');
    const [description, setDescription] = useCommerceDraftState('form:description', product?.description ?? '');
    const [price, setPrice] = useCommerceDraftState('form:price', String(product?.price ?? ''));
    const [currency, setCurrency] = useCommerceDraftState('form:currency', product?.currency ?? 'GEL');
    const [category, setCategory] = useCommerceDraftState('form:category', product?.category ?? 'OTHER');
    const [variants, setVariants] = useCommerceDraftState<StoreVariant[]>('form:variants', () => initialVariants(product));
    const [images, setImages] = useCommerceDraftState('form:images', product?.images ?? []);
    const [active, setActive] = useCommerceDraftState('form:active', product?.active ?? defaultActive);
    const [uploading, setUploading] = useCommerceDraftState('form:uploading', false);
    const [uploadError, setUploadError] = useCommerceDraftState('form:uploadError', '');
    const [discard, setDiscard] = useState(false);
    const editVariant = (index: number, change: Partial<StoreVariant>) => setVariants(current => current.map((variant, i) => i === index ? { ...variant, ...change } : variant));
    const totalStock = variants.reduce((total, variant) => total + (Number.isFinite(variant.stock) ? variant.stock : 0), 0);
    const dirty = JSON.stringify([name, description, price, currency, category, variants, images, active])
        !== JSON.stringify([product?.name ?? '', product?.description ?? '', String(product?.price ?? ''), product?.currency ?? 'GEL', product?.category ?? 'OTHER', initialVariants(product), product?.images ?? [], product?.active ?? defaultActive]);
    const requestClose = () => { if (dirty) setDiscard(true); else onCancel(); };
    return <CommerceEditor title={product ? 'Edit product' : 'Add a product'} formLabel="Product editor" backLabel="Back to products" saveLabel="Save product"
        description="Name the item, set its price and stock for each size, then choose whether supporters can see it."
        saving={saving} disabled={saving || uploading}
        footerNote={active ? 'Saving shows this product in your club store.' : 'Saved as a draft. Publish it when you are ready for supporters to see it.'}
        onRequestClose={requestClose}
        onSubmit={event => {
            event.preventDefault();
            if (saving || uploading) return;
            void onSubmit({ name: name.trim(), description, price: Number(price), currency, category, variants, images, active, ...(product ? { version: product.version } : {}) });
        }}
        feedback={(formError || uploading || uploadError) && <>
            {formError && <div className="gk-notice gk-notice--danger"><span role="alert">{formError}</span><span>Your edits are kept. If another manager changed this product, copy your edits before reopening its latest version.</span></div>}
            {uploading && <p className="gk-notice" role="status">Uploading photo…</p>}
            {uploadError && <p className="gk-notice gk-notice--danger" role="alert">{uploadError}</p>}
        </>}
        confirmation={discard && <EditorDiscardPrompt disabled={saving || uploading} onKeepEditing={() => setDiscard(false)} onDiscard={onCancel} />}
        preview={<>
            <EditorPreview label="Product preview" media={images[0] ? <MediaImage src={resolveMediaUrl(images[0])} alt="Product cover preview" /> : <span className="cm-preview__empty"><Package aria-hidden="true" />No photo yet</span>}
                footnote={`${totalStock} items available across ${variants.length} ${variants.length === 1 ? 'variant' : 'variants'}.`}>
                <Badge tone={active ? 'accent' : 'neutral'}>{active ? 'Published when saved' : 'Draft'}</Badge>
                <h3>{name.trim() || 'Your product name'}</h3>
                <p className="cm-preview__price">{price && Number(price) > 0 ? formatStorePrice(Number(price), currency) : `— ${currency}`}</p>
                <p className="cm-preview__text">{description.trim() || 'Add a few details about the fit, material or what is included.'}</p>
                {variants.some(variant => variant.label.trim()) && <p className="cm-preview__tags">{variants.filter(variant => variant.label.trim()).map((variant, index) => <Badge key={index}>{variant.label}{variant.stock === 0 ? ' · sold out' : ''}</Badge>)}</p>}
            </EditorPreview>
            <EditorChecklist title="Product checklist" items={[
                { label: 'Product name and price', complete: !!name.trim() && Number(price) > 0 },
                { label: 'Named variants with stock quantities', complete: variants.every(variant => !!variant.label.trim() && Number.isInteger(variant.stock) && variant.stock >= 0) },
                { label: 'A helpful description (recommended)', complete: !!description.trim() },
                { label: 'A product photo (recommended)', complete: images.length > 0 },
            ]}>Zero stock means sold out.</EditorChecklist>
        </>}>
        <EditorSection title="Details" description="A clear name and the details supporters will want to know.">
            <Field label="Product name" htmlFor="product-name"><input id="product-name" className="gk-input" autoFocus required maxLength={120} placeholder="For example: 2026 home shirt" value={name} onChange={event => setName(event.target.value)} /></Field>
            <Field label="Description" htmlFor="product-description" hint={`Optional · ${description.length}/2000`}><textarea id="product-description" className="gk-input" maxLength={2000} rows={4} placeholder="Fit, material and anything included." value={description} onChange={event => setDescription(event.target.value)} /></Field>
            <Field label="Category" htmlFor="product-category"><select id="product-category" className="gk-input" value={category} onChange={event => setCategory(event.target.value as typeof category)}>{STORE_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabel(value)}</option>)}</select></Field>
        </EditorSection>
        <EditorSection title="Photos" description="The first photo is the cover.">
            <PhotoField noun="product" context="store-product" images={images} setImages={setImages} setUploading={setUploading} setUploadError={setUploadError} hint="Use clear photos of the actual product." />
        </EditorSection>
        <EditorSection title="Price and stock" description="The price per item and the quantity available for each size or variant.">
            <div className="cm-pair">
                <Field label="Price" htmlFor="product-price"><input id="product-price" className="gk-input" type="number" required min="0.01" max="99999999.99" step="0.01" placeholder="0.00" value={price} onChange={event => setPrice(event.target.value)} /></Field>
                <Field label="Currency" htmlFor="product-currency"><select id="product-currency" className="gk-input" value={currency} onChange={event => setCurrency(event.target.value)}>{['GEL', 'EUR', 'GBP', 'USD'].map(value => <option key={value}>{value}</option>)}</select></Field>
            </div>
            <div className="cm-sizes" role="group" aria-label="Quick add sizes"><span className="cm-hint">Quick add</span>
                {SIZES.map(size => <Button key={size} size="sm" disabled={variants.length >= 20 || variants.some(variant => variant.label.trim().toUpperCase() === size)}
                    onClick={() => setVariants(current => [...current.filter(variant => !(variant.label === 'One size' && variant.stock === 0)), { label: size, stock: 0 }])}>{size}</Button>)}
            </div>
            <ul className="cm-variants">{variants.map((variant, index) => <li key={index} className="cm-variant">
                <Field label={`Variant ${index + 1}`} htmlFor={`variant-${index}`}><input id={`variant-${index}`} className="gk-input" required maxLength={40} placeholder="For example: Medium" value={variant.label} onChange={event => editVariant(index, { label: event.target.value })} /></Field>
                <Field label={`Stock ${index + 1}`} htmlFor={`stock-${index}`}><input id={`stock-${index}`} className="gk-input" type="number" required min="0" max="1000000" step="1" value={Number.isNaN(variant.stock) ? '' : variant.stock} onChange={event => editVariant(index, { stock: event.target.value === '' ? NaN : Number(event.target.value) })} /></Field>
                <Button variant="ghost" iconOnly aria-label={`Remove variant ${index + 1}`} disabled={variants.length === 1} onClick={() => setVariants(current => current.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" /></Button>
            </li>)}</ul>
            <div><Button size="sm" disabled={variants.length >= 20} onClick={() => setVariants(current => [...current, { label: '', stock: 0 }])}><Plus aria-hidden="true" />Add variant</Button></div>
            <p className="cm-hint">Use “One size” when the item has no sizes. Zero means out of stock. Up to 20 variants.</p>
        </EditorSection>
        <EditorSection title="Visibility">
            <label className="cm-switch"><input type="checkbox" className="gk-switch" checked={active} onChange={event => setActive(event.target.checked)} /><span>Published in the Store</span></label>
            <p className="cm-hint">{active ? 'Supporters see this product in your club store after you save.' : draftHint}</p>
        </EditorSection>
    </CommerceEditor>;
};
