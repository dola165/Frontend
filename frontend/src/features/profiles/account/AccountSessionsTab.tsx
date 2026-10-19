import { Loader2, ShieldCheck } from 'lucide-react';
import { useAccountCopy } from './accountCopy';
import { Section, StatTile } from './AccountFields';
import { accountErrorText, btnPrimaryClass, btnSecondaryClass, fmt, insetClass, surfaceClass } from './accountModel';
import type { AccountCenter } from './useAccountCenter';

const sessionTone = (status: 'ACTIVE' | 'REVOKED' | 'EXPIRED') =>
    status === 'ACTIVE'
        ? 'bg-[var(--fc-accent-soft)] text-[var(--fc-accent)]'
        : status === 'REVOKED'
            ? 'bg-[var(--fc-state-warning-soft)] text-[var(--fc-state-warning)]'
            : 'bg-transparent text-[var(--fc-text-muted)]';

type SessionsProps = Pick<AccountCenter, 'sessions' | 'sessionsLoading' | 'sessionsError' | 'loadSessions' | 'revokingSessions' | 'revokeOtherSessions'> & {
    account: NonNullable<AccountCenter['account']>;
};

export const AccountSessionsTab = ({ account, sessions, sessionsLoading, sessionsError, loadSessions, revokingSessions, revokeOtherSessions }: SessionsProps) => {
    const copy = useAccountCopy();
    return (
        <Section
            title={copy("Remembered Sessions")}
            description={copy("Review active, revoked, and expired refresh sessions from one stream.")}
            actions={
                account.sessionRevocationSupported ? (
                    <button
                        type="button"
                        onClick={() => void revokeOtherSessions()}
                        disabled={revokingSessions || sessionsLoading}
                        className={btnPrimaryClass}
                    >
                        {revokingSessions ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        {copy("Sign Out Others")}
                    </button>
                ) : null
            }
        >
            {sessionsError && (
                <div role="alert" className="mb-4 rounded-xl border border-[color:var(--fc-state-danger)]/30 bg-[color:var(--fc-state-danger)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--fc-state-danger)]">
                    {accountErrorText(sessionsError, copy)}
                    <button type="button" className={`${btnSecondaryClass} ml-3`} disabled={sessionsLoading} onClick={() => void loadSessions()}>{copy("Retry sessions")}</button>
                </div>
            )}

            {!account.sessionsSupported ? (
                <div className={`${insetClass} px-4 py-4 text-sm text-[color:var(--fc-text-secondary)]`}>
                    {copy("Session inventory is not available for this account.")}
                </div>
            ) : sessionsLoading ? (
                <div role="status" aria-label={copy("Loading remembered sessions…")} className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[color:var(--fc-accent)]" />
                </div>
            ) : sessions ? (
                <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                        <StatTile label={copy("Active")} value={sessions?.activeCount ?? 0} />
                        <StatTile label={copy("Revoked")} value={sessions?.revokedCount ?? 0} />
                        <StatTile label={copy("Expired")} value={sessions?.expiredCount ?? 0} />
                    </div>

                    <div className={surfaceClass}>
                        {sessions?.sessions.length ? (
                            <div className="divide-y divide-[color:var(--fc-border)]">
                                {sessions.sessions.map((session) => (
                                    <article key={session.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-semibold text-[color:var(--fc-text-primary)]">
                                                    {session.current ? copy('Current Browser Session') : copy(`Remembered Session #${session.id}`, `შენახული სესია #${session.id}`)}
                                                </p>
                                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${sessionTone(session.status)}`}>
                                                    {copy(session.status)}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-[color:var(--fc-text-secondary)]">
                                                {fmt(session.expiresAt) ? copy(`Refresh access expires ${fmt(session.expiresAt)}.`, `სესიის ვადა იწურება: ${fmt(session.expiresAt)}.`) : copy("Expiry details are not available for this session.")}
                                            </p>
                                        </div>
                                        {session.current && (
                                            <span className="rounded-full border border-[color:var(--fc-accent-border)] bg-[color:var(--fc-accent-soft)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--fc-accent)]">
                                                {copy("Current")}
                                            </span>
                                        )}
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="px-5 py-10 text-sm text-[color:var(--fc-text-secondary)]">{copy("No remembered sessions are currently recorded for this account.")}</div>
                        )}
                    </div>
                </div>
            ) : null}
        </Section>
    );
};
