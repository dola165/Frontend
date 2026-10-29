import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, Bot, ClipboardPaste, ExternalLink, GitBranch, GitCommitHorizontal, Link2, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, Skeleton } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { askQuestion, changeWork, createWork, deleteWork, fetchDetail, itemComments, type Detail, type LinkKind, type NewWork, type Person, type Priority, type WorkChange, type WorkEnd, type WorkItem, type WorkQuestion, type WorkStatus, type WorkUpdate } from './api';
import { PurposeChanged, PurposeLine } from './PurposeBits';
import { QuestionRow } from './QuestionRow';
import { EndPick, Field, KeyChip, NameField, PeoplePick, PersonPick, PriorityPick, ProgressPick, QuickEdit, SmallChip, SmallPick, StatusDot, StatusMenu } from './WorkBits';
import { WorkComments } from '../../components/work/WorkComments';
import { AttachButton, WorkMediaList } from './WorkMedia';
import { useTaskUploads } from './useUploads';
import { ReportDialog } from './ReportDialog';
import { DiscussButton } from '../teamChat/DiscussButton';
import { ago, day, endWords, madeBy, priorityName, progressWords, shortDate, statusName } from './teamWorkWords';
import { taskAsText } from './planAsText';
import { short } from './upToDate';

const isConflict = (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 409;

interface Draft {
    title: string; area: string; status: WorkStatus; percent: number | null; step: string; notes: string; branch: string; prUrl: string; update: string;
    startedOn: string; end: WorkEnd; people: number[]; percentFromSteps: boolean; small: boolean;
    tested: string; commits: string; priority: Priority | null; requestedBy: number | null;
}
const draftOf = (item: WorkItem): Draft => ({
    title: item.title, area: item.area ?? '', status: item.status, percent: item.percent, step: item.step ?? '', notes: item.notes ?? '', branch: item.branch ?? '', prUrl: item.prUrl ?? '', update: '',
    startedOn: item.startedOn ?? '', end: item.end, people: item.people.flatMap(person => person.id == null ? [] : [person.id]), percentFromSteps: item.percentFromSteps, small: item.small,
    tested: item.tested ?? '', commits: item.commits ?? '', priority: item.priority, requestedBy: item.requestedBy?.id ?? null,
});
const sameEnd = (a: WorkEnd, b: WorkEnd) => a.kind === b.kind && (a.date ?? null) === (b.date ?? null) && (a.amount ?? null) === (b.amount ?? null) && (a.unit ?? null) === (b.unit ?? null);
const KNOWN: Record<string, [string, string]> = {
    'Added': ['Added', 'დაემატა'], 'Edited the details': ['Edited the details', 'დეტალები შეიცვალა'], 'Added a picture': ['Added a picture', 'დაემატა სურათი'], 'Added a video': ['Added a video', 'დაემატა ვიდეო'], 'Added a file': ['Added a file', 'დაემატა ფაილი'],
    'Seen': ['Seen', 'ნანახია'], 'Acknowledged': ['Acknowledged', 'გაითვალისწინა'], 'Pushed to pending': ['Pushed to Waiting', 'გადავიდა მოლოდინში'], 'Made a task': ['Made a task', 'გახდა საქმე'],
    'Report pasted': ['Report pasted', 'ანგარიში ჩაისვა'], 'Updated from a paste': ['Updated from a paste', 'განახლდა ჩასმით'],
};
const hasFiles = (event: DragEvent) => [...event.dataTransfer.types].includes('Files');

/** One line of history: who, when, how the status and percent moved, and what they wrote. */
function HistoryLine({ update }: { update: WorkUpdate }) {
    const copy = useJourneyCopy();
    const moves = [
        update.status && (update.previousStatus ? `${statusName(copy, update.previousStatus)} → ${statusName(copy, update.status)}` : statusName(copy, update.status)),
        (update.percent != null || update.previousPercent != null) && `${update.previousPercent ?? '—'}% → ${update.percent ?? '—'}%`,
    ].filter(Boolean).join(' · ');
    const message = update.message && KNOWN[update.message] ? copy(...KNOWN[update.message]) : update.message;
    return <li className="tw-history__line">
        <span className="tw-history__who">{madeBy(copy, update.author?.name, update.byDola)} · {ago(copy, update.at)}</span>
        {moves && <span className="tw-history__moves gk-num">{moves}</span>}
        {message && <span className="tw-history__message">{message}</span>}
    </li>;
}

/** Questions for Beqa: the open ones first with their quick answers; with none, just a small "Ask Beqa". */
function Questions({ questions, itemId, onPut }: { questions: WorkQuestion[]; itemId: number; onPut: (detail: Detail) => void }) {
    const copy = useJourneyCopy();
    const textId = useId(), optionsId = useId();
    const [asking, setAsking] = useState(false);
    const [text, setText] = useState('');
    const [options, setOptions] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const run = async (action: () => Promise<Detail>, after?: () => void) => {
        setBusy(true); setError('');
        try { onPut(await action()); after?.(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    const open = questions.filter(question => question.answer == null), answered = questions.filter(question => question.answer != null);
    const ask = asking ? <form className="tw-questions__ask" onSubmit={event => { event.preventDefault(); if (text.trim()) void run(() => askQuestion(itemId, text.trim(), options.split('|').map(option => option.trim()).filter(Boolean)), () => { setText(''); setOptions(''); setAsking(false); }); }}>
        <div className="tw-field"><label htmlFor={textId}>{copy('The question', 'კითხვა')}</label>
            <input id={textId} className="gk-input" autoFocus maxLength={1000} value={text} onChange={event => setText(event.target.value)} /></div>
        <div className="tw-field"><label htmlFor={optionsId}>{copy('Quick answers, separated by | (none means yes/no)', 'სწრაფი პასუხები, | -ით გაყოფილი (თუ არა — კი/არა)')}</label>
            <input id={optionsId} className="gk-input" maxLength={400} value={options} placeholder="10 | 30" onChange={event => setOptions(event.target.value)} /></div>
        <span className="work-row-actions"><Button size="sm" variant="primary" type="submit" disabled={busy || !text.trim()}>{copy('Ask', 'კითხვა')}</Button><Button size="sm" variant="ghost" onClick={() => setAsking(false)}>{copy('Cancel', 'გაუქმება')}</Button></span>
    </form> : <button type="button" className="work-link-button tw-ask" onClick={() => setAsking(true)}><Plus aria-hidden="true" />{copy('Ask Beqa', 'კითხვა ბექას')}</button>;
    if (!questions.length) return <div className="tw-questions tw-questions--empty">{ask}{error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}</div>;
    return <section className="tw-section tw-questions" aria-label={copy('Questions for Beqa', 'კითხვები ბექასთვის')}>
        <h3 className="tw-section__title">{copy('Questions for Beqa', 'კითხვები ბექასთვის')} {open.length > 0 && <span className="gk-count">{open.length}</span>}</h3>
        <ul className="tw-questions__list">{[...open, ...answered].map(question => <QuestionRow key={question.id} question={question} removable onDone={onPut} />)}</ul>
        {ask}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </section>;
}

const KINDS: Record<LinkKind, [string, string]> = { BLOCKED_BY: ['Blocked by', 'ელოდება'], BLOCKS: ['Blocks', 'აკავებს'], RELATED: ['Related', 'დაკავშირებული'] };

/**
 * Links to other tasks: blocked by, blocks, related, with the ones still waited on called out. Blocked by and related
 * live on this task; blocks is the other task's "blocked by", so adding or removing one changes that task.
 */
function Links({ item, candidates, onPut, onSaved }: { item: WorkItem; candidates: WorkItem[]; onPut: (detail: Detail) => void; onSaved: () => void }) {
    const copy = useJourneyCopy();
    const taskId = useId(), kindId = useId();
    const [adding, setAdding] = useState(false);
    const [other, setOther] = useState('');
    const [kind, setKind] = useState<LinkKind>('BLOCKED_BY');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const ids = (which: LinkKind) => item.links.filter(link => link.kind === which).map(link => link.task.id);
    const save = async (action: () => Promise<Detail | void>) => {
        setBusy(true); setError('');
        try { const next = await action(); if (next) onPut(next); else onPut(await fetchDetail(item.id)); onSaved(); setAdding(false); setOther(''); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('The link couldn’t be saved.', 'ბმული ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    /** Adds or removes one link; for "blocks" it is the other task that changes. */
    const set = (which: LinkKind, otherId: number, on: boolean) => save(async () => {
        if (which === 'BLOCKS') {
            const theirs = await fetchDetail(otherId);
            const blockedBy = theirs.item.links.filter(link => link.kind === 'BLOCKED_BY').map(link => link.task.id).filter(id => id !== item.id);
            await changeWork(otherId, { version: theirs.item.version, blockedBy: on ? [...blockedBy, item.id] : blockedBy });
            return undefined;
        }
        const list = ids(which).filter(id => id !== otherId);
        return changeWork(item.id, { version: item.version, [which === 'RELATED' ? 'related' : 'blockedBy']: on ? [...list, otherId] : list });
    });
    const linked = new Set(item.links.map(link => link.task.id));
    const free = candidates.filter(candidate => candidate.id !== item.id && candidate.id !== item.parentId && !linked.has(candidate.id));
    return <div className="tw-linked">
        {item.waitingOn.length > 0 && <p className="tw-waiting"><span className="tw-dot" data-status="BLOCKED" aria-hidden="true" />{copy(`Waiting on ${item.waitingOn.map(ref => `${ref.key} ${ref.title}`).join(', ')}`, `ელოდება: ${item.waitingOn.map(ref => `${ref.key} ${ref.title}`).join(', ')}`)}</p>}
        {item.links.length > 0 && <ul className="tw-linked__list">{item.links.map(link => <li key={`${link.kind}-${link.task.id}`}>
            <span className="tw-linked__kind">{copy(...KINDS[link.kind])}</span>
            <StatusDot status={link.task.status} /><KeyChip value={link.task.key} /><span className="tw-linked__name">{link.task.title}</span>
            <button type="button" className="work-icon-button" aria-label={copy(`Remove the link to ${link.task.key}`, `${link.task.key}-ზე ბმულის წაშლა`)} disabled={busy} onClick={() => void set(link.kind, link.task.id, false)}><X aria-hidden="true" /></button>
        </li>)}</ul>}
        {adding ? <form className="tw-linked__add" onSubmit={event => { event.preventDefault(); if (other) void set(kind, Number(other), true); }}>
            <label htmlFor={kindId} className="gk-visually-hidden">{copy('How', 'როგორ')}</label>
            <select id={kindId} className="gk-input" value={kind} onChange={event => setKind(event.target.value as LinkKind)}>{(Object.keys(KINDS) as LinkKind[]).map(which => <option key={which} value={which}>{copy(...KINDS[which])}</option>)}</select>
            <label htmlFor={taskId} className="gk-visually-hidden">{copy('Task', 'საქმე')}</label>
            <select id={taskId} className="gk-input" value={other} onChange={event => setOther(event.target.value)}>
                <option value="">{copy('Pick a task', 'აირჩიეთ საქმე')}</option>
                {free.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.key} {candidate.title}</option>)}
            </select>
            <Button size="sm" variant="primary" type="submit" disabled={busy || !other}>{copy('Link', 'დაკავშირება')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>{copy('Cancel', 'გაუქმება')}</Button>
        </form> : <span><Button size="sm" variant="ghost" disabled={free.length === 0} onClick={() => setAdding(true)}><Link2 aria-hidden="true" />{copy('Link a task', 'საქმის დაკავშირება')}</Button></span>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}

export interface PlaceOnPlan { first: boolean; last: boolean; onMove: (by: -1 | 1) => void; onRemove: () => void }

/**
 * A task opened, big and in order of what matters: what it is for (and how that changed), what done means, then
 * who is on it, when it started and should end, and Copy for AI, all in view. Status is one compact control and
 * progress a small value; the percent words and slider sit behind "Progress"; "What changed" appears with a change.
 * Questions for Beqa stay small until there are some. A file, picture or video is one button, or a drop anywhere on
 * the page. Steps, links, the report, comments, history and the rest of the details are folded. A save made after a
 * colleague's is refused, and the person reloads with their words kept.
 */
export function TaskView({ id, team, me, place, plan, candidates = [], framed = false, onOpen, onAddStep, onClose, onSaved, onDeleted }: {
    id: number; team: Person[]; me?: number | null; place?: PlaceOnPlan; plan?: string; candidates?: WorkItem[]; framed?: boolean; onOpen: (id: number) => void; onAddStep?: () => void; onClose: () => void; onSaved: () => void; onDeleted?: () => void;
}) {
    const copy = useJourneyCopy();
    const [detail, setDetail] = useState<Detail | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [saving, setSaving] = useState(false);
    const [revision, setRevision] = useState(0);
    const [deleting, setDeleting] = useState(false);
    const [reporting, setReporting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [progressOpen, setProgressOpen] = useState(false);
    const [doneEditing, setDoneEditing] = useState(false);
    const [doneText, setDoneText] = useState('');
    const [dragging, setDragging] = useState(0);
    const doneId = useId();
    const updateInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const controller = new AbortController();
        fetchDetail(id, controller.signal)
            .then(next => { if (controller.signal.aborted) return; setDetail(next); setDraft(current => current && revision > 0 ? { ...draftOf(next.item), update: current.update } : draftOf(next.item)); setConflict(false); setError(''); })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('This task could not load.', 'ეს საქმე ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [id, revision, copy]);

    const item = detail?.item;
    const put = (next: Detail) => { setDetail(next); setDraft(current => ({ ...draftOf(next.item), update: current?.update ?? '' })); };
    const patch = (part: Partial<Draft>) => setDraft(current => current && { ...current, ...part });
    const uploads = useTaskUploads(id, next => { put(next); onSaved(); });
    const changes = (): WorkChange | null => {
        if (!item || !draft) return null;
        const before = draftOf(item), result: WorkChange = { version: item.version };
        const out = result as unknown as Record<string, unknown>;
        let any = false;
        for (const key of ['title', 'area', 'status', 'step', 'notes', 'branch', 'prUrl', 'startedOn', 'percentFromSteps', 'small', 'tested', 'commits'] as const) if (draft[key] !== before[key]) { out[key] = draft[key]; any = true; }
        if (!draft.percentFromSteps && draft.percent !== before.percent) { result.percent = draft.percent ?? -1; any = true; }
        if (draft.priority !== before.priority) { result.priority = draft.priority ?? ''; any = true; }
        if (draft.requestedBy !== before.requestedBy) { result.requestedBy = draft.requestedBy ?? 0; any = true; }
        if (!sameEnd(draft.end, before.end)) { result.end = draft.end; any = true; }
        if ([...draft.people].sort().join() !== [...before.people].sort().join()) { result.people = draft.people; any = true; }
        if (draft.update.trim()) { result.update = draft.update.trim(); any = true; }
        return any ? result : null;
    };
    const pending = changes();
    const save = async () => {
        if (!pending) return;
        setSaving(true); setError('');
        try { const next = await changeWork(id, pending); setDetail(next); setDraft(draftOf(next.item)); onSaved(); }
        catch (failure) { setConflict(isConflict(failure)); setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setSaving(false); }
    };
    /** One field saved on its own, right away: the purpose, what done means. */
    const saveNow = async (change: Omit<WorkChange, 'version'>) => {
        if (!item) return;
        setSaving(true); setError('');
        try { put(await changeWork(id, { version: item.version, ...change })); onSaved(); }
        catch (failure) { setConflict(isConflict(failure)); setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setSaving(false); }
    };
    const onDrop = (event: DragEvent) => { event.preventDefault(); setDragging(0); if (event.dataTransfer.files.length) void uploads.upload([...event.dataTransfer.files]); };

    if (!item || !draft || !detail) return <div className="tw-detail" data-framed={framed || undefined} role="region" aria-label={copy('Task', 'საქმე')}>
        {error ? <p className="gk-notice gk-notice--danger" role="alert">{error}</p> : <div role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={96} /></div>}
    </div>;
    const isStep = item.parentId != null;
    const hasSteps = detail.steps.length > 0;
    const hasReport = Boolean(item.tested || item.commits || item.branch || item.prUrl || detail.foundCommits.length);
    const link = `${window.location.origin}/team-work?task=${item.parentId ?? item.id}${isStep ? `&step=${item.id}` : ''}`;
    const fromSteps = draft.percentFromSteps && hasSteps;
    const progress = fromSteps ? copy(draft.percent == null ? 'no percent, from its steps' : `${draft.percent}%, from its steps`, draft.percent == null ? 'პროცენტი არ არის, ნაბიჯებიდან' : `${draft.percent}%, ნაბიჯებიდან`)
        : draft.percent == null ? copy('no percent', 'პროცენტი არ არის') : progressWords(copy, draft.percent);
    const statusMoved = draft.status !== item.status;
    return <div className="tw-detail" data-framed={framed || undefined} data-dragging={dragging > 0 || undefined} role="region" aria-label={`${item.key} ${item.title}`}
        onDragEnter={event => { if (hasFiles(event)) { event.preventDefault(); setDragging(count => count + 1); } }} onDragOver={event => { if (hasFiles(event)) event.preventDefault(); }}
        onDragLeave={event => { if (hasFiles(event)) setDragging(count => Math.max(0, count - 1)); }} onDrop={onDrop}>
        {dragging > 0 && <div className="tw-drop-overlay" aria-hidden="true"><Paperclip />{copy('Drop to attach it to this task', 'ჩააგდეთ, რომ ამ საქმეს მიემაგროს')}</div>}
        <div className="tw-detail__grid">
            <section className="tw-purpose" aria-label={copy('What it’s for', 'რისთვისაა')}>
                {!framed && <div className="tw-detail__id"><StatusDot status={item.status} /><KeyChip value={item.key} /><span className="tw-detail__name">{item.title}</span><DiscussButton task={item} /></div>}
                <PurposeLine as="p" purpose={item.description} label={copy('What it’s for', 'რისთვისაა')} prompt={isStep ? copy('Write what this step is for', 'დაწერეთ, რისთვისაა ეს ნაბიჯი') : copy('Write what this task is for', 'დაწერეთ, რისთვისაა ეს საქმე')}
                    busy={saving} onSave={purpose => saveNow({ description: purpose })} />
                <PurposeChanged changes={detail.purposeChanges} what="task" />
            </section>

            <section className="tw-done" aria-label={copy('Done means', 'მზადაა, როცა')}>
                <h3 className="tw-section__title">{copy('Done means', 'მზადაა, როცა')}{item.doneMeans && !doneEditing && <button type="button" className="work-icon-button" aria-label={copy('Change what done means', 'შეცვალეთ, რას ნიშნავს მზადაა')} onClick={() => { setDoneText(item.doneMeans ?? ''); setDoneEditing(true); }}><Pencil aria-hidden="true" /></button>}</h3>
                {doneEditing ? <form className="tw-purpose__edit" onSubmit={event => { event.preventDefault(); setDoneEditing(false); if (doneText.trim() !== (item.doneMeans ?? '')) void saveNow({ doneMeans: doneText.trim() }); }}>
                    <label htmlFor={doneId} className="gk-visually-hidden">{copy('Done means', 'მზადაა, როცა')}</label>
                    <textarea id={doneId} className="gk-input" autoFocus rows={3} maxLength={2000} value={doneText} placeholder={copy('What has to be true for this to be done', 'რა უნდა იყოს ასე, რომ ეს მზად იყოს')} onChange={event => setDoneText(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setDoneEditing(false); }} />
                    <span className="work-row-actions"><Button size="sm" variant="primary" type="submit" disabled={saving}>{copy('Save', 'შენახვა')}</Button><Button size="sm" variant="ghost" onClick={() => setDoneEditing(false)}>{copy('Cancel', 'გაუქმება')}</Button></span>
                </form> : item.doneMeans ? <p className="tw-done__text">{item.doneMeans}</p>
                    : <button type="button" className="tw-purpose__prompt tw-purpose__prompt--small" onClick={() => { setDoneText(''); setDoneEditing(true); }}><Pencil aria-hidden="true" />{copy('Write what done means', 'დაწერეთ, რას ნიშნავს მზადაა')}</button>}
                {item.step && <p className="tw-detail__step"><span className="gk-faint">{copy('Current step', 'მიმდინარე ნაბიჯი')}: </span>{item.step}</p>}
            </section>

            <aside className="tw-detail__side" aria-label={copy('Who, when and tools', 'ვინ, როდის და ხელსაწყოები')}>
                <dl className="tw-facts">
                    <div><dt>{copy('Who’s on it', 'ვინ მუშაობს')}</dt><dd>{item.people.length ? item.people.map(person => person.name).join(', ') : copy('nobody yet', 'ჯერ არავინ')}</dd></div>
                    <div><dt>{copy('Started', 'დაიწყო')}</dt><dd>{item.startedOn ? shortDate(copy, day(item.startedOn)) : copy('not yet', 'ჯერ არა')}</dd></div>
                    <div><dt>{copy('Expected end', 'სავარაუდო დასრულება')}</dt><dd>{endWords(copy, item.end)}</dd></div>
                    <div><dt>{copy('Last touched', 'ბოლოს')}</dt><dd>{[item.updatedBy?.name, ago(copy, item.updatedAt)].filter(Boolean).join(' · ')}</dd></div>
                    {(item.priority || item.requestedBy?.name || item.small) && <div><dt>{copy('Also', 'ასევე')}</dt><dd className="tw-detail__id">
                        {item.priority && <span className="tw-chip" data-priority={item.priority}>{priorityName(copy, item.priority)}</span>}
                        {item.small && <SmallChip />}
                        {item.requestedBy?.name && <span>{copy(`Requested by ${item.requestedBy.name}`, `ითხოვა ${item.requestedBy.name}`)}</span>}
                    </dd></div>}
                </dl>
                <div className="tw-detail__tools">
                    <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard?.writeText(taskAsText(detail, link, plan)).then(() => setCopied(true))}><Bot aria-hidden="true" />{copied ? copy('Copied', 'დაკოპირდა') : copy('Copy for AI', 'კოპირება AI-სთვის')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setReporting(true)}><ClipboardPaste aria-hidden="true" />{copy('Paste report', 'ანგარიშის ჩასმა')}</Button>
                    {place && <>
                        <Button size="sm" iconOnly variant="ghost" disabled={place.first} aria-label={copy('Move up', 'ზემოთ')} onClick={() => place.onMove(-1)}><ArrowUp aria-hidden="true" /></Button>
                        <Button size="sm" iconOnly variant="ghost" disabled={place.last} aria-label={copy('Move down', 'ქვემოთ')} onClick={() => place.onMove(1)}><ArrowDown aria-hidden="true" /></Button>
                        <Button size="sm" variant="ghost" onClick={place.onRemove}>{copy('Take off this plan', 'ამ გეგმიდან მოხსნა')}</Button>
                    </>}
                    {onDeleted && <Button size="sm" iconOnly variant="ghost" aria-label={copy('Delete', 'წაშლა')} onClick={() => setDeleting(true)}><Trash2 aria-hidden="true" /></Button>}
                    {!framed && <Button size="sm" iconOnly variant="ghost" aria-label={copy('Close', 'დახურვა')} onClick={onClose}><X aria-hidden="true" /></Button>}
                </div>
            </aside>

            <section className="tw-state" aria-label={copy('Status and progress', 'სტატუსი და პროგრესი')}>
                <div className="tw-state__row">
                    <StatusMenu status={draft.status} percent={draft.percent} fromSteps={fromSteps} onChange={change => { patch(change); requestAnimationFrame(() => updateInput.current?.focus()); }} />
                    <button type="button" className="tw-state__progress" aria-expanded={progressOpen} aria-label={copy(`Progress: ${progress}`, `პროგრესი: ${progress}`)} onClick={() => setProgressOpen(value => !value)}>
                        <span className="tw-card__bar" aria-hidden="true"><span style={{ width: `${draft.percent ?? 0}%` }} /></span><span className="gk-num">{progress}</span><span className="gk-faint">{copy('Progress', 'პროგრესი')}</span>
                    </button>
                </div>
                {progressOpen && <div className="tw-state__fold">
                    {fromSteps ? <p className="gk-faint tw-quick__parts gk-num">{progress}</p> : <ProgressPick percent={draft.percent} onChange={percent => patch({ percent })} />}
                    {hasSteps && <label className="tw-check"><input type="checkbox" checked={draft.percentFromSteps} onChange={event => patch({ percentFromSteps: event.target.checked })} />{copy('Percent follows its steps', 'პროცენტი ნაბიჯებიდან')}</label>}
                </div>}
                {pending && <div className="tw-save">
                    <Field label={copy('What changed', 'რა შეიცვალა')}>{fieldId => <input ref={updateInput} id={fieldId} className="gk-input" maxLength={240} value={draft.update} placeholder={statusMoved ? copy(`Now ${statusName(copy, draft.status).toLowerCase()}: one line on why or what`, `ახლა ${statusName(copy, draft.status)}: ერთი ხაზი`) : copy('One line, for example “Waiting for the email provider”', 'ერთი ხაზი, მაგალითად „ველოდებით ელფოსტის პროვაიდერს“')}
                        onChange={event => patch({ update: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') void save(); }} />}</Field>
                    <Button variant="primary" size="sm" disabled={saving} onClick={() => void save()}>{saving ? copy('Saving…', 'ინახება…') : copy('Save update', 'განახლების შენახვა')}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setDraft(draftOf(item))}>{copy('Cancel', 'გაუქმება')}</Button>
                </div>}
                {error && <div className="gk-notice gk-notice--danger" role="alert"><span>{error}</span>{conflict && <Button size="sm" onClick={() => setRevision(value => value + 1)}>{copy('Reload', 'განახლება')}</Button>}</div>}
            </section>

            <Questions questions={detail.questions} itemId={id} onPut={next => { put(next); onSaved(); }} />

            <section className="tw-section tw-files" aria-label={copy('Files, pictures and videos', 'ფაილები, სურათები და ვიდეოები')}>
                <AttachButton uploads={uploads} primary={detail.media.length === 0} />
                {uploads.error && <p className="gk-notice gk-notice--danger" role="alert">{uploads.error}</p>}
                <WorkMediaList itemId={id} media={detail.media} onChanged={next => { put(next); onSaved(); }} />
            </section>

            {!isStep && (hasSteps || (onAddStep && !item.small)) && <details className="tw-section tw-fold" open={hasSteps}>
                <summary className="tw-section__title">{copy('Steps', 'ნაბიჯები')} <span className="gk-faint gk-num">{detail.steps.length || ''}</span></summary>
                {hasSteps && <ul className="tw-steps">{detail.steps.map(step => <li key={step.id}>
                    <button type="button" onClick={() => onOpen(step.id)}><StatusDot status={step.status} /><KeyChip value={step.key} /><span className="tw-steps__name">{step.title}</span><span className="gk-num gk-faint">{step.percent != null ? `${step.percent}%` : statusName(copy, step.status)}</span></button>
                </li>)}</ul>}
                {onAddStep && !item.small && <span><Button size="sm" variant="ghost" onClick={onAddStep}><Plus aria-hidden="true" />{copy('Add a step', 'ნაბიჯის დამატება')}</Button></span>}
            </details>}
            <details className="tw-section tw-fold" open={item.links.length > 0}>
                <summary className="tw-section__title">{copy('Links', 'ბმულები')} <span className="gk-faint gk-num">{item.links.length || ''}</span>{item.waitingOn.length > 0 && <span className="tw-chip" data-priority="NOW">{copy('waiting', 'ელოდება')}</span>}</summary>
                <Links item={item} candidates={candidates} onPut={put} onSaved={onSaved} />
            </details>
            <details className="tw-section tw-fold" open={hasReport}>
                <summary className="tw-section__title">{copy('Report', 'ანგარიში')} <span className="gk-faint">{hasReport ? '' : copy('nothing yet', 'ჯერ არაფერი')}</span></summary>
                <div className="tw-report">
                    <div><span className="tw-report__label">{copy('Tested', 'შემოწმდა')}</span>{item.tested ? <p className="tw-report__text">{item.tested}</p> : <p className="gk-faint tw-report__text">{copy('Nothing tested yet.', 'ჯერ არაფერი შემოწმებულა.')}</p>}</div>
                    {(item.branch || item.prUrl) && <p className="tw-links">
                        {item.branch && <span><GitBranch aria-hidden="true" /><code>{item.branch}</code></span>}
                        {item.prUrl && <a href={item.prUrl} target="_blank" rel="noreferrer noopener"><ExternalLink aria-hidden="true" />{copy('Open the pull request', 'PR-ის გახსნა')}</a>}
                    </p>}
                    {item.commits && <div><span className="tw-report__label">{copy('Commits, as reported', 'კომიტები, ანგარიშის მიხედვით')}</span><p className="tw-report__text gk-num">{item.commits}</p></div>}
                    {detail.foundCommits.length > 0 && <div><span className="tw-report__label">{copy(`In the live history (${detail.foundCommits.length})`, `ლაივ ისტორიაში (${detail.foundCommits.length})`)}</span>
                        <ul className="tw-commits">{detail.foundCommits.map(commit => <li key={commit.id}><GitCommitHorizontal aria-hidden="true" /><code className="gk-num">{short(commit.id)}</code><span>{commit.title}</span><span className="gk-faint">{commit.author} · {ago(copy, commit.date)}</span></li>)}</ul></div>}
                </div>
            </details>
            <details className="tw-section tw-fold" open={detail.comments.length > 0}>
                <summary className="tw-section__title">{copy('Comments', 'კომენტარები')} <span className="gk-faint gk-num">{detail.comments.length || ''}</span></summary>
                <WorkComments actions={itemComments(id)} comments={detail.comments} team={team} me={me} onChanged={comments => { setDetail({ ...detail, comments }); onSaved(); }} />
            </details>
            <details className="tw-section tw-fold tw-history-box">
                <summary className="tw-section__title">{copy('History', 'ისტორია')} <span className="gk-faint gk-num">{detail.updates.length}</span></summary>
                <ol className="tw-history">{detail.updates.map(update => <HistoryLine key={update.id} update={update} />)}</ol>
            </details>
            <details className="tw-section tw-fold">
                <summary className="tw-section__title">{copy('Edit details', 'დეტალების შეცვლა')} <span className="gk-faint">{copy('name, dates, people, priority, branch…', 'სახელი, თარიღები, ხალხი, პრიორიტეტი, ბრენჩი…')}</span></summary>
                <SmallPick small={draft.small} onChange={small => patch({ small })} />
                <div className="tw-grid">
                    <NameField value={draft.title} onChange={title => patch({ title })} />
                    <Field label={copy('Where', 'სად')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={160} value={draft.area} placeholder={copy('Landing · founders’ request', 'ლენდინგი · დამფუძნებლების თხოვნა')} onChange={event => patch({ area: event.target.value })} />}</Field>
                    <PriorityPick priority={draft.priority} onChange={priority => patch({ priority })} />
                    <PersonPick label={copy('Requested by', 'ვინ ითხოვა')} team={team} chosen={draft.requestedBy} onChange={requestedBy => patch({ requestedBy })} />
                    <Field label={copy('Started', 'დაიწყო')}>{fieldId => <input id={fieldId} className="gk-input" type="date" value={draft.startedOn} onChange={event => patch({ startedOn: event.target.value })} />}</Field>
                    <EndPick end={draft.end} onChange={end => patch({ end })} />
                    <PeoplePick team={team} chosen={draft.people} onChange={people => patch({ people })} />
                    <Field label={copy('Current step', 'მიმდინარე ნაბიჯი')} wide>{fieldId => <input id={fieldId} className="gk-input" maxLength={240} value={draft.step} onChange={event => patch({ step: event.target.value })} />}</Field>
                    <Field label={copy('Tested', 'შემოწმდა')} wide>{fieldId => <textarea id={fieldId} className="gk-input" rows={2} maxLength={5000} value={draft.tested} placeholder={copy('What passed, and what was not run and why', 'რა გაიარა და რა არ გაშვებულა, რატომ')} onChange={event => patch({ tested: event.target.value })} />}</Field>
                    <Field label={copy('Branch', 'ბრენჩი')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={200} value={draft.branch} placeholder="golive/…" onChange={event => patch({ branch: event.target.value })} />}</Field>
                    <Field label={copy('Pull request', 'შერწყმის მოთხოვნა (PR)')}>{fieldId => <input id={fieldId} className="gk-input" type="url" maxLength={500} value={draft.prUrl} placeholder="https://github.com/…" onChange={event => patch({ prUrl: event.target.value })} />}</Field>
                    <Field label={copy('Commits', 'კომიტები')} wide>{fieldId => <input id={fieldId} className="gk-input" maxLength={2000} value={draft.commits} placeholder={copy('ids and titles, as the report named them', 'id-ები და სათაურები, როგორც ანგარიშმა დაასახელა')} onChange={event => patch({ commits: event.target.value })} />}</Field>
                    <Field label={copy('Notes', 'შენიშვნები')} wide>{fieldId => <textarea id={fieldId} className="gk-input" rows={2} maxLength={5000} value={draft.notes} onChange={event => patch({ notes: event.target.value })} />}</Field>
                </div>
            </details>
        </div>
        {deleting && onDeleted && <DeleteDialog item={item} steps={detail.steps.length} onClose={() => setDeleting(false)} onDeleted={onDeleted} />}
        {reporting && <ReportDialog item={item} onClose={() => setReporting(false)} onApplied={next => { setReporting(false); put(next); onSaved(); }} />}
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

/** A new task, on its own or in a plan, a step of a big task, or a task already on another list put in this plan. What it is for comes first. */
export function AddTaskDialog({ planId, parent, team, others, onClose, onCreated, onPlace }: {
    planId?: number; parent?: WorkItem; team: Person[]; others: WorkItem[]; onClose: () => void; onCreated: (detail: Detail) => void; onPlace: (itemId: number) => void;
}) {
    const copy = useJourneyCopy();
    const [work, setWork] = useState<NewWork & { percent: number | null; end: WorkEnd; people: number[]; small: boolean; priority: Priority | null; requestedBy: number | null; doneMeans: string }>({ title: '', area: '', status: 'PLANNED', percent: null, step: '', end: { kind: 'UNKNOWN' }, people: [], small: false, priority: null, requestedBy: null, doneMeans: '' });
    const [existing, setExisting] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const create = async () => {
        if (existing) { onPlace(Number(existing)); return; }
        if (!work.title.trim()) { setError(copy('Give the task a name.', 'მიეცით საქმეს სახელი.')); return; }
        setSaving(true); setError('');
        try { onCreated(await createWork({ ...work, title: work.title.trim(), doneMeans: work.doneMeans.trim() || undefined, ...(parent ? { parentId: parent.id } : planId != null ? { planId } : {}) })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be added.', 'ვერ დაემატა.'))); }
        finally { setSaving(false); }
    };
    const title = parent ? copy(`Add a step to ${parent.title}`, `ნაბიჯის დამატება: ${parent.title}`) : copy('Add task', 'საქმის დამატება');
    return <Dialog open size="md" className="tw-dialog" title={title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={saving} onClick={() => void create()}>{saving ? copy('Adding…', 'ემატება…') : parent ? copy('Add step', 'ნაბიჯის დამატება') : copy('Add task', 'საქმის დამატება')}</Button></>}>
        <div className="tw-details">
            {!parent && others.length > 0 && <Field label={copy('A task already on the list', 'უკვე არსებული საქმე')} wide>{fieldId => <select id={fieldId} className="gk-input" value={existing} onChange={event => setExisting(event.target.value)}>
                <option value="">{copy('No, something new', 'არა, ახალი')}</option>
                {others.map(other => <option key={other.id} value={other.id}>{other.key} {other.title}</option>)}
            </select>}</Field>}
            {!existing && <>
                <div className="tw-grid">
                    <Field label={copy('What it’s for', 'რისთვისაა')} wide>{fieldId => <textarea id={fieldId} className="gk-input" autoFocus rows={2} maxLength={400} value={work.description ?? ''} placeholder={copy('Why this task exists, in one or two lines', 'რატომ არსებობს ეს საქმე, ერთ-ორ ხაზად')} onChange={event => setWork({ ...work, description: event.target.value })} />}</Field>
                    <NameField value={work.title} onChange={title => setWork({ ...work, title })} />
                    <Field label={copy('Where', 'სად')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={160} value={work.area} placeholder={copy('Landing · founders’ request', 'ლენდინგი · დამფუძნებლების თხოვნა')} onChange={event => setWork({ ...work, area: event.target.value })} />}</Field>
                    <Field label={copy('Done means', 'მზადაა, როცა')} wide>{fieldId => <textarea id={fieldId} className="gk-input" rows={2} maxLength={2000} value={work.doneMeans} placeholder={copy('What has to be true for this to be done', 'რა უნდა იყოს ასე, რომ ეს მზად იყოს')} onChange={event => setWork({ ...work, doneMeans: event.target.value })} />}</Field>
                    <PriorityPick priority={work.priority} onChange={priority => setWork({ ...work, priority })} />
                    <PersonPick label={copy('Requested by', 'ვინ ითხოვა')} team={team} chosen={work.requestedBy} onChange={requestedBy => setWork({ ...work, requestedBy })} />
                    <EndPick end={work.end} onChange={end => setWork({ ...work, end })} />
                    <PeoplePick team={team} chosen={work.people} onChange={people => setWork({ ...work, people })} />
                </div>
                <SmallPick small={work.small} onChange={small => setWork({ ...work, small })} />
                <QuickEdit status={work.status} percent={work.percent} onChange={part => setWork(current => ({ ...current, ...part }))} />
            </>}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </div>
    </Dialog>;
}
