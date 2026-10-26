import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { appLanguage } from '../../utils/formatting';
import { TURNSTILE_SITE_KEY } from './turnstileConfig';
import type { BotCheck } from './useBotCheck';

interface TurnstileApi {
    render: (element: HTMLElement, options: Record<string, unknown>) => string;
    remove: (widgetId: string) => void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | null = null;
/** Loads Cloudflare's script once, only on the pages that show the check; a failed load can be tried again. */
function loadTurnstile(): Promise<TurnstileApi> {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    loading ??= new Promise<TurnstileApi>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT;
        script.async = true;
        script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load')));
        script.onerror = () => { loading = null; script.remove(); reject(new Error('Turnstile did not load')); };
        document.head.appendChild(script);
    });
    return loading;
}

function Widget({ check }: { check: BotCheck }) {
    const box = useRef<HTMLDivElement>(null);
    const latest = useRef(check);
    useEffect(() => { latest.current = check; }, [check]);
    useEffect(() => {
        let widget: string | null = null;
        let alive = true;
        void loadTurnstile().then(api => {
            if (!alive || !box.current) return;
            widget = api.render(box.current, {
                sitekey: TURNSTILE_SITE_KEY,
                language: appLanguage() === 'ka' ? 'ka' : 'en',
                theme: 'auto',
                callback: (token: string) => latest.current.onToken(token),
                'expired-callback': () => latest.current.onToken(null),
                'error-callback': () => latest.current.onError(),
            });
        }).catch(() => { if (alive) latest.current.onError(); });
        return () => { alive = false; if (widget && window.turnstile) window.turnstile.remove(widget); };
    }, []);
    return <div ref={box} className="min-h-[65px]" />;
}

/**
 * Cloudflare Turnstile, the bot check the backend asks for at sign-up and when resending a confirmation link while
 * signed out (`turnstileToken`). Shown only when `VITE_TURNSTILE_SITE_KEY` is set. When it cannot load or run, the form
 * says so with Retry instead of waiting silently.
 */
export function Turnstile({ check }: { check: BotCheck }) {
    const { t } = useTranslation();
    if (!check.enabled) return null;
    if (check.failed) return <p role="alert" className="flex flex-wrap items-center justify-between gap-2 border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--state-danger)]">
        <span>{t('auth.register.botUnavailable')}</span>
        <button type="button" onClick={check.renew} className="inline-flex min-h-11 items-center gap-1.5 px-3 text-xs font-semibold text-[var(--color-text)]"><RefreshCw className="h-4 w-4" aria-hidden="true" />{t('auth.register.retry')}</button>
    </p>;
    return <Widget key={check.round} check={check} />;
}
