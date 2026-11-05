import { useEffect, useId, useRef, useState } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { getAuthSessionId, isCurrentAuthSession } from '../../utils/authStorage';
import { MediaImage } from '../ui/MediaImage';
import type { CommentDto } from './FeedPost';
import { useCommentDraft, useCommentEdit, type CommentAttempt } from './commentDraft';
import { usePostCopy } from './postCopy';
import './post-comments.css';

export type ReloadComments = (postId: number) => void | Promise<CommentDto[] | void>;
export type SubmitComment = (postId: number, content: string, attempt?: CommentAttempt) => void | Promise<void>;
const commentsChanged = (postId: number) => window.dispatchEvent(new CustomEvent('gk-post-comments-changed', { detail: postId }));

export function PostComments({ postId, author, comments, error, loading, retry, submit, inputId }: {
    postId: number; author: string; comments?: CommentDto[]; error?: string | null; loading?: boolean;
    retry?: ReloadComments; submit: SubmitComment; inputId?: string;
}) {
    const copy = usePostCopy();
    const { draft, change } = useCommentDraft(postId);
    const [failure, setFailure] = useState('');
    const ownId = useId(), id = inputId ?? ownId;
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const send = async () => {
        if (draft.busy || (!draft.attempt && !draft.content.trim())) return;
        const attempt = draft.attempt ?? { requestId: crypto.randomUUID(), content: draft.content.trim(), parentId: draft.parentId };
        const session = getAuthSessionId();
        change({ attempt, busy: true }); setFailure('');
        try {
            await submit(postId, attempt.content, attempt);
            if (!isCurrentAuthSession(session)) return;
            change({ content: '', parentId: undefined, attempt: undefined, busy: false });
            window.dispatchEvent(new CustomEvent('gk-post-comment-created', { detail: postId }));
        } catch (e) {
            // A rejected transaction cannot have published this draft. Keep it editable.
            const status = (e as { response?: { status?: number } }).response?.status;
            if (isCurrentAuthSession(session) && [400, 401, 403, 404, 409, 422].includes(status ?? 0)) change({ attempt: undefined });
            if (isCurrentAuthSession(session) && alive.current) setFailure(extractApiErrorMessage(e, copy('Comment could not be posted. Your draft is still here.', 'კომენტარი ვერ გამოქვეყნდა. მონახაზი შენახულია.')));
        } finally { if (isCurrentAuthSession(session)) change({ busy: false }); }
    };
    return <section className="post-comments" aria-label={copy('Comments', 'კომენტარები')}>
        <div className="post-comments-list">
            {error ? <p role="alert">{error} {retry && <button type="button" onClick={() => retry(postId)}>{copy('Retry', 'ხელახლა ცდა')}</button>}</p>
                : loading || !comments ? <p role="status">{copy('Loading comments…', 'კომენტარები იტვირთება…')}</p>
                : comments.length === 0 ? <p>{copy('No comments yet', 'კომენტარები ჯერ არ არის')}</p>
                : comments.map(comment => <CommentRow key={`${getAuthSessionId()}:${comment.id}`} postId={postId} comment={comment}
                    parent={comments.find(parent => parent.id === comment.parentId)} retry={retry}
                    reply={() => { change({ parentId: comment.id }); document.getElementById(id)?.focus(); }} disabled={Boolean(draft.attempt)} />)}
        </div>
        {draft.parentId && <div className="post-comment-reply"><span>{copy('Replying to a comment', 'პასუხი კომენტარზე')}</span><button type="button" disabled={Boolean(draft.attempt)} onClick={() => change({ parentId: undefined })}>{copy('Cancel reply', 'პასუხის გაუქმება')}</button></div>}
        <form onSubmit={event => { event.preventDefault(); void send(); }}>
            <textarea id={id} rows={2} maxLength={1000} value={draft.content} disabled={Boolean(draft.attempt)}
                aria-label={copy(`Write a comment on ${author}'s post`, `კომენტარის დაწერა პოსტზე: ${author}`)}
                placeholder={copy('Write a comment…', 'დაწერეთ კომენტარი…')}
                onChange={event => { change({ content: event.target.value }); setFailure(''); }}
                onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
            <button type="submit" disabled={Boolean(draft.busy) || (!draft.content.trim() && !draft.attempt)}>{copy(draft.busy ? 'Posting…' : draft.attempt ? 'Retry comment' : 'Post comment', draft.busy ? 'ქვეყნდება…' : draft.attempt ? 'ხელახლა ცდა' : 'კომენტარის გამოქვეყნება')}</button>
        </form>
        {failure && <p role="alert">{failure}</p>}
        {draft.attempt && !draft.busy && <p>{copy('The result may be uncertain. Retry checks the same comment without posting it twice.', 'შედეგი შეიძლება გაურკვეველი იყოს. ხელახალი ცდა იმავე კომენტარს ამოწმებს, დუბლირების გარეშე.')}</p>}
    </section>;
}

function CommentRow({ postId, comment, parent, retry, reply, disabled }: {
    postId: number; comment: CommentDto; parent?: CommentDto; retry?: ReloadComments; reply: () => void; disabled: boolean;
}) {
    const copy = usePostCopy();
    const [saved, setSaved] = useState<{ source: CommentDto; value: CommentDto } | null>(null), [mode, setMode] = useState<'delete' | null>(null);
    const { edit, changeEdit } = useCommentEdit(postId, comment.id);
    const [requestBusy, setBusy] = useState(false), [error, setError] = useState('');
    const busy = requestBusy || Boolean(edit?.busy), failure = edit?.error || error;
    const current = saved?.source === comment ? saved.value : comment;
    const pending = useRef(false), alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const mutate = async (kind: 'edit' | 'delete' | 'reaction') => {
        if (pending.current || busy) return;
        pending.current = true; setBusy(true); setError('');
        if (kind === 'edit') changeEdit(value => value && { ...value, busy: true, error: undefined });
        const session = getAuthSessionId(), config: AuthSessionRequestConfig = { _authSessionId: session }, path = `/posts/${postId}/comments/${comment.id}`;
        try {
            const response = kind === 'delete' ? await apiClient.delete<CommentDto>(path, { ...config, params: { expectedVersion: current.version ?? 0 } })
                : kind === 'edit' ? await apiClient.put<CommentDto>(path, { content: edit!.content.trim(), expectedVersion: edit!.expectedVersion }, config)
                : await apiClient.put<CommentDto>(`${path}/reaction`, { liked: !current.isLikedByMe }, config);
            if (!isCurrentAuthSession(session)) return;
            if (kind === 'edit') changeEdit(undefined);
            if (alive.current) { setSaved({ source: comment, value: response.data }); setMode(null); }
            commentsChanged(postId);
        } catch (e) {
            if (!isCurrentAuthSession(session)) return;
            const message = extractApiErrorMessage(e, copy('Could not save this change. Your draft is still here.', 'ცვლილება ვერ შეინახა. მონახაზი შენახულია.'));
            if (kind === 'edit') changeEdit(value => value && { ...value, error: message });
            else if (alive.current) setError(message);
        } finally {
            pending.current = false;
            if (isCurrentAuthSession(session)) {
                if (kind === 'edit') changeEdit(value => value && { ...value, busy: false });
                if (alive.current) setBusy(false);
            }
        }
    };
    const reload = async () => {
        if (!retry || busy) return;
        const session = getAuthSessionId();
        changeEdit(value => value && { ...value, busy: true });
        try {
            const rows = await retry(postId);
            if (!isCurrentAuthSession(session)) return;
            const fresh = rows?.find(row => row.id === comment.id);
            if (fresh?.canEdit && !fresh.deleted) changeEdit(value => value && { ...value, expectedVersion: fresh.version ?? 0, error: undefined });
            if (alive.current) { setSaved(null); setError(''); }
        } catch (e) {
            if (isCurrentAuthSession(session)) changeEdit(value => value && { ...value, error: extractApiErrorMessage(e, copy('Could not reload this comment. Your draft is still here.')) });
        } finally { if (isCurrentAuthSession(session)) changeEdit(value => value && { ...value, busy: false }); }
    };
    const name = current.authorName ?? copy('Member', 'წევრი');
    return <article className="post-comment" aria-label={copy(`Comment by ${name}`, `კომენტარი: ${name}`)}>
        {!current.deleted && current.authorAvatarUrl && <MediaImage src={current.authorAvatarUrl} alt="" className="post-comment-avatar" />}
        <div className="post-comment-body">
            {current.parentId && <small>{parent && !parent.deleted ? copy(`Reply to ${parent.authorName ?? 'Member'}`, `პასუხი: ${parent.authorName ?? 'წევრი'}`) : copy('Reply to an unavailable comment', 'პასუხი მიუწვდომელ კომენტარზე')}</small>}
            <header><strong>{current.deleted ? copy('Comment removed', 'კომენტარი წაშლილია') : name}</strong><time dateTime={current.createdAt}>{new Date(current.createdAt).toLocaleDateString()}</time>{current.editedAt && <small>{copy('Edited', 'შესწორებულია')}</small>}</header>
            {!current.deleted && (edit && current.canEdit ? <form onSubmit={event => { event.preventDefault(); void mutate('edit'); }}>
                <textarea aria-label={copy('Edit comment', 'კომენტარის შეცვლა')} rows={3} maxLength={1000} value={edit.content} disabled={busy} onChange={event => changeEdit(value => value && { ...value, content: event.target.value })} />
                <button type="submit" disabled={busy || !edit.content.trim()}>{copy('Save comment', 'კომენტარის შენახვა')}</button><button type="button" disabled={busy} onClick={() => { changeEdit(undefined); setError(''); }}>{copy('Cancel', 'გაუქმება')}</button>
            </form> : <p>{current.content}</p>)}
            {!current.deleted && <div className="post-comment-actions">
                <button type="button" disabled={busy} aria-pressed={Boolean(current.isLikedByMe)} onClick={() => void mutate('reaction')}>{copy('Like', 'მოწონება')} {current.likeCount ?? 0}</button>
                <button type="button" disabled={disabled || busy} onClick={reply}>{copy('Reply', 'პასუხი')}</button>
                {current.canEdit && <><button type="button" disabled={busy} onClick={() => { changeEdit({ content: current.content, expectedVersion: current.version ?? 0 }); setError(''); }}>{copy('Edit', 'შეცვლა')}</button><button type="button" disabled={busy} onClick={() => setMode('delete')}>{copy('Delete', 'წაშლა')}</button></>}
            </div>}
            {mode === 'delete' && !current.deleted && <div><p>{copy('Remove this comment? Replies stay, without your text.', 'წაიშალოს კომენტარი? პასუხები დარჩება თქვენი ტექსტის გარეშე.')}</p><button type="button" disabled={busy} onClick={() => void mutate('delete')}>{copy('Delete comment', 'კომენტარის წაშლა')}</button><button type="button" disabled={busy} onClick={() => setMode(null)}>{copy('Cancel', 'გაუქმება')}</button></div>}
            {failure && <p role="alert">{failure} {retry && <button type="button" disabled={busy} onClick={() => void reload()}>{copy('Reload comment', 'კომენტარის განახლება')}</button>}</p>}
        </div>
    </article>;
}
