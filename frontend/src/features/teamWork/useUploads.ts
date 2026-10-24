import { useState } from 'react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addFile, addPicture, addVideo, FILE_EXTENSIONS, FILE_LIMIT_MB, VIDEO_LIMIT_MB, VIDEO_TYPES, type Detail } from './api';

const extensionOf = (name: string) => name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
/** What the one "Add" button and a drop take: pictures, MP4/WebM videos, and the file kinds the server keeps. */
export const ACCEPT = ['image/*', ...VIDEO_TYPES, ...FILE_EXTENSIONS.map(extension => `.${extension}`)].join(',');

/**
 * Uploads under one task, from the button or a drop: each file goes the way its kind needs (picture, video or
 * file), one after another; the first refusal stops the rest and says why.
 */
export function useUploads(itemId: number, onChanged: (detail: Detail) => void) {
    const copy = useJourneyCopy();
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState('');
    const one = (file: File) => {
        if (file.type.startsWith('image/')) return addPicture(itemId, file);
        if (file.type.startsWith('video/') || ['mp4', 'webm'].includes(extensionOf(file.name))) {
            if (!VIDEO_TYPES.includes(file.type)) throw new Error(copy('Videos are MP4 or WebM.', 'ვიდეო უნდა იყოს MP4 ან WebM.'));
            if (file.size > VIDEO_LIMIT_MB * 1024 * 1024) throw new Error(copy(`Videos are up to ${VIDEO_LIMIT_MB} MB.`, `ვიდეო მაქსიმუმ ${VIDEO_LIMIT_MB} MB.`));
            return addVideo(itemId, file, setProgress);
        }
        if (!FILE_EXTENSIONS.includes(extensionOf(file.name))) throw new Error(copy(`“${file.name}” is not a kind of file we keep: pictures, videos, ${FILE_EXTENSIONS.join(', ')}.`, `„${file.name}“ ასეთ ფაილს არ ვინახავთ: სურათები, ვიდეო, ${FILE_EXTENSIONS.join(', ')}.`));
        if (file.size > FILE_LIMIT_MB * 1024 * 1024) throw new Error(copy(`Files are up to ${FILE_LIMIT_MB} MB.`, `ფაილი მაქსიმუმ ${FILE_LIMIT_MB} MB.`));
        return addFile(itemId, file);
    };
    const upload = async (files: Iterable<File>) => {
        setError(''); setProgress(0);
        try { for (const file of files) onChanged(await one(file)); }
        catch (failure) { setError(failure instanceof Error && !('response' in failure) ? failure.message : extractApiErrorMessage(failure, copy('That couldn’t be added.', 'ვერ დაემატა.'))); }
        finally { setProgress(null); }
    };
    return { upload, progress, error, busy: progress !== null };
}
export type Uploads = ReturnType<typeof useUploads>;
