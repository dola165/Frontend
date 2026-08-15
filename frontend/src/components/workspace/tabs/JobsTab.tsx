import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
    createClubJob, deleteClubJob, fetchAllClubJobs, updateClubJob,
    type ClubJob, type ClubJobPayload
} from '../../../features/clubs/api';
import { ErrorBlock, PageSpinner, Pill, SectionHeader } from '../helpers';

interface JobsTabProps {
    clubId: number;
    pendingKey: string | null;
}

const AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'];
const LEVELS = ['ANY', 'EXPERIENCED', 'LICENSED'];

/**
 * Workspace Jobs tab (WEB_APP_MASTER_PLAN.md §4.2, Phase 2):
 * create/edit/close club job postings; candidates arrive in the Applications tab.
 */
export const JobsTab = ({ clubId, pendingKey }: JobsTabProps) => {
    const { t } = useTranslation();
    const [jobs, setJobs] = useState<ClubJob[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<ClubJob | 'new' | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            setJobs(await fetchAllClubJobs(clubId));
        } catch {
            setError(t('jobs.loadFailed'));
        }
    }, [clubId, t]);

    useEffect(() => { void load(); }, [load]);

    if (jobs == null) {
        return error ? <ErrorBlock message={error} onRetry={() => void load()} /> : <PageSpinner />;
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
                        className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                    >
                        <Plus className="h-3.5 w-3.5" /> {t('jobs.postJob')}
                    </button>
                }
            />

            {jobs.length === 0 ? (
                <p className="text-sm text-[var(--fc-text-secondary)]">{t('jobs.empty')}</p>
            ) : (
                <div className="space-y-1.5">
                    {jobs.map((job) => (
                        <div key={job.id} className="flex items-center gap-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3">
                            <Briefcase className="h-4 w-4 shrink-0 text-[var(--fc-text-muted)]" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--fc-text-primary)]">{job.title}</p>
                                <p className="text-xs text-[var(--fc-text-secondary)]">
                                    {[job.ageGroup, job.level].filter(Boolean).join(' · ') || '—'}
                                </p>
                            </div>
                            <Pill label={job.status ?? 'OPEN'} tone={job.status === 'OPEN' ? 'success' : 'neutral'} />
                            <button
                                type="button"
                                disabled={pendingKey === `job-${job.id}`}
                                onClick={() => void (async () => {
                                    try {
                                        await updateClubJob(clubId, job.id, { status: job.status === 'OPEN' ? 'CLOSED' : 'OPEN' });
                                        await load();
                                    } catch { /* surfaced by reload */ }
                                })()}
                                className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fc-text-secondary)] hover:text-[var(--fc-text-primary)] disabled:opacity-50"
                            >
                                {job.status === 'OPEN' ? t('jobs.close') : t('jobs.reopen')}
                            </button>
                            <button type="button" onClick={() => setEditing(job)} className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => void (async () => {
                                    await deleteClubJob(clubId, job.id);
                                    await load();
                                })()}
                                className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-state-danger)]"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <JobForm
                    clubId={clubId}
                    job={editing === 'new' ? null : editing}
                    saving={saving}
                    formError={formError}
                    onCancel={() => { setEditing(null); setFormError(null); }}
                    onSubmit={async (payload) => {
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
                        } catch {
                            setFormError(t('jobs.saveFailed'));
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

    const inputClass = 'theme-surface-strong theme-border w-full border px-3 py-2 text-sm font-semibold text-[#f4f4f5] focus:border-[#16a34a] outline-none';

    return (
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-4">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--fc-text-primary)]">{job ? t('jobs.editPosting') : t('jobs.newPosting')}</p>
                <button type="button" onClick={onCancel} className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]">
                    <X className="h-4 w-4" />
                </button>
            </div>
            {formError && <p className="mt-2 text-xs font-semibold text-[var(--fc-state-danger)]">{formError}</p>}
            <form
                onSubmit={(e) => { e.preventDefault(); void onSubmit({ title: title.trim(), description: description || null, ageGroup: ageGroup || null, level: level || null }); }}
                className="mt-3 grid gap-3"
            >
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120}
                    placeholder={t('jobs.titlePlaceholder')} className={inputClass} />
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000}
                    placeholder={t('jobs.descriptionPlaceholder')} className={inputClass} />
                <div className="grid gap-3 sm:grid-cols-2">
                    <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className={inputClass}>
                        <option value="">{t('jobs.ageGroupAny')}</option>
                        {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass}>
                        <option value="">{t('jobs.levelAny')}</option>
                        {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <button type="submit" disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('jobs.save')}
                </button>
            </form>
        </div>
    );
};
