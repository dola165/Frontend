import { apiClient } from '../../api/axiosConfig';

/** Mirrors the backend's TeamChatDto. */
export interface ChatPerson { id: number; name: string | null; avatarUrl: string | null }
export interface ChatLimits { pictureMb: number; videoMb: number; fileMb: number; videoTypes: string[]; fileExtensions: string[]; maxLength: number; maxAttachments: number }
/** The chat opened: who is in it, where your unread messages start, the newest revision, the upload limits. */
export interface ChatState {
    conversationId: number; me: number; members: ChatPerson[]; firstUnreadId: number | null; unreadCount: number; revision: number;
    limits: ChatLimits; reactions: string[]; canModerate: boolean;
}
export interface ChatQuote { id: number; senderId: number | null; senderName: string | null; excerpt: string | null; deleted: boolean; attachments: number }
export interface ChatReaction { emoji: string; userIds: number[] }
/** A Team work task named in the text ("GK-12"), with its name and status now. */
export interface ChatTaskRef { id: number; key: string; title: string; status: string; parentId: number | null }
export type AttachmentKind = 'IMAGE' | 'VIDEO' | 'FILE';
export interface ChatAttachment {
    id: number; kind: AttachmentKind; name: string; contentType: string; sizeBytes: number; url: string;
    thumbUrl: string | null; width: number | null; height: number | null; playUrl: string | null;
}
export interface ChatMessage {
    id: number; senderId: number | null; senderName: string | null; content: string; createdAt: string; editedAt: string | null;
    deleted: boolean; replyTo: ChatQuote | null; attachments: ChatAttachment[]; reactions: ChatReaction[]; mentions: number[];
    tasks: ChatTaskRef[]; revision: number; clientMessageId: string | null;
}
export interface ChatPage { messages: ChatMessage[]; hasOlder: boolean; hasNewer: boolean; revision: number }
export interface ChatChanges { messages: ChatMessage[]; revision: number; more: boolean }
export interface ReadState { firstUnreadId: number | null; unreadCount: number }
export interface SharedItem { attachment: ChatAttachment; messageId: number; sender: ChatPerson | null; createdAt: string }
export interface Version { kind: 'EDIT' | 'DELETE'; previous: string; by: ChatPerson | null; at: string }
export interface NewMessage { content: string; clientMessageId: string; replyToId?: number | null; attachmentIds?: number[] }
export type MediaFilter = 'MEDIA' | AttachmentKind;
export interface SearchQuery { q?: string; from?: number | null; has?: MediaFilter | null; before?: number }

const base = '/team-chat';
const data = <T>(request: Promise<{ data: T }>) => request.then(response => response.data);

export const fetchState = (signal?: AbortSignal) => data(apiClient.get<ChatState>(base, { signal }));
/** How many wait, without counting as having the chat open (for badges). */
export const fetchUnread = (signal?: AbortSignal) => data(apiClient.get<ReadState>(`${base}/unread`, { signal }));
export const fetchPage = (where: { before?: number; after?: number; around?: number; limit?: number }, signal?: AbortSignal) =>
    data(apiClient.get<ChatPage>(`${base}/messages`, { params: where, signal }));
export const fetchChanges = (since: number, signal?: AbortSignal) => data(apiClient.get<ChatChanges>(`${base}/changes`, { params: { since }, signal }));
export const sendMessage = (message: NewMessage) => data(apiClient.post<ChatMessage>(`${base}/messages`, message));
export const editMessage = (id: number, content: string) => data(apiClient.patch<ChatMessage>(`${base}/messages/${id}`, { content }));
/** Deletes your message for everyone, its files too; "Message deleted" stays in its place. */
export const deleteMessage = (id: number) => data(apiClient.delete<ChatMessage>(`${base}/messages/${id}`));
export const react = (id: number, emoji: string, on: boolean) => data(apiClient.put<ChatMessage>(`${base}/messages/${id}/reactions`, { emoji, on }));
export const fetchHistory = (id: number) => data(apiClient.get<{ message: ChatMessage; versions: Version[] }>(`${base}/messages/${id}/history`));
export const markRead = (upTo: number) => data(apiClient.post<ReadState>(`${base}/read`, { upTo }));
export const fetchShared = (kind: AttachmentKind | null, before?: number, signal?: AbortSignal) =>
    data(apiClient.get<{ items: SharedItem[]; more: boolean }>(`${base}/shared`, { params: { kind: kind ?? undefined, before, limit: 60 }, signal }));
export const searchMessages = ({ q, from, has, before }: SearchQuery, signal?: AbortSignal) =>
    data(apiClient.get<{ messages: ChatMessage[]; more: boolean }>(`${base}/search`, { params: { q: q || undefined, from: from ?? undefined, has: has ?? undefined, before }, signal }));

type Progress = (share: number) => void;
const progressOf = (onProgress?: Progress) => ({ onUploadProgress: (event: { loaded: number; total?: number }) => { if (event.total) onProgress?.(event.loaded / event.total); } });
export const uploadPicture = (file: File, onProgress?: Progress, signal?: AbortSignal) => {
    const form = new FormData();
    form.append('file', file);
    return data(apiClient.post<ChatAttachment>(`${base}/attachments/pictures`, form, { signal, timeout: 0, ...progressOf(onProgress) }));
};
/** The video is the request body, streamed to storage; MP4 or WebM. */
export const uploadVideo = (file: File, onProgress?: Progress, signal?: AbortSignal) =>
    data(apiClient.post<ChatAttachment>(`${base}/attachments/videos`, file, { params: { name: file.name }, headers: { 'Content-Type': file.type }, signal, timeout: 0, ...progressOf(onProgress) }));
/** Any other file, the request body itself; its name's extension says what it is. */
export const uploadFile = (file: File, onProgress?: Progress, signal?: AbortSignal) =>
    data(apiClient.post<ChatAttachment>(`${base}/attachments/files`, file, { params: { name: file.name }, headers: { 'Content-Type': 'application/octet-stream' }, signal, timeout: 0, ...progressOf(onProgress) }));
/** Takes back an upload that was not sent. */
export const cancelUpload = (id: number) => apiClient.delete(`${base}/attachments/${id}`).then(() => undefined);
/** A fresh ten-minute link to play a video. */
export const playLink = (id: number) => data(apiClient.get<{ url: string; expiresAt: string }>(`${base}/attachments/${id}/play`));
