import { useRef, useState } from 'react';
import { Download, FileText, Maximize2, Paperclip, PencilLine, Play, Tag, Trash2, Video } from 'lucide-react';
import { useContextMenu } from '../../components/useContextMenu';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useMediaSource } from '../../hooks/useMediaSource';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { EditImageButton } from '../imageEditor/EditImageButton';
import { EditedImageNote } from '../imageEditor/EditedImageNote';
import { LabelDialog } from '../teamChat/LabelDialog';
import { TagList } from '../teamChat/MediaBits';
import { PictureEditor } from '../teamChat/PictureEditor';
import { deleteMedia, fetchDetail, playLink, type Detail, type WorkMedia as Media } from './api';
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
    const name = fileName(media, copy('file', 'ფაილი'));
    return <a className="tw-file" href={src ?? undefined} download={name} aria-disabled={!src || undefined} title={copy(`Save ${name}`, `${name}-ის შენახვა`)}>
        <FileText aria-hidden="true" /><span className="tw-file__name">{media.title || name}</span><span className="gk-num gk-faint">{size(media.sizeBytes)}</span><Download aria-hidden="true" />
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

/** A task file's own name (or the last part of its address). */
const fileName = (media: Media, fallback: string) => media.name ?? media.url.split('/').pop() ?? fallback;

/** One attached file with its name and tags; right-click (or hold) to open it, name it, save it, edit the picture or remove it. */
function MediaItem({ itemId, item, onOpen, onLabel, onEdit, onRemove, removeLabel }: {
    itemId: number; item: Media; onOpen: () => void; onLabel: () => void; onEdit: () => void; onRemove: () => void; removeLabel: string;
}) {
    const copy = useJourneyCopy();
    const name = item.title || fileName(item, copy('file', 'ფაილი'));
    const menu = useContextMenu(() => [
        item.kind === 'IMAGE' && { key: 'open', label: copy('Open', 'გახსნა'), icon: Maximize2, onSelect: onOpen },
        { key: 'label', label: copy('Name and tags…', 'სახელი და თეგები…'), icon: Tag, onSelect: onLabel },
        item.kind === 'IMAGE' && { key: 'edit', label: copy('Edit picture', 'სურათის რედაქტირება'), icon: PencilLine, onSelect: onEdit },
        item.canDelete && { key: 'remove', label: removeLabel, icon: Trash2, danger: true, separated: true, onSelect: onRemove },
    ], { label: name });
    return <li className={`gk-cm-target${item.kind === 'VIDEO' ? ' tw-media__video' : item.kind === 'FILE' ? ' tw-media__file' : ''}`} {...menu.bind}>
        {item.kind === 'VIDEO' ? <Player itemId={itemId} media={item} /> : item.kind === 'FILE' ? <FileRow media={item} /> : <Thumb media={item} onOpen={onOpen} />}
        {item.kind === 'IMAGE' && <EditedImageNote url={item.url} />}
        {item.title && item.kind !== 'FILE' && <span className="tw-media__title" title={item.name ?? undefined}>{item.title}</span>}
        <TagList tags={item.tags} />
        <span className="tw-media__meta">
            {item.kind === 'VIDEO' && <Video aria-hidden="true" />}
            <span>{[item.uploadedBy?.name, ago(copy, item.createdAt)].filter(Boolean).join(' · ')}</span>
            <button type="button" className="tw-icon-button" aria-label={copy(`Name and tags for ${name}`, `სახელი და თეგები: ${name}`)} title={copy('Name and tags', 'სახელი და თეგები')} onClick={onLabel}><Tag aria-hidden="true" /></button>
            {item.canDelete && <button type="button" className="tw-icon-button" aria-label={removeLabel} onClick={onRemove}><Trash2 aria-hidden="true" /></button>}
        </span>
        {menu.menu}
    </li>;
}

/** What is attached under a task: pictures to open larger, videos to watch, files to save; remove (the uploader or a system admin). */
export function WorkMediaList({ itemId, media, onChanged }: { itemId: number; media: Media[]; onChanged: (detail: Detail) => void }) {
    const copy = useJourneyCopy();
    const [open, setOpen] = useState<Media | null>(null);
    const [labelling, setLabelling] = useState<Media | null>(null);
    const [editing, setEditing] = useState<Media | null>(null);
    const [error, setError] = useState('');
    const refresh = () => fetchDetail(itemId).then(onChanged).catch(failure => setError(extractApiErrorMessage(failure, copy('Saved, but the task could not refresh. Open it again to see it.', 'შეინახა, მაგრამ საქმე ვერ განახლდა. ხელახლა გახსენით.'))));
    const remove = async (id: number) => {
        setError('');
        try { onChanged(await deleteMedia(itemId, id)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be removed.', 'ვერ წაიშალა.'))); }
    };
    if (!media.length && !error) return null;
    const removeLabel = (item: Media) => item.kind === 'VIDEO' ? copy('Remove the video', 'ვიდეოს წაშლა') : item.kind === 'IMAGE' ? copy('Remove the picture', 'სურათის წაშლა') : copy(`Remove ${item.name ?? 'the file'}`, `${item.name ?? 'ფაილის'} წაშლა`);
    return <div className="tw-media">
        {media.length > 0 && <ul className="tw-media__list">{media.map(item => <MediaItem key={item.id} itemId={itemId} item={item} removeLabel={removeLabel(item)}
            onOpen={() => setOpen(item)} onLabel={() => setLabelling(item)} onEdit={() => setEditing(item)} onRemove={() => void remove(item.id)} />)}</ul>}
        {labelling && <LabelDialog target={{ source: 'TASK', id: labelling.id, fileName: fileName(labelling, copy('file', 'ფაილი')), title: labelling.title ?? null, tags: labelling.tags ?? [],
            labelledBy: labelling.labelledBy ?? null, labelledAt: labelling.labelledAt ?? null }} onClose={() => setLabelling(null)} onSaved={() => { setLabelling(null); void refresh(); }} />}
        {editing && <PictureEditor media={{ url: editing.url, name: editing.name, place: { itemId } }} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh(); }} />}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {open && <Dialog open size="lg" className="tw-lightbox" title={open.title || copy('Picture', 'სურათი')} description={[open.uploadedBy?.name, ago(copy, open.createdAt)].filter(Boolean).join(' · ')} onClose={() => setOpen(null)} closeLabel={copy('Close', 'დახურვა')}
            footer={<EditImageButton media={{ url: open.url, name: open.name, place: { itemId } }} variant="secondary" onSaved={() => {
                setOpen(null);
                fetchDetail(itemId).then(onChanged).catch(failure => setError(extractApiErrorMessage(failure, copy('The copy was saved, but the task could not refresh. Open it again to see it.', 'ასლი შეინახა, მაგრამ საქმე ვერ განახლდა. ხელახლა გახსენით.'))));
            }} />}>
            <Picture media={open} />
        </Dialog>}
    </div>;
}
