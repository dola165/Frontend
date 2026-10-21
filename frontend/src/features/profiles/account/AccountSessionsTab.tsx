import { Loader2, LogOut, MonitorSmartphone, ShieldCheck } from 'lucide-react';
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

type SessionsProps = Pick<AccountCenter, 'sessions' | 'sessionsLoading' | 'sessionsError' | 'loadSessions' | 'revokingSessions' | 'revokeOtherSessions' | 'endingSessionId' | 'endSession'> & {
    account: NonNullable<AccountCenter['account']>;
};

const UNKNOWN_DEVICE = 'Unknown device';

export const AccountSessionsTab = ({ account, sessions, sessionsLoading, sessionsError, loadSessions, revokingSessions, revokeOtherSessions, endingSessionId, endSession }: SessionsProps) => {
    const copy = useAccountCopy();
    return (
        <Section
            title={copy("Signed-in devices")}
            description={copy("Every browser and app signed in to your account. Sign out any you do not recognise, then change your password.")}
            actions={
                account.sessionRevocationSupported ? (
                    <button
                        type="button"
                        onClick={() => void revokeOtherSessions()}
                        disabled={revokingSessions || sessionsLoading || endingSessionId !== null}
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
                        <StatTile label={copy("Active")} value={sessions.activeCount ?? 0} />
                        <StatTile label={copy("Ended")} value={sessions.revokedCount ?? 0} />
                        <StatTile label={copy("Expired")} value={sessions.expiredCount ?? 0} />
                    </div>

                    <div className={surfaceClass}>
                        {sessions.sessions.length ? (
                            <ul className="divide-y divide-[color:var(--fc-border)]" aria-label={copy("Signed-in devices")}>
                                {sessions.sessions.map((session) => {
                                    // Servers from before device names send none; keep their labels.
                                    const device = !session.deviceName
                                        ? session.current ? copy('Current Browser Session') : copy(`Remembered Session #${session.id}`, `შენახული სესია #${session.id}`)
                                        : session.deviceName === UNKNOWN_DEVICE ? copy(UNKNOWN_DEVICE) : session.deviceName;
                                    const signedIn = fmt(session.createdAt);
                                    const lastUsed = fmt(session.lastUsedAt);
                                    return (
                                        <li key={session.id}>
                                            <article className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <MonitorSmartphone aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--fc-text-muted)]" />
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="break-words text-sm font-semibold text-[color:var(--fc-text-primary)]">{device}</p>
                                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${sessionTone(session.status)}`}>
                                                            {copy(session.status)}
                                                        </span>
                                                        {session.current && (
                                                            <span className="rounded-full border border-[color:var(--fc-accent-border)] bg-[color:var(--fc-accent-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--fc-accent)]">
                                                                {session.deviceName ? copy("This device") : copy("Current")}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-sm leading-6 text-[color:var(--fc-text-secondary)]">
                                                        {!signedIn && !lastUsed
                                                            ? fmt(session.expiresAt) ? copy(`Refresh access expires ${fmt(session.expiresAt)}.`, `სესიის ვადა იწურება: ${fmt(session.expiresAt)}.`) : copy("Expiry details are not available for this session.")
                                                            : [
                                                            session.place,
                                                            signedIn ? copy(`Signed in ${signedIn}`, `შესვლა: ${signedIn}`) : null,
                                                            lastUsed ? copy(`Last active ${lastUsed}`, `ბოლო აქტივობა: ${lastUsed}`) : null,
                                                        ].filter(Boolean).join(' · ')}
                                                    </p>
                                                </div>
                                            </div>
                                            {!session.current && session.status === 'ACTIVE' && account.sessionRevocationSupported && (
                                                <button
                                                    type="button"
                                                    className={`${btnSecondaryClass} min-h-11 self-start md:self-center`}
                                                    disabled={endingSessionId !== null || revokingSessions}
                                                    aria-label={copy(`Sign out ${device}`, `გამოსვლა: ${device}`)}
                                                    onClick={() => void endSession(session.id)}
                                                >
                                                    {endingSessionId === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                                                    {copy("Sign out")}
                                                </button>
                                            )}
                                            </article>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="px-5 py-10 text-sm text-[color:var(--fc-text-secondary)]">{copy("No remembered sessions are currently recorded for this account.")}</div>
                        )}
                    </div>
                </div>
            ) : null}
        </Section>
    );
};
