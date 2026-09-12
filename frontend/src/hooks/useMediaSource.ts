import { useEffect, useState, useSyncExternalStore } from 'react';
import { apiClient, DEPLOYMENT_URLS } from '../api/axiosConfig';
import { getStoredAccessToken } from '../utils/authStorage';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

const subscribe = (listener: () => void) => {
    window.addEventListener('gk-auth-changed', listener);
    window.addEventListener('storage', listener);
    return () => {
        window.removeEventListener('gk-auth-changed', listener);
        window.removeEventListener('storage', listener);
    };
};

// Only the configured media service receives credentials. External images never do.
export const protectedMediaUrl = (source?: string) => {
    if (!source) return undefined;
    try {
        const root = new URL(DEPLOYMENT_URLS.mediaBaseUrl, window.location.origin);
        const url = new URL(source.startsWith('/uploads/') ? resolveMediaUrl(source)! : source, window.location.origin);
        const prefix = root.pathname.replace(/\/$/, '') + '/uploads/';
        return url.origin === root.origin && url.pathname.startsWith(prefix) && !url.username && !url.password ? url.href : undefined;
    } catch { return undefined; }
};

export const useMediaSource = (source?: string, enabled = true) => {
    const token = useSyncExternalStore(subscribe, getStoredAccessToken, () => null);
    const protectedUrl = protectedMediaUrl(source);
    const key = `${protectedUrl ?? ''}\n${token ?? ''}`;
    const [loaded, setLoaded] = useState<{ key: string; url: string; signal: AbortSignal }>();
    useEffect(() => {
        if (!protectedUrl || !enabled) return;
        const controller = new AbortController();
        let objectUrl: string | undefined;
        void apiClient.get<Blob>(protectedUrl, { responseType: 'blob', signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } })
            .then(response => {
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(response.data);
                setLoaded({ key, url: objectUrl, signal: controller.signal });
            }).catch(() => {
                if (!controller.signal.aborted) setLoaded({ key, url: 'data:image/png;base64,invalid', signal: controller.signal });
            });
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [protectedUrl, key, enabled]);
    // The same source can recur after cleanup; only its still-live load owns usable bytes.
    return protectedUrl ? enabled && loaded?.key === key && !loaded.signal.aborted ? loaded.url : undefined : source;
};
