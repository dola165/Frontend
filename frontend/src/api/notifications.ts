import { apiClient, type AuthSessionRequestConfig } from './axiosConfig';
import type {
    NotificationBulkReadResult,
    NotificationQueryOptions,
    NotificationPageResult,
    NotificationReadState,
    NotificationUnreadCount
} from '../types/notifications';

const buildNotificationParams = (options: NotificationQueryOptions = {}) => {
    const resolvedScope = options.clubId != null && (!options.scope || options.scope === 'all')
        ? 'club'
        : options.scope;

    return {
        ...(options.page != null ? { page: options.page } : {}),
        ...(options.size != null ? { size: options.size } : {}),
        ...(resolvedScope && resolvedScope !== 'all' ? { scope: resolvedScope } : {}),
        ...(options.clubId != null ? { clubId: options.clubId } : {})
    };
};

export const fetchNotifications = async (options: NotificationQueryOptions = {}, config?: AuthSessionRequestConfig): Promise<NotificationPageResult> => {
    const response = await apiClient.get<NotificationPageResult>('/notifications', {
        ...config,
        params: buildNotificationParams(options)
    });
    return response.data;
};

export const fetchUnreadNotificationCount = async (options: NotificationQueryOptions = {}, config?: AuthSessionRequestConfig): Promise<NotificationUnreadCount> => {
    const response = await apiClient.get<NotificationUnreadCount>('/notifications/unread-count', {
        ...config,
        params: buildNotificationParams(options)
    });
    return response.data;
};

export const markNotificationAsRead = async (notificationId: number): Promise<NotificationReadState> => {
    const response = await apiClient.patch<NotificationReadState>(`/notifications/${notificationId}/read`);
    return response.data;
};

export const markAllNotificationsAsRead = async (options: NotificationQueryOptions = {}): Promise<NotificationBulkReadResult> => {
    const response = await apiClient.patch<NotificationBulkReadResult>('/notifications/read-all', null, {
        params: buildNotificationParams(options)
    });
    return response.data;
};
