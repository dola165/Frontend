import { ct, useCommerceCopy } from '../../store/copy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { CommerceDraftScope } from '../../../components/workspace/CommerceDraftScope';
import { useClearCommerceForm, useCommerceDraftState } from '../../../components/workspace/commerceDraftState';
import { Dialog } from '../../../design/Dialog';
import { Badge, Button, EmptyNote, PageFrame, PageHeader, SearchInput, Skeleton } from '../../../design/primitives';
import { acceptClubApplication, createClubJob, declineClubApplication, deleteClubJob, fetchAllClubJobs, fetchJobApplications, updateClubJob, type ClubJob } from '../../clubs/api';
import type { ClubMembershipApplication } from '../../clubs/domain';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { RoleApplicants, type ApplicantDecision } from './RoleApplicants';
import { appliesInApp, categoryName, engagementName, levelName } from './labels';
import { RoleForm } from './RoleForm';
import { RowMenu } from './RowMenu';
import '../../clubOperations/records/records.css';
import './commerce.css';

interface OpenRolesProps { clubId: number; pendingKey: string | null; currentUserId: number | null; canReviewAllApplications: boolean }

/**
 * Open roles: ongoing paid, volunteer or flexible club roles. Post and edit a role, close or reopen it,
 * delete one without applications (asked first), and review the people who applied.
 */
function OpenRoles({ clubId, pendingKey, currentUserId, canReviewAllApplications }: OpenRolesProps) {
    useCommerceCopy();
    const { t } = useTranslation();
    const clearForm = useClearCommerceForm();
    const [jobs, setJobs] = useState<ClubJob[] | null>(null), [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useCommerceDraftState<ClubJob | 'new' | null>('editing', null);
    const [saving, setSaving] = useCommerceDraftState('busy', false);
    const [formError, setFormError] = useCommerceDraftState<string | null>('formError', null);
    const [jobBusy, setJobBusy] = useCommerceDraftState('jobBusy', false);
    const [actionError, setActionError] = useCommerceDraftState<string | null>('actionError', null);
    const [actionMessage, setActionMessage] = useCommerceDraftState('actionMessage', '');
    const [revision, setRevision] = useCommerceDraftState('revision', 0);
    const [deleteTarget, setDeleteTarget] = useState<ClubJob | null>(null);
    const [latest, setLatest] = useState<ClubJob | null>(null), [loadingLatest, setLoadingLatest] = useState(false);
    const [query, setQuery] = useState(''), [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
    const [selectedJob, setSelectedJob] = useState<ClubJob | null>(null);
    const [applications, setApplications] = useState<ClubMembershipApplication[]>([]);
    const [applicationsLoading, setApplicationsLoading] = useState(false), [applicationsError, setApplicationsError] = useState<string | null>(null);
    const [decision, setDecision] = useState<ApplicantDecision | null>(null), [pendingId, setPendingId] = useState<number | null>(null);
    const loadRequest = useRef({ value: 0 }), applicantRequest = useRef(0);

    const load = useCallback(async () => {
        const request = ++loadRequest.current.value;
        setError(null);
        try { const records = await fetchAllClubJobs(clubId); if (request === loadRequest.current.value) setJobs(records); }
        catch { if (request === loadRequest.current.value) setError(t('jobs.loadFailed')); }
    }, [clubId, t]);
    useEffect(() => { const requests = loadRequest.current; void load(); return () => { requests.value++; }; }, [load, revision]);

    const visibleJobs = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return (jobs ?? []).filter(job => (statusFilter === 'ALL' || job.status === statusFilter)
            && (!needle || [job.title, job.category ?? '', job.engagementType ?? '', categoryName(job.category) ?? ''].some(value => value.toLowerCase().includes(needle))));
    }, [jobs, query, statusFilter]);
    const canReviewJob = (job: ClubJob) => canReviewAllApplications || job.createdBy === currentUserId;

    const openApplicants = async (job: ClubJob) => {
        const request = ++applicantRequest.current;
        setSelectedJob(job); setApplications([]); setApplicationsLoading(true); setApplicationsError(null);
        try { const result = await fetchJobApplications(clubId, job.id); if (request === applicantRequest.current) setApplications(result); }
        catch (failure) { if (request === applicantRequest.current) { setApplications([]); setApplicationsError(extractApiErrorMessage(failure, ct("Could not load applicants."))); } }
        finally { if (request === applicantRequest.current) setApplicationsLoading(false); }
    };
    const decide = async (message: string | null) => {
        if (!selectedJob || !decision || pendingId !== null) return;
        const { application, accept } = decision;
        setPendingId(application.id);
        try {
            if (accept) await acceptClubApplication(clubId, application.id, message);
            else await declineClubApplication(clubId, application.id, message);
            setDecision(null);
            setApplications(current => current.map(item => item.id === application.id ? { ...item, status: accept ? 'ACCEPTED' : 'DECLINED' } : item));
            try { setApplications(await fetchJobApplications(clubId, selectedJob.id)); }
            catch { setApplicationsError(ct("Decision saved, but the refreshed applicant list could not load. Please reload applicants.")); }
            await load();
        } catch (failure) { setApplicationsError(extractApiErrorMessage(failure, ct("Could not update this application."))); }
        finally { setPendingId(null); }
    };
    const changeStatus = async (job: ClubJob) => {
        if (jobBusy) return;
        setJobBusy(true); setError(null); setActionError(null); setActionMessage('');
        try {
            await updateClubJob(clubId, job.id, { status: job.status === 'OPEN' ? 'CLOSED' : 'OPEN', version: job.version });
            setActionMessage(job.status === 'OPEN' ? ct("Posting closed.") : ct("Posting reopened."));
            setRevision(n => n + 1);
        } catch (failure) { setActionError(extractApiErrorMessage(failure, ct("Could not change this posting."))); }
        finally { setJobBusy(false); }
    };
    const remove = async () => {
        if (jobBusy || !deleteTarget) return;
        // The confirmation closes at once; the pending delete shows on the page and survives leaving it.
        const target = deleteTarget;
        setDeleteTarget(null); setJobBusy(true); setError(null); setActionError(null); setActionMessage('');
        try { await deleteClubJob(clubId, target.id, target.version); setActionMessage(ct("Posting deleted.")); setRevision(n => n + 1); }
        catch (failure) { setActionError(extractApiErrorMessage(failure, ct("Could not delete this posting."))); }
        finally { setJobBusy(false); }
    };
    const viewLatest = async () => {
        if (!editing || editing === 'new') return;
        setLoadingLatest(true); setLatest(null);
        try {
            const records = await fetchAllClubJobs(clubId);
            setJobs(records);
            const record = records.find(item => item.id === editing.id);
            if (record) setLatest(record); else setFormError(ct("This posting is no longer available. Your draft is kept."));
        } catch { setFormError(ct("Could not load the latest posting. Your draft is kept. Please try again.")); }
        finally { setLoadingLatest(false); }
    };

    if (selectedJob) return <RoleApplicants job={selectedJob} applications={applications} loading={applicationsLoading} error={applicationsError} canReview={canReviewJob(selectedJob)}
        decision={decision} pendingId={pendingId} onRetry={() => void openApplicants(selectedJob)} onDecide={setDecision} onCancelDecision={() => setDecision(null)} onConfirm={message => void decide(message)}
        onBack={() => { applicantRequest.current++; setSelectedJob(null); setApplications([]); setApplicationsError(null); setDecision(null); }} />;

    const locked = saving || jobBusy || !!editing;
    const feedback = <>
        {jobBusy && <p className="gk-notice" role="status">{ct("Saving your change…")}</p>}
        {actionMessage && <p className="gk-notice" role="status">{actionMessage}</p>}
        {actionError && <div className="gk-notice gk-notice--danger"><span role="alert">{actionError}</span><Button size="sm" onClick={() => { setActionError(null); void load(); }}>{ct("Reload jobs")}</Button></div>}
        {error && <div className="gk-notice gk-notice--danger"><span role="alert">{error}</span><Button size="sm" onClick={() => void load()}>{ct("Reload jobs")}</Button></div>}
    </>;
    let body;
    if (jobs === null) body = error ? null : <div className="gk-panel cm-list" role="status" aria-label={ct("Loading roles")}><div className="cm-skeletons">{[0, 1, 2].map(i => <Skeleton key={i} height={56} />)}</div></div>;
    else if (!visibleJobs.length) body = <div className="gk-panel cm-list">{jobs.length
        ? <EmptyNote title={ct("No roles match")} action={<Button size="sm" onClick={() => { setQuery(''); setStatusFilter('ALL'); }}>{ct("Clear filters")}</Button>}>{ct("Try another status or search.")}</EmptyNote>
        : <EmptyNote title={t('jobs.empty')}>{ct("Post an ongoing paid, volunteer or flexible role. Candidates see it as soon as you save.")}</EmptyNote>}</div>;
    else body = <div className="gk-panel cm-list"><ul className="gk-list" aria-label={ct("Role postings")}>{visibleJobs.map(job => <li key={job.id}><div className="gk-list-row cm-row">
        <span className="gk-list-row__main">
            <h3 className="cm-row__title">{job.title}</h3>
            <span className="gk-list-row__meta">{[categoryName(job.category) || ct("Club role"), engagementName(job.engagementType) || ct("Engagement not specified"), job.ageGroup, levelName(job.level)].filter(Boolean).join(' · ')}</span>
            <span className="gk-list-row__meta">{appliesInApp(job.requiredRole) ? ct("Candidates apply in GrassKickZ") : ct("Candidates contact the club")}</span>
        </span>
        <span className="cm-row__trail">
            <Badge tone={job.status === 'OPEN' ? 'accent' : 'neutral'}>{job.status === 'OPEN' ? ct("Open") : ct("Closed")}</Badge>
            {canReviewJob(job) && <Button size="sm" disabled={locked} onClick={() => void openApplicants(job)}><Users aria-hidden="true" /><span className="gk-num">{job.applicationCount ?? 0}</span> {job.applicationCount === 1 ? "applicant" : 'applicants'}</Button>}
            <Button size="sm" aria-label={ct("Edit {v0}", { v0: job.title })} disabled={locked} onClick={() => setEditing(job)}><Pencil aria-hidden="true" />{ct("Edit")}</Button>
            <RowMenu name={job.title} disabled={locked}>
                <button type="button" className="cm-menu__item" disabled={locked || pendingKey === `job-${job.id}`} onClick={() => void changeStatus(job)}>{job.status === 'OPEN' ? t('jobs.close') : t('jobs.reopen')}</button>
                <button type="button" className="cm-menu__item cm-menu__item--danger" aria-label={ct("Delete {v0}", { v0: job.title })} disabled={locked} onClick={() => setDeleteTarget(job)}><Trash2 aria-hidden="true" />{ct("Delete posting")}</button>
            </RowMenu>
        </span>
    </div></li>)}</ul></div>;

    const recovery = editing && editing !== 'new' && <div className="gk-panel cm-recovery">
        <p>{ct("Check the latest saved posting before you decide what to change.")}</p>
        <div><Button size="sm" disabled={saving || loadingLatest} onClick={() => void viewLatest()}>{loadingLatest ? ct("Loading…") : ct("View latest saved posting")}</Button></div>
        {latest && <div role="region" aria-label={ct("Latest saved posting")} className="cm-recovery__latest">
            <h3>{latest.title}</h3>
            <p className="cm-row__message">{latest.description || ct("No description")}</p>
            <p className="cm-hint">{[latest.status === 'OPEN' ? ct("Open") : ct("Closed"), categoryName(latest.category), engagementName(latest.engagementType), latest.ageGroup, levelName(latest.level), appliesInApp(latest.requiredRole) ? ct("Apply in GrassKickZ") : ct("Contact the club")].filter(Boolean).join(' · ')}</p>
            <p className="cm-hint">{ct("Using the latest posting discards your unsaved edits. Copy anything you want to keep first.")}</p>
            <div><Button size="sm" variant="danger" disabled={saving} onClick={() => { clearForm(); setEditing(latest); setFormError(null); setLatest(null); }}>{ct("Discard my draft and use latest posting")}</Button></div>
        </div>}
    </div>;

    return <>
        <PageFrame className="cw-page cm-page" hidden={!!editing}>
            <PageHeader title={ct("Open roles")} subtitle={ct("Ongoing paid, volunteer or flexible roles at your club.")}
                actions={<Button variant="primary" disabled={locked} onClick={() => setEditing('new')}><Plus aria-hidden="true" />{t('jobs.postJob')}</Button>} />
            <div className="gk-stack">
                {jobs !== null && jobs.length > 0 && <div className="rec-toolbar">
                    <SearchInput className="rec-toolbar__search" aria-label={ct("Search role postings")} placeholder={ct("Search role postings")} value={query} onChange={event => setQuery(event.target.value)} />
                    <select className="gk-input" aria-label={ct("Filter by status")} value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}>
                        {(['ALL', 'OPEN', 'CLOSED'] as const).map(value => <option key={value} value={value}>{value === 'ALL' ? ct("All postings") : value === 'OPEN' ? ct("Open") : ct("Closed")} ({jobs.filter(job => value === 'ALL' || job.status === value).length})</option>)}</select>
                    <span className="rec-toolbar__count" role="status">{visibleJobs.length} {visibleJobs.length === 1 ? "role" : "roles"}</span>
                </div>}
                {feedback}
                {body}
            </div>
        </PageFrame>
        <Dialog open={deleteTarget !== null} role="alertdialog" size="sm" title={ct("Delete this posting?")} onClose={() => { if (!jobBusy) setDeleteTarget(null); }}
            description={ct("A posting with applications cannot be deleted. Close it instead, so its applications stay available.")}
            footer={<><Button variant="ghost" disabled={jobBusy} onClick={() => setDeleteTarget(null)}>{ct("Keep posting")}</Button>
                <Button variant="danger" disabled={jobBusy} onClick={() => void remove()}>{ct("Confirm delete")}</Button></>} />
        {editing && <RoleForm key={editing === 'new' ? 'new' : `${editing.id}:${editing.version}`} clubId={clubId} job={editing === 'new' ? null : editing}
            saving={saving || loadingLatest} formError={formError} recovery={recovery}
            onCancel={() => { clearForm(); setEditing(null); setFormError(null); setLatest(null); }}
            onSubmit={async payload => {
                if (saving) return;
                setSaving(true); setFormError(null);
                try {
                    if (editing === 'new') await createClubJob(clubId, payload);
                    else await updateClubJob(clubId, editing.id, { ...payload, version: editing.version });
                    clearForm(); setEditing(null); setRevision(n => n + 1);
                } catch (failure) { setFormError(extractApiErrorMessage(failure, t('jobs.saveFailed'))); }
                finally { setSaving(false); }
            }} />}
    </>;
}

export const OpenRolesPage = (props: OpenRolesProps) => <CommerceDraftScope clubId={props.clubId} feature="JobsTab"><OpenRoles {...props} /></CommerceDraftScope>;
