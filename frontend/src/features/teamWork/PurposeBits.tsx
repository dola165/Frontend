import { useId, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { PurposeChange } from './api';
import { ago, madeBy, shortDate } from './teamWorkWords';

/**
 * What a plan or a task is for, first and big. Empty, it is a clear prompt to write it; pressed (or the pencil), it
 * becomes a box to write in, saved on Enter. `small` is the quieter version for a task opened in its dialog.
 */
export function PurposeLine({ purpose, prompt, label, as: Tag = 'h1', busy = false, onSave }: {
    purpose: string | null; prompt: string; label: string; as?: 'h1' | 'h2'; busy?: boolean; onSave: (purpose: string) => Promise<void> | void;
}) {
    const copy = useJourneyCopy();
    const id = useId();
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState('');
    const start = () => { setText(purpose ?? ''); setEditing(true); };
    const save = async () => { const next = text.trim(); setEditing(false); if (next !== (purpose ?? '')) await onSave(next); };
    if (editing) return <form className="tw-purpose__edit" onSubmit={event => { event.preventDefault(); void save(); }}>
        <label htmlFor={id} className="gk-visually-hidden">{label}</label>
        <textarea id={id} className="gk-input" autoFocus rows={2} maxLength={400} value={text} placeholder={prompt} onChange={event => setText(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void save(); } if (event.key === 'Escape') setEditing(false); }} />
        <span className="tw-row-actions"><Button size="sm" variant="primary" type="submit" disabled={busy}>{copy('Save', 'შენახვა')}</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{copy('Cancel', 'გაუქმება')}</Button></span>
    </form>;
    if (!purpose) return <button type="button" className="tw-purpose__prompt" onClick={start}><Pencil aria-hidden="true" />{prompt}</button>;
    return <div className="tw-purpose__line">
        <Tag className="tw-purpose__text">{purpose}</Tag>
        <button type="button" className="tw-icon-button tw-purpose__pencil" aria-label={copy(`Change ${label.toLowerCase()}`, `${label} შეცვლა`)} onClick={start}><Pencil aria-hidden="true" /></button>
    </div>;
}

/**
 * "The point of this plan changed": one line with the old purpose and the new one, who changed it and when, and
 * the whole history one tap away. Nothing shows while the purpose was never changed.
 */
export function PurposeChanged({ changes, what }: { changes: PurposeChange[]; what: 'plan' | 'task' }) {
    const copy = useJourneyCopy();
    const [history, setHistory] = useState(false);
    const latest = changes.find(change => change.previous != null);
    if (!latest) return null;
    const when = shortDate(copy, new Date(latest.at));
    return <p className="tw-purpose__was">
        <span className="tw-purpose__was-label">{copy('Was:', 'იყო:')}</span> <span className="tw-purpose__old">{latest.previous}</span>
        <span className="tw-purpose__arrow" aria-hidden="true"> → </span>
        <span className="tw-purpose__was-label">{copy('now:', 'ახლა:')}</span> <span>{latest.purpose ?? copy('nothing', 'არაფერი')}</span>
        <span className="gk-faint"> · {copy(`changed ${when} by ${madeBy(copy, latest.author?.name, latest.byDola)}`, `შეიცვალა ${when}, ${madeBy(copy, latest.author?.name, latest.byDola)}`)}</span>
        {changes.length > 1 && <> · <button type="button" className="tw-link-button" onClick={() => setHistory(true)}>{copy(`All ${changes.length} changes`, `ყველა ${changes.length} ცვლილება`)}</button></>}
        {history && <PurposeHistoryDialog changes={changes} what={what} onClose={() => setHistory(false)} />}
    </p>;
}

/** Every change of the purpose, newest first: who, when, from what to what. */
export function PurposeHistoryDialog({ changes, what, onClose }: { changes: PurposeChange[]; what: 'plan' | 'task'; onClose: () => void }) {
    const copy = useJourneyCopy();
    const title = what === 'plan' ? copy('How the point of this plan changed', 'როგორ შეიცვალა გეგმის მიზანი') : copy('How the point of this task changed', 'როგორ შეიცვალა საქმის მიზანი');
    return <Dialog open size="md" className="tw-dialog" title={title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}>
        <ol className="tw-history">{changes.map(change => <li key={change.id} className="tw-history__line">
            <span className="tw-history__who">{madeBy(copy, change.author?.name, change.byDola)} · {ago(copy, change.at)}</span>
            <span className="tw-history__message">{change.previous ? <><span className="tw-purpose__old">{change.previous}</span> → </> : <span className="gk-faint">{copy('nothing', 'არაფერი')} → </span>}{change.purpose ?? <span className="gk-faint">{copy('nothing', 'არაფერი')}</span>}</span>
        </li>)}</ol>
    </Dialog>;
}
