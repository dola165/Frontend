import { useEffect, useRef } from 'react';
import { appLanguage } from '../../utils/formatting';
import { TURNSTILE_SITE_KEY } from './turnstileConfig';

interface TurnstileApi {
    render: (element: HTMLElement, options: Record<string, unknown>) => string;
    remove: (widgetId: string) => void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | null = null;
/** Loads Cloudflare's script once, only on the pages that show the check. */
function loadTurnstile(): Promise<TurnstileApi> {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    loading ??= new Promise<TurnstileApi>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT;
        script.async = true;
        script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load')));
        script.onerror = () => { loading = null; reject(new Error('Turnstile did not load')); };
        document.head.appendChild(script);
    });
    return loading;
}

/**
 * Cloudflare Turnstile, the bot check the backend asks for at sign-up and when resending a confirmation link while
 * signed out (`turnstileToken`). Rendered only when `VITE_TURNSTILE_SITE_KEY` is set; mostly invisible. A token is
 * used once: remount it (a new `key`) after each attempt.
 */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
    const box = useRef<HTMLDivElement>(null);
    const report = useRef(onToken);
    useEffect(() => { report.current = onToken; }, [onToken]);
    useEffect(() => {
        let widget: string | null = null;
        let alive = true;
        void loadTurnstile().then(api => {
            if (!alive || !box.current) return;
            widget = api.render(box.current, {
                sitekey: TURNSTILE_SITE_KEY,
                language: appLanguage() === 'ka' ? 'ka' : 'en',
                theme: 'auto',
                callback: (token: string) => report.current(token),
                'expired-callback': () => report.current(null),
                'error-callback': () => report.current(null),
            });
        }).catch(() => report.current(null));
        return () => { alive = false; if (widget && window.turnstile) window.turnstile.remove(widget); };
    }, []);
    return <div ref={box} className="min-h-[65px]" />;
}
