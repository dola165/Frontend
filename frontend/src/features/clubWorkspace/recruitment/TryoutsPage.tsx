import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, Badge, Button, ButtonLink, EmptyNote, FixtureRow, List, PageFrame, PageHeader, Panel, SearchInput, Section, Skeleton, StatTile } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { postingLabel, useTryoutCopy } from '../../tryouts/tryoutCopy';
import { squadLabel } from '../../../components/squads/squadLabels';
import { apiClient } from '../../../api/axiosConfig';
import { createTryout, deleteTryout, updateTryout, normalizeManagedTryout, type TryoutBrowseItem, type TryoutDto } from '../../../api/tryouts';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { formatDate } from '../../../utils/formatting';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { TryoutApplicantDto } from '../../../components/workspace/types';
import { recruitmentStatusKey, useRecruitmentCopy } from '../../../locales/recruitmentDesign';
import { TryoutForm, type TryoutPayload } from './TryoutForm';
import { outcomeTone } from './recruitmentStatus';
import '../club-workspace.css';
import '../../clubOperations/records/records.css';
import './recruitment.css';

interface Props {
    clubId: number; tryoutApplicants: TryoutApplicantDto[]; tryoutsLoading: boolean; pendingKey: string | null;
    /** The parent owns the decision note and status mutation. */
    onTryoutStatus: (applicationId: number, status: 'ACCEPTED' | 'REJECTED') => void;
    onOpenPlayers?: () => void;
}
interface Postings { total: number; openCount: number; hasMore: boolean; canManage: boolean }

const lifecycleFor = (tryout: TryoutDto): string => {
    if (tryout.status) return tryout.status;
    const now = Date.now(), date = new Date(tryout.tryoutDate).getTime(), deadline = tryout.deadline ? new Date(tryout.deadline).getTime() : null;
    if (!Number.isNaN(date) && date < now) return 'CLOSED';
    if (deadline != null && !Number.isNaN(deadline) && deadline < now) return 'EXPIRED';
    return 'OPEN';
};
const when = (value: string, options: Intl.DateTimeFormatOptions) => formatDate(value, options);

/**
 * Tryouts: the club's sessions (post, edit, cancel with a confirmation) and the players who applied, each accepted
 * or declined with a note in the workspace's decision dialog. Completed decisions stay read-only.
 */
export function TryoutsPage({ clubId, tryoutApplicants, tryoutsLoading, pendingKey, onTryoutStatus, onOpenPlayers }: Props) {
    const { t } = useTranslation();
    const r = useRecruitmentCopy();
    const copy = useTryoutCopy();
    const [query, setQuery] = useState(''), [status, setStatus] = useState('');
    const [tryouts, setTryouts] = useState<TryoutDto[] | null>(null), [page, setPage] = useState(0);
    const [postings, setPostings] = useState<Postings>({ total: 0, openCount: 0, hasMore: false, canManage: false });
    const [editing, setEditing] = useState<TryoutDto | 'new' | null>(null), [saving, setSaving] = useState(false);
    const [cancelling, setCancelling] = useState<TryoutDto | null>(null), [cancellingId, setCancellingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const loadVersion = useRef(0), mutationLock = useRef(false);
    const failure = r('failed');

    const load = useCallback(async () => {
        const version = ++loadVersion.current;
        setError(null);
        try {
            const response = await apiClient.get<{ content: TryoutBrowseItem[] } & Postings>(`/tryouts/club/${clubId}/postings`, { params: { page, size: 20 } });
            if (version === loadVersion.current) { setTryouts(response.data.content.map(normalizeManagedTryout)); setPostings(response.data); }
        } catch (failed) { if (version === loadVersion.current) setError(extractApiErrorMessage(failed, failure)); }
    }, [clubId, failure, page]);
    useEffect(() => { void load(); return () => { loadVersion.current += 1; }; }, [load]);

    const cancel = async () => {
        if (!cancelling || mutationLock.current) return;
        mutationLock.current = true; setCancellingId(cancelling.id);
        try { await deleteTryout(cancelling.id); setCancelling(null); await load(); }
        catch (failed) { toast.error(extractApiErrorMessage(failed, failure)); }
        finally { mutationLock.current = false; setCancellingId(null); }
    };
    const save = async (payload: TryoutPayload) => {
        if (mutationLock.current || !editing) return;
        mutationLock.current = true; setSaving(true);
        try { if (editing === 'new') await createTryout({ clubId, ...payload }); else await updateTryout(editing.id, payload); setEditing(null); await load(); }
        catch (failed) { toast.error(extractApiErrorMessage(failed, failure)); }
        finally { mutationLock.current = false; setSaving(false); }
    };
    const applicants = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase();
        return tryoutApplicants.filter(a => (!status || a.status === status) && (!needle || `${a.name} ${a.position ?? ''} ${a.ageGroup ?? ''}`.toLocaleLowerCase().includes(needle)));
    }, [tryoutApplicants, query, status]);
    const waiting = tryoutApplicants.filter(a => a.status === 'PENDING' || a.status === 'SHORTLISTED').length;
    const statusLabel = (value: string) => { const key = recruitmentStatusKey(value); return key ? r(key) : value.replaceAll('_', ' '); };
    const statuses = ['PENDING', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', ...tryoutApplicants.map(a => a.status)].filter((value, index, values) => values.indexOf(value) === index);

    let sessions;
    if (tryouts == null) sessions = error ? <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" onClick={() => void load()}>{r('retry')}</Button></div>
        : <Panel><div className="cw-skeleton-rows" role="status" aria-label={r('sessions')}><Skeleton height={56} /><Skeleton height={56} /></div></Panel>;
    else if (!tryouts.length) sessions = <Panel><EmptyNote title={r('noTryouts')} action={postings.canManage ? <Button size="sm" onClick={() => setEditing('new')}><Plus aria-hidden="true" />{r('postTryout')}</Button> : undefined}>{r('noTryoutsIntro')}</EmptyNote></Panel>;
    else sessions = <Panel flush><List label={r('sessions')}>{tryouts.map(tryout => {
        const lifecycle = lifecycleFor(tryout);
        const editable = postings.canManage && !['CANCELLED', 'EXPIRED', 'UNAVAILABLE'].includes(lifecycle);
        return <FixtureRow key={tryout.id} tone={lifecycle === 'OPEN' ? 'trial' : 'neutral'} time={when(tryout.tryoutDate, { hour: '2-digit', minute: '2-digit' })} day={when(tryout.tryoutDate, { weekday: 'short', day: 'numeric', month: 'short' })}
            title={tryout.title} meta={[tryout.position ? squadLabel(tryout.position, t) : r('allPositions'), tryout.ageGroup || r('allAges'), tryout.deadline ? r('deadline', { date: when(tryout.deadline, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }) : r('noDeadline')].join(' · ')}
            trail={<span className="tr-trail"><Badge tone={lifecycle === 'OPEN' ? 'accent' : 'neutral'}>{postingLabel(lifecycle, copy)}</Badge>
                <ButtonLink size="sm" variant="ghost" to={`/tryouts/${tryout.id}`}>{copy('Public details', 'საჯარო დეტალები')}</ButtonLink>
                {editable && <><Button size="sm" variant="ghost" iconOnly aria-label={r('editNamed', { name: tryout.title })} title={r('edit')} onClick={() => setEditing(tryout)}><Pencil aria-hidden="true" /></Button>
                    <Button size="sm" variant="ghost" iconOnly className="tr-danger" aria-label={r('deleteNamed', { name: tryout.title })} title={r('deleteTryout')} disabled={cancellingId === tryout.id} onClick={() => setCancelling(tryout)}><Trash2 aria-hidden="true" /></Button></>}
            </span>} />;
    })}</List></Panel>;

    return <PageFrame className="cw-page tr-page">
        <PageHeader title={r('tryouts')} subtitle={r('tryoutsIntro')} actions={postings.canManage && <Button variant="primary" onClick={() => setEditing('new')}><Plus aria-hidden="true" />{r('postTryout')}</Button>} />
        <div className="gk-stack">
            <div className="gk-stats" role="group" aria-label={r('tryouts')}>
                <StatTile label={r('reviewApplicants')} value={tryoutsLoading ? '–' : waiting} tone={waiting ? 'attention' : undefined} />
                <StatTile label={r('openSessions')} value={tryouts ? postings.openCount : '–'} />
                <StatTile label={r('postedSessions')} value={tryouts ? postings.total : '–'} />
            </div>
            <Section title={r('sessions')}>
                {error && tryouts != null && <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" onClick={() => void load()}>{r('retry')}</Button></div>}
                {sessions}
                {(page > 0 || postings.hasMore) && <nav className="ap-pages" aria-label={copy('Tryout posting pages', 'სინჯების გვერდები')}>
                    <Button size="sm" disabled={page === 0} onClick={() => setPage(n => n - 1)}>{copy('Previous', 'წინა')}</Button><span className="gk-muted">{copy('Page', 'გვერდი')} {page + 1}</span>
                    <Button size="sm" disabled={!postings.hasMore} onClick={() => setPage(n => n + 1)}>{copy('Next', 'შემდეგი')}</Button></nav>}
            </Section>
            <Section title={r('applicantReview')} hint={r('applicantReviewIntro')}>
                <div className="rec-toolbar">
                    <SearchInput className="rec-toolbar__search" value={query} onChange={event => setQuery(event.target.value)} aria-label={r('searchApplicants')} placeholder={r('searchApplicants')} />
                    <select className="gk-input" aria-label={r('status')} value={status} onChange={event => setStatus(event.target.value)}><option value="">{r('allStatuses')}</option>{statuses.map(value => <option key={value} value={value}>{statusLabel(value)}</option>)}</select>
                    <span className="rec-toolbar__count" role="status">{r('results', { count: applicants.length })}</span>
                </div>
                {tryoutsLoading && !tryoutApplicants.length ? <Panel><div className="cw-skeleton-rows" role="status" aria-label={r('applicantReview')}><Skeleton height={48} /><Skeleton height={48} /></div></Panel>
                    : !applicants.length ? <Panel><EmptyNote title={r(query || status ? 'noMatches' : 'noApplicants')} action={query || status ? <Button size="sm" onClick={() => { setQuery(''); setStatus(''); }}>{r('clearFilters')}</Button> : undefined}>{r(query || status ? 'noMatchesIntro' : 'noApplicantsIntro')}</EmptyNote></Panel>
                        : <Panel flush><List label={r('applicantReview')}>{applicants.map(a => {
                            const open = a.status === 'PENDING' || a.status === 'SHORTLISTED';
                            const busy = pendingKey === `tryout-${a.id}-ACCEPTED` || pendingKey === `tryout-${a.id}-REJECTED`;
                            return <li key={a.id}><div className="gk-list-row tr-applicant">
                                <Avatar src={resolveMediaUrl(a.profilePictureUrl) || null} name={a.name} size={40} />
                                <span className="gk-list-row__main"><span className="gk-list-row__title">{a.name}</span><span className="gk-list-row__meta">{[a.position ? squadLabel(a.position, t) : null, a.ageGroup].filter(Boolean).join(' · ') || '—'}</span></span>
                                <span className="gk-list-row__trail tr-trail"><Badge tone={outcomeTone(a.status)}>{statusLabel(a.status)}</Badge>
                                    {open ? <><Button size="sm" variant="primary" disabled={busy} onClick={() => onTryoutStatus(a.id, 'ACCEPTED')}>{r('accept')}</Button>
                                        <Button size="sm" variant="ghost" className="tr-danger" disabled={busy} onClick={() => onTryoutStatus(a.id, 'REJECTED')}>{r('decline')}</Button></>
                                        : <span className="gk-faint tr-done">{r('decisionComplete')}</span>}</span>
                            </div></li>;
                        })}</List></Panel>}
            </Section>
            <p className="gk-notice ap-next"><span className="cw-notices__text">{r('trialNext')}</span>{onOpenPlayers && <Button size="sm" variant="ghost" onClick={onOpenPlayers}>{r('playersStep')}</Button>}</p>
        </div>
        {editing && <TryoutForm key={editing === 'new' ? 'new' : editing.id} tryout={editing === 'new' ? null : editing} saving={saving} onCancel={() => { if (!saving) setEditing(null); }} onSubmit={save} />}
        <Dialog open={cancelling !== null} role="alertdialog" size="sm" title={r('deleteTryout')} description={cancelling ? r('deleteMessage', { name: cancelling.title }) : undefined} onClose={() => { if (!cancellingId) setCancelling(null); }}
            footer={<><Button variant="ghost" disabled={cancellingId !== null} onClick={() => setCancelling(null)}>{r('keepTryout')}</Button>
                <Button variant="danger" disabled={cancellingId !== null} onClick={() => void cancel()}>{r(cancellingId ? 'deleting' : 'deleteTryout')}</Button></>} />
    </PageFrame>;
}
