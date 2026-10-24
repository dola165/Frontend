import { apiClient } from './axiosConfig';

/** The groups a person chooses channels for; TEAM_WORK is listed only for team members. */
export type NotificationGroupKey = 'TEAM_WORK' | 'MESSAGES' | 'CLUB' | 'FAMILY' | 'MATCHES' | 'OTHER';
export type DeliveryMode = 'OFF' | 'DRY_RUN' | 'LIVE';
export type NotificationLanguage = 'en' | 'ka';

export interface NotificationGroupChoice { key: NotificationGroupKey; push: boolean; email: boolean }
export interface NotificationDevice { id: number; device: string | null; createdAt: string | null; lastUsedAt: string | null }

export interface NotificationPreferences {
    mode: DeliveryMode;
    pushConfigured: boolean;
    pushPublicKey: string | null;
    email: string | null;
    emailVerified: boolean;
    emailUnsubscribed: boolean;
    language: NotificationLanguage;
    timeZone: string;
    /** HH:mm in the person's time zone, or null when there are no quiet hours. */
    quietFrom: string | null;
    quietUntil: string | null;
    /** HH:mm; when the daily email summary goes out. */
    digestTime: string;
    groups: NotificationGroupChoice[];
    devices: NotificationDevice[];
}

export interface NotificationPreferencesUpdate {
    language?: NotificationLanguage;
    timeZone?: string;
    quietFrom?: string | null;
    quietUntil?: string | null;
    digestTime?: string;
    groups?: NotificationGroupChoice[];
    emailUnsubscribed?: boolean;
}

export interface PushSubscriptionPayload {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    device?: string | null;
    language?: NotificationLanguage;
}

export interface NotificationTestResult { mode: DeliveryMode; pushDevices: number; email: boolean }

export const fetchNotificationPreferences = async (signal?: AbortSignal) =>
    (await apiClient.get<NotificationPreferences>('/notifications/preferences', { signal })).data;

export const saveNotificationPreferences = async (update: NotificationPreferencesUpdate) =>
    (await apiClient.put<NotificationPreferences>('/notifications/preferences', update)).data;

/** One group's switches, for the one-tap prompt; everything else stays as it was. */
export const setNotificationGroup = async (key: NotificationGroupKey, change: { push?: boolean; email?: boolean; language?: NotificationLanguage }) =>
    (await apiClient.patch<NotificationPreferences>(`/notifications/preferences/groups/${key}`, change)).data;

export const registerPushSubscription = async (payload: PushSubscriptionPayload) =>
    (await apiClient.post<NotificationPreferences>('/notifications/push-subscriptions', payload)).data;

export const forgetPushSubscription = async (endpoint: string) =>
    (await apiClient.post<NotificationPreferences>('/notifications/push-subscriptions/remove', { endpoint })).data;

export const removePushDevice = async (id: number) =>
    (await apiClient.delete<NotificationPreferences>(`/notifications/push-subscriptions/${id}`)).data;

export const sendTestNotification = async (language: NotificationLanguage) =>
    (await apiClient.post<NotificationTestResult>('/notifications/test', null, { params: { language } })).data;
