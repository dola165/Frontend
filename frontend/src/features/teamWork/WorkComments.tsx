import { useState } from 'react';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addComment, deleteComment, editComment, type Person, type WorkComment } from './api';
import { MentionInput, MentionText } from './MentionInput';
import { ago } from './teamWorkWords';

/** A flat thread under a task; "@" tags a colleague. Authors edit or delete their own; system admins any. */
export function WorkComments({ itemId, comments, team, me, onChanged }: { itemId: number; comments: WorkComment[]; team: Person[]; me?: number | null; onChanged: (comments: WorkComment[]) => void }) {
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
    return <div className="tw-comments">
        {comments.length > 0 && <ol className="tw-comments__list">{comments.map(comment => <li key={comment.id}>
            <div className="tw-comments__body">
                <span className="tw-comments__who"><strong>{comment.author?.name ?? copy('Someone', 'ვიღაც')}</strong> · {ago(copy, comment.createdAt)}{comment.editedAt && ` · ${copy('edited', 'შეცვლილი')}`}</span>
                {editing?.id === comment.id
                    ? <form className="tw-comments__edit" onSubmit={event => { event.preventDefault(); if (editing.body.trim()) void run(() => editComment(comment.id, editing.body.trim()), () => setEditing(null)); }}>
                        <MentionInput value={editing.body} team={team} label={copy('Edit the comment', 'კომენტარის რედაქტირება')} onChange={body => setEditing({ id: comment.id, body })} />
                        <span className="tw-row-actions"><Button size="sm" variant="primary" type="submit" disabled={busy}>{copy('Save', 'შენახვა')}</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>{copy('Cancel', 'გაუქმება')}</Button></span>
                    </form>
                    : <p><MentionText text={comment.body} team={team} me={me} /></p>}
                {comment.canEdit && editing?.id !== comment.id && <span className="tw-row-actions">
                    <button type="button" className="tw-link-button" onClick={() => setEditing({ id: comment.id, body: comment.body })}>{copy('Edit', 'რედაქტირება')}</button>
                    <button type="button" className="tw-link-button" disabled={busy} onClick={() => void run(() => deleteComment(comment.id), () => undefined)}>{copy('Delete', 'წაშლა')}</button>
                </span>}
            </div>
        </li>)}</ol>}
        <form className="tw-comments__add" onSubmit={event => { event.preventDefault(); if (text.trim()) void run(() => addComment(itemId, text.trim()), () => setText('')); }}>
            <MentionInput value={text} team={team} rows={1} label={copy('Comment', 'კომენტარი')} placeholder={copy('Write a comment; @ tags someone', 'დაწერეთ კომენტარი; @ ვინმეს მონიშნავს')} onChange={setText} />
            <Button size="sm" type="submit" disabled={busy || !text.trim()}>{copy('Comment', 'კომენტარი')}</Button>
        </form>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
