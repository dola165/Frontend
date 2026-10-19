import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PlayerCard } from '../../clubs/api';
import { confirmSecurityNavigation } from '../../twoFactor/useSecurityNavigationGuard';
import { todayIso } from '../../../utils/age';
import { surfaceClass } from './accountModel';
import type { PlayerCardActivation } from './usePlayerCardActivation';

/** Linked kids — claimed Player Cards (WEB_APP_MASTER_PLAN.md §2.2) */
export const LinkedPlayerCards = ({ cards, onActivate }: { cards: PlayerCard[]; onActivate: (card: PlayerCard) => void }) => {
    const { t } = useTranslation();
    return (
        <section className={`${surfaceClass} px-5 py-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--fc-text-muted)]">{t('minors.account.linkedKids')}</p>
                <h3 className="mt-1 text-base font-semibold text-[color:var(--fc-text-primary)]">{t('minors.account.yourCards')}</h3>
                </div>
                <Link to="/parent" onClick={(event) => { if (!confirmSecurityNavigation()) event.preventDefault(); }}
                    className="rounded-xl border border-[var(--fc-border)] px-4 py-2 text-sm font-semibold text-[color:var(--fc-accent)] hover:bg-[color:var(--fc-accent-soft)]">
                    {t('nav.parentHub', 'Parent Hub')}
                </Link>
            </div>
            <div className="mt-4 grid gap-2">
                {cards.map((card) => (
                    <div key={card.id} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--fc-border)] bg-[color:var(--fc-page-bg)] px-4 py-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-[color:var(--fc-text-primary)]">{card.fullName}</p>
                            <p className="text-xs text-[color:var(--fc-text-secondary)]">
                                {t('minors.account.born', { year: card.birthYear })}
                                {card.registered ? t('minors.account.accountActive') : t('minors.account.awaitingActivation')}
                            </p>
                        </div>
                        {!card.registered && card.birthYear != null
                            && new Date().getFullYear() - card.birthYear >= 13
                            && new Date().getFullYear() - card.birthYear < 18 && (
                            <button
                                type="button"
                                onClick={() => onActivate(card)}
                                className="shrink-0 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
                            >
                                {t('minors.account.activate')}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
};

/** Activation modal (guardian) */
export const PlayerCardActivationDialog = ({ card, activation }: { card: PlayerCard; activation: PlayerCardActivation }) => {
    const { t } = useTranslation();
    const { childDob, setChildDob, childEmail, setChildEmail, activationCreds, activationError, activating, submitActivation } = activation;
    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center">
            <div
                className="theme-overlay absolute inset-0"
                onClick={activation.close}
            />
            <div className="relative z-10 mx-4 w-full max-w-md border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] shadow-2xl">
                <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-5 py-4">
                    <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('minors.account.activateTitle', { name: card.fullName })}</h2>
                    <button
                        type="button"
                        onClick={activation.close}
                        className="text-[var(--color-secondary)] hover:text-[var(--color-text)]"
                    >
                        ✕
                    </button>
                </div>
                <div className="px-5 py-5">
                    {activationCreds ? (
                        <div className="flex flex-col gap-3">
                            <p className="text-[11px] font-semibold text-[color:var(--state-danger)]">
                                Email verification is required before sign-in.
                            </p>
                            <p role="status">Invitation sent to {activationCreds.email}. The recipient must verify their mailbox and use the password setup link sent there. Their player identity and club participation consent stay separate.</p>
                            <button
                                type="button"
                                onClick={activation.finish}
                                className="mt-2 border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-on-accent)]"
                            >
                                {t('minors.account.done')}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={submitActivation} className="flex flex-col gap-4">
                            {activationError && (
                                <div className="border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--state-danger)]">
                                    {activationError}
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold text-[var(--color-secondary)]">{t('minors.consent.childDob')}</label>
                                <input type="date" value={childDob} max={todayIso()} onChange={(e) => setChildDob(e.target.value)} required
                                    className="theme-surface-strong theme-border w-full border px-3 py-2 text-sm font-semibold text-[var(--color-text)] focus:border-[var(--color-accent)] outline-none" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold text-[var(--color-secondary)]">{t('minors.consent.childEmail')}</label>
                                <input type="email" value={childEmail} onChange={(e) => setChildEmail(e.target.value)} required
                                    className="theme-surface-strong theme-border w-full border px-3 py-2 text-sm font-semibold text-[var(--color-text)] focus:border-[var(--color-accent)] outline-none" placeholder={t('minors.consent.emailPlaceholder')} />
                            </div>
                            <button type="submit" disabled={activating}
                                className="inline-flex items-center justify-center border border-[var(--color-accent)] bg-[var(--color-accent)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-on-accent)] disabled:opacity-50">
                                {activating ? t('minors.account.activating') : t('minors.account.activateAccount')}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
