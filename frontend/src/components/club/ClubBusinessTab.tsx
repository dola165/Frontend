import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ClubOpportunities } from './ClubOpportunities';
import {
    acceptClubApplication,
    cancelClubApplication,
    createClubApplication,
    declineClubApplication,
    fetchAllClubJobs,
    fetchClubJobs,
    fetchJobApplications,
    type ClubJob
} from '../../features/clubs/api';
import {
    canManageClubOperations,
    isLeadershipRole,
    type ClubMembershipApplication,
    type ClubMembershipRole
} from '../../features/clubs/domain';
import type { ClubProfile } from '../../pages/ClubProfilePage';
import { extractApiErrorMessage } from '../../utils/apiError';

/**
 * Club "Business" tab (docs/MAP_SEARCH_AND_CLUB_JOBS_PLAN.md item 5): job
 * postings + per-job applications pipeline + the business-opportunities board.
 * Access mirrors the backend: viewing applications requires the job's creator
 * or an OWNER/CLUB_ADMIN; applying is open to authenticated non-creators.
 */
export const ClubBusinessTab = ({
    club,
    ownClubRole,
    isAuthenticated,
    currentUserId,
    onDataChanged
}: {
    club: ClubProfile;
    ownClubRole: ClubMembershipRole | null;
    isAuthenticated: boolean;
    currentUserId?: number | null;
    onDataChanged?: () => void;
}) => {
    const { t } = useTranslation();

    const staffView = canManageClubOperations(ownClubRole);
    const leadership = isLeadershipRole(ownClubRole);

    const [jobs, setJobs] = useState<ClubJob[]>([]);
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [applications, setApplications] = useState<ClubMembershipApplication[]>([]);
    const [loadingApplications, setLoadingApplications] = useState(false);
    const [applyingJob, setApplyingJob] = useState<ClubJob | null>(null);
    const [applyMessage, setApplyMessage] = useState('');
    const [submittingApplication, setSubmittingApplication] = useState(false);
    const [actioningApplicationId, setActioningApplicationId] = useState<number | null>(null);

    const loadJobs = useCallback(async () => {
        setLoadingJobs(true);
        try {
            const result = staffView
                ? await fetchAllClubJobs(club.id)
                : await fetchClubJobs(club.id);
            setJobs(result);
        } catch (error) {
            console.error('Failed to load club jobs', error);
            toast.error(t('jobs.loadFailed'));
        } finally {
            setLoadingJobs(false);
        }
    }, [club.id, staffView, t]);

    useEffect(() => {
        void loadJobs();
    }, [loadJobs]);

    useEffect(() => {
        if (selectedJobId == null) {
            setApplications([]);
            return;
        }
        let active = true;
        setLoadingApplications(true);
        void fetchJobApplications(club.id, selectedJobId)
            .then((result) => {
                if (active) setApplications(result);
            })
            .catch((error) => {
                console.error('Failed to load job applications', error);
                toast.error(extractApiErrorMessage(error, t('jobs.loadFailed')));
            })
            .finally(() => {
                if (active) setLoadingApplications(false);
            });
        return () => {
            active = false;
        };
    }, [club.id, selectedJobId, t]);

    const canViewApplications = (job: ClubJob) =>
        leadership || (job.createdBy != null && job.createdBy === currentUserId);

    const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;

    const handleApply = async () => {
        if (!applyingJob) return;
        setSubmittingApplication(true);
        try {
            await createClubApplication(club.id, 'COACH', applyMessage.trim() || null, { jobId: applyingJob.id });
            toast.success(t('jobs.sent'));
            setApplyingJob(null);
            setApplyMessage('');
            onDataChanged?.();
            await loadJobs();
        } catch (error) {
            console.error('Failed to send job application', error);
            toast.error(extractApiErrorMessage(error, t('jobs.sendFailed')));
        } finally {
            setSubmittingApplication(false);
        }
    };

    const handleWithdraw = async () => {
        if (club.pendingApplicationId == null) return;
        try {
            await cancelClubApplication(club.id, club.pendingApplicationId);
            toast.success(t('business.withdrawn'));
            onDataChanged?.();
            await loadJobs();
        } catch (error) {
            console.error('Failed to withdraw job application', error);
            toast.error(extractApiErrorMessage(error, t('business.actionFailed')));
        }
    };

    const handleDecision = async (applicationId: number, accept: boolean) => {
        setActioningApplicationId(applicationId);
        try {
            if (accept) {
                await acceptClubApplication(club.id, applicationId);
            } else {
                await declineClubApplication(club.id, applicationId);
            }
            toast.success(accept ? t('business.accepted') : t('business.declined'));
            const refreshed = await fetchJobApplications(club.id, selectedJobId as number);
            setApplications(refreshed);
            await loadJobs();
        } catch (error) {
            console.error('Failed to update application', error);
            toast.error(extractApiErrorMessage(error, t('business.actionFailed')));
        } finally {
            setActioningApplicationId(null);
        }
    };

    const statusLabel = (status: string) => {
        switch (status) {
            case 'PENDING': return t('business.statusPending');
            case 'ACCEPTED': return t('business.statusAccepted');
            case 'DECLINED': return t('business.statusRejected');
            case 'CANCELLED': return t('business.statusWithdrawn');
            default: return status;
        }
    };

    if (selectedJobId != null) {
        return (
            <div className="space-y-4">
                <button
                    type="button"
                    onClick={() => setSelectedJobId(null)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t('business.backToJobs')}
                </button>

                <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-[#f4f4f5]">{selectedJob?.title ?? t('business.applications')}</h3>
                        {selectedJob && (
                            <span className="rounded-full border border-[#ffffff0d] bg-[#0f1117] px-2.5 py-1 text-xs font-semibold text-[#a1a1aa]">
                                {[selectedJob.ageGroup, selectedJob.level].filter(Boolean).join(' · ') || t('business.applications')}
                            </span>
                        )}
                    </div>

                    {loadingApplications ? (
                        <div className="mt-5 flex justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-[#16a34a]" />
                        </div>
                    ) : applications.length === 0 ? (
                        <p className="mt-4 text-sm text-[#a1a1aa]">{t('business.noApplications')}</p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {applications.map((application) => (
                                <div
                                    key={application.id}
                                    className="rounded-xl border border-[#ffffff0d] bg-[#0f1117] p-4"
                                >
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#16a34a]/10">
                                            {application.avatarUrl ? (
                                                <img src={application.avatarUrl} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-sm font-bold text-[#16a34a]">
                                                    {(application.fullName ?? application.username).slice(0, 1).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-[#f4f4f5]">{application.fullName ?? application.username}</p>
                                            <p className="mt-0.5 truncate text-xs text-[#a1a1aa]">
                                                {[application.position, application.ageGroup].filter(Boolean).join(' · ') || application.role}
                                            </p>
                                        </div>
                                        <span
                                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                application.status === 'PENDING'
                                                    ? 'border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#f59e0b]'
                                                    : application.status === 'ACCEPTED'
                                                        ? 'border-[#16a34a]/25 bg-[#16a34a]/10 text-[#16a34a]'
                                                        : 'border-[#ffffff0d] bg-[#ffffff05] text-[#a1a1aa]'
                                            }`}
                                        >
                                            {statusLabel(application.status)}
                                        </span>
                                    </div>

                                    {application.message && (
                                        <p className="mt-3 text-sm leading-6 text-[#a1a1aa]">{application.message}</p>
                                    )}

                                    {application.status === 'PENDING' && selectedJob && canViewApplications(selectedJob) && (
                                        <div className="mt-4 flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void handleDecision(application.id, false)}
                                                disabled={actioningApplicationId === application.id}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#ffffff0d] px-3 py-1.5 text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors disabled:opacity-50"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                {t('business.decline')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleDecision(application.id, true)}
                                                disabled={actioningApplicationId === application.id}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#16a34a] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                                            >
                                                {actioningApplicationId === application.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Check className="h-3.5 w-3.5" />
                                                )}
                                                {t('business.accept')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <section className="rounded-xl border border-[#ffffff0d] bg-[#16181d] p-5">
                <h3 className="text-lg font-bold text-[#f4f4f5]">{t('jobs.openRoles')}</h3>

                {loadingJobs ? (
                    <div className="mt-5 flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-[#16a34a]" />
                    </div>
                ) : jobs.length === 0 ? (
                    <p className="mt-4 text-sm text-[#a1a1aa]">{t('jobs.empty')}</p>
                ) : (
                    <div className="mt-4 space-y-3">
                        {jobs.map((job) => {
                            const isMine = job.createdBy != null && job.createdBy === currentUserId;
                            const isApplied = club.pendingApplicationJobId != null && club.pendingApplicationJobId === job.id;
                            return (
                                <div key={job.id} className="rounded-xl border border-[#ffffff0d] bg-[#0f1117] p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-[#f4f4f5]">{job.title}</p>
                                            <p className="mt-0.5 text-xs text-[#a1a1aa]">
                                                {[job.ageGroup, job.level].filter(Boolean).join(' · ') || t('jobs.coachingRole')}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            {job.status === 'CLOSED' && (
                                                <span className="rounded-full border border-[#ffffff0d] bg-[#ffffff05] px-2.5 py-1 text-xs font-semibold text-[#a1a1aa]">
                                                    {t('jobs.close')}
                                                </span>
                                            )}
                                            {canViewApplications(job) && (job.applicationCount ?? 0) > 0 && (
                                                <span className="rounded-full border border-[#f59e0b]/25 bg-[#f59e0b]/10 px-2.5 py-1 text-xs font-semibold text-[#f59e0b]">
                                                    {t('business.pendingBadge', { count: job.applicationCount ?? 0 })}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {job.description && (
                                        <p className="mt-2 text-sm leading-6 text-[#a1a1aa] line-clamp-2">{job.description}</p>
                                    )}

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {canViewApplications(job) && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedJobId(job.id)}
                                                className="rounded-lg border border-[#ffffff0d] px-3 py-1.5 text-xs font-semibold text-[#f4f4f5] hover:bg-[#ffffff05] transition-colors"
                                            >
                                                {t('business.viewApplications')}
                                            </button>
                                        )}
                                        {isApplied ? (
                                            <>
                                                <span className="rounded-full border border-[#16a34a]/25 bg-[#16a34a]/10 px-2.5 py-1 text-xs font-semibold text-[#16a34a]">
                                                    {t('business.applied')}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleWithdraw()}
                                                    className="rounded-lg border border-[#ffffff0d] px-3 py-1.5 text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                                                >
                                                    {t('business.withdraw')}
                                                </button>
                                            </>
                                        ) : isAuthenticated && !isMine ? (
                                            <button
                                                type="button"
                                                onClick={() => setApplyingJob(job)}
                                                className="rounded-lg bg-[#16a34a] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity"
                                            >
                                                {t('jobs.apply')}
                                            </button>
                                        ) : !isAuthenticated ? (
                                            <Link
                                                to={`/login?next=/clubs/${club.id}`}
                                                className="rounded-lg border border-[#ffffff0d] px-3 py-1.5 text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                                            >
                                                {t('jobs.signInToApply')}
                                            </Link>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <ClubOpportunities club={club} showOpportunityBoard />

            {applyingJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setApplyingJob(null)} />
                    <div className="relative z-10 w-full max-w-lg rounded-xl border border-[#ffffff0d] bg-[#16181d] p-5">
                        <div className="flex items-start justify-between gap-4">
                            <h3 className="text-lg font-bold text-[#f4f4f5]">{t('jobs.applyTitle', { title: applyingJob.title })}</h3>
                            <button type="button" onClick={() => setApplyingJob(null)} className="text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <label className="mt-4 block">
                            <span className="text-sm font-semibold text-[#f4f4f5]">{t('jobs.message')}</span>
                            <textarea
                                rows={4}
                                value={applyMessage}
                                onChange={(event) => setApplyMessage(event.target.value)}
                                placeholder={t('jobs.messageHint')}
                                maxLength={500}
                                className="mt-2 w-full rounded-lg border border-[#ffffff0d] bg-[#0f1117] p-3 text-sm text-[#f4f4f5] placeholder:text-[#71717a] focus:border-[#16a34a]/50 focus:outline-none"
                            />
                        </label>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setApplyingJob(null)}
                                className="rounded-lg border border-[#ffffff0d] px-4 py-2 text-sm font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                            >
                                {t('business.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleApply()}
                                disabled={submittingApplication}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {submittingApplication && <Loader2 className="h-4 w-4 animate-spin" />}
                                {t('jobs.sendApplication')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
