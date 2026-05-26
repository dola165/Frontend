export type NotificationScope = 'PERSONAL' | 'CLUB';

export type NotificationListScope = 'all' | 'personal' | 'club';

export interface NotificationItem {
    id: number;
    type: string;
    scope: NotificationScope;
    clubId?: number | null;
    clubName?: string | null;
    entityType?: string | null;
    entityId?: number | null;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string;
    linkPath?: string | null;
}

export interface NotificationQueryOptions {
    page?: number;
    size?: number;
    scope?: NotificationListScope;
    clubId?: number | null;
}

export interface NotificationPageResult {
    content: NotificationItem[];
    pageNumber: number;
    pageSize: number;
    totalElements: number;
}

export interface NotificationUnreadCount {
    unreadCount: number;
}

export interface NotificationReadState {
    id: number;
    isRead: boolean;
}

export interface NotificationBulkReadResult {
    count: number;
}
