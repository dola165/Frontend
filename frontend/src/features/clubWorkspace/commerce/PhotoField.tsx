import { ct, useCommerceCopy } from '../../store/copy';
import { useRef, type Dispatch, type SetStateAction } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { MediaImage } from '../../../components/ui/MediaImage';
import { Button } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { assertCurrentAuthSession, getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import './commerce.css';

export const MAX_PHOTOS = 8;

/**
 * Photos for a product or campaign; the first is the cover. The upload state lives in the draft, so a
 * photo that is still uploading lands in the same draft after the person leaves and comes back.
 */
export function PhotoField({ noun, context, images, setImages, uploading, setUploading, setUploadError, hint }: {
    noun: 'product' | 'campaign'; context: string; images: string[]; setImages: Dispatch<SetStateAction<string[]>>;
    uploading: boolean; setUploading: (value: boolean) => void; setUploadError: (value: string) => void; hint: string;
}) {
    useCommerceCopy();
    const pending = useRef(false);
    const Noun = noun === 'product' ? ct("Product") : ct("Campaign");
    const upload = async (element: HTMLInputElement) => {
        const file = element.files?.[0];
        if (!file || pending.current || uploading || images.length >= MAX_PHOTOS) return;
        pending.current = true;
        const session = getAuthSessionId();
        setUploading(true); setUploadError('');
        try {
            const data = new FormData(); data.append('file', file);
            const response = await apiClient.post<{ url: string }>('/media/upload', data, { params: { context } });
            assertCurrentAuthSession(session);
            setImages(current => current.length < MAX_PHOTOS ? [...current, response.data.url] : current);
        } catch (error) { if (isCurrentAuthSession(session)) setUploadError(extractApiErrorMessage(error, ct("Photo upload failed. Please try again."))); }
        finally { pending.current = false; setUploading(false); element.value = ''; }
    };
    return <div className="cm-photos">
        {images.length > 0 && <ul className="cm-photos__grid">{images.map((url, index) => <li key={`${url}-${index}`} className="cm-photo">
            <MediaImage src={resolveMediaUrl(url)} alt={`${Noun} ${ct('Photo {v0}', { v0: index + 1 }).toLocaleLowerCase()}`} />
            <span className="cm-photo__foot"><span>{index === 0 ? ct("Cover") : ct("Photo {v0}", { v0: index + 1 })}</span>
                <Button size="sm" variant="ghost" iconOnly disabled={uploading} aria-label={ct("Remove photo {v0}", { v0: index + 1 })} onClick={() => { if (!pending.current && !uploading) setImages(current => current.filter((_, i) => i !== index)); }}><Trash2 aria-hidden="true" /></Button></span>
        </li>)}</ul>}
        {images.length < MAX_PHOTOS && <label className="gk-btn gk-btn--secondary cm-upload">
            <ImagePlus aria-hidden="true" />{ct("Add {v0} photo (up to {v1})", { v0: ct(noun), v1: MAX_PHOTOS })}
            <input type="file" accept="image/*" disabled={uploading} className="gk-visually-hidden" onChange={event => void upload(event.currentTarget)} />
        </label>}
        <p className="cm-hint">{hint} {ct('Photos added: {count} of {limit}', { count: images.length, limit: MAX_PHOTOS })}</p>
    </div>;
}
