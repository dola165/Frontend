import { JourneyReminderActions } from '../../features/mapPlanning/JourneyReminderActions';
import { FamilyLinkRequestActions } from '../../features/parents/FamilyLinkRequestActions';
import { SquadJoinNoticeActions } from '../../features/squadCommunication/SquadJoinNoticeActions';
import type { NotificationItem } from '../../types/notifications';

/** Decisions made right in a notification: each renders only for its own notification type. */
export function NotificationActions({ notification }: { notification: NotificationItem }) {
    return <>
        <JourneyReminderActions notification={notification} />
        <SquadJoinNoticeActions notification={notification} />
        <FamilyLinkRequestActions notification={notification} />
    </>;
}
