import { appLocale } from '../../../utils/formatting';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Info, Loader2, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { postingLabel, useTryoutCopy } from '../../../features/tryouts/tryoutCopy';
import { squadLabel } from '../../squads/squadLabels';
import { apiClient } from '../../../api/axiosConfig';
import { createTryout, deleteTryout, updateTryout, normalizeManagedTryout, type TryoutBrowseItem, type TryoutDto } from '../../../api/tryouts';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { DataTable, ErrorBlock, PageSpinner } from '../helpers';
import type { SortState } from '../helpers';
import { UserIdentityCell } from '../UserIdentityCell';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import type { TryoutApplicantDto } from '../types';
import { useDialogFocus } from '../useDialogFocus';
import { RecruitmentNavigation } from '../recruitment/RecruitmentNavigation';
import { recruitmentStatusKey, useRecruitmentCopy } from '../../../locales/recruitmentDesign';
import '../../squads/squad-design.css';
import '../recruitment/recruitment-design.css';

interface TryoutsTabProps {
    clubId: number;
    tryoutApplicants: TryoutApplicantDto[];
    tryoutsLoading: boolean;
    pendingKey: string | null;
    /** The parent owns the decision note and status mutation. */
    onTryoutStatus: (applicationId: number, status: 'ACCEPTED' | 'REJECTED') => void;
    onOpenApplications?: () => void;
    onOpenPlayers?: () => void;
    onOpenSquads?: () => void;
}
interface TryoutPayload { title: string; tryoutDate: string; deadline?: string; position?: string; ageGroup?: string; description?: string; }
const toLocalInput = (value: string | null): string => value ? value.slice(0, 16) : '';
const formatTryoutDate = (value: string): string => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(appLocale(), { dateStyle: 'medium', timeStyle: 'short' });
};
const lifecycleFor = (tryout: TryoutDto): string => {
    if (tryout.status) return tryout.status;
    const now = Date.now();
    const date = new Date(tryout.tryoutDate).getTime();
    const deadline = tryout.deadline ? new Date(tryout.deadline).getTime() : null;
    if (!Number.isNaN(date) && date < now) return 'CLOSED';
    if (deadline != null && !Number.isNaN(deadline) && deadline < now) return 'EXPIRED';
    return 'OPEN';
};

export const TryoutsTab = ({ clubId, tryoutApplicants, tryoutsLoading, pendingKey, onTryoutStatus, onOpenApplications, onOpenPlayers, onOpenSquads }: TryoutsTabProps) => {
    const { t } = useTranslation();
    const r = useRecruitmentCopy();
    const copy = useTryoutCopy();
    const [sort, setSort] = useState<SortState | null>(null);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [tryouts, setTryouts] = useState<TryoutDto[] | null>(null);
    const [page, setPage] = useState(0);
    const [postingSummary, setPostingSummary] = useState({ total: 0, openCount: 0, hasMore: false, canManage: false });
    const [editing, setEditing] = useState<TryoutDto | 'new' | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<TryoutDto | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [tryoutsError, setTryoutsError] = useState<string | null>(null);
    const loadVersion = useRef(0);
    const mutationLock = useRef(false);
    const failureMessage = r('failed');

    const loadTryouts = useCallback(async () => {
        const version = ++loadVersion.current;
        setTryoutsError(null);
        try {
            const response = await apiClient.get<{ content: TryoutBrowseItem[]; total: number; openCount: number; hasMore: boolean; canManage: boolean }>(`/tryouts/club/${clubId}/postings`, { params: { page, size: 20 } });
            if (version === loadVersion.current) { setTryouts(response.data.content.map(normalizeManagedTryout)); setPostingSummary(response.data); }
        } catch (error) {
            if (version === loadVersion.current) setTryoutsError(extractApiErrorMessage(error, failureMessage));
        }
    }, [clubId, failureMessage, page]);
    useEffect(() => { void loadTryouts(); return () => { loadVersion.current += 1; }; }, [loadTryouts]);

    const handleDelete = async () => {
        if (!deleteTarget || mutationLock.current) return;
        mutationLock.current = true;
        setDeletingId(deleteTarget.id);
        try {
            await deleteTryout(deleteTarget.id);
            setDeleteTarget(null);
            await loadTryouts();
        } catch (error) { toast.error(extractApiErrorMessage(error, failureMessage)); }
        finally { mutationLock.current = false; setDeletingId(null); }
    };
    const sortedApplicants = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        const applicants = tryoutApplicants.filter((app) => (!status || app.status === status) && (!search || `${app.name} ${app.position ?? ''} ${app.ageGroup ?? ''}`.toLocaleLowerCase().includes(search)));
        if (!sort) return applicants;
        const value = (app: TryoutApplicantDto) => [app.name.toLocaleLowerCase(), app.position || '', app.ageGroup || '', app.status][sort.column] || '';
        return [...applicants].sort((a, b) => value(a).localeCompare(value(b)) * (sort.direction === 'asc' ? 1 : -1));
    }, [tryoutApplicants, query, status, sort]);
    const pendingCount = tryoutApplicants.filter((app) => app.status === 'PENDING' || app.status === 'SHORTLISTED').length;
    const statusLabel = (value: string) => { const key = recruitmentStatusKey(value); return key ? r(key) : value.replaceAll('_', ' '); };

    return <div className="squad-design recruitment-design">
        <header className="sd-heading"><div><span className="sd-eyebrow">{r('recruitment')}</span><h2>{r('tryouts')}</h2><p>{r('tryoutsIntro')}</p></div>{postingSummary.canManage && <button type="button" className="sd-primary" onClick={() => setEditing('new')}><Plus size={16} />{r('postTryout')}</button>}</header>
        <RecruitmentNavigation active="tryouts" onOpenApplications={onOpenApplications} onOpenPlayers={onOpenPlayers} onOpenSquads={onOpenSquads} />
        <div className="rc-metrics">
            <div className="rc-metric"><strong>{tryoutsLoading ? '—' : pendingCount}</strong><span>{r('reviewApplicants')}</span></div>
            <div className="rc-metric"><strong>{tryouts ? postingSummary.openCount : '—'}</strong><span>{r('openSessions')}</span></div>
            <div className="rc-metric"><strong>{tryouts ? postingSummary.total : '—'}</strong><span>{r('postedSessions')}</span></div>
        </div>
        <div className="rc-section-heading"><h3>{r('sessions')}</h3><CalendarDays size={18} className="sd-muted" /></div>
        {tryoutsError && tryouts != null && <div className="rc-help" role="alert"><Info size={16} /><p>{tryoutsError}</p><button type="button" className="rc-link" onClick={() => void loadTryouts()}>{r('retry')}</button></div>}
        {tryouts == null ? (tryoutsError ? <ErrorBlock message={tryoutsError} onRetry={() => void loadTryouts()} /> : <PageSpinner />) : tryouts.length === 0 ? <div className="sd-empty"><CalendarDays size={28} /><h3>{r('noTryouts')}</h3><p>{r('noTryoutsIntro')}</p>{postingSummary.canManage && <button type="button" className="sd-button" onClick={() => setEditing('new')}><Plus size={15} />{r('postTryout')}</button>}</div> : <div className="rc-sessions">
            {tryouts.map((tryout) => {
                const lifecycle = lifecycleFor(tryout);
                const date = new Date(tryout.tryoutDate);
                const validDate = !Number.isNaN(date.getTime());
                return <article key={tryout.id} className="sd-panel rc-session">
                    <div className="rc-session-top"><div className="rc-date" aria-hidden="true"><small>{validDate ? date.toLocaleDateString(appLocale(), { month: 'short' }) : '—'}</small><strong>{validDate ? date.getDate() : '—'}</strong></div><div className="rc-session-title"><h4>{tryout.title}</h4><p>{formatTryoutDate(tryout.tryoutDate)}</p></div></div>
                    <div className="rc-session-tags"><span className="rc-status" data-status={lifecycle}>{postingLabel(lifecycle, copy)}</span><span>{tryout.position ? squadLabel(tryout.position, t) : r('allPositions')}</span><span>{tryout.ageGroup || r('allAges')}</span></div>
                    {tryout.description && <details><summary>{r('sessionDetails')}</summary><p>{tryout.description}</p></details>}
                    <footer className="rc-session-footer"><p>{tryout.deadline ? r('deadline', { date: formatTryoutDate(tryout.deadline) }) : r('noDeadline')}</p><div><Link className="sd-button" to={`/tryouts/${tryout.id}`}>{copy('Public details', 'საჯარო დეტალები')}</Link>{postingSummary.canManage && !['CANCELLED','EXPIRED','UNAVAILABLE'].includes(lifecycle) && <><button type="button" className="sd-button" aria-label={r('editNamed', { name: tryout.title })} onClick={() => setEditing(tryout)}><Pencil size={12} />{r('edit')}</button><button type="button" className="sd-icon-button rc-danger" aria-label={r('deleteNamed', { name: tryout.title })} onClick={() => setDeleteTarget(tryout)} disabled={deletingId === tryout.id}><Trash2 size={14} /></button></>}</div></footer>
                </article>;
            })}
        </div>}
        {(page > 0 || postingSummary.hasMore) && <nav className="rc-actions" aria-label={copy('Tryout posting pages', 'სინჯების გვერდები')}><button type="button" className="sd-button" disabled={page === 0} onClick={() => setPage(n => n - 1)}>{copy('Previous', 'წინა')}</button><span>{copy('Page', 'გვერდი')} {page + 1}</span><button type="button" className="sd-button" disabled={!postingSummary.hasMore} onClick={() => setPage(n => n + 1)}>{copy('Next', 'შემდეგი')}</button></nav>}
        <section className="sd-panel">
            <header className="rc-panel-header"><div><h3>{r('applicantReview')}</h3><p>{r('applicantReviewIntro')}</p></div><span>{r('results', { count: sortedApplicants.length })}</span></header>
            <div className="rc-toolbar"><label className="sd-search"><Search size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={r('searchApplicants')} placeholder={r('searchApplicants')} /></label><label className="rc-filter">{r('status')}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{r('allStatuses')}</option>{['PENDING', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', ...tryoutApplicants.map((app) => app.status)].filter((value, index, values) => values.indexOf(value) === index).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label></div>
            {tryoutsLoading && tryoutApplicants.length === 0 ? <PageSpinner /> : sortedApplicants.length === 0 ? <div className="sd-empty"><Users size={27} /><h3>{r(query || status ? 'noMatches' : 'noApplicants')}</h3><p>{r(query || status ? 'noMatchesIntro' : 'noApplicantsIntro')}</p>{(query || status) && <button type="button" className="sd-button" onClick={() => { setQuery(''); setStatus(''); }}>{r('clearFilters')}</button>}</div> : <div className="rc-table"><DataTable columns={[r('applicant'), r('position'), r('ageGroup'), r('status'), '']} sort={sort} onSort={(column) => setSort((previous) => ({ column, direction: previous?.column === column && previous.direction === 'asc' ? 'desc' : 'asc' }))}>
                {sortedApplicants.map((app) => {
                    const canDecide = app.status === 'PENDING' || app.status === 'SHORTLISTED';
                    const busy = pendingKey === `tryout-${app.id}-ACCEPTED` || pendingKey === `tryout-${app.id}-REJECTED`;
                    return <tr key={app.id}><td><UserIdentityCell avatarUrl={app.profilePictureUrl} fullName={app.name} size="sm" /></td><td>{app.position ? squadLabel(app.position, t) : '—'}</td><td>{app.ageGroup || '—'}</td><td><span className="rc-status" data-status={app.status}>{statusLabel(app.status)}</span></td><td><div className="rc-actions">{canDecide ? <><button type="button" className="sd-primary" disabled={busy} onClick={() => onTryoutStatus(app.id, 'ACCEPTED')}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{r('accept')}</button><button type="button" className="sd-button rc-danger" disabled={busy} onClick={() => onTryoutStatus(app.id, 'REJECTED')}>{r('decline')}</button></> : <span className="sd-muted">{r('decisionComplete')}</span>}</div></td></tr>;
                })}
            </DataTable></div>}
        </section>
        <div className="rc-help"><Info size={16} /><p>{r('trialNext')}</p>{onOpenPlayers && <button type="button" className="rc-link" onClick={onOpenPlayers}>{r('playersStep')}<ArrowRight size={13} /></button>}</div>
        {editing && <TryoutForm key={editing === 'new' ? 'new' : editing.id} tryout={editing === 'new' ? null : editing} saving={saving} onCancel={() => { if (!saving) setEditing(null); }} onSubmit={async (payload) => {
            if (mutationLock.current) return;
            mutationLock.current = true;
            setSaving(true);
            try { if (editing === 'new') await createTryout({ clubId, ...payload }); else await updateTryout(editing.id, payload); setEditing(null); await loadTryouts(); }
            catch (error) { toast.error(extractApiErrorMessage(error, failureMessage)); }
            finally { mutationLock.current = false; setSaving(false); }
        }} />}
        <ConfirmDialog open={deleteTarget !== null} title={r('deleteTryout')} message={deleteTarget ? r('deleteMessage', { name: deleteTarget.title }) : ''} confirmLabel={r(deletingId ? 'deleting' : 'deleteTryout')} cancelLabel={r('keepTryout')} variant="danger" onConfirm={() => void handleDelete()} onCancel={() => { if (!deletingId) setDeleteTarget(null); }} />
    </div>;
};

const TryoutForm = ({ tryout, saving, onCancel, onSubmit }: { tryout: TryoutDto | null; saving: boolean; onCancel: () => void; onSubmit: (payload: TryoutPayload) => Promise<void> }) => {
    const r = useRecruitmentCopy();
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    useDialogFocus(true, dialogRef, onCancel, titleRef);
    const [title, setTitle] = useState(tryout?.title ?? '');
    const [tryoutDate, setTryoutDate] = useState(toLocalInput(tryout?.tryoutDate ?? ''));
    const [deadline, setDeadline] = useState(toLocalInput(tryout?.deadline ?? ''));
    const [position, setPosition] = useState(tryout?.position ?? '');
    const [ageGroup, setAgeGroup] = useState(tryout?.ageGroup ?? '');
    const [description, setDescription] = useState(tryout?.description ?? '');
    return <div className="rc-overlay"><div className="rc-backdrop" onClick={onCancel} /><div className="rc-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="tryout-editor-title" aria-describedby="tryout-editor-description">
        <header className="rc-dialog-header"><div><span className="sd-eyebrow">{r('tryouts')}</span><h2 id="tryout-editor-title">{r(tryout ? 'editTryout' : 'newTryout')}</h2><p id="tryout-editor-description">{r('formIntro')}</p></div><button type="button" className="sd-icon-button" onClick={onCancel} disabled={saving} aria-label={r('close')}><X size={17} /></button></header>
        <form onSubmit={(event) => { event.preventDefault(); if (title.trim() && !saving) void onSubmit({ title: title.trim(), tryoutDate: tryout && tryoutDate === toLocalInput(tryout.tryoutDate) ? tryout.tryoutDate : tryoutDate, deadline: tryout && deadline === toLocalInput(tryout.deadline) ? tryout.deadline || undefined : deadline || undefined, position: position.trim() || undefined, ageGroup: ageGroup.trim() || undefined, description: description.trim() || undefined }); }}>
            <div className="rc-dialog-body rc-form-grid">
                <label className="rc-form-field rc-form-wide">{r('title')}<input ref={titleRef} type="text" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} disabled={saving} /></label>
                <label className="rc-form-field">{r('date')}<input type="datetime-local" value={tryoutDate} onChange={(event) => setTryoutDate(event.target.value)} required disabled={saving} /></label>
                <label className="rc-form-field">{r('deadlineLabel')}<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} disabled={saving} /><small>{r('optional')}</small></label>
                <label className="rc-form-field">{r('position')}<input type="text" value={position} onChange={(event) => setPosition(event.target.value)} maxLength={80} disabled={saving} placeholder={r('allPositions')} /><small>{r('optional')}</small></label>
                <label className="rc-form-field">{r('ageGroup')}<input type="text" value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)} maxLength={40} disabled={saving} placeholder={r('allAges')} /><small>{r('optional')}</small></label>
                <label className="rc-form-field rc-form-wide">{r('description')}<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={2000} disabled={saving} placeholder={r('descriptionHint')} /><small>{r('optional')}</small></label>
            </div>
            <footer className="rc-dialog-footer"><button type="button" className="sd-button" disabled={saving} onClick={onCancel}>{r('cancel')}</button><button type="submit" className="sd-primary" disabled={saving || !title.trim()}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{r(saving ? 'saving' : 'saveTryout')}</button></footer>
        </form>
    </div></div>;
};
