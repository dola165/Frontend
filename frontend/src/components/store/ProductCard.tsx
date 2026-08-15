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
            className="rounded-xl border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)] overflow-hidden hover:border-[#ffffff15] transition-colors cursor-pointer"
            onClick={() => onOpen(product)}
        >
            {/* Cover */}
            <div className="aspect-square bg-[rgba(255,255,255,0.04)] flex items-center justify-center">
                {cover ? (
                    <img src={cover} alt={product.name ?? 'Product'} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                    <ShoppingBag className="h-10 w-10 text-[#3f3f46]" />
                )}
            </div>

            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#f4f4f5] line-clamp-2">{product.name}</h3>
                    <span className="text-sm font-bold text-[#16a34a] whitespace-nowrap">
                        {product.price ?? 0} ₾
                    </span>
                </div>

                {product.category && (
                    <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[#16a34a]/10 text-[#16a34a]">
                        {t(`store.categories.${product.category}`)}
                    </span>
                )}

                {product.description && (
                    <p className="text-xs text-[#71717a] mt-1 line-clamp-2">{product.description}</p>
                )}

                {product.sizes && product.sizes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                        {product.sizes.slice(0, 5).map((size) => (
                            <span
                                key={size}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-[#a1a1aa]"
                            >
                                {size}
                            </span>
                        ))}
                    </div>
                )}

                {showClub && product.clubName && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#ffffff0d]">
                        {product.clubLogoUrl ? (
                            <img
                                src={resolveMediaUrl(product.clubLogoUrl)}
                                alt=""
                                className="h-5 w-5 rounded-full object-cover"
                            />
                        ) : (
                            <span className="h-5 w-5 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center">
                                <ShoppingBag className="h-2.5 w-2.5 text-[#a1a1aa]" />
                            </span>
                        )}
                        <Link
                            to={`/clubs/${product.clubId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-medium text-[#a1a1aa] hover:text-[#16a34a] transition-colors truncate"
                        >
                            {product.clubName}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};
