import { useState } from 'react';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import type { CommentActions, Person, WorkComment } from './types';
import { MentionInput, MentionText } from './MentionInput';
import { ago, madeBy } from './workWords';
import './work.css';

/**
 * A flat thread, under a task, a person's Now note or a club's project: name and time on each, "@" tags a colleague. Each comment's
 * author edits or deletes it (`canEdit` says who may).
 */
export function WorkComments({ comments, team, me, actions, label, placeholder, onChanged }: {
    comments: WorkComment[]; team: Person[]; me?: number | null; actions: CommentActions; label?: string; placeholder?: string; onChanged: (comments: WorkComment[]) => void;
}) {
    const copy = useJourneyCopy();
    const [text, setText] = useState('');
    const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const run = async (action: () => Promise<WorkComment[]>, after: () => void) => {
        setBusy(true); setError('');
        try { onChanged(await action()); after(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be saved.', 'ვერ შეინახა.'))); }
        finally { setBusy(false); }
    };
    const send = label ?? copy('Comment', 'კომენტარი');
    return <div className="work-comments">
        {comments.length > 0 && <ol className="work-comments__list">{comments.map(comment => <li key={comment.id}>
            <div className="work-comments__body">
                <span className="work-comments__who"><strong>{madeBy(copy, comment.author?.name, comment.byDola)}</strong> · {ago(copy, comment.createdAt)}{comment.editedAt && ` · ${copy('edited', 'შეცვლილი')}`}</span>
                {editing?.id === comment.id
                    ? <form className="work-comments__edit" onSubmit={event => { event.preventDefault(); if (editing.body.trim()) void run(() => actions.edit(comment.id, editing.body.trim()), () => setEditing(null)); }}>
                        <MentionInput value={editing.body} team={team} label={copy('Edit the comment', 'კომენტარის რედაქტირება')} onChange={body => setEditing({ id: comment.id, body })} />
                        <span className="work-row-actions"><Button size="sm" variant="primary" type="submit" disabled={busy}>{copy('Save', 'შენახვა')}</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>{copy('Cancel', 'გაუქმება')}</Button></span>
                    </form>
                    : <p><MentionText text={comment.body} team={team} me={me} /></p>}
                {comment.canEdit && editing?.id !== comment.id && <span className="work-row-actions">
                    <button type="button" className="work-link-button" onClick={() => setEditing({ id: comment.id, body: comment.body })}>{copy('Edit', 'რედაქტირება')}</button>
                    <button type="button" className="work-link-button" disabled={busy} onClick={() => void run(() => actions.remove(comment.id), () => undefined)}>{copy('Delete', 'წაშლა')}</button>
                </span>}
            </div>
        </li>)}</ol>}
        <form className="work-comments__add" onSubmit={event => { event.preventDefault(); if (text.trim()) void run(() => actions.add(text.trim()), () => setText('')); }}>
            <MentionInput value={text} team={team} rows={1} label={send} placeholder={placeholder ?? copy('Write a comment; @ tags someone', 'დაწერეთ კომენტარი; @ ვინმეს მონიშნავს')} onChange={setText} />
            <Button size="sm" type="submit" disabled={busy || !text.trim()}>{send}</Button>
        </form>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
