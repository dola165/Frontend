import { apiClient } from '../../api/axiosConfig';
import { protectedMediaUrl } from '../../hooks/useMediaSource';
import type { ChatAttachment } from './api';

const offer = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/** Saves a chat file under its own name, fetched with the person's sign-in (these files are for the team only). */
export async function saveFile(attachment: ChatAttachment) {
    const source = protectedMediaUrl(attachment.url) ?? attachment.url;
    const response = await apiClient.get<Blob>(source, { responseType: 'blob' });
    offer(response.data, attachment.name);
}

/** Saves an API download (the zip of a chat's files) under a name, with the sign-in. */
export async function saveFromApi(path: string, name: string) {
    const response = await apiClient.get<Blob>(path, { responseType: 'blob', timeout: 0 });
    offer(response.data, name);
}
