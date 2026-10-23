import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Bot, ExternalLink, GitBranch, Plus, Trash2, X } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, Skeleton } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changeWork, createWork, deleteWork, fetchDetail, type Detail, type NewWork, type Person, type WorkChange, type WorkEnd, type WorkItem, type WorkStatus, type WorkUpdate } from './api';
import { EndPick, Field, PeoplePick, QuickEdit, SmallChip, SmallPick, StatusDot } from './WorkBits';
import { WorkComments } from './WorkComments';
import { WorkMediaList } from './WorkMedia';
import { ago, day, endWords, shortDate, statusName } from './teamWorkWords';
import { taskAsText } from './planAsText';

const isConflict = (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 409;

interface Draft {
    title: string; area: string; status: WorkStatus; percent: number; step: string; notes: string; branch: string; prUrl: string; update: string;
    description: string; startedOn: string; end: WorkEnd; people: number[]; percentFromSteps: boolean; small: boolean;
}
const draftOf = (item: WorkItem): Draft => ({
    title: item.title, area: item.area ?? '', status: item.status, percent: item.percent, step: item.step ?? '', notes: item.notes ?? '', branch: item.branch ?? '', prUrl: item.prUrl ?? '', update: '',
    description: item.description ?? '', startedOn: item.startedOn ?? '', end: item.end, people: item.people.flatMap(person => person.id == null ? [] : [person.id]), percentFromSteps: item.percentFromSteps, small: item.small,
});
const sameEnd = (a: WorkEnd, b: WorkEnd) => a.kind === b.kind && (a.date ?? null) === (b.date ?? null) && (a.amount ?? null) === (b.amount ?? null) && (a.unit ?? null) === (b.unit ?? null);

/** One line of history: who, when, how the status and percent moved, and what they wrote. */
function HistoryLine({ update }: { update: WorkUpdate }) {
    const copy = useJourneyCopy();
    const moves = [
        update.status && (update.previousStatus ? `${statusName(copy, update.previousStatus)} → ${statusName(copy, update.status)}` : statusName(copy, update.status)),
        update.percent != null && (update.previousPercent != null ? `${update.previousPercent}% → ${update.percent}%` : `${update.percent}%`),
    ].filter(Boolean).join(' · ');
    const known: Record<string, [string, string]> = { 'Added': ['Added', 'დაემატა'], 'Edited the details': ['Edited the details', 'დეტალები შეიცვალა'], 'Added a picture': ['Added a picture', 'დაემატა სურათი'], 'Added a video': ['Added a video', 'დაემატა ვიდეო'], 'Seen': ['Seen', 'ნანახია'], 'Acknowledged': ['Acknowledged', 'გაითვალისწინა'], 'Pushed to pending': ['Pushed to waiting', 'გადავიდა მოლოდინში'], 'Made a task': ['Made a task', 'გახდა საქმე'] };
    const message = update.message && known[update.message] ? copy(...known[update.message]) : update.message;
    return <li className="tw-history__line">
        <span className="tw-history__who">{update.author?.name ?? copy('Someone', 'ვიღაც')} · {ago(copy, update.at)}</span>
        {moves && <span className="tw-history__moves gk-num">{moves}</span>}
        {message && <span className="tw-history__message">{message}</span>}
    </li>;
}

export interface PlaceOnPlan { first: boolean; last: boolean; onMove: (by: -1 | 1) => void; onRemove: () => void }

/**
 * A task of work opened in place: what it is, when it started and should end, who is on it, its steps, videos,
 * pictures and comments, and the edit. A save made after a colleague's is refused, and the person reloads with
 * their words kept.
 */
export function TaskView({ id, team, me, place, plan, onOpen, onAddStep, onClose, onSaved, onDeleted }: {
    id: number; team: Person[]; me?: number | null; place?: PlaceOnPlan; plan?: string; onOpen: (id: number) => void; onAddStep?: () => void; onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
    const copy = useJourneyCopy();
    const [detail, setDetail] = useState<Detail | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [saving, setSaving] = useState(false);
    const [revision, setRevision] = useState(0);
    const [deleting, setDeleting] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        fetchDetail(id, controller.signal)
            .then(next => { if (controller.signal.aborted) return; setDetail(next); setDraft(current => current && revision > 0 ? { ...draftOf(next.item), update: current.update } : draftOf(next.item)); setConflict(false); setError(''); })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('This work could not load.', 'ეს საქმე ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [id, revision, copy]);

    const item = detail?.item;
    const change = (patch: Partial<Draft>) => setDraft(current => current && { ...current, ...patch });
    const changes = (): WorkChange | null => {
        if (!item || !draft) return null;
        const before = draftOf(item), result: WorkChange = { version: item.version };
        const out = result as unknown as Record<string, unknown>;
        let any = false;
        for (const key of ['title', 'area', 'status', 'step', 'notes', 'branch', 'prUrl', 'description', 'startedOn', 'percentFromSteps', 'small'] as const) if (draft[key] !== before[key]) { out[key] = draft[key]; any = true; }
        if (!draft.percentFromSteps && draft.percent !== before.percent) { result.percent = draft.percent; any = true; }
        if (!sameEnd(draft.end, before.end)) { result.end = draft.end; any = true; }
        if ([...draft.people].sort().join() !== [...before.people].sort().join()) { result.people = draft.people; any = true; }
        if (draft.update.trim()) { result.update = draft.update.trim(); any = true; }
        return any ? result : null;
    };
    const pending = changes();
    const save = async () => {
        if (!pending) return;
        setSaving(true); setError('');
        try { const next = await changeWork(id, pending); setDetail(next); setDraft(draftOf(next.item)); setEditing(false); onSaved(); }
        catch (failure) { setConflict(isConflict(failure)); setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setSaving(false); }
    };

    if (!item || !draft || !detail) return <div className="tw-task" role="region" aria-label={copy('Work', 'საქმე')}>
        {error ? <p className="gk-notice gk-notice--danger" role="alert">{error}</p> : <div role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={96} /></div>}
    </div>;
    const isPart = item.parentId != null;
    const hasParts = detail.steps.length > 0;
    return <div className="tw-task" role="region" aria-label={item.title}>
        <div className="tw-detail__head">
            <dl className="tw-facts">
                <div><dt>{copy('Started', 'დაიწყო')}</dt><dd>{item.startedOn ? shortDate(copy, day(item.startedOn)) : copy('not yet', 'ჯერ არა')}</dd></div>
                <div><dt>{copy('Expected end', 'სავარაუდო დასრულება')}</dt><dd>{endWords(copy, item.end)}</dd></div>
                <div><dt>{copy('Who’s on it', 'ვინ მუშაობს')}</dt><dd>{item.people.length ? item.people.map(person => person.name).join(', ') : '—'}</dd></div>
                <div><dt>{copy('Last touched', 'ბოლოს')}</dt><dd>{[item.updatedBy?.name, ago(copy, item.updatedAt)].filter(Boolean).join(' · ')}</dd></div>
            </dl>
            <span className="tw-detail__tools">
                {place && <>
                    <Button size="sm" iconOnly variant="ghost" disabled={place.first} aria-label={copy('Move up', 'ზემოთ')} onClick={() => place.onMove(-1)}><ArrowUp aria-hidden="true" /></Button>
                    <Button size="sm" iconOnly variant="ghost" disabled={place.last} aria-label={copy('Move down', 'ქვემოთ')} onClick={() => place.onMove(1)}><ArrowDown aria-hidden="true" /></Button>
                    <Button size="sm" variant="ghost" onClick={place.onRemove}>{copy('Take off this plan', 'ამ გეგმიდან მოხსნა')}</Button>
                </>}
                <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(taskAsText(detail, `${window.location.origin}/team-work?task=${item.parentId ?? item.id}${item.parentId != null ? `&step=${item.id}` : ''}`, plan)).then(() => setCopied(true))}><Bot aria-hidden="true" />{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy for AI', 'კოპირება AI-სთვის')}</Button>
                {onDeleted && <Button size="sm" iconOnly variant="ghost" aria-label={copy('Delete', 'წაშლა')} onClick={() => setDeleting(true)}><Trash2 aria-hidden="true" /></Button>}
                <Button size="sm" iconOnly variant="ghost" aria-label={copy('Close', 'დახურვა')} onClick={onClose}><X aria-hidden="true" /></Button>
            </span>
        </div>
        {item.small && <span><SmallChip /></span>}
        {item.description && <p className="tw-detail__description">{item.description}</p>}
        {item.step && <p className="tw-detail__step"><span className="gk-faint">{copy('Current step', 'მიმდინარე ნაბიჯი')}: </span>{item.step}</p>}

        {!isPart && (hasParts || (onAddStep && !item.small)) && <section className="tw-section" aria-label={copy('Steps', 'ნაბიჯები')}>
            <h3 className="tw-section__title">{copy('Steps', 'ნაბიჯები')}</h3>
            {hasParts && <ul className="tw-steps">{detail.steps.map(step => <li key={step.id}>
                <button type="button" onClick={() => onOpen(step.id)}><StatusDot status={step.status} /><span className="tw-steps__name">{step.title}</span><span className="gk-num gk-faint">{step.percent}%</span></button>
            </li>)}</ul>}
            {onAddStep && !item.small && <span><Button size="sm" variant="ghost" onClick={onAddStep}><Plus aria-hidden="true" />{copy('Add a step', 'ნაბიჯის დამატება')}</Button></span>}
        </section>}

        <section className="tw-section tw-edit" aria-label={copy('Update', 'განახლება')}>
            <QuickEdit status={draft.status} percent={draft.percent} fromParts={draft.percentFromSteps && hasParts} onChange={change} />
            {hasParts && <label className="tw-check"><input type="checkbox" checked={draft.percentFromSteps} onChange={event => change({ percentFromSteps: event.target.checked })} />{copy('Percent follows its steps', 'პროცენტი ნაბიჯებიდან')}</label>}
            {editing && <SmallPick small={draft.small} onChange={small => change({ small })} />}
            {editing && <div className="tw-grid">
                <Field label={copy('Name', 'სახელი')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={120} value={draft.title} onChange={event => change({ title: event.target.value })} />}</Field>
                <Field label={copy('Where', 'სად')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={160} value={draft.area} placeholder={copy('Landing · founders’ request', 'ლენდინგი · დამფუძნებლების თხოვნა')} onChange={event => change({ area: event.target.value })} />}</Field>
                <Field label={copy('Description', 'აღწერა')} wide>{fieldId => <textarea id={fieldId} className="gk-input" rows={2} maxLength={400} value={draft.description} onChange={event => change({ description: event.target.value })} />}</Field>
                <Field label={copy('Started', 'დაიწყო')}>{fieldId => <input id={fieldId} className="gk-input" type="date" value={draft.startedOn} onChange={event => change({ startedOn: event.target.value })} />}</Field>
                <EndPick end={draft.end} onChange={end => change({ end })} />
                <PeoplePick team={team} chosen={draft.people} onChange={people => change({ people })} />
                <Field label={copy('Current step', 'მიმდინარე ნაბიჯი')} wide>{fieldId => <input id={fieldId} className="gk-input" maxLength={240} value={draft.step} onChange={event => change({ step: event.target.value })} />}</Field>
                <Field label={copy('Notes', 'შენიშვნები')} wide>{fieldId => <textarea id={fieldId} className="gk-input" rows={2} maxLength={5000} value={draft.notes} onChange={event => change({ notes: event.target.value })} />}</Field>
                <Field label={copy('Branch', 'ბრენჩი')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={200} value={draft.branch} placeholder="golive/…" onChange={event => change({ branch: event.target.value })} />}</Field>
                <Field label={copy('Pull request', 'Pull request')}>{fieldId => <input id={fieldId} className="gk-input" type="url" maxLength={500} value={draft.prUrl} placeholder="https://github.com/…" onChange={event => change({ prUrl: event.target.value })} />}</Field>
                {(item.branch || item.prUrl) && <p className="tw-links tw-field--wide">
                    {item.branch && <span><GitBranch aria-hidden="true" /><code>{item.branch}</code></span>}
                    {item.prUrl && <a href={item.prUrl} target="_blank" rel="noreferrer noopener"><ExternalLink aria-hidden="true" />{copy('Open the pull request', 'Pull request-ის გახსნა')}</a>}
                </p>}
            </div>}
            <div className="tw-save">
                <Field label={copy('What changed', 'რა შეიცვალა')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={240} value={draft.update} placeholder={copy('One line, for example “Waiting for the email provider”', 'ერთი ხაზი, მაგალითად „ველოდებით ელფოსტის პროვაიდერს“')}
                    onChange={event => change({ update: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') void save(); }} />}</Field>
                <Button variant="ghost" size="sm" aria-expanded={editing} onClick={() => setEditing(value => !value)}>{editing ? copy('Fewer details', 'ნაკლები') : copy('Edit details', 'დეტალების შეცვლა')}</Button>
                <Button variant="primary" size="sm" disabled={!pending || saving} onClick={() => void save()}>{saving ? copy('Saving…', 'ინახება…') : copy('Save update', 'განახლების შენახვა')}</Button>
            </div>
            {error && <div className="gk-notice gk-notice--danger" role="alert"><span>{error}</span>{conflict && <Button size="sm" onClick={() => setRevision(value => value + 1)}>{copy('Reload', 'განახლება')}</Button>}</div>}
        </section>

        <section className="tw-section" aria-label={copy('Videos and pictures', 'ვიდეოები და სურათები')}>
            <h3 className="tw-section__title">{copy('Videos and pictures', 'ვიდეოები და სურათები')}</h3>
            <WorkMediaList itemId={id} media={detail.media} onChanged={next => { setDetail(next); onSaved(); }} />
        </section>
        <section className="tw-section" aria-label={copy('Comments', 'კომენტარები')}>
            <h3 className="tw-section__title">{copy('Comments', 'კომენტარები')}</h3>
            <WorkComments itemId={id} comments={detail.comments} team={team} me={me} onChanged={comments => { setDetail({ ...detail, comments }); onSaved(); }} />
        </section>
        <details className="tw-section tw-history-box">
            <summary className="tw-section__title">{copy('History', 'ისტორია')} <span className="gk-faint gk-num">{detail.updates.length}</span></summary>
            <ol className="tw-history">{detail.updates.map(update => <HistoryLine key={update.id} update={update} />)}</ol>
        </details>
        {deleting && onDeleted && <DeleteDialog item={item} steps={detail.steps.length} onClose={() => setDeleting(false)} onDeleted={onDeleted} />}
    </div>;
}

/** "Delete this task?": says what goes with it, and that the plans keep a line saying who deleted it. */
function DeleteDialog({ item, steps, onClose, onDeleted }: { item: WorkItem; steps: number; onClose: () => void; onDeleted: () => void }) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const isStep = item.parentId != null;
    const remove = async () => {
        setBusy(true); setError('');
        try { await deleteWork(item.id); onDeleted(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('It couldn’t be deleted.', 'ვერ წაიშალა.'))); setBusy(false); }
    };
    return <Dialog open size="sm" className="tw-dialog" title={isStep ? copy('Delete this step?', 'წავშალოთ ეს ნაბიჯი?') : copy('Delete this task?', 'წავშალოთ ეს საქმე?')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        description={copy(`“${item.title}”${steps ? ` and its ${steps === 1 ? 'step' : `${steps} steps`}` : ''}, with its comments, files and history. Its plans keep a line saying who deleted it. This can’t be undone.`,
            `„${item.title}“${steps ? ` და მისი ${steps} ნაბიჯი` : ''}, კომენტარებით, ფაილებით და ისტორიით. გეგმებში დარჩება ჩანაწერი, ვინ წაშალა. ამის დაბრუნება შეუძლებელია.`)}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="danger" disabled={busy} onClick={() => void remove()}>{busy ? copy('Deleting…', 'იშლება…') : copy('Delete', 'წაშლა')}</Button></>}>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </Dialog>;
}

/** A new task, on its own or in a plan, a step of a big task, or a task already on another list put in this plan. */
export function AddTaskDialog({ planId, parent, team, others, onClose, onCreated, onPlace }: {
    planId?: number; parent?: WorkItem; team: Person[]; others: WorkItem[]; onClose: () => void; onCreated: (detail: Detail) => void; onPlace: (itemId: number) => void;
}) {
    const copy = useJourneyCopy();
    const [work, setWork] = useState<NewWork & { percent: number; end: WorkEnd; people: number[]; small: boolean }>({ title: '', area: '', status: 'IN_PROGRESS', percent: 0, step: '', end: { kind: 'UNKNOWN' }, people: [], small: false });
    const [existing, setExisting] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const create = async () => {
        if (existing) { onPlace(Number(existing)); return; }
        if (!work.title.trim()) { setError(copy('Give the work a name.', 'მიეცით საქმეს სახელი.')); return; }
        setSaving(true); setError('');
        try { onCreated(await createWork({ ...work, title: work.title.trim(), ...(parent ? { parentId: parent.id } : planId != null ? { planId } : {}) })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be added.', 'ვერ დაემატა.'))); }
        finally { setSaving(false); }
    };
    const title = parent ? copy(`Add a step to ${parent.title}`, `ნაბიჯის დამატება: ${parent.title}`) : copy('Add task', 'საქმის დამატება');
    return <Dialog open size="md" className="tw-dialog" title={title} description={copy('What is being built, and where it stands.', 'რა კეთდება და სად არის.')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={saving} onClick={() => void create()}>{saving ? copy('Adding…', 'ემატება…') : parent ? copy('Add step', 'ნაბიჯის დამატება') : copy('Add task', 'საქმის დამატება')}</Button></>}>
        <div className="tw-details">
            {!parent && others.length > 0 && <Field label={copy('A task already on the list', 'უკვე არსებული საქმე')} wide>{fieldId => <select id={fieldId} className="gk-input" value={existing} onChange={event => setExisting(event.target.value)}>
                <option value="">{copy('No, something new', 'არა, ახალი')}</option>
                {others.map(other => <option key={other.id} value={other.id}>{other.title}</option>)}
            </select>}</Field>}
            {!existing && <>
                <div className="tw-grid">
                    <Field label={copy('Name', 'სახელი')}>{fieldId => <input id={fieldId} className="gk-input" autoFocus maxLength={120} value={work.title} onChange={event => setWork({ ...work, title: event.target.value })} />}</Field>
                    <Field label={copy('Where', 'სად')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={160} value={work.area} placeholder={copy('Landing · founders’ request', 'ლენდინგი · დამფუძნებლების თხოვნა')} onChange={event => setWork({ ...work, area: event.target.value })} />}</Field>
                    <Field label={copy('Description', 'აღწერა')} wide>{fieldId => <textarea id={fieldId} className="gk-input" rows={2} maxLength={400} value={work.description ?? ''} onChange={event => setWork({ ...work, description: event.target.value })} />}</Field>
                    <EndPick end={work.end} onChange={end => setWork({ ...work, end })} />
                    <PeoplePick team={team} chosen={work.people} onChange={people => setWork({ ...work, people })} />
                </div>
                <SmallPick small={work.small} onChange={small => setWork({ ...work, small })} />
                <QuickEdit status={work.status} percent={work.percent} onChange={patch => setWork(current => ({ ...current, ...patch }))} />
            </>}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </div>
    </Dialog>;
}
