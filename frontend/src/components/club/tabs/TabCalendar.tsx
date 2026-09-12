import { ClubActivityList } from './ClubActivityList';

export const TabCalendar = (props: { clubId: number; isOwnClubAdmin: boolean }) => <ClubActivityList key={props.clubId} {...props} view="schedule" />;
