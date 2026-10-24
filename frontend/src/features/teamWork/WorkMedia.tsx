import { useRef, useState } from 'react';
import { Download, FileText, Paperclip, Play, Trash2, Video } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useMediaSource } from '../../hooks/useMediaSource';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { deleteMedia, playLink, type Detail, type WorkMedia as Media } from './api';
import { ago } from './teamWorkWords';
import { ACCEPT, type Uploads } from './useUploads';

const size = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** The one visible way in: a button for any file, picture or video, with the upload's progress beside it. */
export function AttachButton({ uploads, primary = false }: { uploads: Uploads; primary?: boolean }) {
    const copy = useJourneyCopy();
    const input = useRef<HTMLInputElement>(null);
    return <span className="tw-attach">
        <Button size="sm" variant={primary ? 'secondary' : 'ghost'} disabled={uploads.busy} onClick={() => input.current?.click()}><Paperclip aria-hidden="true" />{copy('Add file, picture or video', 'ფაილის, სურათის ან ვიდეოს დამატება')}</Button>
        <span className="gk-faint">{uploads.progress !== null ? copy(`Uploading… ${Math.round(uploads.progress * 100)}%`, `იტვირთება… ${Math.round(uploads.progress * 100)}%`) : copy('or drop it anywhere on this page', 'ან ჩააგდეთ აქ ნებისმიერ ადგილას')}</span>
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={event => { if (event.target.files?.length) void uploads.upload([...event.target.files]); event.target.value = ''; }} />
    </span>;
}

/** A picture as a thumbnail, fetched with the person's sign-in: these files are for the team only. */
function Thumb({ media, onOpen }: { media: Media; onOpen: () => void }) {
    const copy = useJourneyCopy();
    const src = useMediaSource(media.url);
    return <button type="button" className="tw-thumb" onClick={onOpen} aria-label={copy('Open the picture', 'სურათის გახსნა')}>{src && <img src={src} alt="" />}</button>;
}

function Picture({ media }: { media: Media }) {
    const src = useMediaSource(media.url);
    return src ? <img className="tw-lightbox__img" src={src} alt="" /> : null;
}

/** Any other file: its name and size, saved with the person's sign-in. */
function FileRow({ media }: { media: Media }) {
    const copy = useJourneyCopy();
    const src = useMediaSource(media.url);
    const name = media.name ?? media.url.split('/').pop() ?? copy('file', 'ფაილი');
    return <a className="tw-file" href={src ?? undefined} download={name} aria-disabled={!src || undefined} title={copy(`Save ${name}`, `${name}-ის შენახვა`)}>
        <FileText aria-hidden="true" /><span className="tw-file__name">{name}</span><span className="gk-num gk-faint">{size(media.sizeBytes)}</span><Download aria-hidden="true" />
    </a>;
}

/**
 * A video plays from a ten-minute link signed for this person, so the browser can stream it with range requests;
 * a video element cannot send the sign-in itself.
 */
function Player({ itemId, media }: { itemId: number; media: Media }) {
    const copy = useJourneyCopy();
    const [src, setSrc] = useState<string | null>(null);
    const [error, setError] = useState('');
    if (src) return <video className="tw-video" src={src} controls autoPlay playsInline preload="metadata" />;
    return <button type="button" className="tw-thumb tw-thumb--video" onClick={() => playLink(itemId, media.id).then(link => setSrc(resolveMediaUrl(link.url) ?? link.url)).catch(failure => setError(extractApiErrorMessage(failure, copy('The video could not open.', 'ვიდეო ვერ გაიხსნა.'))))}
        aria-label={copy('Play the video', 'ვიდეოს ჩართვა')}>
        <Play aria-hidden="true" /><span className="gk-num">{size(media.sizeBytes)}</span>{error && <span className="tw-thumb__error">{error}</span>}
    </button>;
}

/** What is attached under a task: pictures to open larger, videos to watch, files to save; remove (the uploader or a system admin). */
export function WorkMediaList({ itemId, media, onChanged }: { itemId: number; media: Media[]; onChanged: (detail: Detail) => void }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState<Media | null>(null);
    const [error, setError] = useState('');
    const remove = async (id: number) => {
        setError('');
        try { onChanged(await deleteMedia(itemId, id)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be removed.', 'ვერ წაიშალა.'))); }
    };
    if (!media.length && !error) return null;
    const removeLabel = (item: Media) => item.kind === 'VIDEO' ? copy('Remove the video', 'ვიდეოს წაშლა') : item.kind === 'IMAGE' ? copy('Remove the picture', 'სურათის წაშლა') : copy(`Remove ${item.name ?? 'the file'}`, `${item.name ?? 'ფაილის'} წაშლა`);
    return <div className="tw-media">
        {media.length > 0 && <ul className="tw-media__list">{media.map(item => <li key={item.id} className={item.kind === 'VIDEO' ? 'tw-media__video' : item.kind === 'FILE' ? 'tw-media__file' : undefined}>
            {item.kind === 'VIDEO' ? <Player itemId={itemId} media={item} /> : item.kind === 'FILE' ? <FileRow media={item} /> : <Thumb media={item} onOpen={() => setOpen(item)} />}
            <span className="tw-media__meta">
                {item.kind === 'VIDEO' && <Video aria-hidden="true" />}
                <span>{[item.uploadedBy?.name, ago(copy, item.createdAt)].filter(Boolean).join(' · ')}</span>
                {item.canDelete && <button type="button" className="tw-icon-button" aria-label={removeLabel(item)} onClick={() => void remove(item.id)}><Trash2 aria-hidden="true" /></button>}
            </span>
        </li>)}</ul>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {open && <Dialog open size="lg" className="tw-lightbox" title={copy('Picture', 'სურათი')} description={[open.uploadedBy?.name, ago(copy, open.createdAt)].filter(Boolean).join(' · ')} onClose={() => setOpen(null)} closeLabel={copy('Close', 'დახურვა')}>
            <Picture media={open} />
        </Dialog>}
    </div>;
}
