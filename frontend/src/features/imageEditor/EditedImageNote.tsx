import './image-editor.css';
import { useState } from 'react';
import { PencilLine } from 'lucide-react';
import { Dialog } from '../../design/Dialog';
import { useMediaSource } from '../../hooks/useMediaSource';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { editedAgo } from './imageEditorWords';
import { useEditedFrom } from './useEditedFrom';

/** What useMediaSource gives for a picture that could not be fetched. */
const FAILED = 'data:image/png;base64,invalid';

function Original({ url, onClose }: { url: string; onClose: () => void }) {
    const copy = useJourneyCopy();
    const src = useMediaSource(url);
    const [broken, setBroken] = useState(false);
    const failed = broken || src === FAILED;
    return <Dialog open size="lg" className="ie-original" title={copy('Original picture', 'ორიგინალი სურათი')} description={copy('As it was before the edit.', 'როგორც იყო რედაქტირებამდე.')}
        onClose={onClose} closeLabel={copy('Close', 'დახურვა')}>
        {failed ? <p className="gk-notice gk-notice--danger" role="alert">{copy('The original could not open. It may have been removed; try again later.', 'ორიგინალი ვერ გაიხსნა. შესაძლოა წაიშალა; სცადეთ მოგვიანებით.')}</p>
            : src ? <img className="ie-original__img" src={src} alt={copy('The original picture', 'ორიგინალი სურათი')} onError={() => setBroken(true)} />
                : <p className="gk-faint" role="status">{copy('Opening…', 'იხსნება…')}</p>}
    </Dialog>;
}

/**
 * Under a picture that is an edited copy: "Edited by Beqa · 2 min ago · Original", the last opening the original.
 * Shows nothing for any other picture. `onOpenOriginal` replaces the built-in viewer (for example, to jump to the
 * original's own message in the chat).
 */
export function EditedImageNote({ url, onOpenOriginal, className }: { url: string; onOpenOriginal?: (originalUrl: string) => void; className?: string }) {
    const copy = useJourneyCopy();
    const edit = useEditedFrom(url);
    const [viewing, setViewing] = useState(false);
    if (!edit) return null;
    const who = edit.editedBy.name ?? copy('someone', 'ვიღაცამ');
    const original = edit.originalAvailable ? edit.originalUrl : null;
    return <p className={`ie-note${className ? ` ${className}` : ''}`}>
        <PencilLine aria-hidden="true" />
        <span className="ie-note__text">{copy(`Edited by ${who}`, `დაარედაქტირა: ${who}`)} · {editedAgo(copy, edit.editedAt)}</span>
        {original
            ? <button type="button" className="ie-note__link" onClick={() => onOpenOriginal ? onOpenOriginal(original) : setViewing(true)}>{copy('Original', 'ორიგინალი')}</button>
            : <span className="ie-note__gone">{copy('original removed', 'ორიგინალი წაშლილია')}</span>}
        {viewing && original && <Original url={original} onClose={() => setViewing(false)} />}
    </p>;
}
