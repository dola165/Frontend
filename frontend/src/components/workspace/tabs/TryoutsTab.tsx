import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../../api/axiosConfig';
import { createTryout, deleteTryout, updateTryout, type TryoutDto } from '../../../api/tryouts';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { DataTable, EmptyState, ErrorBlock, PageSpinner, Pill, SectionHeader } from '../helpers';
import type { SortState } from '../helpers';
import { UserIdentityCell } from '../UserIdentityCell';
import { StatusCell } from '../StatusCell';
import { OverflowActions } from '../../ui/OverflowActions';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import type { TryoutApplicantDto } from '../types';

interface TryoutsTabProps {
    clubId: number;
    tryoutApplicants: TryoutApplicantDto[];
    tryoutsLoading: boolean;
    pendingKey: string | null;
    /** Phase A2 — ACCEPTED opens the note modal in the parent; REJECTED stays direct. */
    onTryoutStatus: (applicationId: number, status: 'ACCEPTED' | 'REJECTED') => void;
}

interface TryoutPayload {
    title: string;
    tryoutDate: string;
    deadline?: string;
    position?: string;
    ageGroup?: string;
    description?: string;
}

const TRYOUT_ACTION_FAILED = 'Tryout action failed';

/** "2026-08-20T18:00:00" → "2026-08-20T18:00" for datetime-local inputs. */
const toLocalInput = (value: string | null): string => (value ? value.slice(0, 16) : '');

const formatTryoutDate = (value: string): string => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const lifecycleFor = (tryout: TryoutDto): 'OPEN' | 'CLOSED' | 'EXPIRED' => {
    const now = Date.now();
    const deadline = tryout.deadline ? new Date(tryout.deadline).getTime() : null;
    const date = new Date(tryout.tryoutDate).getTime();
    if (deadline != null && !Number.isNaN(deadline) && deadline < now) return 'EXPIRED';
    if (!Number.isNaN(date) && date < now) return 'CLOSED';
    return 'OPEN';
};

export const TryoutsTab = ({ clubId, tryoutApplicants, tryoutsLoading, pendingKey, onTryoutStatus }: TryoutsTabProps) => {
    const [sort, setSort] = useState<SortState | null>(null);
    const [tryouts, setTryouts] = useState<TryoutDto[] | null>(null);
    const [editing, setEditing] = useState<TryoutDto | 'new' | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<TryoutDto | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [tryoutsError, setTryoutsError] = useState<string | null>(null);

    const loadTryouts = useCallback(async () => {
        setTryoutsError(null);
        try {
            const response = await apiClient.get<{ content: TryoutDto[] }>('/tryouts', { params: { clubId } });
            setTryouts(response.data.content);
        } catch (error) {
            const message = extractApiErrorMessage(error, TRYOUT_ACTION_FAILED);
            setTryoutsError(message);
            toast.error(message);
        }
    }, [clubId]);

    useEffect(() => { void loadTryouts(); }, [loadTryouts]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeletingId(deleteTarget.id);
        try {
            await deleteTryout(deleteTarget.id);
            setDeleteTarget(null);
            await loadTryouts();
        } catch (error) {
            toast.error(extractApiErrorMessage(error, TRYOUT_ACTION_FAILED));
        } finally {
            setDeletingId(null);
        }
    };

    const handleSort = useCallback((col: number) => {
        setSort(prev =>
            prev?.column === col
                ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { column: col, direction: 'asc' }
        );
    }, []);

    const getTryoutSortValue = (app: TryoutApplicantDto, col: number): string | number | null => {
        switch (col) {
            case 0: return (app.name || '').toLowerCase();
            case 1: return app.position || '';
            case 2: return app.ageGroup || '';
            case 3: return app.status;
            default: return null;
        }
    };

    const sortedApplicants = useMemo(() => {
        if (!sort) return tryoutApplicants;
        const data = [...tryoutApplicants];
        data.sort((a, b) => {
            const aVal = getTryoutSortValue(a, sort.column);
            const bVal = getTryoutSortValue(b, sort.column);
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sort.direction === 'desc' ? -cmp : cmp;
        });
        return data;
    }, [tryoutApplicants, sort]);

    return (
        <div className="space-y-4">
            <SectionHeader
                eyebrow="Tryouts"
                title="Club tryouts"
                description="Post and manage your club's tryout sessions."
                action={
                    <button
                        type="button"
                        onClick={() => setEditing('new')}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                    >
                        <Plus className="h-3.5 w-3.5" /> Post a tryout
                    </button>
                }
            />

            {tryouts == null ? (
                tryoutsError ? <ErrorBlock message={tryoutsError} onRetry={() => void loadTryouts()} /> :
                <PageSpinner />
            ) : tryouts.length === 0 ? (
                <p className="text-sm text-[var(--fc-text-secondary)]">No tryouts posted yet.</p>
            ) : (
                <div className="space-y-1.5">
                    {tryouts.map((tryout) => (
                        <div key={tryout.id} className="flex items-center gap-4 rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-3">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--fc-text-primary)]">{tryout.title}</p>
                                <p className="text-xs text-[var(--fc-text-secondary)]">
                                    {[formatTryoutDate(tryout.tryoutDate), tryout.position, tryout.ageGroup].filter(Boolean).join(' · ') || '—'}
                                </p>
                            </div>
                            <Pill label={lifecycleFor(tryout)} tone={lifecycleFor(tryout) === 'OPEN' ? 'success' : lifecycleFor(tryout) === 'EXPIRED' ? 'danger' : 'neutral'} />
                            <button
                                type="button"
                                onClick={() => setEditing(tryout)}
                                aria-label={`Edit ${tryout.title}`}
                                className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                aria-label={`Delete ${tryout.title}`}
                                onClick={() => setDeleteTarget(tryout)}
                                disabled={deletingId === tryout.id}
                                className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-state-danger)] disabled:opacity-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <TryoutForm
                    tryout={editing === 'new' ? null : editing}
                    saving={saving}
                    onCancel={() => setEditing(null)}
                    onSubmit={async (payload) => {
                        setSaving(true);
                        try {
                            if (editing === 'new') {
                                await createTryout({ clubId, ...payload });
                            } else {
                                await updateTryout(editing.id, payload);
                            }
                            setEditing(null);
                            await loadTryouts();
                        } catch (error) {
                            toast.error(extractApiErrorMessage(error, TRYOUT_ACTION_FAILED));
                        } finally {
                            setSaving(false);
                        }
                    }}
                />
            )}

            <SectionHeader eyebrow="Tryouts" title="Applicant Review" description="Review and respond to tryout applications." />
            {tryoutsLoading && sortedApplicants.length === 0 ? (
                <PageSpinner />
            ) : sortedApplicants.length === 0 ? (
                <EmptyState message="No tryout applications to review." />
            ) : (
                <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] overflow-hidden">
                    <DataTable columns={['Name', 'Position', 'Age Group', 'Status', '']} sort={sort} onSort={handleSort}>
                        {sortedApplicants.map((app) => (
                            <tr key={app.id} className="group h-11 hover:bg-[var(--fc-surface-hover)] transition-colors">
                                <td className="px-4">
                                    <UserIdentityCell avatarUrl={app.profilePictureUrl} fullName={app.name} size="sm" />
                                </td>
                                <td className="px-4 text-xs text-[var(--fc-text-secondary)]">{app.position || '—'}</td>
                                <td className="px-4 text-xs text-[var(--fc-text-secondary)]">{app.ageGroup || '—'}</td>
                                <td className="px-4"><StatusCell label={app.status} tone="info" /></td>
                        <td className="px-4 w-12">
                            <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                                {(() => {
                                    const canDecide = app.status === 'PENDING' || app.status === 'SHORTLISTED';
                                    return canDecide ? (
                                        <OverflowActions
                                            triggerIcon="vertical"
                                            label="Tryout actions"
                                            items={[
                                                { id: 'accept', label: 'Accept', description: 'Approve tryout application', icon: <Check className="h-3.5 w-3.5" />, tone: 'positive', disabled: !canDecide || pendingKey === `tryout-${app.id}-ACCEPTED`, onSelect: () => onTryoutStatus(app.id, 'ACCEPTED') },
                                                { id: 'decline', label: 'Decline', description: 'Reject tryout application with a kind note (phase A6)', icon: <X className="h-3.5 w-3.5" />, tone: 'danger', divider: true, disabled: !canDecide || pendingKey === `tryout-${app.id}-REJECTED`, onSelect: () => onTryoutStatus(app.id, 'REJECTED') },
                                            ]}
                                        />
                                    ) : <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fc-text-muted)]">Decision complete</span>;
                                })()}
                            </div>
                        </td>
                            </tr>
                        ))}
                    </DataTable>
                </div>
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete tryout"
                message={deleteTarget ? `Delete “${deleteTarget.title}”? Applicants will no longer be able to apply.` : ''}
                confirmLabel={deletingId ? 'Deleting…' : 'Delete tryout'}
                cancelLabel="Keep tryout"
                variant="danger"
                onConfirm={() => void handleDelete()}
                onCancel={() => { if (!deletingId) setDeleteTarget(null); }}
            />
        </div>
    );
};

const TryoutForm = ({
    tryout, saving, onCancel, onSubmit
}: {
    tryout: TryoutDto | null;
    saving: boolean;
    onCancel: () => void;
    onSubmit: (payload: TryoutPayload) => Promise<void>;
}) => {
    const [title, setTitle] = useState(tryout?.title ?? '');
    const [tryoutDate, setTryoutDate] = useState(toLocalInput(tryout?.tryoutDate ?? ''));
    const [deadline, setDeadline] = useState(toLocalInput(tryout?.deadline ?? ''));
    const [position, setPosition] = useState(tryout?.position ?? '');
    const [ageGroup, setAgeGroup] = useState(tryout?.ageGroup ?? '');
    const [description, setDescription] = useState(tryout?.description ?? '');

    const inputClass = 'theme-surface-strong theme-border w-full border px-3 py-2 text-sm font-semibold text-[#f4f4f5] focus:border-[#16a34a] outline-none';

    return (
        <div className="rounded-xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-4">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--fc-text-primary)]">{tryout ? 'Edit tryout' : 'New tryout'}</p>
                <button type="button" onClick={onCancel} aria-label="Close tryout editor" className="p-1 text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)]">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void onSubmit({
                        title: title.trim(),
                        tryoutDate,
                        deadline: deadline || undefined,
                        position: position.trim() || undefined,
                        ageGroup: ageGroup.trim() || undefined,
                        description: description.trim() || undefined,
                    });
                }}
                className="mt-3 grid gap-3"
            >
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120}
                    placeholder="Tryout title" className={inputClass} />
                <div className="grid gap-3 sm:grid-cols-2">
                    <input type="datetime-local" value={tryoutDate} onChange={(e) => setTryoutDate(e.target.value)} required
                        aria-label="Tryout date" className={inputClass} />
                    <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                        aria-label="Application deadline (optional)" className={inputClass} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} maxLength={80}
                        placeholder="Position (optional)" className={inputClass} />
                    <input type="text" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} maxLength={40}
                        placeholder="Age group (optional)" className={inputClass} />
                </div>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000}
                    placeholder="Description (optional)" className={inputClass} />
                <button type="submit" disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save tryout'}
                </button>
            </form>
        </div>
    );
};
