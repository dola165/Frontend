import { MediaImage } from '../../ui/MediaImage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Briefcase, Check, Eye, Loader2, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import {
    acceptClubApplication, createClubJob, declineClubApplication, deleteClubJob, fetchAllClubJobs, fetchJobApplications, updateClubJob,
    type ClubJob, type ClubJobCategory, type ClubJobEngagementType, type ClubJobPayload
} from '../../../features/clubs/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import type { ClubMembershipApplication } from '../../../features/clubs/domain';
import { ErrorBlock, PageSpinner, Pill, SectionHeader } from '../helpers';
import { DecisionNoteModal } from './DecisionNoteModal';

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
export const JobsTab = ({ clubId, pendingKey, currentUserId, canReviewAllApplications }: JobsTabProps) => {
    const { t } = useTranslation();
    const [jobs, setJobs] = useState<ClubJob[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<ClubJob | 'new' | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [jobBusy, setJobBusy] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const applicantRequest = useRef(0);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
    const [selectedJob, setSelectedJob] = useState<ClubJob | null>(null);
    const [jobApplications, setJobApplications] = useState<ClubMembershipApplication[]>([]);
    const [applicationsLoading, setApplicationsLoading] = useState(false);
    const [applicationsError, setApplicationsError] = useState<string | null>(null);
    const [applicationDecision, setApplicationDecision] = useState<{ application: ClubMembershipApplication; accept: boolean } | null>(null);
    const [applicationPendingId, setApplicationPendingId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setJobs(await fetchAllClubJobs(clubId));
        } catch {
            setError(t('jobs.loadFailed'));
        }
    }, [clubId, t]);

    useEffect(() => { void load(); }, [load]);

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
                                <button type="button" onClick={() => void openApplicants(job)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--fc-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)]">
                                    <Eye className="h-3.5 w-3.5" /> View applicants
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={jobBusy || saving || !!editing || pendingKey === `job-${job.id}`}
                                onClick={() => void (async () => {
                                    setJobBusy(true);setError(null);
                                    try {
                                        await updateClubJob(clubId, job.id, { status: job.status === 'OPEN' ? 'CLOSED' : 'OPEN' });
                                        await load();
                                    } catch (error) { setError(extractApiErrorMessage(error, 'Could not change this posting.')); } finally {setJobBusy(false);}
                                })()}
                                className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] disabled:opacity-50"
                            >
                                {job.status === 'OPEN' ? t('jobs.close') : t('jobs.reopen')}
                            </button>
                            <button type="button" disabled={jobBusy || saving} onClick={() => setEditing(job)} aria-label={`Edit ${job.title}`} className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                aria-label={`Delete ${job.title}`}
                                disabled={jobBusy || saving || !!editing}
                                onClick={() => setDeleteId(job.id)}
                                className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-state-danger)]"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {error && <p role="alert">{error} <button className="underline" onClick={() => void load()}>Reload jobs</button></p>}
            {deleteId !== null && <div role="group" aria-label="Confirm delete job"><p>Delete this posting? A posting with applications must be closed instead.</p><button disabled={jobBusy} onClick={async () => {
                setJobBusy(true);setError(null);
                try {await deleteClubJob(clubId,deleteId);setDeleteId(null);await load();}
                catch(error) {setError(extractApiErrorMessage(error,'Could not delete this posting.'));}
                finally {setJobBusy(false);}
            }}>Confirm delete</button><button className="ml-4" disabled={jobBusy} onClick={() => setDeleteId(null)}>Keep posting</button></div>}
            {editing && (
                <JobForm
                    key={editing === 'new' ? 'new' : editing.id}
                    clubId={clubId}
                    job={editing === 'new' ? null : editing}
                    saving={saving}
                    formError={formError}
                    onCancel={() => { setEditing(null); setFormError(null); }}
                    onSubmit={async (payload) => {
                        if (saving) return;
                        setSaving(true);
                        setFormError(null);
                        try {
                            if (editing === 'new') {
                                await createClubJob(clubId, payload);
                            } else {
                                await updateClubJob(clubId, editing.id, payload);
                            }
                            setEditing(null);
                            await load();
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

const JobForm = ({
    job, saving, formError, onCancel, onSubmit
}: {
    clubId: number;
    job: ClubJob | null;
    saving: boolean;
    formError: string | null;
    onCancel: () => void;
    onSubmit: (payload: ClubJobPayload) => Promise<void>;
}) => {
    const { t } = useTranslation();
    const [title, setTitle] = useState(job?.title ?? '');
    const [description, setDescription] = useState(job?.description ?? '');
    const [ageGroup, setAgeGroup] = useState(job?.ageGroup ?? '');
    const [level, setLevel] = useState(job?.level ?? '');
    const [requiredRole, setRequiredRole] = useState(job?.requiredRole ?? '');
    const [category, setCategory] = useState<ClubJobCategory>(job?.category ?? 'OTHER');
    const [engagementType, setEngagementType] = useState<ClubJobEngagementType>(job?.engagementType ?? 'UNSPECIFIED');

    const inputClass = 'theme-surface-strong theme-border w-full border px-3 py-2 text-sm font-semibold text-[var(--fc-text-primary)] focus:border-fuchsia-500 outline-none';

    return (
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-4">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--fc-text-primary)]">{job ? t('jobs.editPosting') : t('jobs.newPosting')}</p>
                <button type="button" disabled={saving} onClick={onCancel} aria-label="Close job editor" className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]">
                    <X className="h-4 w-4" />
                </button>
            </div>
            {formError && <p className="mt-2 text-xs font-semibold text-[var(--fc-state-danger)]">{formError}</p>}
            <form
                onSubmit={(e) => { e.preventDefault(); void onSubmit({ title: title.trim(), description, ageGroup, level, requiredRole, category, engagementType }); }}
                className="mt-3 grid gap-3"
            >
                <input aria-label="Job title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120}
                    placeholder={t('jobs.titlePlaceholder')} className={inputClass} />
                <textarea aria-label="Job description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000}
                    placeholder={t('jobs.descriptionPlaceholder')} className={inputClass} />
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--fc-text-muted)]">Football role</span>
                        <select value={category} onChange={(e) => setCategory(e.target.value as ClubJobCategory)} className={inputClass}>
                            {JOB_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                    <label className="grid gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--fc-text-muted)]">Opportunity type</span>
                        <select value={engagementType} onChange={(e) => setEngagementType(e.target.value as ClubJobEngagementType)} className={inputClass}>
                            {ENGAGEMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                </div>
                <p className="text-xs text-[var(--fc-text-secondary)]">Player and coach openings use in-app applications. Other roles direct visitors to your club contact details; keep those details up to date.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                    <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className={inputClass}>
                        <option value="">{t('jobs.ageGroupAny')}</option>
                        {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass}>
                        <option value="">{t('jobs.levelAny')}</option>
                        {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <select value={requiredRole} onChange={(e) => setRequiredRole(e.target.value)} aria-label="Application route" className={inputClass}>
                        <option value="">Contact club (other roles)</option>
                        {REQUIRED_ROLES.map((r) => <option key={r} value={r}>{r === 'CLUB_ADMIN' ? 'Club admin (contact club)' : `${r.charAt(0)}${r.slice(1).toLowerCase()} application`}</option>)}
                    </select>
                </div>
                <button type="submit" disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-700 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('jobs.save')}
                </button>
            </form>
        </div>
    );
};
