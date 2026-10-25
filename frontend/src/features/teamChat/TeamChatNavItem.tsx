import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { subscribeNotificationsChanged } from '../../utils/notifications';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchUnread } from './api';

/**
 * Team work's side bar entry for the team chats, with how many messages wait for you in all of them (bright, like Ideas). Asking
 * does not count as having a chat open, so nobody misses the "away" notification because of the badge.
 */
export function TeamChatNavItem() {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [unread, setUnread] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        const load = () => { fetchUnread(controller.signal).then(state => setUnread(state.unreadCount)).catch(() => undefined); };
        load();
        const timer = window.setInterval(load, 60_000);
        const stop = subscribeNotificationsChanged(load);
        return () => { controller.abort(); window.clearInterval(timer); stop(); };
    }, []);
    return <li data-place="chat">
        <button type="button" title={copy('Team chats', 'გუნდის ჩატები')} onClick={() => navigate('/team-work/chat')}>
            <MessagesSquare aria-hidden="true" /><span className="tw-side__label">{copy('Chats', 'ჩატები')}</span>
            {unread > 0 && <span className="gk-count" title={copy('Unread', 'წაუკითხავი')}>{unread > 99 ? '99+' : unread}</span>}
        </button>
    </li>;
}
