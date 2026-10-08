import { RecruitmentApplication } from '../../../features/recruitment/RecruitmentApplication';
import { recruitmentOutcome } from '../../../features/recruitment/outcome';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ClipboardList, Info, Search, ShieldAlert, X } from 'lucide-react';
import type { ClubMembershipApplication } from '../../../features/clubs/domain';
import type { ClubJob } from '../../../features/clubs/api';
import { clubRoleLabel } from '../../../features/clubs/domain';
import { squadLabel } from '../../squads/squadLabels';
import { DataTable, ErrorBlock, PageSpinner } from '../helpers';
import { formatDate } from '../../../utils/formatting';
import type { SortState } from '../helpers';
import { UserIdentityCell } from '../UserIdentityCell';
import { DecisionNoteModal } from './DecisionNoteModal';
import { useDialogFocus } from '../useDialogFocus';
import { RecruitmentNavigation } from '../recruitment/RecruitmentNavigation';
import { useRecruitmentCopy } from '../../../locales/recruitmentDesign';
import '../../squads/squad-design.css';
import '../recruitment/recruitment-design.css';

const POSITION_OPTIONS = ['GOALKEEPER', 'CENTER_BACK', 'FULLBACK', 'LEFT_BACK', 'RIGHT_BACK', 'DEFENSIVE_MIDFIELDER', 'CENTRAL_MIDFIELDER', 'ATTACKING_MIDFIELDER', 'WINGER', 'LEFT_WINGER', 'RIGHT_WINGER', 'STRIKER', 'FORWARD'] as const;
const AGE_GROUP_OPTIONS = ['U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U21', 'SENIOR'] as const;
const STATUS_OPTIONS = ['PENDING', 'OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'OFFER_DECLINED', 'OFFER_CANCELLED', 'ALL'] as const;

export interface ApplicationFilters { position: string; ageGroup: string; status: string; jobId: string; }

interface ApplicationsTabProps {
    applications: ClubMembershipApplication[];
    applicationsLoading: boolean;
    applicationsError: string | null;
    jobs?: ClubJob[];
    filters: ApplicationFilters;
    bulkPending: boolean;
    onFiltersChange: (filters: ApplicationFilters) => void;
    onAcceptApplication: (applicationId: number) => void;
    onDeclineApplication: (applicationId: number) => void;
    /** Selection is cleared only after a completed request. */
    onBulkDecide: (applicationIds: number[], action: 'ACCEPT' | 'DECLINE', message: string | null) => Promise<boolean>;
    onRetry: () => void;
    onOpenTryouts?: () => void;
    onOpenPlayers?: () => void;
    onOpenSquads?: () => void;
    pagination?: { page: number; size: number; total: number; onChange: (page: number) => void };
}

export const ApplicationsTab = ({ applications, applicationsLoading, applicationsError, filters, bulkPending, jobs = [], onFiltersChange, onDeclineApplication, onBulkDecide, onRetry, onOpenTryouts, onOpenPlayers, onOpenSquads, pagination }: ApplicationsTabProps) => {
    const { t } = useTranslation();
    const r = useRecruitmentCopy();
    const [sort, setSort] = useState<SortState | null>(null);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkAction, setBulkAction] = useState<'ACCEPT' | 'DECLINE' | null>(null);
    const [reviewId, setReviewId] = useState<number | null>(null);

    const filteredApplications = useMemo(() => applications.filter((application) => {
        if (filters.jobId && String(application.jobId ?? '') !== filters.jobId) return false;
        const search = query.trim().toLocaleLowerCase();
        return !search || `${application.fullName ?? ''} ${application.username} ${application.jobTitle ?? ''}`.toLocaleLowerCase().includes(search);
    }), [applications, filters.jobId, query]);
    const pendingIds = useMemo(() => filteredApplications.filter((app) => app.status === 'PENDING').map((app) => app.id), [filteredApplications]);
    const selectedIds = pendingIds.filter((id) => selected.has(id));
    const allPendingSelected = pendingIds.length > 0 && selectedIds.length === pendingIds.length;
    const reviewedApplication = applications.find((application) => application.id === reviewId);

    const sortedApplications = useMemo(() => {
        if (!sort) return filteredApplications;
        const value = (app: ClubMembershipApplication) => {
            switch (sort.column) {
                case 1: return (app.fullName || app.username).toLocaleLowerCase();
                case 2: return (app.jobTitle || clubRoleLabel(app.role)).toLocaleLowerCase();
                case 3: return app.createdAt || '';
                case 4: return app.status;
                default: return '';
            }
        };
        return [...filteredApplications].sort((a, b) => value(a).localeCompare(value(b)) * (sort.direction === 'asc' ? 1 : -1));
    }, [filteredApplications, sort]);

    const toggleSelect = (id: number) => setSelected((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const handleBulkConfirm = async (message: string | null) => {
        if (!bulkAction || !selectedIds.length || bulkPending) return;
        if (await onBulkDecide(selectedIds, bulkAction, message)) {
            setSelected(new Set());
            setBulkAction(null);
        }
    };
    const clearFilters = () => { setQuery(''); onFiltersChange({ position: '', ageGroup: '', status: 'PENDING', jobId: '' }); };

    return <div className="squad-design recruitment-design">
        <header className="sd-heading"><div><span className="sd-eyebrow">{r('recruitment')}</span><h2>{r('applications')}</h2><p>{r('applicationsIntro')}</p></div></header>
        <RecruitmentNavigation active="applications" onOpenTryouts={onOpenTryouts} onOpenPlayers={onOpenPlayers} onOpenSquads={onOpenSquads} />
        <div className="rc-metrics" aria-label={r('loadedApplications')}>
            <div className="rc-metric"><strong>{applicationsLoading ? '—' : pendingIds.length}</strong><span>{r('awaitingDecision')}</span></div>
            <div className="rc-metric"><strong>{applicationsLoading ? '—' : filteredApplications.filter((app) => app.role === 'PLAYER').length}</strong><span>{r('playerApplications')}</span></div>
            <div className="rc-metric"><strong>{applicationsLoading ? '—' : filteredApplications.filter((app) => app.jobId != null).length}</strong><span>{r('jobApplications')}</span></div>
        </div>
        <section className="sd-panel">
            <header className="rc-panel-header"><div><h3>{r('applicationsStep')}</h3><p>{r('loadedApplications')}</p></div><span>{r('results', { count: filteredApplications.length })}</span></header>
            {pagination && <nav className="rc-table-summary" aria-label="Application pages"><button disabled={applicationsLoading || bulkPending || pagination.page === 0} onClick={() => { setSelected(new Set()); pagination.onChange(pagination.page - 1); }}>Previous page</button><span>Page {pagination.page + 1} · {pagination.total} matching applications. Search and sorting apply to this page.</span><button disabled={applicationsLoading || bulkPending || (pagination.page + 1) * pagination.size >= pagination.total} onClick={() => { setSelected(new Set()); pagination.onChange(pagination.page + 1); }}>Next page</button></nav>}
            <div className="rc-toolbar">
                <label className="sd-search"><Search size={16} /><input type="search" aria-label={r('searchApplicants')} placeholder={r('searchApplicants')} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
                <label className="rc-filter">{t('applications.filterPosition')}<select value={filters.position} onChange={(event) => onFiltersChange({ ...filters, position: event.target.value })}><option value="">{t('applications.allPositions')}</option>{POSITION_OPTIONS.map((position) => <option key={position} value={position}>{squadLabel(position, t)}</option>)}</select></label>
                <label className="rc-filter">{r('job')}<select value={filters.jobId} onChange={(event) => onFiltersChange({ ...filters, jobId: event.target.value })}><option value="">{r('allApplications')}</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
                <label className="rc-filter">{t('applications.filterAgeGroup')}<select value={filters.ageGroup} onChange={(event) => onFiltersChange({ ...filters, ageGroup: event.target.value })}><option value="">{t('applications.allAgeGroups')}</option>{AGE_GROUP_OPTIONS.map((age) => <option key={age} value={age}>{age}</option>)}</select></label>
                <label className="rc-filter">{t('applications.filterStatus')}<select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status === 'ALL' ? 'All outcomes' : recruitmentOutcome(status)}</option>)}</select></label>
            </div>
            {selectedIds.length > 0 ? <div className="rc-bulk">
                <strong>{t('applications.selected', { count: selectedIds.length })}</strong>

                <button type="button" className="sd-button rc-danger" disabled={bulkPending} onClick={() => setBulkAction('DECLINE')}><X size={14} />{t('applications.declineSelected', { count: selectedIds.length })}</button>
                <button type="button" className="rc-link" disabled={bulkPending} onClick={() => setSelected(new Set())}>{t('applications.clearSelection')}</button>
            </div> : pendingIds.length > 0 && <div className="rc-table-summary"><span>{r('results', { count: pendingIds.length })} · {r('pending')}</span><button type="button" className="rc-link" onClick={() => setSelected(new Set(pendingIds))}>{t('applications.selectAllPending', { count: pendingIds.length })}</button></div>}
            {selectedIds.length > 0 && !allPendingSelected && <div className="rc-table-summary"><button type="button" className="rc-link" onClick={() => setSelected(new Set(pendingIds))}>{t('applications.selectAllPending', { count: pendingIds.length })}</button></div>}
            {applicationsError && applications.length > 0 && <div role="alert" className="rc-help"><Info size={16} /><p>{applicationsError}</p><button type="button" className="rc-link" onClick={onRetry}>{t('journey.retry')}</button></div>}
            {applicationsLoading && applications.length === 0 ? <PageSpinner /> : applicationsError && applications.length === 0 ? <ErrorBlock message={applicationsError} onRetry={onRetry} /> : filteredApplications.length === 0 ? <div className="sd-empty"><ClipboardList size={28} /><h3>{r('emptyApplications')}</h3><p>{r('emptyApplicationsIntro')}</p>{(query || filters.position || filters.ageGroup || filters.jobId || filters.status !== 'PENDING') && <button type="button" className="sd-button" onClick={clearFilters}>{r('clearFilters')}</button>}</div> : <div className="rc-table">
                <DataTable columns={['', r('applicant'), r('opportunity'), r('submitted'), r('status'), '']} sort={sort} onSort={(column) => setSort((previous) => ({ column, direction: previous?.column === column && previous.direction === 'asc' ? 'desc' : 'asc' }))}>
                    {sortedApplications.map((app) => <tr key={app.id} data-selected={selectedIds.includes(app.id)}>
                        <td className="rc-select"><input type="checkbox" checked={selectedIds.includes(app.id)} disabled={app.status !== 'PENDING' || bulkPending} onChange={() => toggleSelect(app.id)} aria-label={r('selectApplicant', { name: app.fullName || app.username })} /></td>
                        <td className="rc-identity"><UserIdentityCell avatarUrl={app.avatarUrl} fullName={app.fullName} username={app.username} /><p>{[app.position ? squadLabel(app.position, t) : null, app.ageGroup].filter(Boolean).join(' · ')}</p><ApplicantSummary application={app} /></td>
                        <td className="rc-job"><strong>{app.jobTitle || r('generalApplication')}</strong><small>{r(app.role)}</small></td>
                        <td>{app.createdAt ? formatDate(app.createdAt) : r('recently')}</td>
                        <td><span className="rc-status" data-status={app.status}>{recruitmentOutcome(app.status)}</span></td>
                        <td><div className="rc-actions"><button type="button" className="sd-button" onClick={() => setReviewId(app.id)}>{r('review')}<ArrowRight size={13} /></button></div></td>
                    </tr>)}
                </DataTable>
            </div>}
        </section>
        <div className="rc-help"><Info size={16} /><p>{r('playerNext')}</p>{onOpenPlayers && <button type="button" className="rc-link" onClick={onOpenPlayers}>{r('playersStep')}<ArrowRight size={13} /></button>}</div>
        {reviewedApplication && <ApplicationReview application={reviewedApplication} onClose={() => setReviewId(null)} onChanged={onRetry} onDecline={() => { setReviewId(null); onDeclineApplication(reviewedApplication.id); }} />}
        {bulkAction && <DecisionNoteModal title={bulkAction === 'ACCEPT' ? t('applications.acceptTitle') : t('applications.declineTitle')} subtitle={t(bulkAction === 'ACCEPT' ? 'decisions.bulkAcceptSubtitle' : 'applications.subtitle')} templateKey={bulkAction === 'ACCEPT' ? 'decisions.staffTemplate' : 'decisions.declineApplicationTemplate'} saving={bulkPending} confirmLabel={bulkAction === 'ACCEPT' ? t('decisions.accept') : t('applications.declineConfirm')} danger={bulkAction === 'DECLINE'} onClose={() => setBulkAction(null)} onConfirm={(message) => void handleBulkConfirm(message)} />}
    </div>;
};

const ApplicantSummary = ({ application: app }: { application: ClubMembershipApplication }) => {
    const { t } = useTranslation();
    return <div className="rc-summary">
        {app.age != null && <span>{t('applications.summaryAge', { age: app.age })}</span>}
        {app.preferredFoot && <span>{app.preferredFoot}</span>}
        {app.heightCm != null && <span>{t('applications.summaryHeight', { height: app.heightCm })}</span>}
        {app.currentClubName && <span>{app.currentClubName}</span>}
        {app.careerHistoryCount != null && app.careerHistoryCount > 0 && <span>{t('applications.summaryHistory', { count: app.careerHistoryCount })}</span>}
        {app.isMinor && <span className="rc-consent"><ShieldAlert size={12} />{t('applications.minor')}</span>}
        {app.isMinor && app.currentConsentStatus === 'PENDING' && <span className="rc-consent">{t('applications.consentPending')}</span>}
    </div>;
};

const ApplicationReview = ({ application, onClose, onChanged, onDecline }: { application: ClubMembershipApplication; onClose: () => void; onChanged: () => void; onDecline: () => void }) => {
    const r = useRecruitmentCopy();
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(true, dialogRef, onClose);
    return <div className="rc-overlay"><div className="rc-backdrop" onClick={onClose} /><div className="rc-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="application-review-title">
        <header className="rc-dialog-header"><div><span className="sd-eyebrow">{r('applicationDetails')}</span><h2 id="application-review-title">{application.fullName || application.username}</h2><p>{[application.jobTitle || r('generalApplication'), r(application.role)].join(' · ')}</p></div><button type="button" className="sd-icon-button" onClick={onClose} aria-label={r('close')}><X size={17} /></button></header>
        <div className="rc-dialog-body"><UserIdentityCell avatarUrl={application.avatarUrl} fullName={application.fullName} username={application.username} /><ApplicantSummary application={application} /><span className="rc-status" data-status={application.status}>{recruitmentOutcome(application.status)}</span><h3>{r('message')}</h3><p className="rc-message">{application.message || r('noMessage')}</p><RecruitmentApplication applicationId={application.id} onChanged={onChanged} /></div>
        <footer className="rc-dialog-footer"><button type="button" className="sd-button" onClick={onClose}>{r('close')}</button>{application.status === 'PENDING' && <><button type="button" className="sd-button rc-danger" onClick={onDecline}><X size={14} />{r('decline')}</button></>}</footer>
    </div></div>;
};
