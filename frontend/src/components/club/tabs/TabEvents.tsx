import { ClubActivityList } from './ClubActivityList';

export const TabEvents = (props: { clubId: number; isOwnClubAdmin: boolean }) => <ClubActivityList key={props.clubId} {...props} view="events" />;
