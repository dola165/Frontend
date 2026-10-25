import { apiClient } from '../../api/axiosConfig';

/** Mirrors the backend's TeamChatDto. */
export interface ChatPerson { id: number; name: string | null; avatarUrl: string | null }
export interface ChatLimits { pictureMb: number; videoMb: number; fileMb: number; videoTypes: string[]; fileExtensions: string[]; maxLength: number; maxAttachments: number; maxDecision: number }
/** Talking (the default), Decided (with its one line), or On hold. */
export type ChatStatus = 'TALKING' | 'DECIDED' | 'ON_HOLD';
/** A Team work task named in the text ("GK-12"), or the task a chat is about. */
export interface ChatTaskRef { id: number; key: string; title: string; status: string; parentId: number | null; doneMeans?: string | null }
/** One chat in the list: its task (if any), status and decision, what waits for you, its latest activity; `deletesAt` while it waits in Recently deleted. */
export interface ChatSummary {
    id: number; name: string; task: ChatTaskRef | null; status: ChatStatus; decision: string | null; decidedBy: ChatPerson | null; decidedAt: string | null;
    unreadCount: number; unreadMentions: number; messageCount: number; lastActivityAt: string; lastLine: string | null;
    createdBy: ChatPerson | null; createdAt: string; deletesAt: string | null; deletedBy: ChatPerson | null;
}
/** The chats opened: the team, your chats (unread first), Recently deleted, the Kept files count, the limits. */
export interface ChatHome { me: number; members: ChatPerson[]; chats: ChatSummary[]; deleted: ChatSummary[]; keptFiles: number; limits: ChatLimits; reactions: string[]; canModerate: boolean }
/** One chat opened: itself, where your unread messages start, the newest revision, the upload limits. */
export interface ChatState { chat: ChatSummary; me: number; members: ChatPerson[]; firstUnreadId: number | null; unreadCount: number; revision: number; limits: ChatLimits; reactions: string[]; canModerate: boolean }
export interface ChatQuote { id: number; senderId: number | null; senderName: string | null; excerpt: string | null; deleted: boolean; attachments: number }
export interface ChatReaction { emoji: string; userIds: number[] }
export type AttachmentKind = 'IMAGE' | 'VIDEO' | 'FILE';
export interface ChatAttachment {
    id: number; kind: AttachmentKind; name: string; contentType: string; sizeBytes: number; url: string;
    thumbUrl: string | null; width: number | null; height: number | null; playUrl: string | null; kept: boolean;
}
export interface ChatMessage {
    id: number; senderId: number | null; senderName: string | null; content: string; createdAt: string; editedAt: string | null;
    deleted: boolean; replyTo: ChatQuote | null; attachments: ChatAttachment[]; reactions: ChatReaction[]; mentions: number[];
    tasks: ChatTaskRef[]; revision: number; clientMessageId: string | null;
}
export interface ChatPage { messages: ChatMessage[]; hasOlder: boolean; hasNewer: boolean; revision: number }
export interface ChatChanges { messages: ChatMessage[]; revision: number; more: boolean }
export interface ReadState { firstUnreadId: number | null; unreadCount: number }
export interface ChatUnread { unreadCount: number; unreadMentions: number; chats: { chatId: number; unreadCount: number; unreadMentions: number }[] }
export interface SharedItem { attachment: ChatAttachment; messageId: number; chatId: number; chatName: string | null; sender: ChatPerson | null; createdAt: string }
export interface Version { kind: 'EDIT' | 'DELETE'; previous: string; by: ChatPerson | null; at: string }
export interface NewMessage { content: string; clientMessageId: string; replyToId?: number | null; attachmentIds?: number[] }
export type MediaFilter = 'MEDIA' | AttachmentKind;
export interface SearchQuery { q?: string; from?: number | null; has?: MediaFilter | null; before?: number }
/** A task a chat can be started from, with the chat it already has. */
export interface TaskOption { task: ChatTaskRef; chatId: number | null }
/** A file on the Kept files shelf, from a deleted chat that had no task. */
export interface KeptFile { id: number; attachment: ChatAttachment; chatName: string | null; keptBy: ChatPerson | null; keptAt: string }

const base = '/team-chat';
const of = (chat: number) => `${base}/chats/${chat}`;
const data = <T>(request: Promise<{ data: T }>) => request.then(response => response.data);

// ── The chats ──────────────────────────────────────────────────────────────
export const fetchHome = (signal?: AbortSignal) => data(apiClient.get<ChatHome>(base, { signal }));
/** How many wait, in all and per chat, without counting as having a chat open (for badges). */
export const fetchUnread = (signal?: AbortSignal) => data(apiClient.get<ChatUnread>(`${base}/unread`, { signal }));
export const fetchTasks = (signal?: AbortSignal) => data(apiClient.get<TaskOption[]>(`${base}/tasks`, { signal }));
/** A general topic by name, or the chat of a task (opened when the task has one already). */
export const createChat = (body: { name?: string; taskId?: number | null }) => data(apiClient.post<ChatSummary>(`${base}/chats`, body));
export const fetchState = (chat: number, signal?: AbortSignal) => data(apiClient.get<ChatState>(of(chat), { signal }));
export const renameChat = (chat: number, name: string) => data(apiClient.patch<ChatSummary>(of(chat), { name }));
/** Decided takes its line, which is pinned and written to the task. */
export const setChatStatus = (chat: number, status: ChatStatus, decision?: string) => data(apiClient.put<ChatSummary>(`${of(chat)}/status`, { status, decision }));
/** Keeps the ticked files, then moves the chat to Recently deleted for seven days. */
export const deleteChat = (chat: number, attachmentIds: number[]) => data(apiClient.post<ChatSummary>(`${of(chat)}/delete`, { attachmentIds }));
export const restoreChat = (chat: number) => data(apiClient.post<ChatSummary>(`${of(chat)}/restore`));
/** Keeps files onto the task (or the Kept files shelf), so a purge never takes them. */
export const keepFiles = (chat: number, attachmentIds: number[]) => data(apiClient.post<ChatSummary>(`${of(chat)}/keep`, { attachmentIds }));
export const zipPath = (chat: number) => `${of(chat)}/files.zip`;
export const fetchKept = (signal?: AbortSignal) => data(apiClient.get<KeptFile[]>(`${base}/kept`, { signal }));
export const keptPlayLink = (id: number) => data(apiClient.get<{ url: string; expiresAt: string }>(`${base}/kept/${id}/play`));

// ── Messages ───────────────────────────────────────────────────────────────
export const fetchPage = (chat: number, where: { before?: number; after?: number; around?: number; limit?: number }, signal?: AbortSignal) =>
    data(apiClient.get<ChatPage>(`${of(chat)}/messages`, { params: where, signal }));
export const fetchChanges = (chat: number, since: number, signal?: AbortSignal) => data(apiClient.get<ChatChanges>(`${of(chat)}/changes`, { params: { since }, signal }));
export const sendMessage = (chat: number, message: NewMessage) => data(apiClient.post<ChatMessage>(`${of(chat)}/messages`, message));
export const editMessage = (chat: number, id: number, content: string) => data(apiClient.patch<ChatMessage>(`${of(chat)}/messages/${id}`, { content }));
/** Deletes your message for everyone, its files too; "Message deleted" stays in its place. */
export const deleteMessage = (chat: number, id: number) => data(apiClient.delete<ChatMessage>(`${of(chat)}/messages/${id}`));
export const react = (chat: number, id: number, emoji: string, on: boolean) => data(apiClient.put<ChatMessage>(`${of(chat)}/messages/${id}/reactions`, { emoji, on }));
export const fetchHistory = (chat: number, id: number) => data(apiClient.get<{ message: ChatMessage; versions: Version[] }>(`${of(chat)}/messages/${id}/history`));
export const markRead = (chat: number, upTo: number) => data(apiClient.post<ReadState>(`${of(chat)}/read`, { upTo }));
/** What was shared in one chat, or in every chat (no `chat`), by kind and by person. */
export const fetchShared = (where: { chat?: number | null; kind?: AttachmentKind | null; from?: number | null; before?: number }, signal?: AbortSignal) =>
    data(apiClient.get<{ items: SharedItem[]; more: boolean }>(`${base}/shared`, { params: { chat: where.chat ?? undefined, kind: where.kind ?? undefined, from: where.from ?? undefined, before: where.before, limit: 60 }, signal }));
export const searchMessages = (chat: number, { q, from, has, before }: SearchQuery, signal?: AbortSignal) =>
    data(apiClient.get<{ messages: ChatMessage[]; more: boolean }>(`${of(chat)}/search`, { params: { q: q || undefined, from: from ?? undefined, has: has ?? undefined, before }, signal }));

// ── Files ──────────────────────────────────────────────────────────────────
type Progress = (share: number) => void;
const progressOf = (onProgress?: Progress) => ({ onUploadProgress: (event: { loaded: number; total?: number }) => { if (event.total) onProgress?.(event.loaded / event.total); } });
export const uploadPicture = (chat: number, file: File, onProgress?: Progress, signal?: AbortSignal) => {
    const form = new FormData();
    form.append('file', file);
    return data(apiClient.post<ChatAttachment>(`${of(chat)}/attachments/pictures`, form, { signal, timeout: 0, ...progressOf(onProgress) }));
};
/** The video is the request body, streamed to storage; MP4 or WebM. */
export const uploadVideo = (chat: number, file: File, onProgress?: Progress, signal?: AbortSignal) =>
    data(apiClient.post<ChatAttachment>(`${of(chat)}/attachments/videos`, file, { params: { name: file.name }, headers: { 'Content-Type': file.type }, signal, timeout: 0, ...progressOf(onProgress) }));
/** Any other file, the request body itself; its name's extension says what it is. */
export const uploadFile = (chat: number, file: File, onProgress?: Progress, signal?: AbortSignal) =>
    data(apiClient.post<ChatAttachment>(`${of(chat)}/attachments/files`, file, { params: { name: file.name }, headers: { 'Content-Type': 'application/octet-stream' }, signal, timeout: 0, ...progressOf(onProgress) }));
/** Takes back an upload that was not sent. */
export const cancelUpload = (id: number) => apiClient.delete(`${base}/attachments/${id}`).then(() => undefined);
/** A fresh ten-minute link to play a video. */
export const playLink = (id: number) => data(apiClient.get<{ url: string; expiresAt: string }>(`${base}/attachments/${id}/play`));
