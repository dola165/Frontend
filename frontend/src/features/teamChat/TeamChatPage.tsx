import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Search, WifiOff } from 'lucide-react';
import { Avatar, Button, GkRoot } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { RouteRecoveryPage } from '../../pages/RouteRecoveryPage';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { AttachmentKind, MediaFilter } from './api';
import { MediaTab } from './MediaTab';
import { SearchPanel, type SearchState } from './SearchPanel';
import { TeamChat } from './TeamChat';
import { useTeamChat, type TeamChatModel } from './useTeamChat';
import './team-chat.css';
import './team-chat-parts.css';

const KINDS: AttachmentKind[] = ['IMAGE', 'VIDEO', 'FILE'];
const FILTERS: MediaFilter[] = ['MEDIA', ...KINDS];

/** The faces of who is in the chat, and how many. */
function People({ model }: { model: TeamChatModel }) {
    const copy = useJourneyCopy();
    const members = model.state?.members ?? [];
    if (!members.length) return null;
    return <span className="tc-people" title={members.map(person => person.name).join(', ')} aria-label={copy(`${members.length} people: ${members.map(person => person.name).join(', ')}`, `${members.length} ადამიანი: ${members.map(person => person.name).join(', ')}`)}>
        <span className="tc-people__faces" aria-hidden="true">{members.slice(0, 5).map(person => <Avatar key={person.id} src={person.avatarUrl} name={person.name} size={24} />)}</span>
        <span className="tc-faint gk-num" aria-hidden="true">{members.length}</span>
    </span>;
}

/** Reconnecting, said quietly; sending keeps waiting in the outbox meanwhile. */
function Connection({ model }: { model: TeamChatModel }) {
    const copy = useJourneyCopy();
    if (model.status !== 'ready' || model.connected) return null;
    return <span className="tc-offline" role="status"><WifiOff aria-hidden="true" />{copy('Reconnecting…', 'კავშირი აღდგება…')}</span>;
}

/**
 * The team chat page (/team-work/chat): Team work accounts only, for anyone else it does not exist. Chat and Media are
 * tabs (?tab=media, ?kind=), search lies over the chat (?find=1&q=&from=&has=), and ?message= opens the chat at a
 * message (mention notifications link there).
 */
export function TeamChatPage() {
    const { sessionId } = useAuth();
    return <TeamChatScreen key={sessionId} />;
}

function TeamChatScreen() {
    const copy = useJourneyCopy();
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'media' ? 'media' : 'chat';
    const kind = KINDS.find(value => value === params.get('kind')) ?? null;
    const jump = Number(params.get('message')) || null;
    const searching = params.has('find');
    const model = useTeamChat(jump);
    const set = useCallback((changes: Record<string, string | null>) => setParams(current => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) { if (value === null) next.delete(key); else next.set(key, value); }
        return next;
    }, { replace: true }), [setParams]);

    // A new ?message= while the chat is open (a notification, a link) goes there.
    const { jumpTo, status } = model;
    const opened = useRef(jump);
    useEffect(() => {
        if (status !== 'ready' || !jump || jump === opened.current) return;
        opened.current = jump;
        jumpTo(jump);
    }, [jump, status, jumpTo]);

    const show = useCallback((messageId: number) => {
        opened.current = messageId;
        set({ tab: null, kind: null, find: null, q: null, from: null, has: null, message: String(messageId) });
        jumpTo(messageId);
    }, [set, jumpTo]);
    const query: SearchState = { q: params.get('q') ?? '', from: Number(params.get('from')) || null, has: FILTERS.find(value => value === params.get('has')) ?? null };
    const onQuery = useCallback((next: SearchState) => set({ q: next.q || null, from: next.from ? String(next.from) : null, has: next.has }), [set]);
    // Someone taken off the team while the page is open: for them the chat no longer exists.
    const [gone, setGone] = useState(false);
    const missing = useCallback(() => setGone(true), []);

    if (model.status === 'missing' || gone) return <RouteRecoveryPage />;
    return <GkRoot className="tc-root">
        <div className="tc-page">
            <header className="tc-head">
                <Link to="/team-work" className="tc-back" aria-label={copy('Back to Team work', 'გუნდის სამუშაოზე დაბრუნება')}><ArrowLeft aria-hidden="true" /><span className="tc-back__label">{copy('Team work', 'გუნდის სამუშაო')}</span></Link>
                <h1 className="tc-title">{copy('Team chat', 'გუნდის ჩატი')}</h1>
                <People model={model} />
                <Connection model={model} />
                <div className="tc-tabs" role="tablist" aria-label={copy('Team chat', 'გუნდის ჩატი')}>
                    <button type="button" role="tab" aria-selected={tab === 'chat'} onClick={() => set({ tab: null, kind: null })}>{copy('Chat', 'ჩატი')}</button>
                    <button type="button" role="tab" aria-selected={tab === 'media'} onClick={() => set({ tab: 'media', find: null })}>{copy('Media', 'მედია')}</button>
                </div>
                <Button variant={searching ? 'secondary' : 'ghost'} iconOnly className="tc-search-toggle" aria-pressed={searching} aria-label={copy('Search the chat', 'ჩატში ძიება')} title={copy('Search the chat', 'ჩატში ძიება')}
                    onClick={() => set(searching ? { find: null, q: null, from: null, has: null } : { find: '1', tab: null })}><Search aria-hidden="true" /></Button>
            </header>
            {model.status === 'error' && <div className="gk-notice gk-notice--danger" role="alert"><span>{copy('The team chat could not load.', 'გუნდის ჩატი ვერ ჩაიტვირთა.')}</span>
                <Button size="sm" onClick={() => window.location.reload()}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
            <div className="tc-body">
                <div className="tc-pane" hidden={tab !== 'chat'}><TeamChat model={model} active={tab === 'chat'} /></div>
                {tab === 'media' && <MediaTab kind={kind} onKind={value => set({ kind: value })} onShow={show} onMissing={missing} />}
                {searching && tab === 'chat' && <SearchPanel query={query} members={model.state?.members ?? []} onQuery={onQuery} onPick={show}
                    onClose={() => set({ find: null, q: null, from: null, has: null })} />}
            </div>
        </div>
    </GkRoot>;
}

/** The team chat inside Messages, like any conversation, with a way to the full page (search and Media). */
export function TeamChatInMessages({ onBack }: { onBack: () => void }) {
    const copy = useJourneyCopy();
    const model = useTeamChat(null);
    if (model.status === 'missing') return <p className="tc-faint">{copy('This conversation is no longer available.', 'ეს საუბარი აღარ არის ხელმისაწვდომი.')}</p>;
    return <GkRoot className="tc-root tc-root--embedded">
        <header className="tc-head">
            <button type="button" className="tc-back messages-mobile-back" onClick={onBack} aria-label={copy('Back to all messages', 'ყველა შეტყობინებაზე დაბრუნება')}><ArrowLeft aria-hidden="true" /></button>
            <h2 className="tc-title">{copy('Team chat', 'გუნდის ჩატი')}</h2>
            <People model={model} />
            <Connection model={model} />
            <Link to="/team-work/chat" className="tc-open"><ExternalLink aria-hidden="true" />{copy('Search and media', 'ძიება და მედია')}</Link>
        </header>
        <div className="tc-body"><div className="tc-pane"><TeamChat model={model} /></div></div>
    </GkRoot>;
}
