import { Archive, AtSign, Plus, Trash2 } from 'lucide-react';
import { Button, Skeleton } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { ChatHome, ChatStatus, ChatSummary } from './api';
import { shortDay, statusWord } from './teamChatWords';

/** The status as a dot and a word: one quiet mark per row; Decided is the bright one. */
export function StatusMark({ status, compact = false }: { status: ChatStatus; compact?: boolean }) {
    const copy = useJourneyCopy();
    return <span className="tc-status" data-status={status}><span className="tc-status__dot" aria-hidden="true" />{!compact && statusWord(copy, status)}</span>;
}

/** One chat on one line: its name, its task key, its status, what waits for you, and when it last moved. */
function ChatRow({ chat, current, onOpen }: { chat: ChatSummary; current: boolean; onOpen: (id: number) => void }) {
    const copy = useJourneyCopy();
    const unread = chat.unreadCount > 0;
    return <li className="tc-chatrow" data-current={current || undefined} data-unread={unread || undefined}>
        <button type="button" onClick={() => onOpen(chat.id)} aria-current={current ? 'true' : undefined}
            aria-label={`${chat.name}${chat.task ? `, ${chat.task.key}` : ''}, ${statusWord(copy, chat.status)}${unread ? `, ${copy(`${chat.unreadCount} unread`, `${chat.unreadCount} წაუკითხავი`)}` : ''}`}>
            <span className="tc-chatrow__top">
                {chat.task && <span className="tc-chatrow__key gk-num">{chat.task.key}</span>}
                <span className="tc-chatrow__name">{chat.name}</span>
                <time className="tc-chatrow__when gk-num" dateTime={chat.lastActivityAt}>{shortDay(copy, chat.lastActivityAt)}</time>
            </span>
            <span className="tc-chatrow__bottom">
                <StatusMark status={chat.status} />
                <span className="tc-chatrow__line">{chat.lastLine ?? copy('No messages yet', 'ჯერ არაფერი')}</span>
                {chat.unreadMentions > 0 && <span className="tc-chatrow__mention" title={copy('You are mentioned', 'მოგიხსენიეს')}><AtSign aria-hidden="true" /></span>}
                {unread && <span className="gk-count" aria-hidden="true">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>}
            </span>
        </button>
    </li>;
}

/**
 * The left column: the chats (unread first, then the latest activity), a way to start one, and at the bottom the
 * doors to Recently deleted and the Kept files shelf, each with its count.
 */
export function ChatList({ home, loading, currentId, view, onOpen, onStart, onView }: {
    home: ChatHome | null; loading: boolean; currentId: number | null; view: 'deleted' | 'kept' | null;
    onOpen: (id: number) => void; onStart: () => void; onView: (view: 'deleted' | 'kept') => void;
}) {
    const copy = useJourneyCopy();
    return <nav className="tc-chats" aria-label={copy('Chats', 'ჩატები')}>
        <div className="tc-chats__head">
            <h2 className="tc-chats__title">{copy('Chats', 'ჩატები')}</h2>
            <Button size="sm" variant="primary" onClick={onStart}><Plus aria-hidden="true" />{copy('Start a chat', 'ახალი ჩატი')}</Button>
        </div>
        {loading && !home && <div className="tc-chats__loading" role="status" aria-label={copy('Loading', 'იტვირთება')}><Skeleton height={52} /><Skeleton height={52} /><Skeleton height={52} /></div>}
        {home && !home.chats.length && <p className="tc-chats__empty">{copy('No chats yet. Start one about a task, or a general topic.', 'ჩატები ჯერ არ არის. დაიწყეთ საქმეზე ან ზოგად თემაზე.')}</p>}
        {home && home.chats.length > 0 && <ul className="tc-chats__list">
            {home.chats.map(chat => <ChatRow key={chat.id} chat={chat} current={chat.id === currentId && view === null} onOpen={onOpen} />)}
        </ul>}
        {home && (home.deleted.length > 0 || home.keptFiles > 0) && <ul className="tc-chats__doors">
            {home.deleted.length > 0 && <li><button type="button" aria-current={view === 'deleted' ? 'true' : undefined} onClick={() => onView('deleted')}>
                <Trash2 aria-hidden="true" /><span>{copy('Recently deleted', 'ბოლოს წაშლილი')}</span><span className="tc-faint gk-num">{home.deleted.length}</span></button></li>}
            {home.keptFiles > 0 && <li><button type="button" aria-current={view === 'kept' ? 'true' : undefined} onClick={() => onView('kept')}>
                <Archive aria-hidden="true" /><span>{copy('Kept files', 'შენახული ფაილები')}</span><span className="tc-faint gk-num">{home.keptFiles}</span></button></li>}
        </ul>}
    </nav>;
}
