/**
 * The planner's shared shapes. Team work (our team's tasks) and a club's projects keep the same people, comments
 * and files, so both pages show them with the same parts in this folder.
 */
export interface Person { id: number | null; name: string | null }

/** A picture, a video or any other file; `name` is the file's own name (files only); `title` and `tags` what people named and tagged it. */
export interface WorkMedia {
    id: number; kind: 'IMAGE' | 'VIDEO' | 'FILE'; url: string; contentType: string; sizeBytes: number; uploadedBy: Person | null; createdAt: string; canDelete: boolean;
    name?: string | null; title?: string | null; tags?: string[]; labelledBy?: Person | null; labelledAt?: string | null;
}
export interface WorkComment { id: number; author: Person | null; body: string; createdAt: string; editedAt: string | null; canEdit: boolean; byDola?: boolean }
export interface CommentActions { add: (body: string) => Promise<WorkComment[]>; edit: (id: number, body: string) => Promise<WorkComment[]>; remove: (id: number) => Promise<WorkComment[]> }

/** What the server keeps besides pictures: MP4 or WebM videos and these files, by extension. */
export const VIDEO_LIMIT_MB = 90;
export const VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const FILE_LIMIT_MB = 25;
export const FILE_EXTENSIONS = ['pdf', 'txt', 'md', 'csv', 'log', 'json', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
