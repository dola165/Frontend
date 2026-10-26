import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authFieldErrorClass, authGhostButtonClass, authInputClass, authInputErrorClass, authLabelClass, authPrimaryButtonClass } from './authClasses';
import type { ParentApprovalFlow } from './useParentApproval';

/**
 * The parent-email part of asking for approval: where the link went with Send again and "Use another email", or the
 * email field (with "Keep {email}" while changing it). The caller handles loading, a failed load and approval.
 */
export function ParentApprovalRequest({ flow }: { flow: ParentApprovalFlow }) {
    const { t } = useTranslation();
    const { request, sent, busy, email, fieldError, editing, error } = flow;
    const spinner = <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
    return <>
        {sent ? <div className="flex flex-col gap-3">
            <p role="status" className="border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 text-sm font-semibold">
                {t('auth.parentWait.sent', { email: request?.parentEmail })}
                <span className="mt-1 block text-xs font-normal text-[var(--color-secondary)]">{t('auth.parentWait.sentHint')}</span>
            </p>
            <button type="button" className={authPrimaryButtonClass} disabled={busy} onClick={() => void flow.send(request!.parentEmail!)}>{busy ? spinner : t('auth.parentWait.resend')}</button>
            <button type="button" className={authGhostButtonClass} onClick={flow.change}>{t('auth.parentWait.change')}</button>
        </div> : <form className="flex flex-col gap-3" onSubmit={flow.submit} noValidate>
            <label htmlFor="parent-email" className={authLabelClass}>{t('auth.parentWait.emailLabel')}</label>
            <input id="parent-email" type="email" autoComplete="off" value={email} onChange={event => flow.type(event.target.value)}
                className={fieldError ? authInputErrorClass : authInputClass} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? 'parent-email-error' : undefined} />
            {fieldError && <p id="parent-email-error" className={authFieldErrorClass}>{fieldError}</p>}
            <button type="submit" className={authPrimaryButtonClass} disabled={busy}>{busy ? spinner : t('auth.parentWait.send')}</button>
            {editing && request?.parentEmail && <button type="button" className={authGhostButtonClass} onClick={flow.keep}>{t('auth.parentWait.keep', { email: request.parentEmail })}</button>}
        </form>}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-[color:var(--state-danger)]">{error}</p>}
    </>;
}
