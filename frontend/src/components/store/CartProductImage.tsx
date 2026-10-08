import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { MediaImage } from '../ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

/** The neighbouring product name labels the thumbnail link. */
export function CartProductImage({ src }: { src?: string | null }) {
    const [failed, setFailed] = useState(false);
    return <span className="store-cart-thumbnail" aria-hidden="true">
        {src && !failed ? <MediaImage src={resolveMediaUrl(src)} alt="" loading="lazy" onError={() => setFailed(true)} /> : <ImagePlus size={24} />}
    </span>;
}
