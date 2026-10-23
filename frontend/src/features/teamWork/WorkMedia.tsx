import { useRef, useState } from 'react';
import { ImagePlus, Play, Trash2, Video } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { useMediaSource } from '../../hooks/useMediaSource';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addPicture, addVideo, deleteMedia, playLink, VIDEO_LIMIT_MB, VIDEO_TYPES, type Detail, type WorkMedia as Media } from './api';
import { ago } from './teamWorkWords';

const size = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

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

/** Videos and pictures under a task: add, watch, open larger, remove (the uploader or a system admin). */
export function WorkMediaList({ itemId, media, onChanged }: { itemId: number; media: Media[]; onChanged: (detail: Detail) => void }) {
    const copy = useJourneyCopy();
    const pictureInput = useRef<HTMLInputElement>(null);
    const videoInput = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState<Media | null>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState('');
    const run = async (action: () => Promise<Detail>) => {
        setError('');
        try { onChanged(await action()); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That couldn’t be done.', 'ვერ მოხერხდა.'))); }
        finally { setProgress(null); }
    };
    const upload = (file: File | undefined, kind: 'IMAGE' | 'VIDEO') => {
        if (!file) return;
        if (kind === 'VIDEO') {
            if (!VIDEO_TYPES.includes(file.type)) { setError(copy('Videos are MP4 or WebM.', 'ვიდეო უნდა იყოს MP4 ან WebM.')); return; }
            if (file.size > VIDEO_LIMIT_MB * 1024 * 1024) { setError(copy(`Videos are up to ${VIDEO_LIMIT_MB} MB.`, `ვიდეო მაქსიმუმ ${VIDEO_LIMIT_MB} MB.`)); return; }
            setProgress(0);
            void run(() => addVideo(itemId, file, setProgress));
        } else { setProgress(0); void run(() => addPicture(itemId, file)); }
    };
    return <div className="tw-media">
        {media.length > 0 && <ul className="tw-media__list">{media.map(item => <li key={item.id} className={item.kind === 'VIDEO' ? 'tw-media__video' : undefined}>
            {item.kind === 'VIDEO' ? <Player itemId={itemId} media={item} /> : <Thumb media={item} onOpen={() => setOpen(item)} />}
            <span className="tw-media__meta">
                {item.kind === 'VIDEO' && <Video aria-hidden="true" />}
                <span>{[item.uploadedBy?.name, ago(copy, item.createdAt)].filter(Boolean).join(' · ')}</span>
                {item.canDelete && <button type="button" className="tw-icon-button" aria-label={item.kind === 'VIDEO' ? copy('Remove the video', 'ვიდეოს წაშლა') : copy('Remove the picture', 'სურათის წაშლა')}
                    onClick={() => void run(() => deleteMedia(itemId, item.id))}><Trash2 aria-hidden="true" /></button>}
            </span>
        </li>)}</ul>}
        <div className="tw-media__add">
            <Button size="sm" disabled={progress !== null} onClick={() => pictureInput.current?.click()}><ImagePlus aria-hidden="true" />{copy('Add a picture', 'სურათის დამატება')}</Button>
            <Button size="sm" disabled={progress !== null} onClick={() => videoInput.current?.click()}><Video aria-hidden="true" />{copy('Add a video', 'ვიდეოს დამატება')}</Button>
            <span className="gk-faint">{progress !== null ? copy(`Uploading… ${Math.round(progress * 100)}%`, `იტვირთება… ${Math.round(progress * 100)}%`) : copy(`Videos: MP4 or WebM, up to ${VIDEO_LIMIT_MB} MB`, `ვიდეო: MP4 ან WebM, მაქს. ${VIDEO_LIMIT_MB} MB`)}</span>
            <input ref={pictureInput} type="file" accept="image/*" hidden onChange={event => { upload(event.target.files?.[0], 'IMAGE'); event.target.value = ''; }} />
            <input ref={videoInput} type="file" accept={VIDEO_TYPES.join(',')} hidden onChange={event => { upload(event.target.files?.[0], 'VIDEO'); event.target.value = ''; }} />
        </div>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {open && <Dialog open size="lg" className="tw-lightbox" title={copy('Picture', 'სურათი')} description={[open.uploadedBy?.name, ago(copy, open.createdAt)].filter(Boolean).join(' · ')} onClose={() => setOpen(null)} closeLabel={copy('Close', 'დახურვა')}>
            <Picture media={open} />
        </Dialog>}
    </div>;
}
