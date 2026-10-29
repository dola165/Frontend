import { useUploads } from '../../components/work/useUploads';
import { addFile, addPicture, addVideo, type Detail } from './api';

/** Uploads under one task: pictures, videos and files, each its own way in. */
export const useTaskUploads = (itemId: number, onChanged: (detail: Detail) => void) => useUploads<Detail>({
    picture: file => addPicture(itemId, file),
    video: (file, onProgress) => addVideo(itemId, file, onProgress),
    file: (file, onProgress) => addFile(itemId, file, onProgress),
}, onChanged);
