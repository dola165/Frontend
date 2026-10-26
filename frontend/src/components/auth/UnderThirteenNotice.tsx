import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Send, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authPrimaryButtonClass } from './authClasses';

/**
 * Sign-up's answer to someone under 13: no account, a kind line, and one button that sends a parent the sign-up link
 * (the phone's share sheet, or the message copied where there is none). Nothing is stored about the child.
 */
export function UnderThirteenNotice() {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const share = async () => {
        const url = `${window.location.origin}/signup`;
        const text = t('auth.under13.shareText', { url });
        try {
            if (navigator.share) { await navigator.share({ title: 'GrassKickZ', text, url }); return; }
            await navigator.clipboard.writeText(text);
            setCopied(true);
        } catch { /* Closing the share sheet is not an error. */ }
    };
    return <div className="flex flex-col items-center gap-5 py-4 text-center" role="status">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-accent)]/12 text-[var(--color-accent)]"><UsersRound className="h-8 w-8" aria-hidden="true" /></span>
        <div className="space-y-2">
            <h2 className="text-xl font-semibold text-[var(--color-text)]">{t('auth.under13.title')}</h2>
            <p className="text-sm leading-6 text-[var(--color-secondary)]">{t('auth.under13.line')}</p>
        </div>
        <button type="button" className={authPrimaryButtonClass} onClick={() => void share()}>
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {copied ? t('auth.under13.copied') : t('auth.under13.share')}
        </button>
        <Link to="/" className="inline-flex min-h-11 items-center text-xs font-semibold app-text-action">{t('auth.under13.home')}</Link>
    </div>;
}
