import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/axiosConfig';
import { getCroppedImg, prepareCropSource, type PixelCrop } from '../utils/cropImageHelper';
import { extractApiErrorMessage } from '../utils/apiError';

type Kind = 'avatar' | 'logo' | 'banner';
export function useIdentityImageEditor(onSave: (kind: Kind, url: string) => Promise<void>, scopeKey = '') {
    const [source, setSource] = useState<{ imageUrl: string; type: Kind; scopeKey: string } | null>(null);
    const [uploading, setUploading] = useState<Kind | null>(null);
    const [error, setError] = useState('');
    const activeUrl = useRef<string | null>(null);
    const generation = useRef(0);
    const pending = useRef(false);
    useEffect(() => () => { generation.current++; pending.current = false; if (activeUrl.current) URL.revokeObjectURL(activeUrl.current); activeUrl.current = null; }, [scopeKey]);
    const close = () => {
        if (pending.current) return;
        generation.current++;
        if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
        activeUrl.current = null;
        setSource(null);
    };
    const select = async (file: File | undefined, type: Kind) => {
        if (!file || pending.current) return;
        const version = ++generation.current;
        setError('');
        try {
            const imageUrl = await prepareCropSource(file);
            if (version !== generation.current) { URL.revokeObjectURL(imageUrl); return; }
            if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
            activeUrl.current = imageUrl;
            setSource({ imageUrl, type, scopeKey });
        } catch (failure) { if (version === generation.current) setError(extractApiErrorMessage(failure, failure instanceof Error ? failure.message : 'This photo could not be opened.')); }
    };
    const save = async (crop: PixelCrop) => {
        if (!source || source.scopeKey !== scopeKey || pending.current) return;
        const version = generation.current;
        pending.current = true;
        setUploading(source.type);
        setError('');
        try {
            const file = await getCroppedImg(source.imageUrl, crop, `${source.type}.jpg`, source.type === 'banner' ? 1920 : 800);
            if (version !== generation.current) return;
            const body = new FormData();
            body.append('file', file);
            const response = await apiClient.post<{ url: string }>('/media/upload', body, { params: { context: source.type === 'avatar' ? 'profile' : source.type } });
            if (version !== generation.current) return;
            if (!response.data?.url) throw new Error('The upload did not return a photo. Please try again.');
            await onSave(source.type, response.data.url);
            if (version !== generation.current) return;
            URL.revokeObjectURL(source.imageUrl);
            activeUrl.current = null;
            setSource(null);
        } catch (failure) { if (version === generation.current) setError(extractApiErrorMessage(failure, failure instanceof Error ? failure.message : 'The photo could not be saved. Your crop is still here; please try again.')); }
        finally { if (version === generation.current) { pending.current = false; setUploading(null); } }
    };
    return { source: source?.scopeKey === scopeKey ? source : null, uploading: source?.scopeKey === scopeKey ? uploading : null, error, select, close, save };
}
