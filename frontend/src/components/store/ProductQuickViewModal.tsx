import { MediaImage } from '../ui/MediaImage';
import { useRef, useState } from 'react';
import { usePanelMotion } from '../ui/usePanelMotion';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, MessageCircle, Phone, ShoppingBag, X } from 'lucide-react';
import type { StoreProduct } from '../../features/store/api';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { toPhoneHref, toWhatsappHref } from '../club/clubProfileInfo';

interface ProductQuickViewModalProps {
    product: StoreProduct | null;
    onClose: () => void;
}

/** Quick-view popup — photos, sizes, price, and a contact-only enquiry handoff (§4.1). */
export const ProductQuickViewModal = (props: ProductQuickViewModalProps) => props.product ? <ProductQuickViewContent {...props} /> : null;

const ProductQuickViewContent = ({ product, onClose: finishClose }: ProductQuickViewModalProps) => {
    const motion = usePanelMotion(finishClose), dialog = useRef<HTMLDivElement>(null);
    const onClose = motion.close;
    useDialogFocus(true, dialog, onClose);
    const { t } = useTranslation();
    const [selectedImage, setSelectedImage] = useState(0);

    if (!product) return null;

    const images = product.images && product.images.length > 0 ? product.images : [];
    // Clamp in case the previous product had more images than this one.
    const activeImage = Math.min(selectedImage, Math.max(0, images.length - 1));
    const whatsappHref = toWhatsappHref(product.clubWhatsappNumber);
    const phoneHref = toPhoneHref(product.clubWhatsappNumber);
    const enquiry = `Product enquiry: ${product.name ?? 'Product'}${product.sizes?.length ? ` (${product.sizes.join(', ')})` : ''}`;

    return (
        <div className="app-motion-portal app-motion-backdrop fixed inset-0 z-[1300] flex items-center justify-center bg-[color:var(--color-overlay)]/60 p-4" data-closing={motion.closing} onClick={onClose}>
            <div
                ref={dialog} role="dialog" aria-modal="true" aria-label={product.name ?? 'Product details'}
                className="app-motion-dialog bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl w-full max-w-lg max-h-[90dvh] overflow-y-auto" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Gallery */}
                <div>
                    <div className="aspect-square bg-[color-mix(in_srgb,_var(--color-ink)_4%,_transparent)] flex items-center justify-center">
                        {images.length > 0 ? (
                            <MediaImage
                                src={resolveMediaUrl(images[activeImage])}
                                alt={product.name ?? 'Product'}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <ShoppingBag className="h-14 w-14 text-[var(--color-muted)]" />
                        )}
                    </div>
                    {images.length > 1 && (
                        <div className="flex gap-2 p-3">
                            {images.map((image, index) => (
                                <button
                                    key={image}
                                    onClick={() => setSelectedImage(index)}
                                    className={`h-14 w-14 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${
                                        activeImage === index ? 'border-[var(--color-accent)]' : 'border-transparent'
                                    }`}
                                >
                                    <MediaImage src={resolveMediaUrl(image)} alt="" className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--color-text)]">{product.name}</h2>
                            {product.clubName && (
                                <Link
                                    to={`/clubs/${product.clubId}`}
                                    onClick={onClose}
                                    className="text-xs font-medium text-[var(--color-secondary)] hover:text-[var(--color-accent)] transition-colors"
                                >
                                    {product.clubName}
                                </Link>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1.5 text-[var(--color-secondary)] hover:bg-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] hover:text-[var(--color-text)] transition-colors shrink-0"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <p className="text-2xl font-bold text-[var(--color-accent)] mt-3">{product.price ?? 0} ₾</p>

                    {product.description && (
                        <p className="text-sm text-[var(--color-secondary)] mt-2">{product.description}</p>
                    )}

                    {product.sizes && product.sizes.length > 0 && (
                        <div className="mt-4">
                            <p className="text-xs font-semibold text-[var(--color-secondary)] uppercase tracking-wide mb-1.5">{t('store.sizes')}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {product.sizes.map((size) => (
                                    <span
                                        key={size}
                                        className="text-xs font-medium px-2.5 py-1 rounded-full bg-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] text-[var(--color-text)]"
                                    >
                                        {size}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="mt-5 text-xs leading-5 text-[var(--color-secondary)]">GrassKickZ does not place an order, reserve stock, or take payment. Ask the club to confirm availability and next steps.</p>
                    {/* Enquiry CTA — catalog only, contact-out (§4.1) */}
                    <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]">
                        {whatsappHref && (
                            <a
                                href={`${whatsappHref}?text=${encodeURIComponent(enquiry)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-accent)] hover:bg-[var(--color-accent)] transition-colors"
                            >
                                <MessageCircle className="h-4 w-4" />
                                {t('store.askViaWhatsApp', 'Ask via WhatsApp')}
                            </a>
                        )}
                        {phoneHref && (
                            <a
                                href={phoneHref}
                                className="inline-flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
                            >
                                <Phone className="h-4 w-4" />
                                {t('store.call')}
                            </a>
                        )}
                        {product.clubEmail && (
                            <a
                                href={`mailto:${product.clubEmail}?subject=${encodeURIComponent(enquiry)}&body=${encodeURIComponent(`Hello, I would like to ask about ${product.name ?? 'this product'}. Please confirm availability and how to buy it directly from the club.`)}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
                            >
                                <Mail className="h-4 w-4" />
                                {t('store.email')}
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
