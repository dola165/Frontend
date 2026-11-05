import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Images, MessagesSquare, Plus } from 'lucide-react';
import { useContextMenu } from '../../components/useContextMenu';
import { subscribeNotificationsChanged } from '../../utils/notifications';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { fetchUnread } from './api';

/**
 * Team work's side bar entry for the team chats, with how many messages wait for you in all of them (bright, like Ideas). Asking
 * does not count as having a chat open, so nobody misses the "away" notification because of the badge. Right-click (or hold)
 * it to start a chat, one about a task, or to open Media.
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
    const menu = useContextMenu(() => [
        { key: 'open', label: copy('Open the chats', 'ჩატების გახსნა'), icon: MessagesSquare, onSelect: () => navigate('/team-work/chat') },
        { key: 'start', label: copy('Start a chat', 'ახალი ჩატი'), icon: Plus, separated: true, onSelect: () => navigate('/team-work/chat?start=topic') },
        { key: 'task', label: copy('Start a chat about a task', 'ჩატი საქმეზე'), icon: ClipboardList, onSelect: () => navigate('/team-work/chat?start=task') },
        { key: 'media', label: copy('Media', 'მედია'), icon: Images, separated: true, onSelect: () => navigate('/team-work/chat?view=media') },
    ], { label: copy('Chats', 'ჩატები') });
    return <li data-place="chat">
        <button type="button" className="gk-cm-target" title={copy('Team chats', 'გუნდის ჩატები')} onClick={() => navigate('/team-work/chat')} {...menu.bind}>
            <MessagesSquare aria-hidden="true" /><span className="tw-side__label">{copy('Chats', 'ჩატები')}</span>
            {unread > 0 && <span className="gk-count" title={copy('Unread', 'წაუკითხავი')}>{unread > 99 ? '99+' : unread}</span>}
        </button>
        {menu.menu}
    </li>;
}
