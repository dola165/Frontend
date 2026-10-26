import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Loader2, ShieldQuestion, UserRoundCheck } from 'lucide-react';
import { answerParentApproval, fetchParentApprovalLink, type ParentApprovalLink } from '../api/parentApproval';
import { AuthCenterCard } from '../components/auth/AuthCenterCard';
import { authGhostButtonClass, authPrimaryButtonClass } from '../components/auth/authClasses';

/**
 * The parent's link from the email (`/parent-approval?token=…`): who asked, Approve in one tap, or "This isn't my
 * child". No sign-in needed; the token is the permission. Only the first name and age are shown.
 */
export function ParentApprovalPage() {
    const { t } = useTranslation();
    const token = useSearchParams()[0].get('token') ?? '';
    const [link, setLink] = useState<ParentApprovalLink | null | 'invalid'>(token ? null : 'invalid');
    const [answer, setAnswer] = useState<'approve' | 'decline' | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();
        fetchParentApprovalLink(token, controller.signal).then(setLink).catch(() => { if (!controller.signal.aborted) setLink('invalid'); });
        return () => controller.abort();
    }, [token]);

    const reply = async (value: 'approve' | 'decline') => {
        if (busy) return;
        setBusy(true); setError('');
        try { await answerParentApproval(token, value); setAnswer(value); } catch { setError(t('auth.parentApprove.failed')); } finally { setBusy(false); }
    };

    if (link === null) return <AuthCenterCard icon={<Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />} title={t('auth.parentApprove.title')} />;
    if (link === 'invalid') return <AuthCenterCard icon={<ShieldQuestion className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentApprove.invalid')} />;
    if (answer) return <AuthCenterCard icon={<BadgeCheck className="h-8 w-8" aria-hidden="true" />} title={answer === 'approve' ? t('auth.parentApprove.approved') : t('auth.parentApprove.declined')} />;
    return <AuthCenterCard icon={<UserRoundCheck className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentApprove.title')}
        line={t('auth.parentApprove.line', { name: link.childName, age: link.childAge })}>
        <button type="button" className={authPrimaryButtonClass} disabled={busy} onClick={() => void reply('approve')}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : t('auth.parentApprove.approve')}
        </button>
        <button type="button" className={authGhostButtonClass} disabled={busy} onClick={() => void reply('decline')}>{t('auth.parentApprove.decline')}</button>
        {error && <p role="alert" className="mt-3 text-center text-sm font-semibold text-[color:var(--state-danger)]">{error}</p>}
    </AuthCenterCard>;
}
