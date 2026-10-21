import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { MediaImage } from '../../components/ui/MediaImage';
import { apiClient } from '../../api/axiosConfig';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import './journey/journey.css';

/** A photo of a place, so families recognise the meeting point or ground when they arrive. */
export function PlacePhoto({ url, name }: { url?: string | null; name: string }) {
    const [failed, setFailed] = useState<string | null>(null);
    if (!url || failed === url) return null;
    return <MediaImage className="gk-place-photo" src={url} alt={name} loading="lazy" onError={() => setFailed(url)} />;
}

/** Adds, replaces or removes a place's photo (up to 5 MB). It is shared when the plan is published. */
export function PlacePhotoEditor({ url, name, onChange }: { url?: string | null; name: string; onChange: (url: string | null) => void }) {
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const latest = useRef(onChange), controller = useRef<AbortController | null>(null);
    const inputId = useId();
    useEffect(() => { latest.current = onChange; }, [onChange]);
    useEffect(() => () => controller.current?.abort(), []);
    const upload = async (file: File) => {
        if (busy) return;
        if (file.size > 5 * 1024 * 1024) { setError('Choose a photo up to 5 MB.'); return; }
        const request = new AbortController(); controller.current = request;
        setBusy(true); setError('');
        try {
            const form = new FormData(); form.append('file', file); form.append('context', 'general');
            const { data } = await apiClient.post<{ url: string }>('/media/upload', form, { signal: request.signal });
            if (!request.signal.aborted) latest.current(data.url);
        } catch (cause) {
            if (!request.signal.aborted) setError(extractApiErrorMessage(cause, 'The photo could not upload. Try again.'));
        } finally {
            if (!request.signal.aborted) setBusy(false);
        }
    };
    return (
        <div className="gk-place-photo-editor">
            <PlacePhoto url={url} name={name} />
            <div className="gk-row">
                <label className="gk-btn gk-btn--secondary gk-btn--sm" htmlFor={inputId}><ImagePlus aria-hidden="true" />{busy ? 'Uploading…' : url ? 'Replace photo' : 'Add a photo of the place'}</label>
                <input id={inputId} className="gk-visually-hidden" aria-label={`Photo for ${name}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
                    onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} />
                {url && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onChange(null)}><X aria-hidden="true" />Remove photo</Button>}
            </div>
            {error && <p className="gk-field__error" role="alert">{error}</p>}
        </div>
    );
}
