import { ct, useCommerceCopy } from '../../store/copy';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Avatar, Badge, Button, EmptyNote, PageFrame, PageHeader, Skeleton } from '../../../design/primitives';
import type { ClubJob } from '../../clubs/api';
import type { ClubMembershipApplication } from '../../clubs/domain';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { DecisionNoteModal } from '../recruitment/DecisionNoteModal';

const STATUS: Record<string, { label: string; tone: 'warning' | 'accent' | 'neutral' }> = {
    PENDING: { label: 'Needs a decision', tone: 'warning' }, ACCEPTED: { label: 'Accepted', tone: 'accent' },
    DECLINED: { label: 'Declined', tone: 'neutral' }, CANCELLED: { label: 'Withdrawn', tone: 'neutral' },
};

export type ApplicantDecision = { application: ClubMembershipApplication; accept: boolean };

/** The people who applied to one role posting, with an accept or decline decision for each pending application. */
export function RoleApplicants({ job, applications, loading, error, canReview, decision, pendingId, onBack, onRetry, onDecide, onCancelDecision, onConfirm }: {
    job: ClubJob; applications: ClubMembershipApplication[]; loading: boolean; error: string | null; canReview: boolean;
    decision: ApplicantDecision | null; pendingId: number | null;
    onBack: () => void; onRetry: () => void; onDecide: (decision: ApplicantDecision) => void; onCancelDecision: () => void; onConfirm: (message: string | null) => void;
}) {
    useCommerceCopy();
    let body;
    if (loading) body = <div className="gk-panel cm-list" role="status" aria-label={ct("Loading applicants")}><div className="cm-skeletons">{[0, 1].map(i => <Skeleton key={i} height={56} />)}</div></div>;
    else if (!applications.length) body = error ? null : <div className="gk-panel cm-list"><EmptyNote title={ct("No applications yet")}>{ct("Applications for this posting will appear here.")}</EmptyNote></div>;
    else body = <div className="gk-panel cm-list"><ul className="gk-list" aria-label={ct("Applicants")}>{applications.map(application => {
        const name = application.fullName || application.username, status = STATUS[application.status] ?? { label: application.status, tone: 'neutral' as const };
        return <li key={application.id}><div className="gk-list-row cm-row cm-row--top">
            <Avatar src={resolveMediaUrl(application.avatarUrl) || null} name={name} size={40} />
            <span className="gk-list-row__main">
                <span className="cm-row__name">{name}</span>
                <span className="gk-list-row__meta">{[application.position, application.ageGroup, application.currentClubName].filter(Boolean).join(' · ') || application.role}</span>
                {application.message && <span className="cm-row__message">{application.message}</span>}
            </span>
            <span className="cm-row__trail">
                <Badge tone={status.tone}>{ct(status.label)}</Badge>
                {canReview && application.status === 'PENDING' && <>
                    <Button size="sm" disabled={pendingId === application.id} onClick={() => onDecide({ application, accept: false })}><X aria-hidden="true" />{ct("Decline")}</Button>
                    <Button size="sm" variant="primary" disabled={pendingId === application.id} onClick={() => onDecide({ application, accept: true })}><Check aria-hidden="true" />{ct("Accept")}</Button>
                </>}
            </span>
        </div></li>;
    })}</ul></div>;
    return <PageFrame className="cw-page cm-page">
        <div className="cm-editor__back"><Button variant="ghost" size="sm" disabled={pendingId !== null} onClick={onBack}><ArrowLeft aria-hidden="true" />{ct("Back to open roles")}</Button></div>
        <PageHeader title={job.title} subtitle={job.status === 'OPEN' ? ct("Review applicants and decide who moves forward.") : ct("This posting is closed. Its applications stay available for review.")} />
        <div className="gk-stack">
            <p className="gk-notice">{ct("Accepting a player or coach can create that club relationship. It never grants club administration or other permissions.")}</p>
            {error && <div className="gk-notice gk-notice--danger"><span role="alert">{error}</span><Button size="sm" onClick={onRetry}>{ct("Try again")}</Button></div>}
            {body}
        </div>
        {decision && <DecisionNoteModal title={decision.accept ? ct("Accept applicant?") : ct("Decline applicant?")} subtitle={decision.application.fullName || decision.application.username}
            saving={pendingId === decision.application.id} danger={!decision.accept} confirmLabel={decision.accept ? ct("Accept applicant") : ct("Decline applicant")}
            onClose={onCancelDecision} onConfirm={onConfirm} />}
    </PageFrame>;
}
