import { useContext, useState } from 'react';
import { CircleDot, ClipboardCopy, Eye, Hash, Link2, MessagesSquare, Octagon, Pin, PinOff, SquareArrowOutUpRight, Timer } from 'lucide-react';
import { useContextMenu, type ContextMenuItems } from '../../components/useContextMenu';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { useDiscuss } from '../teamChat/useDiscuss';
import { CHAT_PRIVATE } from '../teamChat/teamChatWords';
import { changeWork, type WorkItem, type WorkStatus } from './api';
import { statusName } from './teamWorkWords';
import { TaskMenuContext } from './taskMenuContext';

/** The statuses a task's menu moves it to; accepting, going live and cancelling stay in the task (they ask more). */
const MOVES: [WorkStatus, typeof CircleDot][] = [['PLANNED', CircleDot], ['IN_PROGRESS', Timer], ['NEEDS_LOOK', Eye], ['BLOCKED', Octagon]];

/** "/team-work?task=12" (a step: its task and the step), as the browser opens it. */
export const taskLink = (item: Pick<WorkItem, 'id' | 'parentId'>) =>
    `${window.location.origin}/team-work?task=${item.parentId ?? item.id}${item.parentId ? `&step=${item.id}` : ''}`;

/**
 * A task's right-click menu (rows and cards): open it, discuss it, move its status, copy its key or link, pin it to
 * your Overview. Everything here is also in the task itself; the menu is the shortcut. Gives the element's handlers,
 * the menu, and a short notice when something did not work.
 */
export function useTaskMenu(item: WorkItem, onOpen: () => void) {
    const copy = useJourneyCopy();
    const { pins, onChanged } = useContext(TaskMenuContext);
    const discuss = useDiscuss();
    const [notice, setNotice] = useState('');
    const say = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(current => current === text ? '' : current), 2500); };
    const write = (text: string, done: string) => void navigator.clipboard?.writeText(text).then(() => say(done)).catch(() => setNotice(copy('Copying did not work here.', 'კოპირება აქ ვერ მოხერხდა.')));
    const move = async (status: WorkStatus) => {
        setNotice('');
        try { await changeWork(item.id, { version: item.version, status }); onChanged?.(); say(copy(`Moved to ${statusName(copy, status)}`, `გადავიდა: ${statusName(copy, status)}`)); }
        catch (failure) { setNotice(extractApiErrorMessage(failure, copy('The status was not changed.', 'სტატუსი ვერ შეიცვალა.'))); }
    };
    const pinned = pins?.pinned({ itemId: item.id }) ?? false;
    const items = (): ContextMenuItems => [
        { key: 'open', label: copy('Open', 'გახსნა'), icon: SquareArrowOutUpRight, onSelect: onOpen },
        {
            key: 'discuss', label: item.chatId ? copy('Open its chat', 'მისი ჩატის გახსნა') : copy('Discuss in a chat', 'ჩატში განხილვა'), icon: MessagesSquare,
            disabled: !!item.chatPrivate, reason: item.chatPrivate ? copy(...CHAT_PRIVATE) : undefined,
            onSelect: () => void discuss(item).catch(failure => setNotice(extractApiErrorMessage(failure, copy('The chat could not open.', 'ჩატი ვერ გაიხსნა.')))),
        },
        ...MOVES.map(([status, icon], index) => ({
            key: `status-${status}`, label: copy(`Move to ${statusName(copy, status)}`, `გადატანა: ${statusName(copy, status)}`), icon, separated: index === 0,
            disabled: item.status === status, reason: item.status === status ? copy('It is there now.', 'ახლა აქაა.') : undefined, onSelect: () => void move(status),
        })),
        { key: 'key', label: copy(`Copy ${item.key}`, `${item.key}-ის კოპირება`), icon: Hash, separated: true, onSelect: () => write(item.key, copy('Key copied', 'კოდი დაკოპირდა')) },
        { key: 'link', label: copy('Copy link', 'ბმულის კოპირება'), icon: Link2, onSelect: () => write(taskLink(item), copy('Link copied', 'ბმული დაკოპირდა')) },
        { key: 'title', label: copy('Copy key and name', 'კოდის და სახელის კოპირება'), icon: ClipboardCopy, onSelect: () => write(`${item.key} ${item.title}`, copy('Copied', 'დაკოპირდა')) },
        {
            key: 'pin', label: pinned ? copy('Unpin from your Overview', 'მოხსნა მიმოხილვიდან') : copy('Pin to your Overview', 'მიმაგრება მიმოხილვაზე'), icon: pinned ? PinOff : Pin,
            separated: true, disabled: !pins || (!pinned && pins.full),
            reason: !pins ? copy('Pins are on Team work’s Overview.', 'მიმაგრებები გუნდის სამუშაოს მიმოხილვაზეა.') : !pinned && pins.full ? copy('You have the most pins already.', 'მიმაგრებების ლიმიტი შევსებულია.') : undefined,
            onSelect: () => void pins?.toggle({ itemId: item.id }),
        },
    ];
    const menu = useContextMenu(items, { label: `${item.key} ${item.title}` });
    return { bind: menu.bind, menu: menu.menu, notice, dismiss: () => setNotice('') };
}
