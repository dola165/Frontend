import { API_BASE_URL, apiClient } from '../../api/axiosConfig';
import { protectedMediaUrl } from '../../hooks/useMediaSource';
import { zipLink, type ChatAttachment } from './api';

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

/**
 * Downloads a chat's files as one zip through a one-time link: the browser saves the stream straight to disk, so a
 * large zip never sits in this page's memory. The link is the server's own path ("/api/…"), on the API's address.
 */
export async function downloadZip(chat: number) {
    const { url } = await zipLink(chat);
    const link = document.createElement('a');
    link.href = new URL(API_BASE_URL.replace(/\/$/, '') + url.replace(/^\/api(?=\/)/, ''), window.location.origin).href;
    link.rel = 'noopener';
    // A download, so a link that has run out never takes the person away from the app.
    link.download = '';
    document.body.append(link);
    link.click();
    link.remove();
}
