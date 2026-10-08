import { CommerceDraftScope, CommerceDraftNotice } from '../CommerceDraftScope';
import { useCommerceDraftState, useClearCommerceForm } from '../commerceDraftState';
import { MediaImage } from '../../ui/MediaImage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Briefcase, Check, Eye, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import {
    acceptClubApplication, createClubJob, declineClubApplication, deleteClubJob, fetchAllClubJobs, fetchJobApplications, updateClubJob,
    type ClubJob, type ClubJobCategory, type ClubJobEngagementType, type ClubJobPayload
} from '../../../features/clubs/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import type { ClubMembershipApplication } from '../../../features/clubs/domain';
import { ErrorBlock, PageSpinner, Pill, SectionHeader } from '../helpers';
import { DecisionNoteModal } from './DecisionNoteModal';
import { EditorChecklist, EditorDiscardPrompt, EditorSection, WorkspaceEditor } from '../editor/WorkspaceEditor';

interface JobsTabProps {
    clubId: number;
    pendingKey: string | null;
    currentUserId: number | null;
    canReviewAllApplications: boolean;
}

const AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'];
const LEVELS = ['ANY', 'EXPERIENCED', 'LICENSED'];
const REQUIRED_ROLES = ['PLAYER', 'COACH', 'CLUB_ADMIN'];
const JOB_CATEGORIES: Array<{ value: ClubJobCategory; label: string }> = [
    { value: 'COACHING', label: 'Coaching' },
    { value: 'FOOTBALL_OPERATIONS', label: 'Football operations' },
    { value: 'ADMINISTRATION', label: 'Administration' },
    { value: 'MEDIA_COMMUNICATIONS', label: 'Media & communications' },
    { value: 'FACILITIES', label: 'Facilities & maintenance' },
    { value: 'MEDICAL', label: 'Medical & wellbeing' },
    { value: 'MATCHDAY', label: 'Matchday staff' },
    { value: 'OTHER', label: 'Other club role' },
];
const ENGAGEMENT_TYPES: Array<{ value: ClubJobEngagementType; label: string }> = [
    { value: 'PAID', label: 'Paid role' },
    { value: 'VOLUNTEER', label: 'Volunteer role' },
    { value: 'FLEXIBLE', label: 'Paid or volunteer' },
    { value: 'UNSPECIFIED', label: 'Not specified' },
];

/**
 * Workspace Jobs tab (WEB_APP_MASTER_PLAN.md §4.2, Phase 2):
 * create/edit/close club job postings; candidates arrive in the Applications tab.
 */
const JobsTabContent = ({ clubId, pendingKey, currentUserId, canReviewAllApplications }: JobsTabProps) => {
    const clearForm = useClearCommerceForm();
    const { t } = useTranslation();
    const [jobs, setJobs] = useState<ClubJob[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useCommerceDraftState<ClubJob | 'new' | null>("editing", null);
    const [saving, setSaving] = useCommerceDraftState("busy", false);
    const [formError, setFormError] = useCommerceDraftState<string | null>("formError", null);
    const [jobBusy, setJobBusy] = useCommerceDraftState('jobBusy', false);
    const [actionError, setActionError] = useCommerceDraftState<string | null>('actionError', null);
    const [actionMessage, setActionMessage] = useCommerceDraftState('actionMessage', '');
    const loadRequest = useRef({ value: 0 });
    const [deleteTarget, setDeleteTarget] = useState<ClubJob | null>(null);
    const [latest, setLatest] = useState<ClubJob | null>(null);
    const [loadingLatest, setLoadingLatest] = useState(false);
    const applicantRequest = useRef(0);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
    const [selectedJob, setSelectedJob] = useState<ClubJob | null>(null);
    const [jobApplications, setJobApplications] = useState<ClubMembershipApplication[]>([]);
    const [applicationsLoading, setApplicationsLoading] = useState(false);
    const [applicationsError, setApplicationsError] = useState<string | null>(null);
    const [applicationDecision, setApplicationDecision] = useState<{ application: ClubMembershipApplication; accept: boolean } | null>(null);
    const [applicationPendingId, setApplicationPendingId] = useState<number | null>(null);

    const [revision, setRevision] = useCommerceDraftState("revision", 0);
    const load = useCallback(async () => {
        const request = ++loadRequest.current.value;
        setError(null);
        try {
            const records = await fetchAllClubJobs(clubId);
            if (request === loadRequest.current.value) setJobs(records);
        } catch {
            if (request === loadRequest.current.value) setError(t('jobs.loadFailed'));
        }
    }, [clubId, t]);

    useEffect(() => { const requests = loadRequest.current; void load(); return () => { requests.value++; }; }, [load, revision]);

    const visibleJobs = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return (jobs ?? []).filter((job) => {
            const statusMatches = statusFilter === 'ALL' || job.status === statusFilter;
            const queryMatches = !normalized
                || job.title.toLowerCase().includes(normalized)
                || (job.category ?? '').toLowerCase().includes(normalized)
                || (job.engagementType ?? '').toLowerCase().includes(normalized);
            return statusMatches && queryMatches;
        });
    }, [jobs, query, statusFilter]);

    const canReviewJob = (job: ClubJob) => canReviewAllApplications || job.createdBy === currentUserId;

    const openApplicants = async (job: ClubJob) => {
        const request = ++applicantRequest.current;
        setSelectedJob(job);
        setJobApplications([]);
        setApplicationsLoading(true);
        setApplicationsError(null);
        try {
            const result = await fetchJobApplications(clubId, job.id);
            if(request === applicantRequest.current) setJobApplications(result);
        } catch (error) {
            if(request === applicantRequest.current) {setJobApplications([]);setApplicationsError(extractApiErrorMessage(error, 'Could not load applicants.'));}
        } finally {
            if(request === applicantRequest.current) setApplicationsLoading(false);
        }
    };

    const handleApplicationDecision = async (message: string | null) => {
        if (!selectedJob || !applicationDecision || applicationPendingId !== null) return;
        const { application, accept } = applicationDecision;
        setApplicationPendingId(application.id);
        try {
            if (accept) await acceptClubApplication(clubId, application.id, message);
            else await declineClubApplication(clubId, application.id, message);
            setApplicationDecision(null);
            setJobApplications(current => current.map(item => item.id === application.id ? {...item, status: accept ? 'ACCEPTED' : 'DECLINED'} : item));
            try { setJobApplications(await fetchJobApplications(clubId, selectedJob.id)); }
            catch { setApplicationsError('Decision saved, but the refreshed applicant list could not load. Please reload applicants.'); }
            await load();
        } catch (error) {
            setApplicationsError(extractApiErrorMessage(error, 'Could not update this application.'));
        } finally {
            setApplicationPendingId(null);
        }
    };

    if (jobs == null) {
        return error ? <ErrorBlock message={error} onRetry={() => void load()} /> : <PageSpinner />;
    }

    if (selectedJob) {
        return (
            <div className="space-y-4">
                <button type="button" disabled={applicationPendingId !== null} onClick={() => { applicantRequest.current++; setSelectedJob(null); setJobApplications([]); setApplicationsError(null); setApplicationDecision(null); }} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]">
                    <ArrowLeft className="h-4 w-4" /> Back to job postings
                </button>
                <SectionHeader
                    eyebrow="Applicants"
                    title={selectedJob.title}
                    description={selectedJob.status === 'OPEN' ? 'Review applicants and decide who moves forward.' : 'This posting is closed. Existing applications remain available for review.'}
                />
                {applicationsError && <ErrorBlock message={applicationsError} onRetry={() => void openApplicants(selectedJob)} />}
                {applicationsLoading ? <PageSpinner /> : jobApplications.length === 0 ? (
                    <p className="text-sm text-[var(--fc-text-secondary)]">No applications have been submitted for this posting.</p>
                ) : (
                    <div className="space-y-2">
                        {jobApplications.map((application) => {
                            const decided = application.status !== 'PENDING';
                            return (
                                <article key={application.id} className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-4">
                                    <div className="flex flex-wrap items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--fc-accent-soft)] text-sm font-bold text-[var(--fc-accent)]">
                                            {application.avatarUrl ? <MediaImage src={application.avatarUrl} alt="" className="h-full w-full object-cover" /> : (application.fullName || application.username).slice(0, 1).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-[var(--fc-text-primary)]">{application.fullName || application.username}</p>
                                            <p className="mt-0.5 text-xs text-[var(--fc-text-secondary)]">{[application.position, application.ageGroup, application.currentClubName].filter(Boolean).join(' · ') || application.role}</p>
                                        </div>
                                        <Pill label={application.status} tone={application.status === 'PENDING' ? 'warning' : application.status === 'ACCEPTED' ? 'success' : 'neutral'} />
                                    </div>
                                    {application.message && <p className="mt-3 text-sm leading-6 text-[var(--fc-text-secondary)]">{application.message}</p>}
                                    {canReviewJob(selectedJob) && !decided && (
                                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                                            <button type="button" disabled={applicationPendingId === application.id} onClick={() => setApplicationDecision({ application, accept: false })} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--fc-border)] px-3 py-1.5 text-xs font-semibold text-[var(--fc-text-secondary)] hover:text-[var(--fc-state-danger)] disabled:opacity-50">
                                                <X className="h-3.5 w-3.5" /> Decline
                                            </button>
                                            <button type="button" disabled={applicationPendingId === application.id} onClick={() => setApplicationDecision({ application, accept: true })} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fc-accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                                                <Check className="h-3.5 w-3.5" /> Accept
                                            </button>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
                {applicationDecision && (
                    <DecisionNoteModal
                        title={applicationDecision.accept ? 'Accept applicant?' : 'Decline applicant?'}
                        subtitle={applicationDecision.application.fullName || applicationDecision.application.username}
                        saving={applicationPendingId === applicationDecision.application.id}
                        danger={!applicationDecision.accept}
                        confirmLabel={applicationDecision.accept ? 'Accept applicant' : 'Decline applicant'}
                        onClose={() => setApplicationDecision(null)}
                        onConfirm={(message) => void handleApplicationDecision(message)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <SectionHeader
                eyebrow={t('jobs.title')}
                title={t('jobs.heading')}
                description={t('jobs.description')}
                action={
                    <button
                        type="button"
                        disabled={saving || jobBusy || !!editing}
                        onClick={() => setEditing('new')}
                        className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-700 px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                    >
                        <Plus className="h-3.5 w-3.5" /> {t('jobs.postJob')}
                    </button>
                }
            />

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-3">
                <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2">
                    <Search className="h-4 w-4 text-[var(--fc-text-muted)]" />
                    <span className="sr-only">Search job postings</span>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search postings" className="min-w-0 flex-1 bg-transparent text-sm text-[var(--fc-text-primary)] outline-none placeholder:text-[var(--fc-text-muted)]" />
                </label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-[var(--fc-border)] bg-[var(--fc-page-bg)] px-3 py-2 text-xs font-semibold text-[var(--fc-text-primary)]">
                    <option value="ALL">All statuses</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option>
                </select>
                <span className="text-xs text-[var(--fc-text-muted)]">{visibleJobs.length} posting{visibleJobs.length === 1 ? '' : 's'}</span>
            </div>

            {visibleJobs.length === 0 ? (
                <p className="text-sm text-[var(--fc-text-secondary)]">{t('jobs.empty')}</p>
            ) : (
                <div className="space-y-1.5">
                    {visibleJobs.map((job) => (
                        <div key={job.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3">
                            <Briefcase className="h-4 w-4 shrink-0 text-[var(--fc-text-muted)]" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--fc-text-primary)]">{job.title}</p>
                                <p className="text-xs text-[var(--fc-text-secondary)]">
                                    {[JOB_CATEGORIES.find((item) => item.value === job.category)?.label, ENGAGEMENT_TYPES.find((item) => item.value === job.engagementType)?.label, job.ageGroup, job.level].filter(Boolean).join(' · ') || '—'}
                                </p>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--fc-text-secondary)]" title="Pending applications">
                                <Users className="h-3.5 w-3.5" /> {job.applicationCount ?? 0}
                            </span>
                            <Pill label={job.status ?? 'OPEN'} tone={job.status === 'OPEN' ? 'success' : 'neutral'} />
                            {job.requiredRole && <Pill label={job.requiredRole} tone="neutral" />}
                            {canReviewJob(job) && (
                                <button type="button" disabled={saving || jobBusy || !!editing} onClick={() => void openApplicants(job)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--fc-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]">
                                    <Eye className="h-3.5 w-3.5" /> View applicants
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={jobBusy || saving || !!editing || pendingKey === `job-${job.id}`}
                                onClick={() => void (async () => {
                                    if (jobBusy) return;
                                    setJobBusy(true);setError(null);setActionError(null);setActionMessage('');
                                    try {
                                        await updateClubJob(clubId, job.id, { status: job.status === 'OPEN' ? 'CLOSED' : 'OPEN', version: job.version });
                                        setActionMessage(job.status === 'OPEN' ? 'Posting closed.' : 'Posting reopened.');
                                        setRevision(n => n + 1);
                                    } catch (error) { setActionError(extractApiErrorMessage(error, 'Could not change this posting.')); } finally {setJobBusy(false);}
                                })()}
                                className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] disabled:opacity-50"
                            >
                                {job.status === 'OPEN' ? t('jobs.close') : t('jobs.reopen')}
                            </button>
                            <button type="button" disabled={jobBusy || saving || !!editing} onClick={() => setEditing(job)} aria-label={`Edit ${job.title}`} className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                aria-label={`Delete ${job.title}`}
                                disabled={jobBusy || saving || !!editing}
                                onClick={() => setDeleteTarget(job)}
                                className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-state-danger)]"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {actionMessage && <p role="status">{actionMessage}</p>}
            {(error || actionError) && <p role="alert">{error || actionError} <button className="underline" onClick={() => { setActionError(null); void load(); }}>Reload jobs</button></p>}
            {deleteTarget !== null && <div role="group" aria-label="Confirm delete job"><p>Delete this posting? A posting with applications must be closed instead.</p><button disabled={jobBusy} onClick={async () => {
                if (jobBusy) return;
                                    setJobBusy(true);setError(null);setActionError(null);setActionMessage('');
                try {await deleteClubJob(clubId,deleteTarget.id,deleteTarget.version);setDeleteTarget(null);setActionMessage('Posting deleted.');setRevision(n => n + 1);}
                catch(error) {setActionError(extractApiErrorMessage(error,'Could not delete this posting.'));}
                finally {setJobBusy(false);}
            }}>Confirm delete</button><button className="ml-4" disabled={jobBusy} onClick={() => setDeleteTarget(null)}>Keep posting</button></div>}
            {editing && editing !== 'new' && formError && <div id={`job-editor-recovery-${clubId}`} className="workspace-editor__recovery space-y-3 rounded-xl border border-fuchsia-700 p-4">
                <p>Your draft is kept below. You can check the latest saved posting before deciding what to change.</p>
                <button type="button" disabled={saving || loadingLatest} className="rounded-lg bg-fuchsia-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={async () => {
                    setLoadingLatest(true); setLatest(null);
                    try {
                        const records = await fetchAllClubJobs(clubId);
                        setJobs(records);
                        const record = records.find(item => item.id === editing.id);
                        if (record) setLatest(record);
                        else setFormError('This posting is no longer available. Your draft is kept below.');
                    } catch { setFormError('Could not load the latest posting. Your draft is kept below. Please try again.'); }
                    finally { setLoadingLatest(false); }
                }}>View latest saved posting</button>
                {latest && <div role="region" aria-label="Latest saved posting" className="space-y-2">
                    <h3 className="font-semibold">{latest.title}</h3>
                    <p className="whitespace-pre-wrap">{latest.description || 'No description'}</p>
                    <p>{[latest.status, JOB_CATEGORIES.find(item => item.value === latest.category)?.label, ENGAGEMENT_TYPES.find(item => item.value === latest.engagementType)?.label, latest.ageGroup, latest.level, latest.requiredRole || 'Contact club'].filter(Boolean).join(' · ')}</p>
                    <p>Replacing your draft discards your unsaved edits. Copy anything you want to keep first.</p>
                    <button type="button" disabled={saving} className="rounded-lg bg-fuchsia-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => { clearForm(); setEditing(latest); setFormError(null); setLatest(null); }}>Discard my draft and use latest posting</button>
                </div>}
            </div>}
            {editing && (
                <JobForm
                    key={editing === 'new' ? 'new' : `${editing.id}:${editing.version}`}
                    clubId={clubId}
                    job={editing === 'new' ? null : editing}
                    saving={saving || loadingLatest}
                    formError={formError}
                    onCancel={() => { clearForm(); setEditing(null); setFormError(null); setLatest(null); }}
                    onSubmit={async (payload) => {
                        if (saving) return;
                        setSaving(true);
                        setFormError(null);
                        try {
                            if (editing === 'new') {
                                await createClubJob(clubId, payload);
                            } else {
                                await updateClubJob(clubId, editing.id, { ...payload, version: editing.version });
                            }
                            clearForm(); setEditing(null);
                            setRevision(n => n + 1);
                        } catch (error) {
                            setFormError(extractApiErrorMessage(error, t('jobs.saveFailed')));
                        } finally {
                            setSaving(false);
                        }
                    }}
                />
            )}
        </div>
    );
};

const JobForm = ({ clubId, job, saving, formError, onCancel, onSubmit }: {
    clubId: number;
    job: ClubJob | null;
    saving: boolean;
    formError: string | null;
    onCancel: () => void;
    onSubmit: (payload: ClubJobPayload) => Promise<void>;
}) => {
    const { t } = useTranslation();
    const [title, setTitle] = useCommerceDraftState("form:title", job?.title ?? '');
    const [description, setDescription] = useCommerceDraftState("form:description", job?.description ?? '');
    const [ageGroup, setAgeGroup] = useCommerceDraftState("form:ageGroup", job?.ageGroup ?? '');
    const [level, setLevel] = useCommerceDraftState("form:level", job?.level ?? '');
    const [requiredRole, setRequiredRole] = useCommerceDraftState("form:requiredRole", job?.requiredRole ?? '');
    const [category, setCategory] = useCommerceDraftState<ClubJobCategory>("form:category", job?.category ?? 'OTHER');
    const [engagementType, setEngagementType] = useCommerceDraftState<ClubJobEngagementType>("form:engagementType", job?.engagementType ?? 'UNSPECIFIED');
    const [discard, setDiscard] = useState(false);
    const inAppApplications = requiredRole === 'PLAYER' || requiredRole === 'COACH';
    return <WorkspaceEditor
        title={job ? t('jobs.editPosting') : t('jobs.newPosting')} eyebrow="Club opportunities / Job editor" accent="job" formLabel="Job editor"
        description="Help the right people see where they fit. Describe the work, the commitment and how candidates should get in touch with your club."
        backLabel="Back to job postings" closeLabel="Close job editor" saving={saving} saveLabel={t('jobs.save')}
        footerNote={job ? `Saving updates this posting and keeps it ${job.status === 'CLOSED' ? 'closed' : 'open'}.` : 'Saving creates an open posting, visible to candidates. Review the details before saving.'}
        onRequestClose={() => setDiscard(true)}
        onSubmit={event => {
            event.preventDefault();
            if (saving) return;
            void onSubmit({ title: title.trim(), description, ageGroup, level, requiredRole, category, engagementType });
        }}
        feedback={formError && <><p role="alert">{formError}</p><p>Your edits have been kept.{job && <> <a className="underline" href={`#job-editor-recovery-${clubId}`}>Check the latest saved posting</a> before replacing your draft.</>}</p></>}
        confirmation={discard && <EditorDiscardPrompt label="Discard job edits" disabled={saving} onKeepEditing={() => setDiscard(false)} onDiscard={onCancel}/>}
        preview={<>
            <section className="workspace-editor__preview" aria-label="Job preview">
                <div className="workspace-editor__preview-label"><span>Candidate preview</span><span>Unsaved</span></div>
                <div className="workspace-editor__preview-body">
                    <Briefcase size={26} strokeWidth={1.4} aria-hidden="true"/>
                    <span className="workspace-editor__badge">{JOB_CATEGORIES.find(item => item.value === category)?.label}</span>
                    <h4>{title.trim() || 'Your next club opening'}</h4>
                    <div className="workspace-editor__preview-tags"><span className="workspace-editor__badge">{ENGAGEMENT_TYPES.find(item => item.value === engagementType)?.label}</span>{ageGroup && <span className="workspace-editor__badge">{ageGroup}</span>}{level && level !== 'ANY' && <span className="workspace-editor__badge">{level.charAt(0) + level.slice(1).toLowerCase()}</span>}</div>
                    <p className="workspace-editor__preview-description">{description.trim() || 'Explain the responsibilities, expected commitment and what your club offers.'}</p>
                    <span className="workspace-editor__badge">{inAppApplications ? 'Apply in GrassKickZ' : 'Contact the club'}</span>
                </div>
                <p className="workspace-editor__preview-footnote">{inAppApplications ? 'Candidates send an application. You can review it from this posting.' : 'Candidates use your club’s public contact details. Make sure those details are current.'}</p>
            </section>
            <EditorChecklist title="Before you save" items={[
                { label: 'A clear job title', complete: !!title.trim() },
                { label: 'Responsibilities and commitment (recommended)', complete: !!description.trim() },
                { label: 'Paid or volunteer terms (recommended)', complete: engagementType !== 'UNSPECIFIED' },
            ]}>{job ? 'Edits keep the existing application route unless you change it below.' : 'New postings are open immediately after saving.'} Choose the application route that fits this opening.</EditorChecklist>
        </>}
    >
        <EditorSection number="01" title="The opportunity" description="Give candidates a specific title and enough detail to decide whether this role fits them.">
            <label className="workspace-editor__field"><span>Job title<span className="workspace-editor__required" aria-hidden="true">*</span></span><input autoFocus aria-label="Job title" type="text" value={title} onChange={e => setTitle(e.target.value)} required maxLength={120} placeholder={t('jobs.titlePlaceholder')}/></label>
            <label className="workspace-editor__field"><span>Job description<span className="workspace-editor__count" aria-hidden="true">{description.length}/2000</span></span><textarea aria-label="Job description" value={description} onChange={e => setDescription(e.target.value)} rows={7} maxLength={2000} placeholder={t('jobs.descriptionPlaceholder')}/></label>
            <p className="workspace-editor__hint">Include responsibilities, location, expected days or hours, experience and what the club offers.</p>
            <div className="workspace-editor__row">
                <label className="workspace-editor__field">Football role<select value={category} onChange={e => setCategory(e.target.value as ClubJobCategory)}>{JOB_CATEGORIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="workspace-editor__field">Opportunity type<select value={engagementType} onChange={e => setEngagementType(e.target.value as ClubJobEngagementType)}>{ENGAGEMENT_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            </div>
        </EditorSection>
        <EditorSection number="02" title="Who you are looking for" description="Use these optional filters when the opening is for a particular team or level of experience.">
            <div className="workspace-editor__row">
                <label className="workspace-editor__field">Age group<select value={ageGroup} onChange={e => setAgeGroup(e.target.value)}><option value="">{t('jobs.ageGroupAny')}</option>{AGE_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}</select></label>
                <label className="workspace-editor__field">Experience level<select value={level} onChange={e => setLevel(e.target.value)}><option value="">{t('jobs.levelAny')}</option>{LEVELS.map(item => <option key={item} value={item}>{item.charAt(0) + item.slice(1).toLowerCase()}</option>)}</select></label>
            </div>
        </EditorSection>
        <EditorSection number="03" title="How candidates apply" description="Choose the next step candidates will see on the public posting.">
            <label className="workspace-editor__field">Application route<select aria-label="Application route" value={requiredRole} onChange={e => setRequiredRole(e.target.value)}><option value="">Contact club (other roles)</option>{REQUIRED_ROLES.map(role => <option key={role} value={role}>{role === 'CLUB_ADMIN' ? 'Club admin (contact club)' : `${role.charAt(0)}${role.slice(1).toLowerCase()} application`}</option>)}</select></label>
            <p className="workspace-editor__hint">{inAppApplications ? 'Players and coaches submit an application in GrassKickZ. Open “View applicants” on this posting to review candidates and respond.' : 'This opening directs candidates to your club’s contact details. Add a clear contact method to the description and keep your public club details up to date.'}</p>
        </EditorSection>
    </WorkspaceEditor>;
};
export const JobsTab = (props: Parameters<typeof JobsTabContent>[0]) => <CommerceDraftScope clubId={props.clubId} feature="JobsTab"><CommerceDraftNotice/><JobsTabContent {...props}/></CommerceDraftScope>;
