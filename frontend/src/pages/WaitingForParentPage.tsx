import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Hourglass, Loader2, MailCheck } from 'lucide-react';
import { AuthCenterCard } from '../components/auth/AuthCenterCard';
import { authPrimaryButtonClass } from '../components/auth/authClasses';
import { ParentApprovalRequest } from '../components/auth/ParentApprovalRequest';
import { useParentApproval } from '../components/auth/useParentApproval';
import { useAuth } from '../context/AuthContext';
import { completedAuthDestination, getAuthFlow } from '../utils/authRedirect';

/**
 * "Waiting for your parent": a 13 to 15-year-old's account after sign-up, until a parent approves it with one tap.
 * It shows where the request went with Send again, or asks for the parent's email (a corrected one, or when staff
 * asked for a parent). The answer is checked again whenever the page comes back into view. Nothing else answers the
 * account meanwhile, so the only other way out is signing out.
 */
export function WaitingForParentPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, bootstrapSession, logout } = useAuth();
    const flow = useParentApproval(user?.email);
    const enter = async () => {
        const fresh = await bootstrapSession().catch(() => null);
        navigate(completedAuthDestination(fresh ?? user ?? {}, getAuthFlow().nextPath, getAuthFlow().newAccount), { replace: true });
    };

    if (!flow.request && flow.loadFailed) return <AuthCenterCard icon={<Hourglass className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentWait.title')} line={t('auth.parentWait.loadFailed')}>
        <button type="button" className={authPrimaryButtonClass} onClick={flow.retry}>{t('auth.register.retry')}</button>
    </AuthCenterCard>;
    if (!flow.request) return <AuthCenterCard icon={<Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />} title={t('auth.parentWait.title')} />;
    if (flow.request.status === 'NOT_NEEDED') return <AuthCenterCard icon={<BadgeCheck className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentWait.approved')}>
        <button type="button" className={authPrimaryButtonClass} onClick={() => void enter()}>{t('auth.parentWait.continue')}</button>
    </AuthCenterCard>;
    return <AuthCenterCard icon={flow.sent ? <MailCheck className="h-8 w-8" aria-hidden="true" /> : <Hourglass className="h-8 w-8" aria-hidden="true" />} title={t('auth.parentWait.title')} line={t('auth.parentWait.line')}>
        <ParentApprovalRequest flow={flow} />
        <div className="mt-6 flex justify-end border-t border-[color:var(--color-border)]/10 pt-4 text-xs font-semibold">
            <button type="button" className="min-h-11 px-2 text-[var(--color-secondary)] hover:text-[var(--color-text)]" onClick={() => void logout().then(() => navigate('/login', { replace: true }))}>{t('auth.parentWait.signOut')}</button>
        </div>
    </AuthCenterCard>;
}
