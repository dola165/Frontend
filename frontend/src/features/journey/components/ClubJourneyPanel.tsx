import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Check, ExternalLink, Loader2, Mail, ShieldAlert, X } from 'lucide-react';
import {
    acceptClubInvitation,
    cancelClubApplication,
    declineClubInvitation,
    fetchClubJourney,
} from '../../clubs/api';
import type { ClubJourney } from '../../clubs/domain';
import { extractApiErrorMessage } from '../../../utils/apiError';

/**
 * Phase A4 — the player's club journey: applications, invitations, tryouts,
 * affiliations, and recent decisions in one place. CTAs (cancel application,
 * accept/decline invite) act and refresh the panel.
 */
export const ClubJourneyPanel = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [journey, setJourney] = useState<ClubJourney | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setJourney(await fetchClubJourney());
        } catch (err) {
            setError(extractApiErrorMessage(err, 'Failed to load your club journey.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const runAction = async (key: string, action: () => Promise<unknown>) => {
        setBusyKey(key);
        setError(null);
        try {
            await action();
            await load();
        } catch (err) {
            setError(extractApiErrorMessage(err, 'Request failed.'));
        } finally {
            setBusyKey(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#16a34a]" />
            </div>
        );
    }

    if (error && !journey) {
        return (
            <div className="py-6 text-center">
                <p className="text-sm text-[var(--fc-state-danger)]">{error}</p>
                <button type="button" onClick={() => void load()} className="mt-2 text-xs font-semibold text-[var(--fc-accent)] hover:underline">
                    {t('journey.retry')}
                </button>
            </div>
        );
    }

    if (!journey) return null;

    const trialists = journey.affiliations.filter((a) => a.status === 'TRIALIST');
    const members = journey.affiliations.filter((a) => a.status === 'ACTIVE');
    const notAccepted = journey.recentDecisions.filter((d) => d.status === 'DECLINED' || d.status === 'REJECTED');

    const pills = [
        { label: t('journey.pillApplied'), count: journey.applications.filter((a) => a.status === 'PENDING').length, tone: 'info' },
        { label: t('journey.pillInvited'), count: journey.invitations.length, tone: 'info' },
        { label: t('journey.pillOnTrial'), count: trialists.length, tone: 'warning' },
        { label: t('journey.pillMember'), count: members.length, tone: 'success' },
        { label: t('journey.pillNotAccepted'), count: notAccepted.length, tone: 'neutral' },
    ];

    const hasActivity = journey.applications.length > 0 || journey.invitations.length > 0
        || journey.tryouts.length > 0 || journey.affiliations.length > 0 || journey.recentDecisions.length > 0;

    return (
        <div className="flex flex-col gap-4">
            {error && <p className="text-xs text-[var(--fc-state-danger)]">{error}</p>}

            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5">
                {pills.map((pill) => (
                    <span
                        key={pill.label}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                            pill.tone === 'success' ? 'border-[var(--fc-state-success)]/40 text-[var(--fc-state-success)]'
                            : pill.tone === 'warning' ? 'border-[var(--fc-state-warning)]/40 text-[var(--fc-state-warning)]'
                            : pill.tone === 'info' ? 'border-[var(--fc-accent)]/40 text-[var(--fc-accent)]'
                            : 'border-[var(--fc-border)] text-[var(--fc-text-secondary)]'
                        }`}
                    >
                        {pill.label} · {pill.count}
                    </span>
                ))}
            </div>

            {!hasActivity && (
                <div className="rounded-xl border border-dashed border-[var(--fc-border)] px-4 py-6 text-center">
                    <p className="text-sm text-[var(--fc-text-secondary)]">{t('journey.empty')}</p>
                    <button
                        type="button"
                        onClick={() => navigate('/map')}
                        className="mt-2 text-xs font-semibold text-[var(--fc-accent)] hover:underline"
                    >
                        {t('journey.browseClubs')}
                    </button>
                </div>
            )}

            {/* Affiliations */}
            {journey.affiliations.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fc-text-muted)]">{t('journey.affiliations')}</p>
                    {journey.affiliations.map((aff) => (
                        <div key={`${aff.clubId}-${aff.status}`} className="flex items-center gap-2 rounded-xl border border-[var(--fc-border)] px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--fc-text-primary)]">{aff.clubName}</p>
                                <p className="mt-0.5 truncate text-[11px] text-[var(--fc-text-secondary)]">
                                    {[aff.status === 'ACTIVE' ? t('journey.member') : aff.status === 'TRIALIST' ? t('journey.onTrial') : aff.status,
                                        aff.squadName, aff.trialEndsOn ? `${t('journey.trialEnds')} ${aff.trialEndsOn}` : null]
                                        .filter(Boolean).join(' · ')}
                                </p>
                            </div>
                            {aff.consentStatus === 'PENDING' && (
                                <span title={t('journey.consentPending')}><ShieldAlert className="h-4 w-4 text-[var(--fc-state-warning)]" /></span>
                            )}
                            <button
                                type="button"
                                onClick={() => navigate(`/clubs/${aff.clubId}`)}
                                className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-accent)]"
                                title={t('journey.viewClub')}
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Invitations */}
            {journey.invitations.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fc-text-muted)]">{t('journey.invitations')}</p>
                    {journey.invitations.map((inv) => (
                        <div key={inv.inviteId} className="flex items-center gap-2 rounded-xl border border-[var(--fc-border)] px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--fc-text-primary)]">{inv.clubName}</p>
                                <p className="mt-0.5 text-[11px] text-[var(--fc-text-secondary)]">{t('journey.inviteRole', { role: inv.role })}</p>
                            </div>
                            <button
                                type="button"
                                disabled={busyKey === `invite-accept-${inv.inviteId}`}
                                onClick={() => void runAction(`invite-accept-${inv.inviteId}`, () => acceptClubInvitation(inv.inviteId))}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#16a34a] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white hover:opacity-90 disabled:opacity-50"
                            >
                                <Check className="h-3 w-3" /> {t('journey.acceptInvite')}
                            </button>
                            <button
                                type="button"
                                disabled={busyKey === `invite-decline-${inv.inviteId}`}
                                onClick={() => void runAction(`invite-decline-${inv.inviteId}`, () => declineClubInvitation(inv.inviteId))}
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--fc-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] disabled:opacity-50"
                            >
                                <X className="h-3 w-3" /> {t('journey.declineInvite')}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Applications */}
            {journey.applications.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fc-text-muted)]">{t('journey.applications')}</p>
                    {journey.applications.map((app) => (
                        <div key={app.applicationId} className="rounded-xl border border-[var(--fc-border)] px-3 py-2.5">
                            <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-[var(--fc-text-primary)]">{app.clubName}</p>
                                    <p className="mt-0.5 text-[11px] text-[var(--fc-text-secondary)]">
                                        {app.status === 'PENDING' ? t('journey.pending') : app.status}
                                    </p>
                                </div>
                                {app.status === 'PENDING' && (
                                    <button
                                        type="button"
                                        disabled={busyKey === `app-cancel-${app.applicationId}`}
                                        onClick={() => void runAction(`app-cancel-${app.applicationId}`, () => cancelClubApplication(app.clubId, app.applicationId))}
                                        className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-state-danger)] hover:underline disabled:opacity-50"
                                    >
                                        {t('journey.cancelApplication')}
                                    </button>
                                )}
                            </div>
                            {app.decisionMessage && (
                                <p className="mt-1.5 text-xs leading-5 text-[var(--fc-text-secondary)]">{app.decisionMessage}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Tryouts */}
            {journey.tryouts.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fc-text-muted)]">{t('journey.tryouts')}</p>
                    {journey.tryouts.map((tryout) => (
                        <div key={tryout.tryoutApplicationId} className="rounded-xl border border-[var(--fc-border)] px-3 py-2.5">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--fc-text-muted)]" />
                                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--fc-text-primary)]">
                                    {tryout.title} · {tryout.clubName}
                                </p>
                            </div>
                            <p className="mt-0.5 text-[11px] text-[var(--fc-text-secondary)]">
                                {tryout.status}
                                {tryout.tryoutDate ? ` · ${new Date(tryout.tryoutDate).toLocaleDateString()}` : ''}
                            </p>
                            {tryout.decisionMessage && (
                                <p className="mt-1.5 text-xs leading-5 text-[var(--fc-text-secondary)]">{tryout.decisionMessage}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Recent decisions */}
            {journey.recentDecisions.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fc-text-muted)]">{t('journey.recentDecisions')}</p>
                    {journey.recentDecisions.slice(0, 5).map((decision, index) => (
                        <div key={`${decision.kind}-${decision.clubName}-${index}`} className="flex items-start gap-2 rounded-xl border border-[var(--fc-border)] px-3 py-2">
                            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--fc-text-muted)]" />
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-[var(--fc-text-primary)]">
                                    {decision.clubName} · {decision.status}
                                </p>
                                {decision.message && (
                                    <p className="mt-0.5 text-[11px] leading-4 text-[var(--fc-text-secondary)]">{decision.message}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
