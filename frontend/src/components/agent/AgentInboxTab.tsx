import { ArrowUpRight, BellRing, Building2, LockKeyhole, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AgentInterest } from '../../features/agents/domain';
import { EmptyStateCard } from '../workspace/EmptyStateCard';
import { SectionHeader } from '../workspace/helpers';
import { useAgentCopy, type AgentCopyKey } from '../../features/agents/copy';

interface Props {
    interests: AgentInterest[];
}

const STATUS_COPY: Record<AgentInterest['status'], { label: AgentCopyKey; tone: string }> = {
    EXPRESSED: { label: 'newEnquiry', tone: 'bg-[var(--fc-state-warning-soft)] text-[var(--fc-state-warning)]' },
    VIEWED: { label: 'viewed', tone: 'bg-[var(--fc-state-info-soft)] text-[var(--fc-state-info)]' },
    CONTACTED: { label: 'contacted', tone: 'bg-[var(--fc-state-success-soft)] text-[var(--fc-state-success)]' },
    DISMISSED: { label: 'closed', tone: 'bg-[var(--fc-surface-hover)] text-[var(--fc-text-muted)]' }
};

export const AgentInboxTab = ({ interests }: Props) => {
    const { copy, date } = useAgentCopy();
    return (
    <section aria-label={copy('enquiries')}>
        <SectionHeader
            eyebrow={copy('privateEnquiries')}
            title={copy('agentInbox')}
            description={copy('inboxDescription')}
        />

        {interests.length === 0 ? (
            <EmptyStateCard
                icon={BellRing}
                title={copy('noEnquiries')}
                description={copy('noEnquiriesDetail')}
            />
        ) : (
            <div className="mt-4 grid gap-3">
                {interests.map(interest => {
                    const status = STATUS_COPY[interest.status] ?? STATUS_COPY.EXPRESSED;
                    const contactId = interest.interestedByUserId;
                    const canMessage = contactId != null && Number.isSafeInteger(contactId) && contactId > 0;
                    const contextProtected = interest.listingId == null;
                    return (
                        <article
                            key={interest.interestId}
                            className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-4"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fc-surface-hover)]">
                                        <Building2 className="h-5 w-5 text-[var(--fc-accent)]" aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="truncate font-semibold text-[var(--fc-text-primary)]">{interest.clubName}</h3>
                                        <p className="mt-1 text-xs text-[var(--fc-text-muted)]">
                                            {interest.interestedByName || copy('clubContact')} · {date(interest.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
                                    {copy(status.label)}
                                </span>
                            </div>

                            {contextProtected ? (
                                <p className="mt-4 text-sm text-[var(--fc-text-muted)]">
                                    {copy('protectedMessage')}
                                </p>
                            ) : interest.message ? (
                                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--fc-text-secondary)]">{interest.message}</p>
                            ) : (
                                <p className="mt-4 text-sm italic text-[var(--fc-text-muted)]">{copy('noMessage')}</p>
                            )}

                            <div className="mt-4 flex flex-col gap-3 border-t border-[var(--fc-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="flex items-start gap-2 text-xs text-[var(--fc-text-muted)]">
                                    <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    {copy('enquiryPrivacy')}
                                </p>
                                {canMessage ? (
                                    <Link
                                        to={`/messages?chatWith=${contactId}`}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--fc-accent)] px-3 py-2 text-sm font-semibold text-[color:var(--color-on-accent)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fc-accent)]"
                                    >
                                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                                        {copy('messageContact')}
                                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                                    </Link>
                                ) : (
                                    <span className="text-xs text-[var(--fc-text-muted)]">{copy('noMessageDestination')}</span>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        )}
    </section>
    );
};
