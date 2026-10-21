import { ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AgentPortfolioPlayer } from '../../features/agents/domain';
import { SectionHeader } from '../workspace/helpers';
import { EmptyStateCard } from '../workspace/EmptyStateCard';
import { UserIdentityCell } from '../workspace/UserIdentityCell';
import { useAgentCopy, type AgentCopyKey } from '../../features/agents/copy';

interface Props {
    players: AgentPortfolioPlayer[];
}

const consentKeys = (player: AgentPortfolioPlayer): { label: AgentCopyKey; detail: AgentCopyKey; tone: string } => {
    if (player.requiresMinorConsent && player.minorConsentStatus === 'PENDING') {
        return {
            label: 'consentPending',
            tone: 'bg-[var(--fc-state-warning-soft)] text-[var(--fc-state-warning)]',
            detail: 'consentPendingDetail'
        };
    }
    if (player.requiresMinorConsent && player.minorConsentStatus === 'ACCEPTED') {
        return {
            label: 'consentConfirmed',
            tone: 'bg-[var(--fc-state-success-soft)] text-[var(--fc-state-success)]',
            detail: player.playerUserId == null
                ? 'consentConfirmedProtected'
                : 'consentConfirmedDetail'
        };
    }
    if (player.requiresMinorConsent) {
        return {
            label: 'consentNotConfirmed',
            tone: 'bg-[var(--fc-state-warning-soft)] text-[var(--fc-state-warning)]',
            detail: 'consentNotConfirmedDetail'
        };
    }
    return {
        label: 'representationActive',
        tone: 'bg-[var(--fc-state-info-soft)] text-[var(--fc-state-info)]',
        detail: 'representationActiveDetail'
    };
};

export const AgentPortfolioTab = ({ players }: Props) => {
    const { copy, date } = useAgentCopy();
    return (
    <section aria-label={copy('playerPortfolio')}>
        <SectionHeader
            eyebrow={copy('privateRepresentation')}
            title={copy('playerPortfolio')}
            description={copy('portfolioDescription')}
        />

        {players.length === 0 ? (
            <EmptyStateCard
                icon={Users}
                title={copy('noActiveRepresentations')}
                description={copy('noActiveRepresentationsDetail')}
            />
        ) : (
            <div className="mt-4 grid gap-3">
                {players.map(player => {
                    const consent = consentKeys(player);
                    const detailsAvailable = player.playerUserId != null && player.fullName != null && player.username != null;
                    return (
                        <article
                            key={player.representationId}
                            className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-4"
                        >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                <div className="min-w-0 flex-1">
                                    {detailsAvailable ? (
                                        <Link to={`/profile/${player.playerUserId}`} className="hover:underline"><UserIdentityCell
                                            avatarUrl={player.avatarUrl}
                                            fullName={player.fullName!}
                                            username={player.username!}
                                            subtitle={player.currentClubName || copy('noCurrentClub')}
                                        /></Link>
                                    ) : (
                                        <div>
                                            <h3 className="font-semibold text-[var(--fc-text-primary)]">{copy('protectedRequest')}</h3>
                                            <p className="mt-1 text-sm text-[var(--fc-text-muted)]">{copy('protectedRequestDetail')}</p>
                                        </div>
                                    )}
                                </div>
                                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${consent.tone}`}>
                                    {copy(consent.label)}
                                </span>
                            </div>
                            <div className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--fc-surface-hover)] p-3 text-sm text-[var(--fc-text-secondary)]">
                                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fc-accent)]" aria-hidden="true" />
                                <p>{copy(consent.detail)}</p>
                            </div>
                            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                                <div><dt className="text-xs text-[var(--fc-text-muted)]">{copy('position')}</dt><dd className="mt-1 font-medium text-[var(--fc-text-primary)]">{player.position || copy('notProvided')}</dd></div>
                                <div><dt className="text-xs text-[var(--fc-text-muted)]">{copy('authority')}</dt><dd className="mt-1 font-medium text-[var(--fc-text-primary)]">{player.representationType.replace(/_/g, ' ')}</dd></div>
                                <div><dt className="text-xs text-[var(--fc-text-muted)]">{copy('started')}</dt><dd className="mt-1 font-medium text-[var(--fc-text-primary)]">{date(player.startedAt)}</dd></div>
                            </dl>
                        </article>
                    );
                })}
            </div>
        )}
    </section>
    );
};
