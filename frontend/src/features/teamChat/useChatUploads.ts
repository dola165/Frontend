import { useCallback, useEffect, useRef, useState } from 'react';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { cancelUpload, uploadFile, uploadPicture, uploadVideo, type AttachmentKind, type ChatAttachment, type ChatLimits } from './api';
import { problem } from './teamChatWords';

/** A file on its way into the composer: uploading (with progress), ready, or refused. */
export interface Upload {
    id: string; file: File; kind: AttachmentKind; progress: number; state: 'uploading' | 'ready' | 'failed';
    attachment: ChatAttachment | null; error: string; preview: string | null;
}

const extensionOf = (name: string) => name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';

/** Which way a file goes in: a picture, an MP4/WebM video, or one of the kinds of file the team keeps. */
export function kindOf(file: File, limits: ChatLimits): AttachmentKind | null {
    if (file.type.startsWith('image/')) return 'IMAGE';
    if (limits.videoTypes.includes(file.type) || ['mp4', 'webm'].includes(extensionOf(file.name))) return 'VIDEO';
    return limits.fileExtensions.includes(extensionOf(file.name)) ? 'FILE' : null;
}

/**
 * The composer's uploads into one chat: each starts at once (from the button, a paste or a drop) with its progress,
 * can be cancelled (an upload already made is taken back), retried when it failed, and is checked against the same
 * limits as the server's before it starts.
 */
export function useChatUploads(chatId: number, limits: ChatLimits | null) {
    const copy = useJourneyCopy();
    const [items, setItems] = useState<Upload[]>([]);
    const controllers = useRef(new Map<string, AbortController>());
    const [refusal, setRefusal] = useState('');
    const patch = (id: string, change: Partial<Upload>) => setItems(current => current.map(item => item.id === id ? { ...item, ...change } : item));

    const start = useCallback((item: Upload) => {
        const controller = new AbortController();
        controllers.current.set(item.id, controller);
        const onProgress = (share: number) => patch(item.id, { progress: share });
        const request = item.kind === 'IMAGE' ? uploadPicture(chatId, item.file, onProgress, controller.signal)
            : item.kind === 'VIDEO' ? uploadVideo(chatId, item.file, onProgress, controller.signal)
                : uploadFile(chatId, item.file, onProgress, controller.signal);
        request.then(attachment => {
            if (controller.signal.aborted) { void cancelUpload(attachment.id).catch(() => undefined); return; }
            patch(item.id, { state: 'ready', progress: 1, attachment });
        }).catch(error => {
            if (controller.signal.aborted) return;
            patch(item.id, { state: 'failed', error: problem(copy, error, ['The upload failed.', 'ატვირთვა ვერ მოხერხდა.']) });
        }).finally(() => controllers.current.delete(item.id));
    }, [chatId, copy]);

    const add = useCallback((files: Iterable<File>) => {
        if (!limits) return;
        setRefusal('');
        const accepted: Upload[] = [];
        const reasons: string[] = [];
        let room = limits.maxAttachments - items.length;
        for (const file of files) {
            const kind = kindOf(file, limits);
            const mb = kind === 'IMAGE' ? limits.pictureMb : kind === 'VIDEO' ? limits.videoMb : limits.fileMb;
            if (!kind) reasons.push(copy(`“${file.name}”: not a kind of file the team keeps (pictures, MP4/WebM videos, ${limits.fileExtensions.join(', ')}).`,
                `„${file.name}“: ასეთ ფაილს არ ვინახავთ (სურათები, MP4/WebM ვიდეო, ${limits.fileExtensions.join(', ')}).`));
            else if (file.size > mb * 1024 * 1024) reasons.push(copy(`“${file.name}” is over ${mb} MB.`, `„${file.name}“ ${mb} MB-ზე მეტია.`));
            else if (file.size === 0) reasons.push(copy(`“${file.name}” is empty.`, `„${file.name}“ ცარიელია.`));
            else if (room <= 0) reasons.push(copy(`At most ${limits.maxAttachments} files in one message.`,
                `ერთ შეტყობინებაში მაქსიმუმ ${limits.maxAttachments} ფაილი.`));
            else {
                room--;
                accepted.push({
                    id: crypto.randomUUID(), file, kind, progress: 0, state: 'uploading', attachment: null, error: '',
                    preview: kind === 'IMAGE' ? URL.createObjectURL(file) : null,
                });
            }
        }
        if (reasons.length) setRefusal(reasons.join(' '));
        if (!accepted.length) return;
        setItems(current => [...current, ...accepted]);
        accepted.forEach(start);
    }, [limits, items.length, copy, start]);

    const itemsRef = useRef(items);
    useEffect(() => { itemsRef.current = items; }, [items]);

    /** Takes a file out: an upload on its way stops, one already made is taken back on the server. */
    const cancel = useCallback((id: string) => {
        const item = itemsRef.current.find(candidate => candidate.id === id);
        if (item?.preview) URL.revokeObjectURL(item.preview);
        if (item?.attachment) void cancelUpload(item.attachment.id).catch(() => undefined);
        controllers.current.get(id)?.abort();
        setItems(current => current.filter(candidate => candidate.id !== id));
    }, []);
    const retry = useCallback((id: string) => {
        const item = itemsRef.current.find(candidate => candidate.id === id);
        if (!item) return;
        patch(id, { state: 'uploading', progress: 0, error: '' });
        start(item);
    }, [start]);
    /**
     * Files already uploaded to this chat elsewhere (edited copies): ready to send, or to take out, which cancels them.
     * The per-message limit holds: any over it are cancelled on the server and the box says why. Gives how many went in.
     */
    const adopt = useCallback((files: { attachment: ChatAttachment; file: File }[]) => {
        const present = new Set(itemsRef.current.flatMap(item => item.attachment ? [item.attachment.id] : []));
        const fresh = files.filter(({ attachment }) => !present.has(attachment.id));
        const room = Math.max(0, (limits?.maxAttachments ?? fresh.length) - itemsRef.current.length);
        const kept = fresh.slice(0, room), over = fresh.slice(room);
        for (const { attachment } of over) void cancelUpload(attachment.id).catch(() => undefined);
        if (over.length && limits) setRefusal(copy(`At most ${limits.maxAttachments} files in one message.`, `ერთ შეტყობინებაში მაქსიმუმ ${limits.maxAttachments} ფაილი.`));
        if (!kept.length) return 0;
        const added: Upload[] = kept.map(({ attachment, file }) => ({ id: crypto.randomUUID(), file, kind: attachment.kind, progress: 1, state: 'ready', attachment, error: '', preview: URL.createObjectURL(file) }));
        itemsRef.current = [...itemsRef.current, ...added];
        setItems(current => [...current, ...added]);
        return kept.length;
    }, [limits, copy]);
    /** The files went out with a message: they are the message's now. */
    const sent = useCallback(() => {
        itemsRef.current.forEach(item => { if (item.preview) URL.revokeObjectURL(item.preview); });
        setItems([]);
        setRefusal('');
    }, []);

    useEffect(() => () => { controllers.current.forEach(controller => controller.abort()); }, []);

    const ready = items.length > 0 && items.every(item => item.state === 'ready');
    return { items, add, adopt, cancel, retry, sent, ready, busy: items.some(item => item.state === 'uploading'), refusal, dismiss: () => setRefusal(''),
        attachments: items.flatMap(item => item.attachment ? [item.attachment] : []) };
}
export type ChatUploads = ReturnType<typeof useChatUploads>;
