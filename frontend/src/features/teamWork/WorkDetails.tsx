import { useEffect, useId, useState, type ReactNode } from 'react';
import { ExternalLink, GitBranch } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button, Skeleton } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { changeWork, createWork, fetchDetail, STATUSES, type Detail, type NewWork, type WorkChange, type WorkItem, type WorkStatus, type WorkUpdate } from './api';
import { WorkProgress, WorkStatusLabel } from './WorkBits';
import { ago, statusName } from './teamWorkWords';

const isConflict = (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 409;

interface Draft { title: string; area: string; status: WorkStatus; percent: number; step: string; notes: string; branch: string; prUrl: string; update: string }
const draftOf = (item: WorkItem): Draft => ({ title: item.title, area: item.area ?? '', status: item.status, percent: item.percent, step: item.step ?? '', notes: item.notes ?? '', branch: item.branch ?? '', prUrl: item.prUrl ?? '', update: '' });

function Field({ label, children, wide = false }: { label: string; children: (id: string) => ReactNode; wide?: boolean }) {
    const id = useId();
    return <div className={`tw-field${wide ? ' tw-field--wide' : ''}`}><label htmlFor={id}>{label}</label>{children(id)}</div>;
}

/** Status, a percent slider in steps of 5 and the one-line update: the quick part of every edit. Finished means 100%. */
function QuickEdit({ draft, onChange }: { draft: Pick<Draft, 'status' | 'percent'>; onChange: (change: Partial<Draft>) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    return <div className="tw-quick">
        <div className="tw-status-pick" role="radiogroup" aria-label={copy('Status', 'სტატუსი')}>
            {STATUSES.map(value => <button key={value} type="button" role="radio" aria-checked={draft.status === value} data-status={value}
                onClick={() => onChange(value === 'FINISHED' && draft.status !== 'FINISHED' ? { status: value, percent: 100 } : { status: value })}>
                <span className="gk-status__dot" aria-hidden="true" />{statusName(copy, value)}
            </button>)}
        </div>
        <div className="tw-slider"><label htmlFor={id}>{copy('Done', 'შესრულებულია')}</label>
            <input id={id} type="range" min={0} max={100} step={5} value={draft.percent} onChange={event => onChange({ percent: Number(event.target.value) })} />
            <output htmlFor={id} className="gk-num">{draft.percent}%</output>
        </div>
    </div>;
}

/** One line of history: who, when, how the status and percent moved, and what they wrote. */
function HistoryLine({ update }: { update: WorkUpdate }) {
    const copy = useJourneyCopy();
    const moves = [
        update.status && (update.previousStatus ? `${statusName(copy, update.previousStatus)} → ${statusName(copy, update.status)}` : statusName(copy, update.status)),
        update.percent != null && (update.previousPercent != null ? `${update.previousPercent}% → ${update.percent}%` : `${update.percent}%`),
    ].filter(Boolean).join(' · ');
    const message = update.message === 'Added' ? copy('Added', 'დაემატა') : update.message === 'Edited the details' ? copy('Edited the details', 'დეტალები შეიცვალა') : update.message;
    return <li className="tw-history__line">
        <span className="tw-history__who">{update.author?.name ?? copy('Someone', 'ვიღაც')} · {ago(copy, update.at)}</span>
        {moves && <span className="tw-history__moves gk-num">{moves}</span>}
        {message && <span className="tw-history__message">{message}</span>}
    </li>;
}

/**
 * A piece of work opened: its quick edit (status, percent, a line on what changed), its details and links, and every
 * change so far. A save made after a colleague's is refused, and the person reloads with their words kept.
 */
export function WorkDetails({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
    const copy = useJourneyCopy();
    const [detail, setDetail] = useState<Detail | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [saving, setSaving] = useState(false);
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        fetchDetail(id, controller.signal)
            .then(next => { if (controller.signal.aborted) return; setDetail(next); setDraft(current => current && revision > 0 ? { ...draftOf(next.item), update: current.update } : draftOf(next.item)); setConflict(false); setError(''); })
            .catch(failure => { if (!controller.signal.aborted) setError(extractApiErrorMessage(failure, copy('This work could not load.', 'ეს საქმე ვერ ჩაიტვირთა.'))); });
        return () => controller.abort();
    }, [id, revision, copy]);

    const item = detail?.item;
    const change = (part: Partial<Draft>) => setDraft(current => current && { ...current, ...part });
    const changes = (): WorkChange | null => {
        if (!item || !draft) return null;
        const before = draftOf(item), result: WorkChange = { version: item.version };
        const keys = ['title', 'area', 'status', 'percent', 'step', 'notes', 'branch', 'prUrl'] as const;
        let any = false;
        for (const key of keys) if (draft[key] !== before[key]) { (result as unknown as Record<string, unknown>)[key] = draft[key]; any = true; }
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

    return <Dialog open size="lg" className="tw-dialog" title={item?.title ?? copy('Work', 'საქმე')} description={item?.area ?? undefined} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={item && draft && <>
            <Button variant="ghost" onClick={onClose}>{copy('Close', 'დახურვა')}</Button>
            <Button variant="primary" disabled={!pending || saving} onClick={() => void save()}>{saving ? copy('Saving…', 'ინახება…') : copy('Save update', 'განახლების შენახვა')}</Button>
        </>}>
        {!item || !draft ? error ? <p className="gk-notice gk-notice--danger" role="alert">{error}</p> : <div role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={120} /></div>
            : <div className="tw-details">
                <div className="tw-details__now"><WorkStatusLabel status={item.status} /><WorkProgress item={item} />
                    <span className="tw-who">{[item.updatedBy?.name, ago(copy, item.updatedAt)].filter(Boolean).join(' · ')}</span></div>
                <section className="tw-section" aria-label={copy('Update', 'განახლება')}>
                    <QuickEdit draft={draft} onChange={change} />
                    <Field label={copy('What changed', 'რა შეიცვალა')} wide>{fieldId => <input id={fieldId} className="gk-input" maxLength={240} value={draft.update} placeholder={copy('One line, for example “Waiting for the email provider”', 'ერთი ხაზი, მაგალითად „ველოდებით ელფოსტის პროვაიდერს“')}
                        onChange={event => change({ update: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') void save(); }} />}</Field>
                    {error && <div className="gk-notice gk-notice--danger" role="alert"><span>{error}</span>{conflict && <Button size="sm" onClick={() => setRevision(value => value + 1)}>{copy('Reload', 'განახლება')}</Button>}</div>}
                </section>
                <section className="tw-section tw-grid" aria-label={copy('Details', 'დეტალები')}>
                    <Field label={copy('Name', 'სახელი')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={120} value={draft.title} onChange={event => change({ title: event.target.value })} />}</Field>
                    <Field label={copy('Where', 'სად')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={160} value={draft.area} placeholder={copy('Landing · founders’ request', 'ლენდინგი · დამფუძნებლების თხოვნა')} onChange={event => change({ area: event.target.value })} />}</Field>
                    <Field label={copy('Current step', 'მიმდინარე ნაბიჯი')} wide>{fieldId => <input id={fieldId} className="gk-input" maxLength={240} value={draft.step} onChange={event => change({ step: event.target.value })} />}</Field>
                    <Field label={copy('Notes', 'შენიშვნები')} wide>{fieldId => <textarea id={fieldId} className="gk-input" rows={3} maxLength={5000} value={draft.notes} onChange={event => change({ notes: event.target.value })} />}</Field>
                    <Field label={copy('Branch', 'ბრენჩი')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={200} value={draft.branch} placeholder="golive/…" onChange={event => change({ branch: event.target.value })} />}</Field>
                    <Field label={copy('Pull request', 'Pull request')}>{fieldId => <input id={fieldId} className="gk-input" type="url" maxLength={500} value={draft.prUrl} placeholder="https://github.com/…" onChange={event => change({ prUrl: event.target.value })} />}</Field>
                    {(item.branch || item.prUrl) && <p className="tw-links tw-field--wide">
                        {item.branch && <span><GitBranch aria-hidden="true" /><code>{item.branch}</code></span>}
                        {item.prUrl && <a href={item.prUrl} target="_blank" rel="noreferrer noopener"><ExternalLink aria-hidden="true" />{copy('Open the pull request', 'Pull request-ის გახსნა')}</a>}
                    </p>}
                </section>
                <section className="tw-section" aria-labelledby={`tw-history-${id}`}>
                    <h3 id={`tw-history-${id}`} className="tw-section__title">{copy('History', 'ისტორია')}</h3>
                    <ol className="tw-history">{detail!.updates.map(update => <HistoryLine key={update.id} update={update} />)}</ol>
                </section>
            </div>}
    </Dialog>;
}

/** A new piece of work: its name, where it lives, where it stands and the current step. */
export function AddWorkDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (detail: Detail) => void }) {
    const copy = useJourneyCopy();
    const [work, setWork] = useState<NewWork & { percent: number }>({ title: '', area: '', status: 'IN_PROGRESS', percent: 0, step: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const create = async () => {
        if (!work.title.trim()) { setError(copy('Give the work a name.', 'მიეცით საქმეს სახელი.')); return; }
        setSaving(true); setError('');
        try { onCreated(await createWork({ ...work, title: work.title.trim() })); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be added.', 'ვერ დაემატა.'))); }
        finally { setSaving(false); }
    };
    return <Dialog open size="md" className="tw-dialog" title={copy('Add work', 'საქმის დამატება')} description={copy('What is being built, and where it stands.', 'რა კეთდება და სად არის.')} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        footer={<><Button variant="ghost" onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" disabled={saving} onClick={() => void create()}>{saving ? copy('Adding…', 'ემატება…') : copy('Add work', 'საქმის დამატება')}</Button></>}>
        <div className="tw-details">
            <div className="tw-grid">
                <Field label={copy('Name', 'სახელი')}>{fieldId => <input id={fieldId} className="gk-input" autoFocus maxLength={120} value={work.title} onChange={event => setWork({ ...work, title: event.target.value })} />}</Field>
                <Field label={copy('Where', 'სად')}>{fieldId => <input id={fieldId} className="gk-input" maxLength={160} value={work.area} placeholder={copy('Landing · founders’ request', 'ლენდინგი · დამფუძნებლების თხოვნა')} onChange={event => setWork({ ...work, area: event.target.value })} />}</Field>
                <Field label={copy('Current step', 'მიმდინარე ნაბიჯი')} wide>{fieldId => <input id={fieldId} className="gk-input" maxLength={240} value={work.step} onChange={event => setWork({ ...work, step: event.target.value })} />}</Field>
            </div>
            <QuickEdit draft={work} onChange={part => setWork(current => ({ ...current, ...part }))} />
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </div>
    </Dialog>;
}
