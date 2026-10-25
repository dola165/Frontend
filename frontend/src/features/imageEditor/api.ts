import { apiClient } from '../../api/axiosConfig';
import type { ChatAttachment } from '../teamChat/api';

/** Mirrors the backend's MediaEditDto. */
export interface EditPerson { id: number | null; name: string | null }
/**
 * An edited copy just saved, beside its original: another picture on the same Team work task (`itemId`), or in a team
 * chat an unsent upload of the original's chat (`chatId`, `attachment`) for its message box, answering the original's
 * message (`replyToId`); it is sent with the person's own words, or taken out (which cancels it).
 */
export interface SavedCopy {
    url: string; thumbUrl: string | null; originalUrl: string; place: 'TEAM_WORK' | 'CHAT';
    itemId: number | null; chatId: number | null; replyToId: number | null; attachment: ChatAttachment | null;
    editedBy: EditPerson; editedAt: string;
}
/** A picture that is an edited copy, and what it was edited from (`originalAvailable`: you can still open it; only then its URL). */
export interface MediaEdit { url: string; originalUrl: string | null; originalAvailable: boolean; place: 'TEAM_WORK' | 'CHAT'; editedBy: EditPerson; editedAt: string }

/** Where Edit was pressed: the chat message carrying the original, or the task it is on. The copy goes there. */
export type EditPlace = { messageId: number } | { itemId: number };

/** Saves the edited image as a new picture where Edit was pressed; the original stays as it was. */
export const saveCopy = (originalUrl: string, image: Blob, name: string, place?: EditPlace, signal?: AbortSignal) => {
    const form = new FormData();
    form.append('original', originalUrl);
    if (place && 'messageId' in place) form.append('messageId', String(place.messageId));
    if (place && 'itemId' in place) form.append('itemId', String(place.itemId));
    form.append('file', image, name);
    return apiClient.post<SavedCopy>('/media/edits', form, { signal, timeout: 0 }).then(response => response.data);
};

/** Which of these pictures are edited copies; pictures you cannot open, or that are not copies, are left out. */
export const editsOf = (urls: string[], signal?: AbortSignal) =>
    apiClient.get<{ edits: MediaEdit[] }>('/media/edits', { params: { url: urls }, paramsSerializer: { indexes: null }, signal })
        .then(response => response.data.edits);
