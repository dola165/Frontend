import { Building2, Clock3, LockKeyhole } from 'lucide-react';
import type { AgentEngagement } from '../../features/agents/domain';
import { SectionHeader } from '../workspace/helpers';
import { EmptyStateCard } from '../workspace/EmptyStateCard';
import { MediaImage } from '../ui/MediaImage';
import { useAgentCopy, type AgentCopyKey } from '../../features/agents/copy';
import { ClubApproachesPanel } from '../../features/agents/ClubApproachesPanel';

interface Props {
    engagements: AgentEngagement[];
}

const STATUS_COPY: Record<AgentEngagement['status'], { label: AgentCopyKey; detail: AgentCopyKey; tone: string }> = {
    PENDING: {
        label: 'awaitingClub',
        detail: 'awaitingClubDetail',
        tone: 'bg-[var(--fc-state-warning-soft)] text-[var(--fc-state-warning)]'
    },
    ACTIVE: {
        label: 'activeRelationship',
        detail: 'activeRelationshipStateDetail',
        tone: 'bg-[var(--fc-state-success-soft)] text-[var(--fc-state-success)]'
    },
    DECLINED: {
        label: 'declinedByClub',
        detail: 'declinedByClubDetail',
        tone: 'bg-[var(--fc-state-danger-soft)] text-[var(--fc-state-danger)]'
    },
    CANCELLED: {
        label: 'cancelled',
        detail: 'cancelledDetail',
        tone: 'bg-[var(--fc-surface-hover)] text-[var(--fc-text-muted)]'
    },
    TERMINATED: {
        label: 'relationshipEnded',
        detail: 'relationshipEndedDetail',
        tone: 'bg-[var(--fc-surface-hover)] text-[var(--fc-text-muted)]'
    }
};

export const ClubRelationshipsTab = ({ engagements }: Props) => {
    const { copy, date } = useAgentCopy();
    return (
    <section aria-label={copy('relationships')}>
        <ClubApproachesPanel mode="agent" />
        <div className="mt-8">
        <SectionHeader
            eyebrow={copy('relationshipHistory')}
            title={copy('relationships')}
            description={copy('relationshipsDescription')}
        />

        {engagements.length === 0 ? (
            <EmptyStateCard
                icon={Building2}
                title={copy('noRelationships')}
                description={copy('noRelationshipsDetail')}
            />
        ) : (
            <div className="mt-4 grid gap-3">
                {engagements.map(engagement => {
                    const status = STATUS_COPY[engagement.status] ?? STATUS_COPY.CANCELLED;
                    return (
                        <article
                            key={engagement.engagementId}
                            className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-4"
                        >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--fc-surface-hover)]">
                                        {engagement.clubLogoUrl ? (
                                            <MediaImage src={engagement.clubLogoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                                        ) : (
                                            <Building2 className="h-5 w-5 text-[var(--fc-text-muted)]" aria-hidden="true" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="truncate font-semibold text-[var(--fc-text-primary)]">{engagement.clubName}</h3>
                                        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--fc-text-muted)]">
                                            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                                            {copy('requestedDate', { date: date(engagement.createdAt) })}
                                        </p>
                                    </div>
                                </div>
                                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
                                    {copy(status.label)}
                                </span>
                            </div>
                            <p className="mt-4 text-sm text-[var(--fc-text-secondary)]">{copy(status.detail)}</p>
                            {engagement.responseNotes && (
                                <div className="mt-3 rounded-xl bg-[var(--fc-surface-hover)] p-3 text-sm text-[var(--fc-text-secondary)]">
                                    <span className="font-semibold text-[var(--fc-text-primary)]">{copy('clubResponse')} </span>
                                    {engagement.responseNotes}
                                </div>
                            )}
                            {engagement.notes && (
                                <p className="mt-3 text-sm text-[var(--fc-text-secondary)]">
                                    <span className="font-semibold text-[var(--fc-text-primary)]">{copy('originalNote')} </span>
                                    {engagement.notes}
                                </p>
                            )}
                            {engagement.status === 'ACTIVE' && (
                                <p className="mt-4 flex items-center gap-2 text-xs text-[var(--fc-text-muted)]">
                                    <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                                    {copy('activeRelationshipPrivacy')}
                                </p>
                            )}
                        </article>
                    );
                })}
            </div>
        )}
        </div>
    </section>
    );
};
