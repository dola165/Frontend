import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Building2, ClipboardCheck, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { MediaImage } from '../../../components/ui/MediaImage';
import { confirmSecurityNavigation } from '../../twoFactor/useSecurityNavigationGuard';
import { useAccountCopy } from './accountCopy';
import { btnPrimaryClass, btnSecondaryClass, labelClass, surfaceClass, type Account, type TryoutApp } from './accountModel';
import './account-copy.css';

export const AccountHeader = ({ account, profileHref, avatarPreview, initials, tryoutApps, showTryoutApps, onSecurity, onToggleTryouts }: {
    account: Account; profileHref: string; avatarPreview: string | null | undefined; initials: string;
    tryoutApps: TryoutApp[]; showTryoutApps: boolean; onSecurity: () => void; onToggleTryouts: () => void;
}) => {
    const copy = useAccountCopy();
    return (
        <header className="border-b border-[var(--fc-border)] pb-5">
            <Link
                to={profileHref}
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--fc-text-secondary)] transition-colors hover:text-[color:var(--fc-text-primary)]"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
                {copy("Back")}
            </Link>

            <div className="account-heading-layout mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--fc-accent)]">{copy("Account Center")}</p>
                    <h1 className="mt-2 text-3xl font-bold text-[color:var(--fc-text-primary)]">{copy("Account Settings")}</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--fc-text-secondary)]">
                        {copy("Identity, authentication, linked providers, and session controls — all in one place.")}
                    </p>

                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border-2 border-[var(--fc-border)] bg-[color:var(--fc-page-bg)] text-xl font-bold text-[color:var(--fc-text-primary)]">
                            {avatarPreview ? <MediaImage src={avatarPreview} alt={account.displayName} className="h-full w-full object-cover" /> : initials}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[color:var(--fc-text-primary)]">{account.displayName}</h2>
                            <p className="mt-1 text-sm text-[color:var(--fc-text-secondary)]">{account.email}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                                <span className={`rounded-full border px-2.5 py-1 ${
                                    account.emailVerified
                                        ? 'border-[color:var(--fc-accent-border)] bg-[color:var(--fc-accent-soft)] text-[color:var(--fc-accent)]'
                                        : 'border-[var(--fc-state-warning)]/30 bg-[color:var(--fc-state-warning-soft)] text-[color:var(--fc-state-warning)]'
                                }`}>
                                    {account.emailVerified ? copy("Email Verified") : copy("Verification Pending")}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <section className={`account-quick-actions account-quick-actions--copy ${surfaceClass} px-5 py-4`}>
                    <p className={labelClass}>{copy("Quick Actions")}</p>
                    <div className="mt-4 grid gap-2">
                        <Link to={profileHref} className="inline-flex items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-[color:var(--fc-page-bg)] px-3 py-2.5 text-xs font-semibold text-[color:var(--fc-text-primary)] transition-colors hover:bg-[color:var(--color-ink)]/[0.04]">
                            <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {copy("View Public Profile")}
                        </Link>
                        <button
                            type="button"
                            onClick={() => { if (confirmSecurityNavigation()) onSecurity(); }}
                            className={btnPrimaryClass + ' justify-center'}
                        >
                            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />{copy("Security Controls")}
                        </button>
                        <Link to="/world/tournaments?peek=draw-new" className="inline-flex items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-[color:var(--fc-page-bg)] px-3 py-2.5 text-xs font-semibold text-[color:var(--fc-text-primary)] transition-colors hover:bg-[color:var(--color-ink)]/[0.04]">
                            <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {copy("Tournament Setup")}
                        </Link>
                        <button
                            type="button"
                            onClick={onToggleTryouts}
                            className="inline-flex items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-[color:var(--fc-page-bg)] px-3 py-2.5 text-xs font-semibold text-[color:var(--fc-text-primary)] transition-colors hover:border-[color:var(--fc-accent)]"
                        >
                            <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden="true" />{copy(showTryoutApps ? 'Hide My Tryout Applications' : 'View My Tryout Applications')}
                            {tryoutApps.length > 0 && (
                                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border border-[color:var(--fc-accent-border)] bg-[color:var(--fc-accent-soft)] px-1.5 text-[10px] text-[color:var(--fc-accent)]">
                                    {tryoutApps.length}
                                </span>
                            )}
                        </button>
                        <Link to="/account/football" className={btnSecondaryClass}><BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />{copy("Your football profile")}</Link>
                        <Link to="/my-organizations" className={btnSecondaryClass}><Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />{copy("My organizations")}</Link>
                        {account.role === 'SYSTEM_ADMIN' && (
                            <Link to="/admin" className="inline-flex items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-[color:var(--fc-page-bg)] px-3 py-2.5 text-xs font-semibold text-[color:var(--fc-text-primary)] transition-colors hover:bg-[color:var(--color-ink)]/[0.04]">
                                {copy("Admin Panel")}
                            </Link>
                        )}
                    </div>
                </section>
            </div>
        </header>
    );
};
