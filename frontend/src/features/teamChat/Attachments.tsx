import { useState, type CSSProperties } from 'react';
import { Download, FileText, Loader2, Play } from 'lucide-react';
import { useMediaSource } from '../../hooks/useMediaSource';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { playLink, type ChatAttachment } from './api';
import { saveFile } from './saveFile';
import { fileSize } from './teamChatWords';

/** A picture fetched with the sign-in: the small copy in lists, the picture itself full screen. */
export function ChatImage({ attachment, full = false, className }: { attachment: ChatAttachment; full?: boolean; className?: string }) {
    const src = useMediaSource(full ? attachment.url : attachment.thumbUrl ?? attachment.url);
    const ratio = attachment.width && attachment.height ? { aspectRatio: `${attachment.width} / ${attachment.height}` } as CSSProperties : undefined;
    return src ? <img className={className} src={src} alt={attachment.name} style={full ? undefined : ratio} /> : <span className={`${className ?? ''} tc-img--loading`} style={ratio} aria-hidden="true" />;
}

/**
 * A video plays from a ten-minute link signed for this person (a video element cannot send the sign-in); when the
 * link has run out it asks for a fresh one.
 */
export function ChatVideo({ attachment, controls = false, autoPlay = false, className }: { attachment: ChatAttachment; controls?: boolean; autoPlay?: boolean; className?: string }) {
    const [src, setSrc] = useState(attachment.playUrl);
    const [renewed, setRenewed] = useState(false);
    const url = src ? resolveMediaUrl(src) : undefined;
    return <video className={className} src={url ? `${url}${controls ? '' : '#t=0.1'}` : undefined} controls={controls} autoPlay={autoPlay}
        muted={!controls} playsInline preload="metadata" aria-label={attachment.name}
        onError={() => { if (renewed) return; setRenewed(true); void playLink(attachment.id).then(link => setSrc(link.url)).catch(() => undefined); }} />;
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
        <span className="tc-file__name">{attachment.name}</span>
        <span className="tc-file__meta">{[extension, fileSize(attachment.sizeBytes)].filter(Boolean).join(' · ')}</span>
        {busy ? <Loader2 className="tc-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
        {failed && <span className="tc-file__error" role="alert">{copy('Could not save; try again.', 'ვერ შეინახა; სცადეთ ხელახლა.')}</span>}
    </button>;
}

/** A message's pictures and videos in a small grid (opening full screen), then its files. */
export function Attachments({ attachments, onOpen }: { attachments: ChatAttachment[]; onOpen: (attachment: ChatAttachment) => void }) {
    const copy = useJourneyCopy();
    const visual = attachments.filter(attachment => attachment.kind !== 'FILE');
    const files = attachments.filter(attachment => attachment.kind === 'FILE');
    return <div className="tc-attachments">
        {visual.length > 0 && <ul className="tc-gallery" data-count={Math.min(visual.length, 4)}>
            {visual.map(attachment => <li key={attachment.id}>
                <button type="button" className="tc-tile" onClick={() => onOpen(attachment)}
                    aria-label={attachment.kind === 'VIDEO' ? copy(`Play ${attachment.name}`, `${attachment.name}-ის ჩართვა`) : copy(`Open ${attachment.name}`, `${attachment.name}-ის გახსნა`)}>
                    {attachment.kind === 'VIDEO'
                        ? <><ChatVideo attachment={attachment} className="tc-tile__media" /><span className="tc-tile__play"><Play aria-hidden="true" /></span></>
                        : <ChatImage attachment={attachment} className="tc-tile__media" />}
                </button>
            </li>)}
        </ul>}
        {files.map(attachment => <FileRow key={attachment.id} attachment={attachment} />)}
    </div>;
}
