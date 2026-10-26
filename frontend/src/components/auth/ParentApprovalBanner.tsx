import { useState } from 'react';
import { BadgeCheck, Loader2, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Dialog } from '../../design/Dialog';
import { appLocale } from '../../utils/formatting';
import { authPrimaryButtonClass } from './authClasses';
import { ParentApprovalRequest } from './ParentApprovalRequest';
import { useParentApproval } from './useParentApproval';

const HIDDEN = 'grasskickz.parent-banner-later';
const hiddenThisVisit = () => { try { return window.sessionStorage.getItem(HIDDEN) === '1'; } catch { return false; } };

/** The day the account starts waiting for a parent, as people say it ("26 November"). */
const dayOf = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(appLocale(), { day: 'numeric', month: 'long' });

function AskDialog({ due, onClose }: { due: string; onClose: () => void }) {
    const { t } = useTranslation();
    const { user, bootstrapSession } = useAuth();
    const flow = useParentApproval(user?.email);
    const approved = flow.request?.status === 'NOT_NEEDED';
    return <Dialog open size="sm" title={approved ? t('auth.parentBanner.approved') : t('auth.parentBanner.title')}
        description={approved ? undefined : t('auth.parentBanner.dialogLine', { date: dayOf(due) })}
        onClose={() => { if (approved) void bootstrapSession().catch(() => undefined); onClose(); }}>
        {approved ? <BadgeCheck className="mx-auto h-10 w-10 text-[var(--color-accent)]" aria-hidden="true" />
            : flow.request ? <ParentApprovalRequest flow={flow} />
            : flow.loadFailed ? <><p role="alert" className="text-sm">{t('auth.parentWait.loadFailed')}</p><button type="button" className={authPrimaryButtonClass} onClick={flow.retry}>{t('auth.register.retry')}</button></>
            : <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden="true" />}
    </Dialog>;
}

/**
 * A calm line under the header for a 13 to 15-year-old whose account was made before parents approved accounts:
 * "Ask your parent to approve your account by 26 November", with Ask my parent (the same parent-email flow as the
 * waiting page) and Later (for this visit). After the day, the account waits for the parent and the app shows that.
 */
export function ParentApprovalBanner() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [hidden, setHidden] = useState(hiddenThisVisit);
    const [asking, setAsking] = useState(false);
    const due = user?.accountState !== 'AWAITING_PARENT' ? user?.parentApprovalDueBy : null;
    if (!due || (hidden && !asking)) return null;
    const later = () => { setHidden(true); try { window.sessionStorage.setItem(HIDDEN, '1'); } catch { /* Shown again next time. */ } };
    return <>
        <div role="status" className="border-b border-[color:var(--color-border)]/10 bg-[color:var(--color-info)]/10">
            <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6">
                <UsersRound className="h-4 w-4 shrink-0 text-[color:var(--color-info)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[var(--color-text)]">{t('auth.parentBanner.line', { date: dayOf(due) })}</span>
                <button type="button" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold app-text-action" onClick={() => setAsking(true)}>{t('auth.parentBanner.ask')}</button>
                <button type="button" className="inline-flex min-h-11 items-center px-3 text-sm text-[var(--color-secondary)] hover:text-[var(--color-text)]" onClick={later}>{t('auth.parentBanner.later')}</button>
            </div>
        </div>
        {asking && <AskDialog due={due} onClose={() => setAsking(false)} />}
    </>;
}
