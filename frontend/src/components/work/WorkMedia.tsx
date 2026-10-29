import { useRef, useState, type ReactNode } from 'react';
import { Download, FileText, Maximize2, Paperclip, PencilLine, Play, Tag, Trash2, Video } from 'lucide-react';
import { useContextMenu } from '../useContextMenu';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useMediaSource } from '../../hooks/useMediaSource';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import type { WorkMedia as Media } from './types';
import { ACCEPT, type Uploads } from './useUploads';
import { ago, fileName } from './workWords';
import './work.css';

const size = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** The one visible way in: a button for any file, picture or video, with the upload's progress beside it. */
export function AttachButton({ uploads, primary = false, label }: { uploads: Uploads; primary?: boolean; label?: string }) {
    const copy = useJourneyCopy();
    const input = useRef<HTMLInputElement>(null);
    return <span className="work-attach">
        <Button size="sm" variant={primary ? 'secondary' : 'ghost'} disabled={uploads.busy} onClick={() => input.current?.click()}><Paperclip aria-hidden="true" />{label ?? copy('Add file, picture or video', 'ფაილის, სურათის ან ვიდეოს დამატება')}</Button>
        <span className="gk-faint">{uploads.progress !== null ? copy(`Uploading… ${Math.round(uploads.progress * 100)}%`, `იტვირთება… ${Math.round(uploads.progress * 100)}%`) : copy('or drop it anywhere on this page', 'ან ჩააგდეთ აქ ნებისმიერ ადგილას')}</span>
        <input ref={input} type="file" accept={uploads.accept ?? ACCEPT} multiple hidden onChange={event => { if (event.target.files?.length) void uploads.upload([...event.target.files]); event.target.value = ''; }} />
    </span>;
}

/** A picture as a thumbnail, fetched with the person's sign-in: these files are for the people on the work only. */
function Thumb({ media, onOpen }: { media: Media; onOpen: () => void }) {
    const copy = useJourneyCopy();
    const src = useMediaSource(media.url);
    return <button type="button" className="work-thumb" onClick={onOpen} aria-label={copy('Open the picture', 'სურათის გახსნა')}>{src && <img src={src} alt="" />}</button>;
}

function Picture({ media }: { media: Media }) {
    const src = useMediaSource(media.url);
    return src ? <img className="work-lightbox__img" src={src} alt="" /> : null;
}

/** Any other file: its name and size, saved with the person's sign-in. */
function FileRow({ media }: { media: Media }) {
    const copy = useJourneyCopy();
    const src = useMediaSource(media.url);
    const name = fileName(media, copy('file', 'ფაილი'));
    return <a className="work-file" href={src ?? undefined} download={name} aria-disabled={!src || undefined} title={copy(`Save ${name}`, `${name}-ის შენახვა`)}>
        <FileText aria-hidden="true" /><span className="work-file__name">{media.title || name}</span><span className="gk-num gk-faint">{size(media.sizeBytes)}</span><Download aria-hidden="true" />
    </a>;
}

/**
 * A video plays from a ten-minute link signed for this person, so the browser can stream it with range requests;
 * a video element cannot send the sign-in itself.
 */
function Player({ media, playLink }: { media: Media; playLink: (mediaId: number) => Promise<{ url: string }> }) {
    const copy = useJourneyCopy();
    const [src, setSrc] = useState<string | null>(null);
    const [error, setError] = useState('');
    if (src) return <video className="work-video" src={src} controls autoPlay playsInline preload="metadata" />;
    return <button type="button" className="work-thumb work-thumb--video" onClick={() => playLink(media.id).then(link => setSrc(resolveMediaUrl(link.url) ?? link.url)).catch(failure => setError(extractApiErrorMessage(failure, copy('The video could not open.', 'ვიდეო ვერ გაიხსნა.'))))}
        aria-label={copy('Play the video', 'ვიდეოს ჩართვა')}>
        <Play aria-hidden="true" /><span className="gk-num">{size(media.sizeBytes)}</span>{error && <span className="work-thumb__error">{error}</span>}
    </button>;
}

/** Where the files are kept: removing one, and playing a video, answer with what the page shows next. */
export interface MediaActions<T> {
    remove: (mediaId: number) => Promise<T>;
    playLink?: (mediaId: number) => Promise<{ url: string }>;
}

/**
 * What a page adds to its files beyond open, save and remove: Team work names and tags them and edits pictures.
 * Each is optional; without it the file simply has no such action.
 */
export interface MediaTools {
    label?: (item: Media) => void;
    edit?: (item: Media) => void;
    note?: (item: Media) => ReactNode;
    tags?: (item: Media) => ReactNode;
    lightboxFooter?: (item: Media, close: () => void) => ReactNode;
}

/** One attached file with its name; right-click (or hold) to open it, name it, edit the picture or remove it. */
function MediaItem({ item, tools, playLink, onOpen, onRemove, removeLabel }: {
    item: Media; tools: MediaTools; playLink?: (mediaId: number) => Promise<{ url: string }>; onOpen: () => void; onRemove: () => void; removeLabel: string;
}) {
    const copy = useJourneyCopy();
    const name = item.title || fileName(item, copy('file', 'ფაილი'));
    const menu = useContextMenu(() => [
        item.kind === 'IMAGE' && { key: 'open', label: copy('Open', 'გახსნა'), icon: Maximize2, onSelect: onOpen },
        tools.label && { key: 'label', label: copy('Name and tags…', 'სახელი და თეგები…'), icon: Tag, onSelect: () => tools.label?.(item) },
        item.kind === 'IMAGE' && tools.edit && { key: 'edit', label: copy('Edit picture', 'სურათის რედაქტირება'), icon: PencilLine, onSelect: () => tools.edit?.(item) },
        item.canDelete && { key: 'remove', label: removeLabel, icon: Trash2, danger: true, separated: true, onSelect: onRemove },
    ], { label: name });
    // A video plays where there is a way to play it; elsewhere it is a file to save, never a picture.
    const asFile = item.kind === 'FILE' || (item.kind === 'VIDEO' && !playLink);
    return <li className={`gk-cm-target${asFile ? ' work-media__file' : item.kind === 'VIDEO' ? ' work-media__video' : ''}`} {...menu.bind}>
        {asFile ? <FileRow media={item} /> : item.kind === 'VIDEO' && playLink ? <Player media={item} playLink={playLink} /> : <Thumb media={item} onOpen={onOpen} />}
        {item.kind === 'IMAGE' && tools.note?.(item)}
        {item.title && !asFile && <span className="work-media__title" title={item.name ?? undefined}>{item.title}</span>}
        {tools.tags?.(item)}
        <span className="work-media__meta">
            {item.kind === 'VIDEO' && <Video aria-hidden="true" />}
            <span>{[item.uploadedBy?.name, ago(copy, item.createdAt)].filter(Boolean).join(' · ')}</span>
            {tools.label && <button type="button" className="work-icon-button" aria-label={copy(`Name and tags for ${name}`, `სახელი და თეგები: ${name}`)} title={copy('Name and tags', 'სახელი და თეგები')} onClick={() => tools.label?.(item)}><Tag aria-hidden="true" /></button>}
            {item.canDelete && <button type="button" className="work-icon-button" aria-label={removeLabel} onClick={onRemove}><Trash2 aria-hidden="true" /></button>}
        </span>
        {menu.menu}
    </li>;
}

/** What is attached: pictures to open larger, videos to watch, files to save; remove (whoever may). */
export function WorkMediaList<T>({ media, actions, tools = {}, onChanged, children }: {
    media: Media[]; actions: MediaActions<T>; tools?: MediaTools; onChanged: (next: T) => void; children?: ReactNode;
}) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState<Media | null>(null);
    const [error, setError] = useState('');
    const remove = async (id: number) => {
        setError('');
        try { onChanged(await actions.remove(id)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be removed.', 'ვერ წაიშალა.'))); }
    };
    if (!media.length && !error) return null;
    const removeLabel = (item: Media) => item.kind === 'VIDEO' ? copy('Remove the video', 'ვიდეოს წაშლა') : item.kind === 'IMAGE' ? copy('Remove the picture', 'სურათის წაშლა') : copy(`Remove ${item.name ?? 'the file'}`, `${item.name ?? 'ფაილის'} წაშლა`);
    return <div className="work-media">
        {media.length > 0 && <ul className="work-media__list">{media.map(item => <MediaItem key={item.id} item={item} tools={tools} playLink={actions.playLink} removeLabel={removeLabel(item)}
            onOpen={() => setOpen(item)} onRemove={() => void remove(item.id)} />)}</ul>}
        {children}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {open && <Dialog open size="lg" className="work-lightbox" title={open.title || copy('Picture', 'სურათი')} description={[open.uploadedBy?.name, ago(copy, open.createdAt)].filter(Boolean).join(' · ')} onClose={() => setOpen(null)} closeLabel={copy('Close', 'დახურვა')}
            footer={tools.lightboxFooter?.(open, () => setOpen(null))}>
            <Picture media={open} />
        </Dialog>}
    </div>;
}
