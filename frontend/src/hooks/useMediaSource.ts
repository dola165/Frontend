import { useEffect, useState, useSyncExternalStore } from 'react';
import { DEPLOYMENT_URLS } from '../api/axiosConfig';
import { getAuthSessionId, getStoredAccessToken } from '../utils/authStorage';
import { acquireMedia } from './mediaRequestPool';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { isAndroidApp } from '../android/bridge';

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
    const session = useSyncExternalStore(subscribe, getAuthSessionId, () => null);
    const protectedUrl = protectedMediaUrl(source);
    // The account-scoped WebView already intercepts local /uploads/ requests
    // with native credentials. Loading them directly avoids sending every
    // image through JSON/base64 and creating another copy in JavaScript.
    const nativeMedia = isAndroidApp && protectedUrl !== undefined &&
        new URL(protectedUrl).origin === window.location.origin &&
        new URL(protectedUrl).pathname.startsWith('/uploads/');
    const key = `${protectedUrl ?? ''}\n${session ?? ''}\n${token ?? ''}`;
    const [loaded, setLoaded] = useState<{ key: string; url: string; signal: AbortSignal }>();
    useEffect(() => {
        if (!protectedUrl || !enabled || nativeMedia) return;
        const controller = new AbortController();
        const request = acquireMedia(key, protectedUrl);
        void request.promise
            .then(objectUrl => {
                if (controller.signal.aborted) return;
                setLoaded({ key, url: objectUrl, signal: controller.signal });
            }).catch(() => {
                if (!controller.signal.aborted) setLoaded({ key, url: 'data:image/png;base64,invalid', signal: controller.signal });
            });
        return () => {
            controller.abort();
            request.release();
        };
    }, [protectedUrl, key, enabled, nativeMedia]);
    // The same source can recur after cleanup; only its still-live load owns usable bytes.
    if (nativeMedia) return enabled ? protectedUrl : undefined;
    return protectedUrl ? enabled && loaded?.key === key && !loaded.signal.aborted ? loaded.url : undefined : source;
};
