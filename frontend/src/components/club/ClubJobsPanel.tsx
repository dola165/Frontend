import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Briefcase, Loader2, X } from 'lucide-react';
import { createClubApplication, fetchClubJobs, type ClubJob } from '../../features/clubs/api';
import { extractApiErrorMessage } from '../../utils/apiError';

interface ClubJobsPanelProps {
    clubId: number;
    isAuthenticated: boolean;
}

/**
 * Public "Open roles" section on the club profile (WEB_APP_MASTER_PLAN.md §4.2).
 * Applying routes through the existing application pipeline with role COACH
 * and a jobId link.
 */
export const ClubJobsPanel = ({ clubId, isAuthenticated }: ClubJobsPanelProps) => {
    const { t } = useTranslation();
    const [jobs, setJobs] = useState<ClubJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [applyingJob, setApplyingJob] = useState<ClubJob | null>(null);
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchClubJobs(clubId)
            .then((data) => { if (!cancelled) setJobs(data); })
            .catch(() => { if (!cancelled) setJobs([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [clubId]);

    const submitApplication = async () => {
        if (!applyingJob) return;
        setSaving(true);
        setError(null);
        try {
            await createClubApplication(clubId, 'COACH', message.trim() || null, { jobId: applyingJob.id });
            setSuccess(t('jobs.sent'));
            setApplyingJob(null);
            setMessage('');
        } catch (err) {
            setError(extractApiErrorMessage(err, t('jobs.sendFailed')));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return null;
    }
    if (jobs.length === 0) {
        return null;
    }

    return (
        <section className="theme-surface theme-border rounded-xl border px-5 py-4">
            <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#16a34a]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a1a1aa]">{t('jobs.openRoles')}</p>
            </div>
            <div className="mt-3 space-y-2">
                {jobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#ffffff0d] bg-elevated px-4 py-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#f4f4f5]">{job.title}</p>
                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#a1a1aa]">
                                {[job.ageGroup, job.level].filter(Boolean).join(' · ') || t('jobs.coachingRole')}
                            </p>
                        </div>
                        {isAuthenticated ? (
                            <button
                                type="button"
                                onClick={() => { setApplyingJob(job); setError(null); setSuccess(null); }}
                                className="shrink-0 rounded-full border border-[#16a34a] bg-[#16a34a]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#16a34a] hover:bg-[#16a34a]/20"
                            >
                                {t('jobs.apply')}
                            </button>
                        ) : (
                            <Link
                                to={`/login?next=/clubs/${clubId}`}
                                className="shrink-0 rounded-full border border-[#16a34a] bg-[#16a34a]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#16a34a] hover:bg-[#16a34a]/20"
                            >
                                {t('jobs.signInToApply')}
                            </Link>
                        )}
                    </div>
                ))}
            </div>
            {success && <p className="mt-3 text-xs font-semibold text-[#16a34a]">{success}</p>}

            {applyingJob && (
                <div className="fixed inset-0 z-[1300] flex items-center justify-center">
                    <div className="theme-overlay absolute inset-0" onClick={() => setApplyingJob(null)} />
                    <div className="relative z-10 mx-4 w-full max-w-md border border-[#ffffff0d] bg-[#0f1117] shadow-2xl">
                        <div className="flex items-center justify-between border-b border-[#ffffff0d] px-5 py-4">
                            <h2 className="text-sm font-semibold text-[#f4f4f5]">{t('jobs.applyTitle', { title: applyingJob.title })}</h2>
                            <button type="button" onClick={() => setApplyingJob(null)} className="text-[#a1a1aa] hover:text-[#f4f4f5]">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-3 px-5 py-5">
                            {error && (
                                <div className="border border-[color:var(--state-danger)] bg-[color:var(--state-danger-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--state-danger)]">
                                    {error}
                                </div>
                            )}
                            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">{t('jobs.message')}</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={4}
                                maxLength={2000}
                                placeholder={t('jobs.messageHint')}
                                className="theme-surface-strong theme-border w-full border px-3 py-2 text-sm font-semibold text-[#f4f4f5] focus:border-[#16a34a] outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => void submitApplication()}
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 border border-[#16a34a] bg-[#16a34a] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : t('jobs.sendApplication')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
