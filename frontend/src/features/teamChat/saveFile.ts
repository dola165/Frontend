import { apiClient } from '../../api/axiosConfig';
import { protectedMediaUrl } from '../../hooks/useMediaSource';
import type { ChatAttachment } from './api';

/** Saves a chat file under its own name, fetched with the person's sign-in (these files are for the team only). */
export async function saveFile(attachment: ChatAttachment) {
    const source = protectedMediaUrl(attachment.url) ?? attachment.url;
    const response = await apiClient.get<Blob>(source, { responseType: 'blob', headers: { 'Cache-Control': 'no-cache' } });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
