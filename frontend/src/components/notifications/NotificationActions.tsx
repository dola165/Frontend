import { AssistantSuggestionActions } from '../../features/clubOperations/people/AssistantSuggestionActions';
import { StaffChildrenYesActions } from '../../features/clubOperations/people/StaffChildrenYesActions';
import { HandoverNoticeActions } from '../../features/clubOperations/leaving/HandoverNoticeActions';
import { JourneyReminderActions } from '../../features/mapPlanning/JourneyReminderActions';
import { FamilyLinkRequestActions } from '../../features/parents/FamilyLinkRequestActions';
import { TeenTrialActions } from '../../features/clubWorkspace/players/TeenTrialActions';
import { NotTheirParentAction } from '../../features/parents/NotTheirParentAction';
import { ParentAskActions } from '../../features/parents/ParentAskActions';
import { SquadJoinNoticeActions } from '../../features/squadCommunication/SquadJoinNoticeActions';
import type { NotificationItem } from '../../types/notifications';

/** Decisions made right in a notification: each renders only for its own notification type. */
export function NotificationActions({ notification }: { notification: NotificationItem }) {
    return <>
        <JourneyReminderActions notification={notification} />
        <SquadJoinNoticeActions notification={notification} />
        <FamilyLinkRequestActions notification={notification} />
        <NotTheirParentAction notification={notification} />
        <ParentAskActions notification={notification} />
        <TeenTrialActions notification={notification} />
        <AssistantSuggestionActions notification={notification} />
        <StaffChildrenYesActions notification={notification} />
        <HandoverNoticeActions notification={notification} />
    </>;
}
