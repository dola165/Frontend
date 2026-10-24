import { apiClient } from '../../api/axiosConfig';

/** Mirrors the backend's MediaEditDto. */
export interface EditPerson { id: number | null; name: string | null }
/**
 * An edited copy just saved, beside its original: on the same Team work task (`itemId`), or in the team chat as a new
 * message answering the original's (`messageId`, with the chat's small copy in `thumbUrl`).
 */
export interface SavedCopy {
    url: string; thumbUrl: string | null; originalUrl: string; place: 'TEAM_WORK' | 'CHAT';
    itemId: number | null; messageId: number | null; editedBy: EditPerson; editedAt: string;
}
/** A picture that is an edited copy, and what it was edited from (`originalAvailable`: you can still open it). */
export interface MediaEdit { url: string; originalUrl: string; originalAvailable: boolean; place: 'TEAM_WORK' | 'CHAT'; editedBy: EditPerson; editedAt: string }

/** Saves the edited image as a new picture where the original is; the original stays as it was. */
export const saveCopy = (originalUrl: string, image: Blob, name: string, signal?: AbortSignal) => {
    const form = new FormData();
    form.append('original', originalUrl);
    form.append('file', image, name);
    return apiClient.post<SavedCopy>('/media/edits', form, { signal, timeout: 0 }).then(response => response.data);
};

/** Which of these pictures are edited copies; pictures you cannot open, or that are not copies, are left out. */
export const editsOf = (urls: string[], signal?: AbortSignal) =>
    apiClient.get<{ edits: MediaEdit[] }>('/media/edits', { params: { url: urls }, paramsSerializer: { indexes: null }, signal })
        .then(response => response.data.edits);
