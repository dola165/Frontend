import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, X } from 'lucide-react';
import { Avatar, Badge, Button, EmptyNote, PageFrame, PageHeader, Panel, SearchInput, Skeleton, StatTile } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { RecruitmentApplication } from '../../recruitment/RecruitmentApplication';
import { recruitmentOutcome } from '../../recruitment/outcome';
import type { ClubMembershipApplication } from '../../clubs/domain';
import type { ClubJob } from '../../clubs/api';
import { squadLabel } from '../../../components/squads/squadLabels';
import { formatDate } from '../../../utils/formatting';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { useRecruitmentCopy } from '../../../locales/recruitmentDesign';
import { DecisionNoteModal } from './DecisionNoteModal';
import { outcomeTone } from './recruitmentStatus';
import '../club-workspace.css';
import '../../clubOperations/records/records.css';
import './recruitment.css';

const POSITIONS = ['GOALKEEPER', 'CENTER_BACK', 'FULLBACK', 'LEFT_BACK', 'RIGHT_BACK', 'DEFENSIVE_MIDFIELDER', 'CENTRAL_MIDFIELDER', 'ATTACKING_MIDFIELDER', 'WINGER', 'LEFT_WINGER', 'RIGHT_WINGER', 'STRIKER', 'FORWARD'] as const;
const AGE_GROUPS = ['U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U21', 'SENIOR'] as const;
const OUTCOMES = ['PENDING', 'OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'OFFER_DECLINED', 'OFFER_CANCELLED', 'ALL'] as const;
type Order = '' | 'applicant' | 'opportunity' | 'submitted' | 'status';

export interface ApplicationFilters { position: string; ageGroup: string; status: string; jobId: string }

export interface ApplicationsPageProps {
    applications: ClubMembershipApplication[]; applicationsLoading: boolean; applicationsError: string | null; jobs?: ClubJob[];
    filters: ApplicationFilters; bulkPending: boolean; onFiltersChange: (filters: ApplicationFilters) => void;
    onAcceptApplication: (applicationId: number) => void; onDeclineApplication: (applicationId: number) => void;
    /** Selection is cleared only after a completed request. */
    onBulkDecide: (applicationIds: number[], action: 'ACCEPT' | 'DECLINE', message: string | null) => Promise<boolean>;
    onRetry: () => void; onOpenPlayers?: () => void;
    pagination?: { page: number; size: number; total: number; onChange: (page: number) => void };
}

/** The applicant's football facts in a line of quiet badges: age, foot, height, current club, history, minor and consent. */
function ApplicantFacts({ application: a }: { application: ClubMembershipApplication }) {
    const { t } = useTranslation();
    return <span className="ap-facts">
        {a.age != null && <Badge>{t('applications.summaryAge', { age: a.age })}</Badge>}
        {a.preferredFoot && <Badge>{a.preferredFoot}</Badge>}
        {a.heightCm != null && <Badge>{t('applications.summaryHeight', { height: a.heightCm })}</Badge>}
        {a.currentClubName && <Badge>{a.currentClubName}</Badge>}
        {a.careerHistoryCount != null && a.careerHistoryCount > 0 && <Badge>{t('applications.summaryHistory', { count: a.careerHistoryCount })}</Badge>}
        {a.isMinor && <Badge tone="info"><ShieldAlert aria-hidden="true" className="ap-icon" />{t('applications.minor')}</Badge>}
        {a.isMinor && a.currentConsentStatus === 'PENDING' && <Badge tone="warning">{t('applications.consentPending')}</Badge>}
    </span>;
}

/**
 * Applications to join the club or one of its openings. Search and filter, review one application in full before
 * deciding, or decline several with one note. Offers always wait for the applicant's consent; nothing is accepted here.
 */
export function ApplicationsPage({ applications, applicationsLoading, applicationsError, filters, bulkPending, jobs = [], onFiltersChange, onDeclineApplication, onBulkDecide, onRetry, onOpenPlayers, pagination }: ApplicationsPageProps) {
    const { t } = useTranslation();
    const r = useRecruitmentCopy();
    const [order, setOrder] = useState<Order>(''), [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set()), [declining, setDeclining] = useState(false), [reviewId, setReviewId] = useState<number | null>(null);
    const visible = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase();
        const found = applications.filter(a => (!filters.jobId || String(a.jobId ?? '') === filters.jobId) && (!needle || `${a.fullName ?? ''} ${a.username} ${a.jobTitle ?? ''}`.toLocaleLowerCase().includes(needle)));
        if (!order) return found;
        const value = (a: ClubMembershipApplication) => order === 'applicant' ? (a.fullName || a.username).toLocaleLowerCase() : order === 'opportunity' ? (a.jobTitle || a.role).toLocaleLowerCase() : order === 'submitted' ? a.createdAt ?? '' : a.status;
        return [...found].sort((a, b) => value(a).localeCompare(value(b)));
    }, [applications, filters.jobId, query, order]);
    const pendingIds = visible.filter(a => a.status === 'PENDING').map(a => a.id);
    const selectedIds = pendingIds.filter(id => selected.has(id));
    const reviewed = applications.find(a => a.id === reviewId);
    const filtered = Boolean(query || filters.position || filters.ageGroup || filters.jobId || filters.status !== 'PENDING');
    const toggle = (id: number) => setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    const confirmDecline = async (message: string | null) => {
        if (!selectedIds.length || bulkPending) return;
        if (await onBulkDecide(selectedIds, 'DECLINE', message)) { setSelected(new Set()); setDeclining(false); }
    };
    const page = (to: number) => { setSelected(new Set()); pagination?.onChange(to); };

    let body;
    if (applicationsLoading && !applications.length) body = <Panel><div className="cw-skeleton-rows" role="status" aria-label={r('loadedApplications')}>{[0, 1, 2].map(i => <Skeleton key={i} height={56} />)}</div></Panel>;
    else if (applicationsError && !applications.length) body = <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{applicationsError}</span><Button size="sm" onClick={onRetry}>{r('retry')}</Button></div>;
    else if (!visible.length) body = <Panel><EmptyNote title={r('emptyApplications')} action={filtered ? <Button size="sm" onClick={() => { setQuery(''); onFiltersChange({ position: '', ageGroup: '', status: 'PENDING', jobId: '' }); }}>{r('clearFilters')}</Button> : undefined}>{r('emptyApplicationsIntro')}</EmptyNote></Panel>;
    else body = <Panel flush><ul className="gk-list" aria-label={r('applications')}>{visible.map(a => {
        const name = a.fullName || a.username;
        return <li key={a.id} data-selected={selected.has(a.id) || undefined}><div className="gk-list-row ap-row">
            <input type="checkbox" className="ap-check" checked={selectedIds.includes(a.id)} disabled={a.status !== 'PENDING' || bulkPending} onChange={() => toggle(a.id)} aria-label={r('selectApplicant', { name })} />
            <Avatar src={resolveMediaUrl(a.avatarUrl) || null} name={name} size={40} />
            <span className="gk-list-row__main">
                <span className="gk-list-row__title">{name}</span>
                <span className="gk-list-row__meta">{[a.jobTitle || r('generalApplication'), r(a.role), a.position ? squadLabel(a.position, t) : null, a.ageGroup, a.createdAt ? formatDate(a.createdAt, { day: 'numeric', month: 'short' }) : r('recently')].filter(Boolean).join(' · ')}</span>
                <ApplicantFacts application={a} />
            </span>
            <span className="gk-list-row__trail ap-trail"><Badge tone={outcomeTone(a.status)}>{recruitmentOutcome(a.status)}</Badge><Button size="sm" onClick={() => setReviewId(a.id)}>{r('review')}</Button></span>
        </div></li>;
    })}</ul></Panel>;

    return <PageFrame className="cw-page ap-page">
        <PageHeader title={r('applications')} subtitle={r('applicationsIntro')} />
        <div className="gk-stack">
            <div className="gk-stats" role="group" aria-label={r('loadedApplications')}>
                <StatTile label={r('awaitingDecision')} value={applicationsLoading ? '–' : pendingIds.length} tone={pendingIds.length ? 'attention' : undefined} />
                <StatTile label={r('playerApplications')} value={applicationsLoading ? '–' : visible.filter(a => a.role === 'PLAYER').length} />
                <StatTile label={r('jobApplications')} value={applicationsLoading ? '–' : visible.filter(a => a.jobId != null).length} />
            </div>
            <div className="rec-toolbar">
                <SearchInput className="rec-toolbar__search" aria-label={r('searchApplicants')} placeholder={r('searchApplicants')} value={query} onChange={event => setQuery(event.target.value)} />
                <select className="gk-input" aria-label={t('applications.filterPosition')} value={filters.position} onChange={event => onFiltersChange({ ...filters, position: event.target.value })}>
                    <option value="">{t('applications.allPositions')}</option>{POSITIONS.map(position => <option key={position} value={position}>{squadLabel(position, t)}</option>)}</select>
                {jobs.length > 0 && <select className="gk-input" aria-label={r('job')} value={filters.jobId} onChange={event => onFiltersChange({ ...filters, jobId: event.target.value })}>
                    <option value="">{r('allApplications')}</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select>}
                <select className="gk-input" aria-label={t('applications.filterAgeGroup')} value={filters.ageGroup} onChange={event => onFiltersChange({ ...filters, ageGroup: event.target.value })}>
                    <option value="">{t('applications.allAgeGroups')}</option>{AGE_GROUPS.map(age => <option key={age} value={age}>{age}</option>)}</select>
                <select className="gk-input" aria-label={t('applications.filterStatus')} value={filters.status} onChange={event => onFiltersChange({ ...filters, status: event.target.value })}>
                    {OUTCOMES.map(status => <option key={status} value={status}>{status === 'ALL' ? 'All outcomes' : recruitmentOutcome(status)}</option>)}</select>
                <select className="gk-input" aria-label="Order" value={order} onChange={event => setOrder(event.target.value as Order)}>
                    <option value="">{t('squadDesign.players.defaultOrder', 'Default order')}</option><option value="applicant">{r('applicant')}</option><option value="opportunity">{r('opportunity')}</option><option value="submitted">{r('submitted')}</option><option value="status">{r('status')}</option></select>
            </div>
            {pendingIds.length > 0 && <div className="ap-bulk" role="group" aria-label="Selection">
                {selectedIds.length > 0 ? <>
                    <strong>{t('applications.selected', { count: selectedIds.length })}</strong>
                    <Button size="sm" variant="danger" disabled={bulkPending} onClick={() => setDeclining(true)}><X aria-hidden="true" />{t('applications.declineSelected', { count: selectedIds.length })}</Button>
                    {selectedIds.length < pendingIds.length && <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(pendingIds))}>{t('applications.selectAllPending', { count: pendingIds.length })}</Button>}
                    <Button size="sm" variant="ghost" disabled={bulkPending} onClick={() => setSelected(new Set())}>{t('applications.clearSelection')}</Button>
                </> : <><span className="gk-muted">{r('results', { count: pendingIds.length })} · {r('pending')}</span><Button size="sm" variant="ghost" onClick={() => setSelected(new Set(pendingIds))}>{t('applications.selectAllPending', { count: pendingIds.length })}</Button></>}
            </div>}
            {pagination && <nav className="ap-pages" aria-label="Application pages">
                <Button size="sm" disabled={applicationsLoading || bulkPending || pagination.page === 0} onClick={() => page(pagination.page - 1)}>Previous page</Button>
                <span className="gk-muted">Page {pagination.page + 1} · {pagination.total} matching applications. Search and sorting apply to this page.</span>
                <Button size="sm" disabled={applicationsLoading || bulkPending || (pagination.page + 1) * pagination.size >= pagination.total} onClick={() => page(pagination.page + 1)}>Next page</Button>
            </nav>}
            {applicationsError && applications.length > 0 && <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{applicationsError}</span><Button size="sm" onClick={onRetry}>{t('journey.retry')}</Button></div>}
            {body}
            <p className="gk-notice ap-next"><span className="cw-notices__text">{r('playerNext')}</span>{onOpenPlayers && <Button size="sm" variant="ghost" onClick={onOpenPlayers}>{r('playersStep')}</Button>}</p>
        </div>
        {reviewed && <Dialog open size="lg" title={reviewed.fullName || reviewed.username} description={[reviewed.jobTitle || r('generalApplication'), r(reviewed.role)].join(' · ')} closeLabel={r('close')} onClose={() => setReviewId(null)}
            footer={<><Button variant="ghost" onClick={() => setReviewId(null)}>{r('close')}</Button>
                {reviewed.status === 'PENDING' && <Button variant="danger" onClick={() => { const id = reviewed.id; setReviewId(null); onDeclineApplication(id); }}><X aria-hidden="true" />{r('decline')}</Button>}</>}>
            <div className="ap-review__head"><Avatar src={resolveMediaUrl(reviewed.avatarUrl) || null} name={reviewed.fullName || reviewed.username} size={44} /><ApplicantFacts application={reviewed} /><Badge tone={outcomeTone(reviewed.status)}>{recruitmentOutcome(reviewed.status)}</Badge></div>
            <section className="ap-review__message"><h3>{r('message')}</h3><p>{reviewed.message || r('noMessage')}</p></section>
            <RecruitmentApplication applicationId={reviewed.id} onChanged={onRetry} />
        </Dialog>}
        {declining && <DecisionNoteModal title={t('applications.declineTitle')} subtitle={t('applications.subtitle')} templateKey="decisions.declineApplicationTemplate" saving={bulkPending}
            confirmLabel={t('applications.declineConfirm')} danger onClose={() => setDeclining(false)} onConfirm={message => void confirmDecline(message)} />}
    </PageFrame>;
}
