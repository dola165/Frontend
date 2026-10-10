import type { Dispatch, SetStateAction } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { MediaImage } from '../../../components/ui/MediaImage';
import { Button } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';

export const MAX_PHOTOS = 8;

/**
 * Photos for a product or campaign; the first is the cover. The upload state lives in the draft, so a
 * photo that is still uploading lands in the same draft after the person leaves and comes back.
 */
export function PhotoField({ noun, context, images, setImages, setUploading, setUploadError, hint }: {
    noun: 'product' | 'campaign'; context: string; images: string[]; setImages: Dispatch<SetStateAction<string[]>>;
    setUploading: (value: boolean) => void; setUploadError: (value: string) => void; hint: string;
}) {
    const Noun = noun === 'product' ? 'Product' : 'Campaign';
    const upload = async (element: HTMLInputElement) => {
        const file = element.files?.[0];
        if (!file) return;
        setUploading(true); setUploadError('');
        try {
            const data = new FormData(); data.append('file', file);
            const response = await apiClient.post<{ url: string }>('/media/upload', data, { params: { context } });
            setImages(current => [...current, response.data.url]);
        } catch (error) { setUploadError(extractApiErrorMessage(error, 'Photo upload failed. Please try again.')); }
        finally { setUploading(false); element.value = ''; }
    };
    return <div className="cm-photos">
        {images.length > 0 && <ul className="cm-photos__grid">{images.map((url, index) => <li key={`${url}-${index}`} className="cm-photo">
            <MediaImage src={resolveMediaUrl(url)} alt={`${Noun} photo ${index + 1}`} />
            <span className="cm-photo__foot"><span>{index === 0 ? 'Cover' : `Photo ${index + 1}`}</span>
                <Button size="sm" variant="ghost" iconOnly aria-label={`Remove photo ${index + 1}`} onClick={() => setImages(current => current.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" /></Button></span>
        </li>)}</ul>}
        {images.length < MAX_PHOTOS && <label className="gk-btn gk-btn--secondary cm-upload">
            <ImagePlus aria-hidden="true" />{`Add ${noun} photo (up to ${MAX_PHOTOS})`}
            <input type="file" accept="image/*" className="gk-visually-hidden" onChange={event => void upload(event.currentTarget)} />
        </label>}
        <p className="cm-hint">{hint} {images.length} of {MAX_PHOTOS} photos added.</p>
    </div>;
}
