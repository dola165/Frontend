import { useRef, useState, type CSSProperties } from 'react';
import { useContextMenu, type ContextMenuItems } from '../../components/useContextMenu';
import { Download, FileText, Loader2, Play } from 'lucide-react';
import { useMediaSource } from '../../hooks/useMediaSource';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { EditedImageNote } from '../imageEditor/EditedImageNote';
import { playLink, type ChatAttachment } from './api';
import { shownName } from './mediaWords';
import { useNearView } from './nearView';
import { saveFile } from './saveFile';
import { fileSize } from './teamChatWords';

/**
 * A picture fetched with the sign-in: the small copy (made once at upload) in lists, the picture itself full screen.
 * With `lazy`, it is fetched only once it comes near the screen (long grids).
 */
export function ChatImage({ attachment, full = false, lazy = false, className }: { attachment: ChatAttachment; full?: boolean; lazy?: boolean; className?: string }) {
    const box = useRef<HTMLSpanElement>(null);
    const near = useNearView(box);
    const src = useMediaSource(full ? attachment.url : attachment.thumbUrl ?? attachment.url, !lazy || near);
    const ratio = attachment.width && attachment.height ? { aspectRatio: `${attachment.width} / ${attachment.height}` } as CSSProperties : undefined;
    return src ? <img className={className} src={src} alt={attachment.name} style={full ? undefined : ratio} /> : <span ref={box} className={`${className ?? ''} tc-img--loading`} style={ratio} aria-hidden="true" />;
}

/**
 * A video plays from a ten-minute link signed for this person (a video element cannot send the sign-in); when the
 * link has run out it asks for a fresh one (`renew`, the chat's own link by default).
 */
export function ChatVideo({ attachment, controls = false, autoPlay = false, className, renew }: {
    attachment: ChatAttachment; controls?: boolean; autoPlay?: boolean; className?: string; renew?: () => Promise<{ url: string }>;
}) {
    const [src, setSrc] = useState(attachment.playUrl);
    const [renewed, setRenewed] = useState(false);
    const url = src ? resolveMediaUrl(src) : undefined;
    const fresh = () => (renew ?? (() => playLink(attachment.id)))();
    return <video className={className} src={url ? `${url}${controls ? '' : '#t=0.1'}` : undefined} controls={controls} autoPlay={autoPlay}
        muted={!controls} playsInline preload="metadata" aria-label={attachment.name}
        onError={() => { if (renewed) return; setRenewed(true); void fresh().then(link => setSrc(link.url)).catch(() => undefined); }} />;
}

/** A file to save: its name, size and a download button. */
export function FileRow({ attachment }: { attachment: ChatAttachment }) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const save = async () => {
        setBusy(true); setFailed(false);
        try { await saveFile(attachment); } catch { setFailed(true); } finally { setBusy(false); }
    };
    const extension = attachment.name.includes('.') ? attachment.name.slice(attachment.name.lastIndexOf('.') + 1).toUpperCase() : '';
    return <button type="button" className="tc-file" onClick={() => void save()} disabled={busy} title={copy(`Save ${attachment.name}`, `${attachment.name}-ის შენახვა`)}>
        <FileText aria-hidden="true" />
        <span className="tc-file__name">{shownName(attachment)}</span>
        <span className="tc-file__meta">{[extension, fileSize(attachment.sizeBytes)].filter(Boolean).join(' · ')}</span>
        {busy ? <Loader2 className="tc-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
        {failed && <span className="tc-file__error" role="alert">{copy('Could not save; try again.', 'ვერ შეინახა; სცადეთ ხელახლა.')}</span>}
    </button>;
}

/** One picture or video in a message: opens full screen; right-click (or hold) for what else it can do. */
function GalleryTile({ attachment, onOpen, menu }: { attachment: ChatAttachment; onOpen: (attachment: ChatAttachment) => void; menu?: (attachment: ChatAttachment) => ContextMenuItems }) {
    const copy = useJourneyCopy();
    const name = shownName(attachment);
    const context = useContextMenu(() => menu?.(attachment) ?? [], { label: name, disabled: !menu });
    return <li>
        <button type="button" className="tc-tile gk-cm-target" onClick={() => onOpen(attachment)} {...context.bind}
            aria-label={attachment.kind === 'VIDEO' ? copy(`Play ${name}`, `${name}-ის ჩართვა`) : copy(`Open ${name}`, `${name}-ის გახსნა`)}>
            {attachment.kind === 'VIDEO'
                ? <><ChatVideo attachment={attachment} className="tc-tile__media" /><span className="tc-tile__play"><Play aria-hidden="true" /></span></>
                : <ChatImage attachment={attachment} className="tc-tile__media" />}
        </button>
        {attachment.title && <span className="tc-gallery__name" title={attachment.name}>{attachment.title}</span>}
        {attachment.kind === 'IMAGE' && <EditedImageNote url={attachment.url} className="tc-gallery__edited" />}
        {context.menu}
    </li>;
}

/** One file in a message: saves on a click; right-click (or hold) for what else it can do. */
function FileItem({ attachment, menu }: { attachment: ChatAttachment; menu?: (attachment: ChatAttachment) => ContextMenuItems }) {
    const context = useContextMenu(() => menu?.(attachment) ?? [], { label: shownName(attachment), disabled: !menu });
    return <div className="tc-fileitem gk-cm-target" {...context.bind}><FileRow attachment={attachment} />{context.menu}</div>;
}

/**
 * A message's pictures and videos in a small grid (opening full screen), then its files. `menu` gives each its own
 * right-click menu (open, save, edit, show in media, name and tags).
 */
export function Attachments({ attachments, onOpen, menu }: {
    attachments: ChatAttachment[]; onOpen: (attachment: ChatAttachment) => void; menu?: (attachment: ChatAttachment) => ContextMenuItems;
}) {
    const visual = attachments.filter(attachment => attachment.kind !== 'FILE');
    const files = attachments.filter(attachment => attachment.kind === 'FILE');
    return <div className="tc-attachments">
        {visual.length > 0 && <ul className="tc-gallery" data-count={Math.min(visual.length, 4)}>
            {visual.map(attachment => <GalleryTile key={attachment.id} attachment={attachment} onOpen={onOpen} menu={menu} />)}
        </ul>}
        {files.map(attachment => <FileItem key={attachment.id} attachment={attachment} menu={menu} />)}
    </div>;
}
