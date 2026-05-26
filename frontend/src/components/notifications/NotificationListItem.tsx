import { Fragment } from 'react';
import {
    ArrowRight,
    BellRing,
    ClipboardCheck,
    ShieldAlert,
    ShieldCheck,
    UserPlus,
    UsersRound
} from 'lucide-react';
import type { NotificationItem } from '../../types/notifications';
import {
    formatNotificationTime,
    notificationActionLabel,
    notificationScopeLabel,
    notificationTypeLabel
} from '../../utils/notifications';

interface NotificationListItemProps {
    notification: NotificationItem;
    compact?: boolean;
    busy?: boolean;
    showScope?: boolean;
    onOpen: (notification: NotificationItem) => void | Promise<void>;
}

const iconByType: Record<string, typeof BellRing> = {
    CLUB_CHALLENGE_RECEIVED: ShieldAlert,
    TRYOUT_APPLICATION_RECEIVED: ClipboardCheck,
    TRYOUT_APPLICATION_SHORTLISTED: ClipboardCheck,
    TRYOUT_APPLICATION_ACCEPTED: ShieldCheck,
    TRYOUT_APPLICATION_REJECTED: ShieldAlert,
    CLUB_INVITATION_RECEIVED: UserPlus,
    CLUB_ROLE_CHANGED: ShieldCheck,
    SQUAD_ASSIGNMENT: UsersRound
};

export const NotificationListItem = ({
    notification,
    compact = false,
    busy = false,
    showScope = true,
    onOpen
}: NotificationListItemProps) => {
    const Icon = iconByType[notification.type] ?? BellRing;
    const actionLabel = notificationActionLabel(notification);
    const metaItems = [
        showScope ? notificationScopeLabel(notification.scope) : null,
        notification.clubName || null,
        notificationTypeLabel(notification.type)
    ].filter((value): value is string => Boolean(value));

    return (
        <button
            type="button"
            onClick={() => void onOpen(notification)}
            disabled={busy}
            className={`group relative grid w-full gap-3 text-left transition-colors ${
                compact ? 'px-4 py-3' : 'px-5 py-4'
            } ${busy ? 'cursor-wait opacity-70' : 'cursor-pointer'} ${notification.isRead ? 'hover:bg-base' : 'bg-accent-primary-soft hover:bg-base'}`}
        >
            {!notification.isRead && (
                <span className="absolute inset-y-0 left-0 w-px bg-[color:var(--accent-muted)]" aria-hidden="true" />
            )}

            <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex shrink-0 items-center justify-center border ${notification.isRead ? 'border-subtle bg-base text-secondary' : 'border-accent-primary bg-accent-primary-soft accent-primary'} ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}>
                    <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                {!notification.isRead && <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent-primary)]" />}
                                <p className={`truncate text-sm uppercase tracking-[0.08em] text-primary ${notification.isRead ? 'font-bold' : 'font-black'}`}>
                                    {notification.title}
                                </p>
                            </div>
                            <p className={`mt-1 text-sm leading-6 text-secondary ${compact ? 'max-w-[26rem]' : ''}`}>
                                {notification.body}
                            </p>
                        </div>

                        <span className="shrink-0 whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-secondary">
                            {formatNotificationTime(notification.createdAt)}
                        </span>
                    </div>

                    <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.16em] text-secondary">
                            {metaItems.map((item, index) => (
                                <Fragment key={`${notification.id}-${item}-${index}`}>
                                    {index > 0 && <span className="h-1 w-1 rounded-full bg-[color:var(--accent-muted)]" />}
                                    <span>{item}</span>
                                </Fragment>
                            ))}
                        </div>

                        {actionLabel && (
                            <span className="inline-flex items-center gap-1.5 self-start text-[11px] font-black uppercase tracking-[0.16em] accent-primary">
                                {actionLabel}
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
};
