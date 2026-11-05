import { MediaImage } from '../../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { Material } from './api';
import './orders.css';

export function QuotedMaterials({ lines }: { lines: Array<{ name?: string; variant?: string; material?: Material | null }> }) {
    return <details open className="store-orders__materials"><summary>Quoted item details</summary>
        {lines.map((line, index) => <section key={index}>
            <strong>{line.name} · {line.variant}</strong>
            {line.material ? <>
                {(line.material.category || line.material.collection) && <p>{[line.material.category, line.material.collection].filter(Boolean).join(' · ').replaceAll('_', ' ')}</p>}
            {!!line.material.sizes?.length && <p>Listed sizes: {line.material.sizes.join(', ')}</p>}
            {line.material.description && <p>{line.material.description}</p>}
                {line.material.sellerArrangement && <p>{line.material.sellerArrangement}</p>}
                {line.material.images.length > 0 && <div className="store-orders__photos">{line.material.images.map((url, photo) => <MediaImage key={`${url}:${photo}`} src={resolveMediaUrl(url)} alt={`${line.name ?? 'Item'} quoted photo ${photo + 1}`} />)}</div>}
            </> : <p>Earlier material details were not recorded. Buyer review is required before accepting a pending request.</p>}
        </section>)}
    </details>;
}
