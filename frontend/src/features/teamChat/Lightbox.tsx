import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, MessageSquare, Tag } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { EditImageButton } from '../imageEditor/EditImageButton';
import { EditedImageNote } from '../imageEditor/EditedImageNote';
import { handOffChatDraft } from '../imageEditor/chatDraft';
import type { ChatAttachment, ChatTaskRef } from './api';
import { ChatImage, ChatVideo, FileRow } from './Attachments';
import type { LabelTarget } from './LabelDialog';
import { TagList } from './MediaBits';
import { shownName } from './mediaWords';
import { saveFile } from './saveFile';
import { fileSize } from './teamChatWords';

/**
 * A picture or video seen full screen, and where it came from (`chatId` and `messageId`; none for kept files;
 * `itemId` for a task's own picture; `task` the task it is on or its chat is about). `editable: false` where a copy
 * could not be saved (a chat in Recently deleted). `label` lets it be named and tagged here.
 */
export interface Viewed {
    attachment: ChatAttachment; messageId: number | null; chatId: number | null; caption: string; renew?: () => Promise<{ url: string }>; editable?: boolean;
    itemId?: number | null; task?: ChatTaskRef | null; label?: LabelTarget;
}

/**
 * Pictures and videos full screen, one at a time: arrows (and ← →) move through the set, Download saves it, and
 * "Show in chat" goes to the message it came in.
 */
export function Lightbox({ items, start, onClose, onShow, onTask, onLabel }: {
    items: Viewed[]; start: number; onClose: () => void; onShow?: (item: Viewed) => void; onTask?: (item: Viewed) => void; onLabel?: (item: Viewed) => void;
}) {
    const copy = useJourneyCopy();
    const [index, setIndex] = useState(start);
    const [saving, setSaving] = useState(false);
    const current = items[Math.min(index, items.length - 1)];
    useEffect(() => {
        const keys = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') setIndex(value => Math.max(0, value - 1));
            if (event.key === 'ArrowRight') setIndex(value => Math.min(items.length - 1, value + 1));
        };
        window.addEventListener('keydown', keys);
        return () => window.removeEventListener('keydown', keys);
    }, [items.length]);
    if (!current) return null;
    const { attachment } = current;
    const save = async () => { setSaving(true); try { await saveFile(attachment); } finally { setSaving(false); } };
    return <Dialog open size="lg" className="tc-lightbox" onClose={onClose} closeLabel={copy('Close', 'დახურვა')}
        title={<span className="tc-lightbox__title">{shownName(attachment)}</span>}
        description={`${current.caption} · ${fileSize(attachment.sizeBytes)}${attachment.title ? ` · ${attachment.name}` : ''}${items.length > 1 ? ` · ${index + 1}/${items.length}` : ''}`}
        footer={<>
            <TagList tags={attachment.tags} />
            {onLabel && current.label && <Button variant="ghost" size="sm" onClick={() => onLabel(current)}><Tag aria-hidden="true" />{copy('Name and tags', 'სახელი და თეგები')}</Button>}
            {attachment.kind === 'IMAGE' && <EditedImageNote url={attachment.url} className="tc-lightbox__edited" />}
            {attachment.kind === 'IMAGE' && current.messageId !== null && current.editable !== false && <EditImageButton media={{ url: attachment.url, name: attachment.name, place: { messageId: current.messageId } }}
                onSaved={(saved, image) => {
                    onClose();
                    // The copy waits in its chat's message box; from another chat or All chats, that chat opens at the original.
                    if (handOffChatDraft(saved, image) && onShow && saved.chatId !== null) onShow({ ...current, chatId: saved.chatId, messageId: saved.replyToId });
                }} />}
            {attachment.kind === 'IMAGE' && current.messageId === null && current.itemId && current.editable !== false && <EditImageButton media={{ url: attachment.url, name: attachment.name, place: { itemId: current.itemId } }} />}
            {onShow && current.messageId !== null && <Button variant="ghost" size="sm" onClick={() => onShow(current)}><MessageSquare aria-hidden="true" />{copy('Show in chat', 'ჩატში ნახვა')}</Button>}
            {onTask && current.task && <Button variant="ghost" size="sm" onClick={() => onTask(current)}><ExternalLink aria-hidden="true" />{copy('Open the task', 'საქმის გახსნა')}</Button>}
            <Button size="sm" disabled={saving} onClick={() => void save()}><Download aria-hidden="true" />{copy('Download', 'ჩამოტვირთვა')}</Button>
        </>}>
        <div className="tc-lightbox__stage">
            {items.length > 1 && <Button variant="ghost" iconOnly className="tc-lightbox__prev" disabled={index === 0} aria-label={copy('Previous', 'წინა')} onClick={() => setIndex(index - 1)}><ChevronLeft aria-hidden="true" /></Button>}
            {attachment.kind === 'VIDEO'
                ? <ChatVideo key={attachment.id} attachment={attachment} controls autoPlay renew={current.renew} className="tc-lightbox__media" />
                : attachment.kind === 'IMAGE' ? <ChatImage key={attachment.id} attachment={attachment} full className="tc-lightbox__media" />
                    : <FileRow attachment={attachment} />}
            {items.length > 1 && <Button variant="ghost" iconOnly className="tc-lightbox__next" disabled={index === items.length - 1} aria-label={copy('Next', 'შემდეგი')} onClick={() => setIndex(index + 1)}><ChevronRight aria-hidden="true" /></Button>}
        </div>
    </Dialog>;
}
