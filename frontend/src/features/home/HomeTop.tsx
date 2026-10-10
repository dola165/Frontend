import './home-top.css';
import { GkRoot } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { HomeAnnouncements } from '../announcements/HomeAnnouncements';
import { useHomeAnnouncements } from '../announcements/useHomeAnnouncements';
import { ThisWeek } from './ThisWeek';

/**
 * Above the feed, which itself is unchanged: this week and pinned announcements. Announcements from
 * someone else come first, because they are news for me; my own (with read receipts) follow the week.
 */
export function HomeTop() {
    const { user } = useAuth();
    const pinned = useHomeAnnouncements();
    const forMe = pinned.items.some(item => item.message.author_id !== user?.id);
    const announcements = <HomeAnnouncements pinned={pinned} />;
    return (
        <GkRoot className="gk-home-top">
            {forMe && announcements}
            <ThisWeek />
            {!forMe && announcements}
        </GkRoot>
    );
}
