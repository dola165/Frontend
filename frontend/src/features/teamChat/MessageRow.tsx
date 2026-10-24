import { memo, useEffect, useRef, useState } from 'react';
import { History, Link2, Copy, MoreHorizontal, Pencil, Reply, SmilePlus, Trash2, AlertCircle, Loader2, RotateCcw, X } from 'lucide-react';
import { Avatar } from '../../design/primitives';
import { ReportControl } from '../moderation/Reporting';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { ChatAttachment, ChatMessage, ChatPerson } from './api';
import { Attachments } from './Attachments';
import { MessageBody } from './MessageBody';
import type { Pending } from './outbox';
import { clock, fileSize, fullTime } from './teamChatWords';

export interface RowActions {
    onReply: (message: ChatMessage) => void;
    onEdit: (message: ChatMessage) => void;
    onDelete: (message: ChatMessage) => void;
    onReact: (message: ChatMessage, emoji: string) => void;
    onHistory: (message: ChatMessage) => void;
    onJump: (id: number) => void;
    onOpen: (message: ChatMessage, attachment: ChatAttachment) => void;
}

/** Closes a small popup on a click outside it or on Escape, and gives focus back to its button. */
function useDismiss(open: boolean, root: React.RefObject<HTMLElement | null>, trigger: React.RefObject<HTMLElement | null>, close: () => void) {
    useEffect(() => {
        if (!open) return;
        const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close(); trigger.current?.focus(); } };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape, true);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
    }, [open, root, trigger, close]);
}

/** The few things to do with a message, shown on hover, on keyboard focus, or when a phone taps it. */
function Tools({ message, mine, reactions, canModerate, conversationId, actions }: { message: ChatMessage; mine: boolean; reactions: string[]; canModerate: boolean; conversationId: number; actions: RowActions }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState<'react' | 'more' | null>(null);
    const [copied, setCopied] = useState('');
    const root = useRef<HTMLDivElement>(null), reactButton = useRef<HTMLButtonElement>(null), moreButton = useRef<HTMLButtonElement>(null);
    useDismiss(open !== null, root, open === 'react' ? reactButton : moreButton, () => setOpen(null));
    const write = (text: string, done: string) => void navigator.clipboard?.writeText(text).then(() => { setCopied(done); window.setTimeout(() => setCopied(''), 1500); }).catch(() => undefined);
    return <div ref={root} className="tc-tools" data-open={open !== null || undefined}>
        <button ref={reactButton} type="button" className="tc-tool" aria-label={copy('React', 'რეაქცია')} title={copy('React', 'რეაქცია')} aria-expanded={open === 'react'} onClick={() => setOpen(open === 'react' ? null : 'react')}><SmilePlus aria-hidden="true" /></button>
        <button type="button" className="tc-tool" aria-label={copy('Reply', 'პასუხი')} title={copy('Reply', 'პასუხი')} onClick={() => actions.onReply(message)}><Reply aria-hidden="true" /></button>
        {mine && <button type="button" className="tc-tool" aria-label={copy('Edit', 'რედაქტირება')} title={copy('Edit', 'რედაქტირება')} onClick={() => actions.onEdit(message)}><Pencil aria-hidden="true" /></button>}
        <button ref={moreButton} type="button" className="tc-tool" aria-label={copy('More', 'მეტი')} title={copy('More', 'მეტი')} aria-expanded={open === 'more'} onClick={() => setOpen(open === 'more' ? null : 'more')}><MoreHorizontal aria-hidden="true" /></button>
        {open === 'react' && <div className="tc-pop tc-pop--react" role="group" aria-label={copy('Reactions', 'რეაქციები')}>
            {reactions.map(emoji => <button key={emoji} type="button" autoFocus={emoji === reactions[0]} aria-label={emoji} onClick={() => { actions.onReact(message, emoji); setOpen(null); }}>{emoji}</button>)}
        </div>}
        {open === 'more' && <div className="tc-pop tc-pop--menu" role="menu">
            {message.content && <button type="button" role="menuitem" autoFocus onClick={() => write(message.content, 'text')}><Copy aria-hidden="true" />{copied === 'text' ? copy('Copied', 'დაკოპირდა') : copy('Copy text', 'ტექსტის კოპირება')}</button>}
            <button type="button" role="menuitem" autoFocus={!message.content} onClick={() => write(`${window.location.origin}/team-work/chat?message=${message.id}`, 'link')}><Link2 aria-hidden="true" />{copied === 'link' ? copy('Copied', 'დაკოპირდა') : copy('Copy link', 'ბმულის კოპირება')}</button>
            {canModerate && message.editedAt && <button type="button" role="menuitem" onClick={() => { setOpen(null); actions.onHistory(message); }}><History aria-hidden="true" />{copy('Earlier versions', 'წინა ვერსიები')}</button>}
            {mine && <button type="button" role="menuitem" className="tc-danger" onClick={() => { setOpen(null); actions.onDelete(message); }}><Trash2 aria-hidden="true" />{copy('Delete for everyone', 'ყველასთვის წაშლა')}</button>}
            {!mine && message.senderId !== null && <ReportControl targetType="MESSAGE" targetId={message.id} conversationId={conversationId} personId={message.senderId} className="tc-pop__report" />}
        </div>}
    </div>;
}

/** Who reacted, as chips: yours stand out; a tap adds or takes back yours. */
function Reactions({ message, me, members, onReact }: { message: ChatMessage; me: number | null; members: Map<number, ChatPerson>; onReact: (emoji: string) => void }) {
    const copy = useJourneyCopy();
    return <ul className="tc-reactions" aria-label={copy('Reactions', 'რეაქციები')}>
        {message.reactions.map(reaction => {
            const names = reaction.userIds.map(id => id === me ? copy('you', 'თქვენ') : members.get(id)?.name ?? '?').join(', ');
            const mine = me !== null && reaction.userIds.includes(me);
            return <li key={reaction.emoji}><button type="button" aria-pressed={mine} title={names} aria-label={`${reaction.emoji} ${reaction.userIds.length}: ${names}`} onClick={() => onReact(reaction.emoji)}>
                <span aria-hidden="true">{reaction.emoji}</span><span className="gk-num">{reaction.userIds.length}</span>
            </button></li>;
        })}
    </ul>;
}

export const MessageRow = memo(function MessageRow({ message, compact, me, members, reactions, canModerate, conversationId, highlighted, actions }: {
    message: ChatMessage; compact: boolean; me: number | null; members: Map<number, ChatPerson>; reactions: string[]; canModerate: boolean;
    conversationId: number; highlighted: boolean; actions: RowActions;
}) {
    const copy = useJourneyCopy();
    const mine = me !== null && message.senderId === me;
    const person = message.senderId !== null ? members.get(message.senderId) : undefined;
    const name = message.senderName ?? person?.name ?? copy('Someone', 'ვიღაც');
    const removed = message.deleted;
    const quote = message.replyTo;
    const edited = message.editedAt ? <span className="tc-edited" title={fullTime(copy, message.editedAt)}>{copy('(edited)', '(შესწორებული)')}</span> : null;
    return <article id={`tc-m-${message.id}`} className="tc-msg" tabIndex={-1} data-compact={compact || undefined} data-mine={mine || undefined}
        data-highlight={highlighted || undefined} data-chat-message-id={message.id} aria-label={`${name}, ${fullTime(copy, message.createdAt)}`}>
        <div className="tc-msg__side">
            {compact ? <time className="tc-msg__hover-time" dateTime={message.createdAt} title={fullTime(copy, message.createdAt)}>{clock(message.createdAt)}</time>
                : <Avatar src={person?.avatarUrl} name={name} size={32} />}
        </div>
        <div className="tc-msg__main">
            {!compact && <header className="tc-msg__head">
                <span className="tc-msg__name">{name}</span>
                <time dateTime={message.createdAt} title={fullTime(copy, message.createdAt)}>{clock(message.createdAt)}</time>
            </header>}
            {quote && <button type="button" className="tc-quote" onClick={() => actions.onJump(quote.id)} aria-label={copy(`Go to the message from ${quote.senderName ?? ''}`, `${quote.senderName ?? ''}-ის შეტყობინებაზე გადასვლა`)}>
                <Reply aria-hidden="true" /><span className="tc-quote__name">{quote.senderName}</span>
                <span className="tc-quote__text">{quote.deleted ? copy('Message deleted', 'შეტყობინება წაიშალა') : quote.excerpt || copy(`${quote.attachments} file(s)`, `${quote.attachments} ფაილი`)}</span>
            </button>}
            {removed
                ? <p className="tc-msg__deleted">{copy('Message deleted', 'შეტყობინება წაიშალა')}</p>
                : <>
                    <MessageBody message={message} members={members} me={me} trailing={edited} />
                    {!message.content && edited}
                    {message.attachments.length > 0 && <Attachments attachments={message.attachments} onOpen={attachment => actions.onOpen(message, attachment)} />}
                    {message.reactions.length > 0 && <Reactions message={message} me={me} members={members} onReact={emoji => actions.onReact(message, emoji)} />}
                </>}
        </div>
        {!removed && <Tools message={message} mine={mine} reactions={reactions} canModerate={canModerate} conversationId={conversationId} actions={actions} />}
        {removed && canModerate && <div className="tc-tools"><button type="button" className="tc-tool" aria-label={copy('Earlier versions', 'წინა ვერსიები')} title={copy('Earlier versions', 'წინა ვერსიები')} onClick={() => actions.onHistory(message)}><History aria-hidden="true" /></button></div>}
    </article>;
});

/** A message on its way: waiting for the connection, being sent, or refused (then: try again or remove). */
export function PendingRow({ item, sending, me, onRetry, onDiscard }: { item: Pending; sending: boolean; me: ChatPerson | undefined; onRetry: () => void; onDiscard: () => void }) {
    const copy = useJourneyCopy();
    return <article className="tc-msg tc-msg--pending" data-mine="" data-refused={item.refused !== null || undefined}>
        <div className="tc-msg__side"><Avatar src={me?.avatarUrl} name={me?.name} size={32} /></div>
        <div className="tc-msg__main">
            <header className="tc-msg__head"><span className="tc-msg__name">{me?.name ?? copy('You', 'თქვენ')}</span>
                <span className="tc-pending" role="status">
                    {item.refused !== null ? <><AlertCircle aria-hidden="true" />{copy('Not sent', 'ვერ გაიგზავნა')}</>
                        : sending ? <><Loader2 className="tc-spin" aria-hidden="true" />{copy('Sending…', 'იგზავნება…')}</>
                            : copy('Waiting for the connection…', 'კავშირს ველოდებით…')}
                </span>
            </header>
            {item.replyTo && <p className="tc-quote tc-quote--static"><Reply aria-hidden="true" /><span className="tc-quote__name">{item.replyTo.senderName}</span><span className="tc-quote__text">{item.replyTo.excerpt}</span></p>}
            {item.content && <p className="tc-msg__text">{item.content}</p>}
            {item.attachments.length > 0 && <ul className="tc-pending__files">{item.attachments.map(file => <li key={file.id}>{file.name} · {fileSize(file.sizeBytes)}</li>)}</ul>}
            {item.refused !== null && <p className="tc-pending__why">{item.refused}
                <button type="button" className="tc-link-button" onClick={onRetry}><RotateCcw aria-hidden="true" />{copy('Try again', 'ხელახლა ცდა')}</button>
                <button type="button" className="tc-link-button" onClick={onDiscard}><X aria-hidden="true" />{copy('Remove', 'წაშლა')}</button>
            </p>}
        </div>
    </article>;
}
