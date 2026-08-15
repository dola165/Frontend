import { useState } from 'react';
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

/** Quick-view popup — photos, sizes, price, and the contact-out order CTA (§4.1). */
export const ProductQuickViewModal = ({ product, onClose }: ProductQuickViewModalProps) => {
    const { t } = useTranslation();
    const [selectedImage, setSelectedImage] = useState(0);

    if (!product) return null;

    const images = product.images && product.images.length > 0 ? product.images : [];
    // Clamp in case the previous product had more images than this one.
    const activeImage = Math.min(selectedImage, Math.max(0, images.length - 1));
    const whatsappHref = toWhatsappHref(product.clubWhatsappNumber);
    const phoneHref = toPhoneHref(product.clubWhatsappNumber);

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className="bg-[#0f1117] border border-[#26282d] rounded-xl w-full max-w-lg max-h-[90dvh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Gallery */}
                <div>
                    <div className="aspect-square bg-[rgba(255,255,255,0.04)] flex items-center justify-center">
                        {images.length > 0 ? (
                            <img
                                src={resolveMediaUrl(images[activeImage])}
                                alt={product.name ?? 'Product'}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <ShoppingBag className="h-14 w-14 text-[#3f3f46]" />
                        )}
                    </div>
                    {images.length > 1 && (
                        <div className="flex gap-2 p-3">
                            {images.map((image, index) => (
                                <button
                                    key={image}
                                    onClick={() => setSelectedImage(index)}
                                    className={`h-14 w-14 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${
                                        activeImage === index ? 'border-[#16a34a]' : 'border-transparent'
                                    }`}
                                >
                                    <img src={resolveMediaUrl(image)} alt="" className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-[#f4f4f5]">{product.name}</h2>
                            {product.clubName && (
                                <Link
                                    to={`/clubs/${product.clubId}`}
                                    onClick={onClose}
                                    className="text-xs font-medium text-[#a1a1aa] hover:text-[#16a34a] transition-colors"
                                >
                                    {product.clubName}
                                </Link>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1.5 text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#f4f4f5] transition-colors shrink-0"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <p className="text-2xl font-bold text-[#16a34a] mt-3">{product.price ?? 0} ₾</p>

                    {product.description && (
                        <p className="text-sm text-[#a1a1aa] mt-2">{product.description}</p>
                    )}

                    {product.sizes && product.sizes.length > 0 && (
                        <div className="mt-4">
                            <p className="text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-1.5">{t('store.sizes')}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {product.sizes.map((size) => (
                                    <span
                                        key={size}
                                        className="text-xs font-medium px-2.5 py-1 rounded-full bg-[rgba(255,255,255,0.06)] text-[#f4f4f5]"
                                    >
                                        {size}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Order CTA — catalog only, contact-out (§4.1) */}
                    <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-[#ffffff0d]">
                        {whatsappHref && (
                            <a
                                href={whatsappHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#22c55e] transition-colors"
                            >
                                <MessageCircle className="h-4 w-4" />
                                {t('store.orderViaWhatsApp')}
                            </a>
                        )}
                        {phoneHref && (
                            <a
                                href={phoneHref}
                                className="inline-flex items-center gap-2 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-2 text-sm font-medium text-[#f4f4f5] hover:bg-[#1a1c22] transition-colors"
                            >
                                <Phone className="h-4 w-4" />
                                {t('store.call')}
                            </a>
                        )}
                        {product.clubEmail && (
                            <a
                                href={`mailto:${product.clubEmail}?subject=${encodeURIComponent(`Order: ${product.name ?? ''}`)}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-[#ffffff0d] bg-[#16181d] px-4 py-2 text-sm font-medium text-[#f4f4f5] hover:bg-[#1a1c22] transition-colors"
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
