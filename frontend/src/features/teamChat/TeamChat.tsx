import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Upload as UploadIcon, X } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { takeChatDraft, useChatDraft } from '../imageEditor/chatDraft';
import { fetchHistory, type ChatAttachment, type ChatMessage, type ChatSummary, type Version } from './api';
import { DecisionBar, DeletedBar } from './ChatBars';
import { Composer, type Context } from './Composer';
import { Lightbox, type Viewed } from './Lightbox';
import { MessageList } from './MessageList';
import type { RowActions } from './MessageRow';
import { fullTime } from './teamChatWords';
import { useChatUploads } from './useChatUploads';
import type { TeamChatModel } from './useTeamChat';

const quoteOf = (message: ChatMessage) => ({
    id: message.id, senderId: message.senderId, senderName: message.senderName,
    excerpt: message.content.length > 160 ? `${message.content.slice(0, 157)}…` : message.content, deleted: false, attachments: message.attachments.length,
});

/** Who is typing, under the messages. */
function TypingLine({ names }: { names: string[] }) {
    const copy = useJourneyCopy();
    if (!names.length) return <p className="tc-typing" aria-hidden="true" />;
    const who = names.length > 2 ? copy(`${names.length} people`, `${names.length} ადამიანი`) : names.join(copy(' and ', ' და '));
    return <p className="tc-typing" role="status">
        {names.length === 1 ? copy(`${who} is typing…`, `${who} წერს…`) : copy(`${who} are typing…`, `${who} წერენ…`)}
    </p>;
}

/** For moderators: what a message said before each edit and before it was deleted. */
function HistoryDialog({ chatId, message, onClose }: { chatId: number; message: ChatMessage; onClose: () => void }) {
    const copy = useJourneyCopy();
    const [versions, setVersions] = useState<Version[] | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let live = true;
        fetchHistory(chatId, message.id).then(history => { if (live) setVersions(history.versions); }).catch(() => { if (live) setFailed(true); });
        return () => { live = false; };
    }, [chatId, message.id]);
    return <Dialog open size="md" className="tc-dialog" title={copy('Earlier versions', 'წინა ვერსიები')} onClose={onClose}
        closeLabel={copy('Close', 'დახურვა')}
        description={copy('Kept for moderators; others see only the message as it is now.',
            'ინახება მოდერატორებისთვის; სხვები მხოლოდ ამჟამინდელ ტექსტს ხედავენ.')}>
        {failed ? <p className="gk-notice gk-notice--danger" role="alert">{copy('The versions could not load.', 'ვერსიები ვერ ჩაიტვირთა.')}</p>
            : !versions ? <p role="status">{copy('Loading…', 'იტვირთება…')}</p>
                : <ol className="tc-versions">
                    {!message.deleted && <li><span className="tc-faint">{copy('Now', 'ახლა')}</span><p>{message.content}</p></li>}
                    {versions.map((version, index) => <li key={index}>
                        <span className="tc-faint">
                            {version.kind === 'DELETE' ? copy('Before it was deleted', 'წაშლამდე') : copy('Before an edit', 'რედაქტირებამდე')}
                            {' · '}{version.by?.name}{' · '}{fullTime(copy, version.at)}
                        </span>
                        <p>{version.previous}</p>
                    </li>)}
                </ol>}
    </Dialog>;
}

/**
 * The chat itself: its decision pinned on top, the messages, who is typing and the box to write in; files can be dropped
 * anywhere on it. A chat waiting in Recently deleted says when it goes and takes nothing new. Deleting a message
 * asks first (it deletes the files for everyone); pictures and videos open full screen.
 */
export function TeamChat({ model, active = true, onChat }: { model: TeamChatModel; active?: boolean; onChat?: (chat: ChatSummary) => void }) {
    const copy = useJourneyCopy();
    const uploads = useChatUploads(model.chatId, model.state?.limits ?? null);
    const [context, setContext] = useState<Context>(null);
    const [deleting, setDeleting] = useState<ChatMessage | null>(null);
    const [history, setHistory] = useState<ChatMessage | null>(null);
    const [viewing, setViewing] = useState<{ items: Viewed[]; start: number } | null>(null);
    const [dragging, setDragging] = useState(false);
    const depth = useRef(0);
    const me = model.state?.me ?? null;
    const messages = model.view.messages;

    const { toggleReaction, jumpTo } = model;
    const actions = useMemo<RowActions>(() => ({
        onReply: message => setContext({ kind: 'reply', quote: quoteOf(message) }),
        onEdit: message => setContext({ kind: 'edit', message }),
        onDelete: message => setDeleting(message),
        onReact: (message, emoji) => toggleReaction(message, emoji),
        onHistory: message => setHistory(message),
        onJump: id => jumpTo(id),
        onOpen: (message: ChatMessage, attachment: ChatAttachment) => {
            const caption = `${message.senderName ?? ''} · ${fullTime(copy, message.createdAt)}`;
            const items: Viewed[] = message.attachments.filter(file => file.kind !== 'FILE')
                .map(file => ({ attachment: file, messageId: message.id, chatId: model.chatId, caption }));
            setViewing({ items, start: Math.max(0, items.findIndex(item => item.attachment.id === attachment.id)) });
        },
    }), [toggleReaction, jumpTo, copy, model.chatId]);

    // An edited copy saved from this chat's pictures arrives as a ready file answering the original's message, the box
    // focused (the reply does that) rather than the original it opened at, for the person to add words and send. It
    // waits a moment for the original to load.
    const draft = useChatDraft(model.chatId);
    const { adopt } = uploads;
    const { setHighlight } = model;
    useEffect(() => {
        if (!draft) return undefined;
        const original = messages.find(message => message.id === draft.replyToId);
        const place = () => {
            if (!takeChatDraft(model.chatId)) return;
            adopt(draft.attachment, draft.file);
            setHighlight(null);
            setContext({ kind: 'reply', quote: original ? quoteOf(original) : { id: draft.replyToId, senderId: null, senderName: null, excerpt: '', deleted: false, attachments: 1 } });
        };
        if (original) { place(); return undefined; }
        const timer = window.setTimeout(place, 1500);
        return () => window.clearTimeout(timer);
    }, [draft, messages, model.chatId, adopt, setHighlight]);

    const editLast = useCallback(() => {
        const last = [...messages].reverse().find(message => message.senderId === me && !message.deleted);
        if (last) setContext({ kind: 'edit', message: last });
    }, [messages, me]);

    const files = (event: DragEvent) => [...event.dataTransfer.types].includes('Files');
    const drop = {
        onDragEnter: (event: DragEvent) => { if (!files(event)) return; event.preventDefault(); depth.current++; setDragging(true); },
        onDragOver: (event: DragEvent) => { if (files(event)) event.preventDefault(); },
        onDragLeave: (event: DragEvent) => {
            if (!files(event)) return;
            depth.current = Math.max(0, depth.current - 1);
            if (!depth.current) setDragging(false);
        },
        onDrop: (event: DragEvent) => {
            if (!files(event)) return;
            event.preventDefault();
            depth.current = 0;
            setDragging(false);
            if (context?.kind === 'edit') setContext(null);
            uploads.add([...event.dataTransfer.files]);
        },
    };

    const chat = model.state?.chat ?? null;
    const trashed = !!chat?.deletesAt;
    const putChat = (next: ChatSummary) => { model.putChat(next); onChat?.(next); };
    return <section className="tc-chat" aria-label={chat?.name ?? copy('Team chat', 'გუნდის ჩატი')} {...(trashed ? {} : drop)}>
        {chat && <DecisionBar chat={chat} />}
        {chat && <DeletedBar chat={chat} onChat={putChat} />}
        {model.notice && <div className="tc-notice" role="alert">
            <span>{model.notice}</span>
            <button type="button" className="tc-tool" aria-label={copy('Dismiss', 'დახურვა')} onClick={model.dismissNotice}><X aria-hidden="true" /></button>
        </div>}
        <MessageList model={model} actions={actions} active={active} />
        <TypingLine names={model.typingNames} />
        {!trashed && <Composer model={model} uploads={uploads} context={context} onClearContext={() => setContext(null)} onEditLast={editLast} />}
        {dragging && <div className="tc-drop" aria-hidden="true">
            <UploadIcon /><span>{copy('Drop to add to your message', 'ჩააგდეთ შეტყობინებაში დასამატებლად')}</span>
        </div>}
        {deleting && <Dialog open size="sm" role="alertdialog" className="tc-dialog"
            title={copy('Delete this message for everyone?', 'წავშალოთ ეს შეტყობინება ყველასთვის?')}
            description={deleting.attachments.length
                ? copy(`Its ${deleting.attachments.length} file(s) will be deleted for everyone too. “Message deleted” stays in its place.`,
                    `მისი ${deleting.attachments.length} ფაილიც ყველასთვის წაიშლება. მის ადგილას დარჩება „შეტყობინება წაიშალა“.`)
                : copy('“Message deleted” stays in its place.', 'მის ადგილას დარჩება „შეტყობინება წაიშალა“.')}
            onClose={() => setDeleting(null)} closeLabel={copy('Cancel', 'გაუქმება')}
            footer={<>
                <Button variant="ghost" onClick={() => setDeleting(null)}>{copy('Cancel', 'გაუქმება')}</Button>
                <Button variant="danger" autoFocus onClick={() => { const target = deleting; setDeleting(null); void model.remove(target.id); }}>
                    {copy('Delete', 'წაშლა')}
                </Button>
            </>} />}
        {history && <HistoryDialog chatId={model.chatId} message={history} onClose={() => setHistory(null)} />}
        {viewing && <Lightbox items={viewing.items} start={viewing.start} onClose={() => setViewing(null)} />}
    </section>;
}
