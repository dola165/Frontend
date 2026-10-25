import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, PanelRight, Search, WifiOff } from 'lucide-react';
import { Button, EmptyNote, GkRoot } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { RouteRecoveryPage } from '../../pages/RouteRecoveryPage';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { TeamSearch } from '../search/TeamSearch';
import type { AttachmentKind, ChatSummary, MediaFilter } from './api';
import { ChatList, StatusMark } from './ChatList';
import { ChatPanel } from './ChatPanel';
import { PHONE, useMatches } from './layout';
import type { MediaFilters } from './PanelMedia';
import { SearchPanel, type SearchState } from './SearchPanel';
import { DeletedView, KeptView } from './ShelfViews';
import { StartChatDialog } from './StartChatDialog';
import { TeamChat } from './TeamChat';
import { useChats, type Chats } from './useChats';
import { useTeamChat, type TeamChatModel } from './useTeamChat';
import './team-chat.css';
import './team-chat-parts.css';
import './team-chat-columns.css';
import './team-chat-panel.css';

const KINDS: AttachmentKind[] = ['IMAGE', 'VIDEO', 'FILE'];
const FILTERS: MediaFilter[] = ['MEDIA', ...KINDS];
const VIEWS = ['deleted', 'kept'] as const;
type View = typeof VIEWS[number];
type Changes = Record<string, string | null>;
/** What leaving a chat clears: its message, search and panel. */
const LEAVE_CHAT: Changes = { message: null, panel: null, find: null, q: null, from: null, has: null };

/** Reconnecting, said quietly; sending keeps waiting in the outbox meanwhile. */
function Connection({ model }: { model: TeamChatModel }) {
    const copy = useJourneyCopy();
    if (model.status !== 'ready' || model.connected) return null;
    return <span className="tc-offline" role="status"><WifiOff aria-hidden="true" />{copy('Reconnecting…', 'კავშირი აღდგება…')}</span>;
}

/**
 * Team chats (/team-work/chat): Team work accounts only, for anyone else they do not exist. Three columns on a wide
 * screen: the chats, the open conversation, and its panel (people, task, status, media, settings); one column at a
 * time on a phone. The address says what is open: ?chat=, ?message= (a mention, a search result), ?view=deleted|kept,
 * ?panel=1 (narrower screens), ?find=1&q=&from=&has= (search) and ?mall=&mkind=&mfrom= (the panel's media).
 */
export function TeamChatPage() {
    const { sessionId } = useAuth();
    return <TeamChatScreen key={sessionId} />;
}

function TeamChatScreen() {
    const copy = useJourneyCopy();
    const [params, setParams] = useSearchParams();
    const chats = useChats();
    const { home } = chats;
    const phone = useMatches(PHONE);
    const [starting, setStarting] = useState(false);
    const set = useCallback((changes: Changes, push = false) => setParams(current => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) { if (value === null) next.delete(key); else next.set(key, value); }
        return next;
    }, { replace: !push }), [setParams]);
    const chatId = Number(params.get('chat')) || null;
    const message = Number(params.get('message')) || null;
    const view: View | null = VIEWS.find(value => value === params.get('view')) ?? null;

    // A chat opens by itself for an old link (?message= alone, from when the team had one chat: the oldest one), and on
    // a wide screen the first in the list. On a phone the list comes first.
    useEffect(() => {
        if (!home || chatId || view) return;
        const all = [...home.chats, ...home.deleted];
        if (message && all.length) set({ chat: String(Math.min(...all.map(chat => chat.id))) });
        else if (!phone && home.chats.length) set({ chat: String(home.chats[0].id) });
    }, [home, chatId, view, message, phone, set]);

    const open = useCallback((id: number) => set({ ...LEAVE_CHAT, chat: String(id), view: null }, true), [set]);
    const showView = (next: View) => set({ ...LEAVE_CHAT, chat: null, view: next }, true);
    const toList = () => set({ ...LEAVE_CHAT, chat: null, view: null });

    if (chats.status === 'missing') return <RouteRecoveryPage />;
    const panel = params.get('panel') === '1';
    const show = !phone ? 'all' : view || (chatId && !panel) ? 'main' : chatId ? 'panel' : 'list';
    return <GkRoot className="tc-root">
        <div className="tc-columns" data-show={show} data-panel={panel || undefined} data-view={view || undefined}>
            <aside className="tc-col tc-col--list" aria-label={copy('Team chats', 'გუნდის ჩატები')}>
                <div className="tc-listhead">
                    <Link to="/team-work" className="tc-back"><ArrowLeft aria-hidden="true" /><span>{copy('Team work', 'გუნდის სამუშაო')}</span></Link>
                    <h1 className="tc-title">{copy('Team chats', 'გუნდის ჩატები')}</h1>
                    <TeamSearch />
                </div>
                {chats.status === 'error' && !home && <div className="gk-notice gk-notice--danger" role="alert"><span>{copy('The chats could not load.', 'ჩატები ვერ ჩაიტვირთა.')}</span>
                    <Button size="sm" onClick={() => void chats.refresh()}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
                <ChatList home={home} loading={chats.status === 'loading'} currentId={chatId} view={view} onOpen={open} onStart={() => setStarting(true)} onView={showView} />
            </aside>
            {view === 'deleted' ? <DeletedView chats={home?.deleted ?? []} onOpen={open} onChat={chat => { chats.put(chat); if (!chat.deletesAt) open(chat.id); }} onBack={toList} />
                : view === 'kept' ? <KeptView onBack={toList} />
                    : chatId ? <ChatScreen key={chatId} chatId={chatId} chats={chats} params={params} set={set} onBack={toList} />
                        : <section className="tc-col tc-col--main tc-col--empty">
                            {home && !home.chats.length && <EmptyNote title={copy('No chats yet', 'ჩატები ჯერ არ არის')}
                                action={<Button variant="primary" onClick={() => setStarting(true)}>{copy('Start a chat', 'ახალი ჩატი')}</Button>}>
                                {copy('Talk about one task, or a general topic. Everyone on the team is in every chat.', 'ისაუბრეთ ერთ საქმეზე ან ზოგად თემაზე. გუნდის ყველა წევრი ყველა ჩატშია.')}
                            </EmptyNote>}
                        </section>}
        </div>
        {starting && <StartChatDialog onClose={() => setStarting(false)} onCreated={chat => { setStarting(false); chats.put(chat); open(chat.id); }} />}
    </GkRoot>;
}

/** The open chat's header: its name and task key, its status, the connection, search, and (narrower screens) the panel. */
function ChatHeader({ chat, model, searching, panel, onBack, onSearch, onPanel }: {
    chat: ChatSummary | null; model: TeamChatModel; searching: boolean; panel: boolean; onBack: () => void; onSearch: () => void; onPanel: () => void;
}) {
    const copy = useJourneyCopy();
    return <header className="tc-chathead">
        <button type="button" className="tc-back tc-chathead__back" onClick={onBack} aria-label={copy('Back to the chats', 'ჩატებზე დაბრუნება')}><ArrowLeft aria-hidden="true" /></button>
        <div className="tc-chathead__about">
            <h2 className="tc-chathead__name">{chat?.task && <span className="tc-chatrow__key gk-num">{chat.task.key}</span>}<span>{chat?.name}</span></h2>
            {chat && <StatusMark status={chat.status} />}
        </div>
        <Connection model={model} />
        <Button variant={searching ? 'secondary' : 'ghost'} iconOnly aria-pressed={searching} aria-label={copy('Search this chat', 'ამ ჩატში ძიება')} title={copy('Search this chat', 'ამ ჩატში ძიება')} onClick={onSearch}><Search aria-hidden="true" /></Button>
        <Button variant={panel ? 'secondary' : 'ghost'} iconOnly className="tc-chathead__panel" aria-pressed={panel} aria-label={copy('People, task, status, media and settings', 'ხალხი, საქმე, სტატუსი, მედია და პარამეტრები')}
            title={copy('People, task, status, media and settings', 'ხალხი, საქმე, სტატუსი, მედია და პარამეტრები')} onClick={onPanel}><PanelRight aria-hidden="true" /></Button>
    </header>;
}

/**
 * One chat open: the conversation in the middle and its panel on the right. Only this chat holds a live line; the
 * list hears about its new activity a moment later.
 */
function ChatScreen({ chatId, chats, params, set, onBack }: { chatId: number; chats: Chats; params: URLSearchParams; set: (changes: Changes, push?: boolean) => void; onBack: () => void }) {
    const copy = useJourneyCopy();
    const jump = Number(params.get('message')) || null;
    const model = useTeamChat(chatId, jump);
    const { home, put, refresh } = chats;

    // A new ?message= while the chat is open (a notification, a link) goes there.
    const { jumpTo, status, putChat: putModelChat } = model;
    const opened = useRef(jump);
    useEffect(() => {
        if (status !== 'ready' || !jump || jump === opened.current) return;
        opened.current = jump;
        jumpTo(jump);
    }, [jump, status, jumpTo]);
    const showMessage = useCallback((messageId: number) => {
        opened.current = messageId;
        set({ find: null, q: null, from: null, has: null, panel: null, message: String(messageId) });
        jumpTo(messageId);
    }, [set, jumpTo]);
    const onShow = (other: number, messageId: number) => {
        if (other === chatId) showMessage(messageId);
        else set({ ...LEAVE_CHAT, chat: String(other), message: String(messageId) }, true);
    };

    // New activity here reorders the list and changes its last line: it looks again a moment later.
    const last = model.view.messages.at(-1)?.id;
    useEffect(() => {
        if (!last) return;
        const timer = window.setTimeout(() => void refresh(), 1500);
        return () => window.clearTimeout(timer);
    }, [last, refresh]);

    const putChat = useCallback((next: ChatSummary) => { putModelChat(next); put(next); }, [putModelChat, put]);
    const searching = params.has('find');
    const query: SearchState = { q: params.get('q') ?? '', from: Number(params.get('from')) || null, has: FILTERS.find(value => value === params.get('has')) ?? null };
    const onQuery = useCallback((next: SearchState) => set({ q: next.q || null, from: next.from ? String(next.from) : null, has: next.has }), [set]);
    const media: MediaFilters = { all: params.get('mall') === '1', kind: KINDS.find(value => value === params.get('mkind')) ?? null, from: Number(params.get('mfrom')) || null };
    const onMedia = useCallback((next: MediaFilters) => set({ mall: next.all ? '1' : null, mkind: next.kind, mfrom: next.from ? String(next.from) : null }), [set]);
    const gone = useCallback(() => void refresh(), [refresh]);

    if (model.status === 'missing') return <section className="tc-col tc-col--main tc-col--empty">
        <EmptyNote title={copy('This chat is gone', 'ეს ჩატი აღარ არსებობს')} action={<Button onClick={onBack}>{copy('Back to the chats', 'ჩატებზე დაბრუნება')}</Button>}>
            {copy('It was deleted for good, or you are no longer on the team.', 'ის საბოლოოდ წაიშალა, ან აღარ ხართ გუნდში.')}
        </EmptyNote>
    </section>;
    const chat = model.state?.chat ?? home?.chats.find(known => known.id === chatId) ?? home?.deleted.find(known => known.id === chatId) ?? null;
    const panel = params.get('panel') === '1';
    return <>
        <section className="tc-col tc-col--main" aria-label={chat?.name ?? copy('Chat', 'ჩატი')}>
            <ChatHeader chat={chat} model={model} searching={searching} panel={panel} onBack={onBack}
                onSearch={() => set(searching ? { find: null, q: null, from: null, has: null } : { find: '1' })} onPanel={() => set({ panel: panel ? null : '1' })} />
            {model.status === 'error' && <div className="gk-notice gk-notice--danger" role="alert"><span>{copy('This chat could not load.', 'ეს ჩატი ვერ ჩაიტვირთა.')}</span>
                <Button size="sm" onClick={() => window.location.reload()}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
            <div className="tc-body">
                <div className="tc-pane"><TeamChat model={model} onChat={put} /></div>
                {searching && <SearchPanel chatId={chatId} query={query} members={model.state?.members ?? []} onQuery={onQuery} onPick={showMessage}
                    onClose={() => set({ find: null, q: null, from: null, has: null })} />}
            </div>
        </section>
        <aside className="tc-col tc-col--panel" aria-label={copy('About this chat', 'ამ ჩატის შესახებ')}>
            {chat && <ChatPanel chat={chat} members={model.state?.members ?? home?.members ?? []} maxDecision={home?.limits.maxDecision ?? model.state?.limits.maxDecision ?? 200}
                media={media} onMedia={onMedia} onChat={putChat} onShow={onShow} onMissing={gone} onBack={() => set({ panel: null })} />}
        </aside>
    </>;
}

/** One team chat inside Messages, like any conversation, with a way to its full page (panel, media, search). */
export function TeamChatInMessages({ chatId, onBack }: { chatId: number; onBack: () => void }) {
    const copy = useJourneyCopy();
    const model = useTeamChat(chatId, null);
    if (model.status === 'missing') return <p className="tc-faint">{copy('This conversation is no longer available.', 'ეს საუბარი აღარ არის ხელმისაწვდომი.')}</p>;
    const chat = model.state?.chat ?? null;
    return <GkRoot className="tc-root tc-root--embedded">
        <header className="tc-head">
            <button type="button" className="tc-back messages-mobile-back" onClick={onBack} aria-label={copy('Back to all messages', 'ყველა შეტყობინებაზე დაბრუნება')}><ArrowLeft aria-hidden="true" /></button>
            <h2 className="tc-title">{chat?.name ?? copy('Team chat', 'გუნდის ჩატი')}</h2>
            {chat && <StatusMark status={chat.status} />}
            <Connection model={model} />
            <Link to={`/team-work/chat?chat=${chatId}`} className="tc-open"><ExternalLink aria-hidden="true" />{copy('Open in Team work', 'გუნდის სამუშაოში გახსნა')}</Link>
        </header>
        <div className="tc-body"><div className="tc-pane"><TeamChat model={model} /></div></div>
    </GkRoot>;
}
