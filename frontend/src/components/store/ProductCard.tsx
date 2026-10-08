import { MediaImage } from '../ui/MediaImage';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingBag } from 'lucide-react';
import type { StoreProduct } from '../../features/store/api';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

interface ProductCardProps {
    product: StoreProduct;
    onOpen: (product: StoreProduct) => void;
    /** Show the club attribution row (aggregate /store page). */
    showClub?: boolean;
}

export const ProductCard = ({ product, onOpen, showClub }: ProductCardProps) => {
    const { t } = useTranslation();
    const cover = product.images && product.images.length > 0 ? resolveMediaUrl(product.images[0]) : null;

    return (
        <div
            className="rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[color-mix(in_srgb,_var(--color-ink)_2%,_transparent)] overflow-hidden hover:border-[color-mix(in_srgb,_var(--color-border)_8.24%,_transparent)] transition-colors cursor-pointer"
            onClick={() => onOpen(product)}
        >
            {/* Cover */}
            <div className="relative aspect-square bg-[color-mix(in_srgb,_var(--color-ink)_4%,_transparent)] flex items-center justify-center">
                <ShoppingBag className="h-10 w-10 text-[var(--color-muted)]" />
                {cover && (
                    <MediaImage
                        src={cover}
                        alt={product.name ?? 'Product'}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                )}
            </div>

            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--color-text)] line-clamp-2">{product.name}</h3>
                    <span className="text-sm font-bold text-[var(--color-accent)] whitespace-nowrap">
                        {product.price ?? 0} ₾
                    </span>
                </div>

                {product.category && (
                    <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                        {t(`store.categories.${product.category}`)}
                    </span>
                )}

                {product.description && (
                    <p className="text-xs text-[var(--color-secondary)] mt-1 line-clamp-2">{product.description}</p>
                )}

                {product.sizes && product.sizes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                        {product.sizes.slice(0, 5).map((size) => (
                            <span
                                key={size}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[color-mix(in_srgb,_var(--color-ink)_6%,_transparent)] text-[var(--color-secondary)]"
                            >
                                {size}
                            </span>
                        ))}
                    </div>
                )}

                {showClub && product.clubName && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)]">
                        {product.clubLogoUrl ? (
                            <MediaImage
                                src={resolveMediaUrl(product.clubLogoUrl)}
                                alt=""
                                className="h-5 w-5 rounded-full object-cover"
                            />
                        ) : (
                            <span className="h-5 w-5 rounded-full bg-[color-mix(in_srgb,_var(--color-ink)_8%,_transparent)] flex items-center justify-center">
                                <ShoppingBag className="h-2.5 w-2.5 text-[var(--color-secondary)]" />
                            </span>
                        )}
                        <Link
                            to={`/clubs/${product.clubId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-medium text-[var(--color-secondary)] hover:text-[var(--color-accent)] transition-colors truncate"
                        >
                            {product.clubName}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};
