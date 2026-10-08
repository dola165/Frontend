import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Globe2, LockKeyhole, MessageCircle, Send, Share2, ShieldAlert, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { chatApi, type ConversationDto } from '../../api/chat';
import { extractApiErrorMessage } from '../../utils/apiError';
import { getAuthSessionId, getStoredUserId } from '../../utils/authStorage';
import { useDialogFocus } from '../workspace/useDialogFocus';
import { MediaImage } from '../ui/MediaImage';
import type { FeedPostDto } from './FeedPost';
import './post-actions.css';
import { usePanelMotion } from '../ui/usePanelMotion';

function PostAvatar({ src, fallback, className, children }: { src?: string | null; fallback: ReactNode; className: string; children?: ReactNode }) {
    const [failedSource, setFailedSource] = useState<string | null>(null);
    return <span className={className}>{src && failedSource !== src ? <MediaImage src={src} alt="" onError={() => setFailedSource(src)} /> : fallback}{children}</span>;
}

export function PostDialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
    const ref = useRef<HTMLDivElement>(null), id = useId();
    const motion = usePanelMotion(onClose);
    useDialogFocus(true, ref, () => { if (!busy) motion.close(); });
    return createPortal(<div className="app-motion-portal app-motion-backdrop post-dialog-backdrop feed-home-shell" data-closing={motion.closing} onMouseDown={event => { if (event.target === event.currentTarget && !busy) motion.close(); }}>
        <div ref={ref} className="post-dialog app-motion-dialog" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd} role="dialog" aria-modal="true" aria-labelledby={id}>
            <header><h2 id={id}>{title}</h2><button className="post-icon-button" type="button" disabled={busy} aria-label={`Close ${title.toLowerCase()}`} onClick={motion.close}><X size={20} /></button></header>
            <div className="post-dialog-content">{children}</div>
        </div>
    </div>, document.body);
}

export function PostPreview({ post }: { post: FeedPostDto }) {
    const media = post.mediaUrls?.[0] ?? post.image;
    return <Link to={`/posts/${post.id}`} className="post-preview">
        <div className="post-preview-author">{post.authorAvatarUrl && <PostAvatar src={post.authorAvatarUrl} fallback={post.authorName.slice(0,2).toUpperCase()} className="post-avatar" />}<span><strong>{post.clubName || post.authorName}</strong><small>Original post</small></span></div>
        <p>{post.content}</p>
        {media && !/\.(mp4|mov|webm)(?:\?|$)/i.test(media) && <MediaImage src={media} alt="Shared post media" className="post-preview-media" />}
    </Link>;
}

export function SharedPostPreview({ id }: { id?: number | null }) {
    const [post, setPost] = useState<FeedPostDto | null>(null), [failed, setFailed] = useState(false);
    useEffect(() => {
        if (!id) return;
        const controller = new AbortController();
        apiClient.get<FeedPostDto>(`/posts/${id}`, { signal: controller.signal }).then(({ data }) => { if (!controller.signal.aborted) setPost(data); }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
        return () => controller.abort();
    }, [id]);
    return post ? <PostPreview post={post} /> : <div className="post-preview post-unavailable">{!id || failed ? 'Original post is no longer available to you.' : 'Loading shared post…'}</div>;
}

function Audience({ value, onChange, disabled, club = false }: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean; club?: boolean }) {
    return <label className="post-audience">{value ? <Globe2 size={15} /> : <LockKeyhole size={15} />}<span className="sr-only">Audience</span><select aria-label="Audience" value={String(value)} disabled={disabled} onChange={e => onChange(e.target.value === 'true')}><option value="true">Public</option><option value="false">{club ? 'Club leadership' : 'Only me'}</option></select></label>;
}

export function EditPostDialog({ post, onClose, onSaved }: { post: FeedPostDto; onClose: () => void; onSaved: (post: FeedPostDto) => void }) {
    const [content, setContent] = useState(post.content), [isPublic, setPublic] = useState(post.isPublic !== false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const pending = useRef(false);
    const save = async () => {
        if (pending.current) return; pending.current = true; setBusy(true); setError('');
        try { const { data } = await apiClient.put<FeedPostDto>(`/posts/${post.id}`, { content: content.trim(), isPublic, expectedContent: post.content, expectedPublic: post.isPublic !== false }); onSaved(data); onClose(); }
        catch (e) { setError(extractApiErrorMessage(e, 'Could not save changes. Your draft is still here.')); }
        finally { pending.current = false; setBusy(false); }
    };
    return <PostDialog title="Edit post" onClose={onClose} busy={busy}><form onSubmit={e => { e.preventDefault(); void save(); }}>
        <Audience value={isPublic} onChange={setPublic} disabled={busy} club={post.clubId != null} />
        <label className="sr-only" htmlFor="edit-post-content">Post text</label><textarea id="edit-post-content" maxLength={2000} rows={6} value={content} disabled={busy} onChange={e => setContent(e.target.value)} />
        <small className="post-muted">{content.length}/2000 · Attached photos and videos stay with this post.</small>
        {error && <p role="alert" className="post-error">{error}</p>}<footer><button className="post-secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="post-primary" disabled={busy || (!content.trim() && !post.isReshare)}>{busy ? 'Saving…' : 'Save changes'}</button></footer>
    </form></PostDialog>;
}

export function ReportPostDialog({ post, onClose }: { post: FeedPostDto; onClose: () => void }) {
    const [reason, setReason] = useState(''), [description, setDescription] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState<number | null>(null);
    const [requestId] = useState(() => crypto.randomUUID()), pending = useRef(false);
    const submit = async () => {
        if (!reason || pending.current) return; pending.current = true; setBusy(true); setError('');
        try { const { data } = await apiClient.post<{ id: number }>('/reports', { targetType: 'POST', targetId: post.id, requestId, reason, description }); setReceipt(data.id); }
        catch (e) { setError(extractApiErrorMessage(e, 'Could not send your report. Retry to check whether it was received.')); }
        finally { pending.current = false; setBusy(false); }
    };
    return <PostDialog title="Report post" onClose={onClose} busy={busy}>{receipt ? <div className="post-report-success" role="status"><Check size={32} /><h3>Thank you for letting us know</h3><p>Your report is awaiting review. Your identity stays private.</p><Link className="post-secondary" to={`/reports?itemId=${receipt}`} onClick={onClose}>View report receipt</Link><button className="post-primary" type="button" onClick={onClose}>Done</button></div> : <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        <p className="post-muted">What’s wrong with this post? Your report goes to the moderation team.</p>
        <fieldset className="post-reasons"><legend className="sr-only">Report reason</legend>{[['SPAM','Spam or unwanted promotion'],['HARASSMENT','Bullying or harassment'],['SAFETY','Unsafe or harmful content'],['IMPERSONATION','Impersonation'],['OTHER','Something else']].map(([value, text]) => <label key={value}><input type="radio" name="report-reason" value={value} checked={reason === value} disabled={busy} onChange={() => setReason(value)} /><span>{text}</span></label>)}</fieldset>
        <label className="post-field">More detail <span className="post-muted">(optional)</span><textarea rows={3} value={description} maxLength={1500} disabled={busy} onChange={e => setDescription(e.target.value)} placeholder="Help us understand what happened…" /></label>
        <p className="post-privacy"><ShieldAlert size={16} />Reporting does not automatically remove a post. The post text and your description are kept for review for up to 90 days.</p>
        {error && <p className="post-error" role="alert">{error}</p>}<footer><button type="button" className="post-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="post-primary" disabled={busy || !reason}>{busy ? 'Sending…' : error ? 'Retry report' : 'Send report'}</button></footer>
    </form>}</PostDialog>;
}

export function SharePostDialog({ post, onClose, onShared }: { post: FeedPostDto; onClose: () => void; onShared: () => void }) {
    const [content, setContent] = useState(''), [isPublic, setPublic] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [feedback, setFeedback] = useState('');
    const [conversations, setConversations] = useState<ConversationDto[]>([]), [chatPage, setChatPage] = useState(0), [chatTotal, setChatTotal] = useState(0), [chatLoading, setChatLoading] = useState(false), [chatError, setChatError] = useState('');
    const [sending, setSending] = useState<number | null>(null), [sent, setSent] = useState<number[]>([]), [chatRevision, setChatRevision] = useState(0);
    const [requestId] = useState(() => crypto.randomUUID()), pending = useRef(false), messageIds = useRef(new Map<number, string>()), chatPending = useRef(false);
    const [sharedId, setSharedId] = useState<number | null>(null);
    const viewer = Number(getStoredUserId()), signedIn = viewer > 0;
    const [identity] = useState(() => { try { return JSON.parse(localStorage.getItem('user') || '{}') as { fullName?: string; username?: string; avatarUrl?: string }; } catch { return {}; } });
    const originalId = post.isReshare ? post.sharedPostId : post.id;
    const shareUrl = new URL(`/posts/${originalId ?? post.id}`, window.location.origin).toString();
    const allowed = post.isPublic !== false && Boolean(originalId);
    useEffect(() => {
        if (!signedIn) return;
        const controller = new AbortController(); setChatLoading(true); setChatError('');
        chatApi.getConversations(chatPage, 6, { signal: controller.signal, _authSessionId: getAuthSessionId() }).then(({ data }) => { if (!controller.signal.aborted) { setConversations(items => chatPage === 0 ? data.content : [...items, ...data.content.filter(item => !items.some(old => old.id === item.id))]); setChatTotal(data.totalElements); } }).catch(e => { if (!controller.signal.aborted) setChatError(extractApiErrorMessage(e, 'Recent chats could not load.')); }).finally(() => { if (!controller.signal.aborted) setChatLoading(false); });
        return () => controller.abort();
    }, [signedIn, chatPage, chatRevision]);
    const share = async () => {
        if (pending.current) return; pending.current = true; setBusy(true); setError('');
        try { const { data } = await apiClient.post<{ postId: number }>(`/posts/${post.id}/shares`, { content: content.trim(), isPublic, requestId }); setSharedId(data.postId); onShared(); }
        catch (e) { setError(extractApiErrorMessage(e, 'Could not share this post. Your draft is still here; retry is safe.')); }
        finally { pending.current = false; setBusy(false); }
    };
    const send = async (conversationId: number) => {
        if (chatPending.current || sent.includes(conversationId)) return;
        chatPending.current = true; setSending(conversationId); setError('');
        const messageId = messageIds.current.get(conversationId) ?? crypto.randomUUID(); messageIds.current.set(conversationId, messageId);
        try { await chatApi.sendMessage(conversationId, [content.trim(), shareUrl].filter(Boolean).join('\n\n'), messageId); setSent(items => [...items, conversationId]); setFeedback('Post sent to chat.'); }
        catch (e) { setError(extractApiErrorMessage(e, 'Could not send to this chat. Retry is safe.')); }
        finally { chatPending.current = false; setSending(null); }
    };
    const copy = async () => { try { await navigator.clipboard.writeText(shareUrl); setFeedback('Post link copied.'); } catch { setFeedback('Copy did not work. Select and copy the link below.'); } };
    if (sharedId) return <PostDialog title="Post shared" onClose={onClose}><div className="post-report-success" role="status"><Check size={32} /><h3>Shared to your profile</h3><p className="post-muted">{isPublic ? 'People who can view your public profile can see this post.' : 'Only you can see this shared post.'}</p><Link className="post-secondary" to={`/posts/${sharedId}`} onClick={onClose}>View shared post</Link><button className="post-primary" type="button" onClick={onClose}>Done</button></div></PostDialog>;
    return <PostDialog title="Share post" onClose={onClose} busy={busy || sending !== null}>
        <div className="post-share-identity"><PostAvatar src={identity.avatarUrl} fallback={(identity.fullName || identity.username || 'You').slice(0,2).toUpperCase()} className="post-avatar" /><div><strong>{identity.fullName || identity.username || 'You'}</strong><Audience value={isPublic} onChange={setPublic} disabled={busy} /></div></div>
        {!signedIn && <p className="post-muted"><Link to="/login">Sign in</Link> to share to your feed or send to a chat.</p>}
        {signedIn && <textarea aria-label="Say something about this post" rows={3} maxLength={2000} value={content} disabled={busy || sending !== null} onChange={e => setContent(e.target.value)} placeholder="Say something about this…" />}
        {post.isReshare ? <SharedPostPreview id={post.sharedPostId} /> : <PostPreview post={post} />}
        {!allowed && <p className="post-muted">This post has a restricted audience or is unavailable. It cannot be reshared.</p>}
        {signedIn && <><p className="post-muted post-audience-note">{isPublic ? 'Visible to people who can view your public profile.' : 'Saved on your profile, visible only to you.'}</p><footer><button className="post-primary" type="button" disabled={busy || sending !== null || !allowed} onClick={() => void share()}><Share2 size={17} />{busy ? 'Sharing…' : 'Share now'}</button></footer>
        <section className="post-share-section"><h3><MessageCircle size={18} />Send in GrassKickZ</h3>
            {chatLoading && <p className="post-muted" role="status">Loading chats…</p>}{chatError && <p role="alert" className="post-error">{chatError} <button type="button" className="post-text-button" onClick={() => setChatRevision(v => v + 1)}>Retry</button></p>}
            {!chatLoading && !chatError && conversations.length === 0 && <p className="post-muted">Your conversations will appear here. <Link to="/messages" onClick={onClose}>Open messages</Link></p>}
            <div className="post-share-chats">{conversations.map(chat => { const other = chat.participants.find(person => person.userId !== viewer), name = chat.name || other?.displayName || 'Conversation'; return <button key={chat.id} type="button" disabled={busy || sending !== null || sent.includes(chat.id) || !allowed} aria-label={`${sent.includes(chat.id) ? 'Sent to' : 'Send to'} ${name}`} onClick={() => void send(chat.id)}><PostAvatar src={other?.profilePictureUrl} fallback={<MessageCircle size={23} />} className="post-chat-avatar">{sent.includes(chat.id) && <Check className="post-sent-check" size={17} />}</PostAvatar><span>{name}</span><small>{sent.includes(chat.id) ? 'Sent' : sending === chat.id ? 'Sending…' : chat.contextType === 'DIRECT' ? 'Message' : 'Group'}</small></button>; })}</div>
            {conversations.length < chatTotal && <button className="post-text-button" type="button" disabled={chatLoading} onClick={() => setChatPage(p => p + 1)}>More chats</button>}
        </section></>}
        <section className="post-share-section"><h3>Share to</h3><div className="post-share-destinations"><button type="button" disabled={!allowed} onClick={() => void copy()}><span><Copy size={23} /></span>Copy link</button>{allowed && <a href={`https://wa.me/?text=${encodeURIComponent([content.trim(), shareUrl].filter(Boolean).join('\n\n'))}`} target="_blank" rel="noopener noreferrer"><span><Send size={23} /></span>WhatsApp</a>}</div><input aria-label="Post link" readOnly value={shareUrl} onFocus={e => e.target.select()} /></section>
        {feedback && <p role="status" className="post-feedback">{feedback}</p>}{error && <p role="alert" className="post-error">{error}</p>}
    </PostDialog>;
}
