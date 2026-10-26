import { memo, useEffect, useRef, useState } from 'react';
import { History, Images, Link2, Copy, MoreHorizontal, Pencil, Reply, SmilePlus, Trash2, AlertCircle, Loader2, RotateCcw, X } from 'lucide-react';
import { useContextMenu, type ContextMenuItems } from '../../components/useContextMenu';
import { Avatar } from '../../design/primitives';
import { ReportControl } from '../moderation/Reporting';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { ChatAttachment, ChatMessage, ChatPerson } from './api';
import { Attachments } from './Attachments';
import { mediaMenu } from './mediaMenu';
import { eventLine } from './mediaWords';
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
    /** Name and tag one of its files. */
    onLabel?: (message: ChatMessage, attachment: ChatAttachment) => void;
    /** Edit one of its pictures (a copy waits in the message box). */
    onEditPicture?: (message: ChatMessage, attachment: ChatAttachment) => void;
    /** The Media page, at this chat. */
    onMedia?: () => void;
    onSave?: (attachment: ChatAttachment) => void;
}

/** Copies words, saying so for a moment. */
function useCopied() {
    const [copied, setCopied] = useState('');
    const write = (text: string, done: string) => void navigator.clipboard?.writeText(text)
        .then(() => { setCopied(done); window.setTimeout(() => setCopied(''), 1500); })
        .catch(() => undefined);
    return { copied, write };
}

/** Closes a small popup on a click outside it or on Escape, and gives focus back to its button. */
function useDismiss(
    open: boolean,
    root: React.RefObject<HTMLElement | null>,
    trigger: React.RefObject<HTMLElement | null>,
    close: () => void,
) {
    useEffect(() => {
        if (!open) return;
        const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(); };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.stopPropagation(); close(); trigger.current?.focus(); }
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape, true);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape, true);
        };
    }, [open, root, trigger, close]);
}

/**
 * The few things to do with a message, shown on hover, on keyboard focus, or when a phone taps it; the same as its
 * right-click menu. `open` is held by the row, so the menu's "React…" opens the reactions here.
 */
function Tools({ message, mine, reactions, canModerate, conversationId, actions, open, setOpen }: {
    message: ChatMessage; mine: boolean; reactions: string[]; canModerate: boolean; conversationId: number; actions: RowActions;
    open: 'react' | 'more' | null; setOpen: (open: 'react' | 'more' | null) => void;
}) {
    const copy = useJourneyCopy();
    const { copied, write } = useCopied();
    const root = useRef<HTMLDivElement>(null), reactButton = useRef<HTMLButtonElement>(null), moreButton = useRef<HTMLButtonElement>(null);
    useDismiss(open !== null, root, open === 'react' ? reactButton : moreButton, () => setOpen(null));
    return <div ref={root} className="tc-tools" data-open={open !== null || undefined}>
        <button ref={reactButton} type="button" className="tc-tool" aria-label={copy('React', 'რეაქცია')} title={copy('React', 'რეაქცია')}
            aria-expanded={open === 'react'} onClick={() => setOpen(open === 'react' ? null : 'react')}>
            <SmilePlus aria-hidden="true" />
        </button>
        <button type="button" className="tc-tool" aria-label={copy('Reply', 'პასუხი')} title={copy('Reply', 'პასუხი')}
            onClick={() => actions.onReply(message)}>
            <Reply aria-hidden="true" />
        </button>
        {mine && <button type="button" className="tc-tool" aria-label={copy('Edit', 'რედაქტირება')} title={copy('Edit', 'რედაქტირება')}
            onClick={() => actions.onEdit(message)}>
            <Pencil aria-hidden="true" />
        </button>}
        <button ref={moreButton} type="button" className="tc-tool" aria-label={copy('More', 'მეტი')} title={copy('More', 'მეტი')}
            aria-expanded={open === 'more'} onClick={() => setOpen(open === 'more' ? null : 'more')}>
            <MoreHorizontal aria-hidden="true" />
        </button>
        {open === 'react' && <div className="tc-pop tc-pop--react" role="group" aria-label={copy('Reactions', 'რეაქციები')}>
            {reactions.map(emoji => <button key={emoji} type="button" autoFocus={emoji === reactions[0]} aria-label={emoji}
                onClick={() => { actions.onReact(message, emoji); setOpen(null); }}>{emoji}</button>)}
        </div>}
        {open === 'more' && <div className="tc-pop tc-pop--menu" role="menu">
            {message.content && <button type="button" role="menuitem" autoFocus onClick={() => write(message.content, 'text')}>
                <Copy aria-hidden="true" />
                {copied === 'text' ? copy('Copied', 'დაკოპირდა') : copy('Copy text', 'ტექსტის კოპირება')}
            </button>}
            <button type="button" role="menuitem" autoFocus={!message.content}
                onClick={() => write(`${window.location.origin}/team-work/chat?chat=${conversationId}&message=${message.id}`, 'link')}>
                <Link2 aria-hidden="true" />
                {copied === 'link' ? copy('Copied', 'დაკოპირდა') : copy('Copy link', 'ბმულის კოპირება')}
            </button>
            {canModerate && message.editedAt && <button type="button" role="menuitem"
                onClick={() => { setOpen(null); actions.onHistory(message); }}>
                <History aria-hidden="true" />
                {copy('Earlier versions', 'წინა ვერსიები')}
            </button>}
            {(mine || canModerate) && <button type="button" role="menuitem" className="tc-danger" onClick={() => { setOpen(null); actions.onDelete(message); }}>
                <Trash2 aria-hidden="true" />
                {mine ? copy('Delete for everyone', 'ყველასთვის წაშლა') : copy('Delete for everyone (moderator)', 'ყველასთვის წაშლა (მოდერატორი)')}
            </button>}
            {!mine && message.senderId !== null && <ReportControl targetType="MESSAGE" targetId={message.id} conversationId={conversationId}
                personId={message.senderId} className="tc-pop__report" />}
        </div>}
    </div>;
}

/** Who reacted, as chips: yours stand out; a tap adds or takes back yours. */
function Reactions({ message, me, members, onReact }: {
    message: ChatMessage; me: number | null; members: Map<number, ChatPerson>; onReact: (emoji: string) => void;
}) {
    const copy = useJourneyCopy();
    return <ul className="tc-reactions" aria-label={copy('Reactions', 'რეაქციები')}>
        {message.reactions.map(reaction => {
            const names = reaction.userIds.map(id => id === me ? copy('you', 'თქვენ') : members.get(id)?.name ?? '?').join(', ');
            const mine = me !== null && reaction.userIds.includes(me);
            return <li key={reaction.emoji}>
                <button type="button" aria-pressed={mine} title={names} aria-label={`${reaction.emoji} ${reaction.userIds.length}: ${names}`}
                    onClick={() => onReact(reaction.emoji)}>
                    <span aria-hidden="true">{reaction.emoji}</span><span className="gk-num">{reaction.userIds.length}</span>
                </button>
            </li>;
        })}
    </ul>;
}

/** A line the chat wrote itself ("Beqa added Gio"), quiet and centred, in the reader's language. */
function SystemLine({ message, me }: { message: ChatMessage; me: number | null }) {
    const copy = useJourneyCopy();
    if (!message.event) return null;
    return <p id={`tc-m-${message.id}`} className="tc-sysline" data-chat-message-id={message.id}>
        <span>{eventLine(copy, message.event, me)}</span>
        <time dateTime={message.createdAt} title={fullTime(copy, message.createdAt)}>{clock(message.createdAt)}</time>
    </p>;
}

export const MessageRow = memo(function MessageRow({
    message, compact, me, members, reactions, canModerate, conversationId, highlighted, actions, readOnly = false,
}: {
    message: ChatMessage; compact: boolean; me: number | null; members: Map<number, ChatPerson>; reactions: string[]; canModerate: boolean;
    conversationId: number; highlighted: boolean; actions: RowActions; readOnly?: boolean;
}) {
    if (message.event) return <SystemLine message={message} me={me} />;
    return <Message message={message} compact={compact} me={me} members={members} reactions={reactions} canModerate={canModerate}
        conversationId={conversationId} highlighted={highlighted} actions={actions} readOnly={readOnly} />;
});

/**
 * What a message's right-click menu holds: reply, react, copy, edit and delete (yours; moderators delete anyone's),
 * and for a message with one file: save it, edit the picture, show it in Media, name and tag it.
 */
function messageMenu(copy: ReturnType<typeof useJourneyCopy>, message: ChatMessage, { mine, canModerate, readOnly, conversationId, actions, onReact, write }: {
    mine: boolean; canModerate: boolean; readOnly: boolean; conversationId: number; actions: RowActions; onReact: () => void; write: (text: string, done: string) => void;
}): ContextMenuItems {
    const link = `${window.location.origin}/team-work/chat?chat=${conversationId}&message=${message.id}`;
    if (message.deleted) return canModerate ? [{ key: 'history', label: copy('Earlier versions', 'წინა ვერსიები'), icon: History, onSelect: () => actions.onHistory(message) }] : [];
    const only = message.attachments.length === 1 ? message.attachments[0] : null;
    const files: ContextMenuItems = only
        ? mediaMenu(copy, only, {
            onSave: actions.onSave ? () => actions.onSave?.(only) : undefined,
            onMedia: actions.onMedia,
            onLabel: !readOnly && actions.onLabel ? () => actions.onLabel?.(message, only) : undefined,
            onEdit: !readOnly && actions.onEditPicture ? () => actions.onEditPicture?.(message, only) : undefined,
            noEdit: readOnly ? copy('The chat is in Recently deleted.', 'ჩატი ბოლოს წაშლილებშია.') : undefined,
        }).map(item => item && item.key === 'label' ? { ...item, separated: true } : item)
        : message.attachments.length > 1 && actions.onMedia ? [{ key: 'media', label: copy('Show its files in Media', 'ფაილების ნახვა მედიაში'), icon: Images, separated: true, onSelect: actions.onMedia }] : [];
    return [
        !readOnly && { key: 'reply', label: copy('Reply', 'პასუხი'), icon: Reply, onSelect: () => actions.onReply(message) },
        !readOnly && { key: 'react', label: copy('React…', 'რეაქცია…'), icon: SmilePlus, onSelect: onReact },
        message.content && { key: 'copy', label: copy('Copy text', 'ტექსტის კოპირება'), icon: Copy, onSelect: () => write(message.content, 'text') },
        { key: 'link', label: copy('Copy link', 'ბმულის კოპირება'), icon: Link2, onSelect: () => write(link, 'link') },
        mine && !readOnly && { key: 'edit', label: copy('Edit', 'რედაქტირება'), icon: Pencil, onSelect: () => actions.onEdit(message) },
        ...files,
        canModerate && message.editedAt && { key: 'history', label: copy('Earlier versions', 'წინა ვერსიები'), icon: History, separated: true, onSelect: () => actions.onHistory(message) },
        (mine || canModerate) && !readOnly && {
            key: 'delete', label: mine ? copy('Delete for everyone', 'ყველასთვის წაშლა') : copy('Delete for everyone (moderator)', 'ყველასთვის წაშლა (მოდერატორი)'),
            icon: Trash2, danger: true, separated: true, onSelect: () => actions.onDelete(message),
        },
    ];
}

function Message({
    message, compact, me, members, reactions, canModerate, conversationId, highlighted, actions, readOnly,
}: {
    message: ChatMessage; compact: boolean; me: number | null; members: Map<number, ChatPerson>; reactions: string[]; canModerate: boolean;
    conversationId: number; highlighted: boolean; actions: RowActions; readOnly: boolean;
}) {
    const copy = useJourneyCopy();
    const mine = me !== null && message.senderId === me;
    const [tool, setTool] = useState<'react' | 'more' | null>(null);
    const { copied, write } = useCopied();
    const person = message.senderId !== null ? members.get(message.senderId) : undefined;
    const name = message.senderName ?? person?.name ?? copy('Someone', 'ვიღაც');
    const removed = message.deleted;
    const quote = message.replyTo;
    const edited = message.editedAt
        ? <span className="tc-edited" title={fullTime(copy, message.editedAt)}>{copy('(edited)', '(შესწორებული)')}</span>
        : null;
    const menu = useContextMenu(() => messageMenu(copy, message, { mine, canModerate, readOnly, conversationId, actions, onReact: () => setTool('react'), write }),
        { label: copy(`Message from ${name}`, `${name}-ის შეტყობინება`) });
    const fileMenu = (attachment: ChatAttachment) => removed ? [] : mediaMenu(copy, attachment, {
        onOpen: attachment.kind === 'FILE' ? undefined : () => actions.onOpen(message, attachment),
        onSave: actions.onSave ? () => actions.onSave?.(attachment) : undefined,
        onMedia: actions.onMedia,
        onLabel: !readOnly && actions.onLabel ? () => actions.onLabel?.(message, attachment) : undefined,
        onEdit: !readOnly && actions.onEditPicture ? () => actions.onEditPicture?.(message, attachment) : undefined,
        noEdit: readOnly ? copy('The chat is in Recently deleted.', 'ჩატი ბოლოს წაშლილებშია.') : undefined,
    });
    return <article id={`tc-m-${message.id}`} className="tc-msg gk-cm-target" tabIndex={-1} data-compact={compact || undefined} data-mine={mine || undefined}
        data-highlight={highlighted || undefined} data-chat-message-id={message.id} aria-label={`${name}, ${fullTime(copy, message.createdAt)}`} {...menu.bind}>
        <div className="tc-msg__side">
            {compact
                ? <time className="tc-msg__hover-time" dateTime={message.createdAt} title={fullTime(copy, message.createdAt)}>
                    {clock(message.createdAt)}
                </time>
                : <Avatar src={person?.avatarUrl} name={name} size={32} />}
        </div>
        <div className="tc-msg__main">
            {!compact && <header className="tc-msg__head">
                <span className="tc-msg__name">{name}</span>
                <time dateTime={message.createdAt} title={fullTime(copy, message.createdAt)}>{clock(message.createdAt)}</time>
            </header>}
            {quote && <button type="button" className="tc-quote" onClick={() => actions.onJump(quote.id)}
                aria-label={copy(`Go to the message from ${quote.senderName ?? ''}`, `${quote.senderName ?? ''}-ის შეტყობინებაზე გადასვლა`)}>
                <Reply aria-hidden="true" /><span className="tc-quote__name">{quote.senderName}</span>
                <span className="tc-quote__text">
                    {quote.deleted
                        ? copy('Message deleted', 'შეტყობინება წაიშალა')
                        : quote.excerpt || copy(`${quote.attachments} file(s)`, `${quote.attachments} ფაილი`)}
                </span>
            </button>}
            {removed
                ? <p className="tc-msg__deleted">{copy('Message deleted', 'შეტყობინება წაიშალა')}</p>
                : <>
                    <MessageBody message={message} members={members} me={me} trailing={edited} />
                    {!message.content && edited}
                    {message.attachments.length > 0
                        && <Attachments attachments={message.attachments} onOpen={attachment => actions.onOpen(message, attachment)} menu={fileMenu} />}
                    {message.reactions.length > 0
                        && <Reactions message={message} me={me} members={members} onReact={emoji => actions.onReact(message, emoji)} />}
                </>}
        </div>
        {!removed && !readOnly && <Tools message={message} mine={mine} reactions={reactions} canModerate={canModerate}
            conversationId={conversationId} actions={actions} open={tool} setOpen={setTool} />}
        {copied && <span className="tc-copied" role="status">{copied === 'link' ? copy('Link copied', 'ბმული დაკოპირდა') : copy('Copied', 'დაკოპირდა')}</span>}
        {menu.menu}
        {removed && canModerate && <div className="tc-tools">
            <button type="button" className="tc-tool" aria-label={copy('Earlier versions', 'წინა ვერსიები')}
                title={copy('Earlier versions', 'წინა ვერსიები')} onClick={() => actions.onHistory(message)}>
                <History aria-hidden="true" />
            </button>
        </div>}
    </article>;
}

/** A message on its way: waiting for the connection, being sent, or refused (then: try again or remove). */
export function PendingRow({ item, sending, me, onRetry, onDiscard }: {
    item: Pending; sending: boolean; me: ChatPerson | undefined; onRetry: () => void; onDiscard: () => void;
}) {
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
            {item.replyTo && <p className="tc-quote tc-quote--static">
                <Reply aria-hidden="true" />
                <span className="tc-quote__name">{item.replyTo.senderName}</span>
                <span className="tc-quote__text">{item.replyTo.excerpt}</span>
            </p>}
            {item.content && <p className="tc-msg__text">{item.content}</p>}
            {item.attachments.length > 0 && <ul className="tc-pending__files">
                {item.attachments.map(file => <li key={file.id}>{file.name} · {fileSize(file.sizeBytes)}</li>)}
            </ul>}
            {item.refused !== null && <p className="tc-pending__why">{item.refused}
                <button type="button" className="tc-link-button" onClick={onRetry}><RotateCcw aria-hidden="true" />{copy('Try again', 'ხელახლა ცდა')}</button>
                <button type="button" className="tc-link-button" onClick={onDiscard}><X aria-hidden="true" />{copy('Remove', 'წაშლა')}</button>
            </p>}
        </div>
    </article>;
}
