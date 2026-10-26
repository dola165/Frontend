import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Loader2, ShieldQuestion, UserRoundCheck } from 'lucide-react';
import { approveParentApproval, fetchParentApprovalLink, type ParentApprovalLink } from '../api/parentApproval';
import { AuthCenterCard } from '../components/auth/AuthCenterCard';
import { authPrimaryButtonClass } from '../components/auth/authClasses';
import { extractApiErrorCode } from '../utils/apiError';

/**
 * The parent's link from the email (`/parent-approval?token=…`): who asked, and Approve in one tap. No sign-in needed;
 * the token is the permission, and only the child's name is shown. Ignoring it removes the account after 7 days.
 */
export function ParentApprovalPage() {
    const { t } = useTranslation();
    const token = useSearchParams()[0].get('token') ?? '';
    const [link, setLink] = useState<ParentApprovalLink | null | 'invalid'>(token ? null : 'invalid');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) return;
        let active = true;
        fetchParentApprovalLink(token).then(found => { if (active) setLink(found.status === 'REPLACED' ? 'invalid' : found); }).catch(() => { if (active) setLink('invalid'); });
        return () => { active = false; };
    }, [token]);

    const approve = async () => {
        if (busy || !link || link === 'invalid') return;
        setBusy(true); setError('');
        try { setLink(await approveParentApproval(token)); } catch (failure) {
            const code = extractApiErrorCode(failure);
            if (code === 'used_token' || code === 'expired_token' || code === 'invalid_token') setLink('invalid'); else setError(t('auth.parentApprove.failed'));
        } finally { setBusy(false); }
    };

    if (link === null) return <AuthCenterCard icon={<Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />} title={t('auth.parentApprove.title')} />;
    if (link === 'invalid') return <AuthCenterCard icon={<ShieldQuestion className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentApprove.invalid')} />;
    if (link.status === 'APPROVED') return <AuthCenterCard icon={<BadgeCheck className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentApprove.approved')} />;
    return <AuthCenterCard icon={<UserRoundCheck className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentApprove.title')}
        line={t('auth.parentApprove.line', { name: link.childName })}>
        <button type="button" className={authPrimaryButtonClass} disabled={busy} onClick={() => void approve()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : t('auth.parentApprove.approve')}
        </button>
        <p className="mt-4 text-center text-xs leading-5 text-[var(--color-secondary)]">{t('auth.parentApprove.ignore')}</p>
        {error && <p role="alert" className="mt-3 text-center text-sm font-semibold text-[color:var(--state-danger)]">{error}</p>}
    </AuthCenterCard>;
}
