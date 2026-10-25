import { useEffect, useId, useRef, useState } from 'react';
import { FileText, Film, Image as ImageIcon, X } from 'lucide-react';
import { Avatar, Button } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { searchMessages, type ChatMessage, type ChatPerson, type MediaFilter } from './api';
import { fullTime, problem } from './teamChatWords';

/** The words found, marked; any letter case. */
function Marked({ text, words }: { text: string; words: string }) {
    const at = words ? text.toLowerCase().indexOf(words.toLowerCase()) : -1;
    if (at < 0) return <>{text.length > 220 ? `${text.slice(0, 217)}…` : text}</>;
    const start = Math.max(0, at - 60);
    return <>{start > 0 && '…'}{text.slice(start, at)}<mark>{text.slice(at, at + words.length)}</mark>{text.slice(at + words.length, at + words.length + 140)}</>;
}

const HAS: [MediaFilter | '', string, string][] = [['', 'Anything', 'ყველაფერი'], ['MEDIA', 'With files', 'ფაილებით'], ['IMAGE', 'Pictures', 'სურათები'], ['VIDEO', 'Videos', 'ვიდეო'], ['FILE', 'Files', 'ფაილები']];

export interface SearchState { q: string; from: number | null; has: MediaFilter | null }

/**
 * Searching the chat: words (in a message or a file's name), one person's messages, and messages with files. A
 * result opens the chat at that message. What is searched for is kept in the address.
 */
export function SearchPanel({ chatId, query, members, onQuery, onPick, onClose }: {
    chatId: number; query: SearchState; members: ChatPerson[]; onQuery: (query: SearchState) => void; onPick: (messageId: number) => void; onClose: () => void;
}) {
    const copy = useJourneyCopy();
    const [words, setWords] = useState(query.q);
    const [found, setFound] = useState<ChatMessage[] | null>(null);
    const [more, setMore] = useState(false);
    const [error, setError] = useState('');
    const input = useRef<HTMLInputElement>(null);
    const personId = useId(), hasId = useId();
    const asked = query.q.trim().length > 0 || query.from !== null || query.has !== null;

    useEffect(() => { input.current?.focus(); }, []);
    // Typing settles for a moment before the words go into the address (and the search).
    useEffect(() => {
        if (words === query.q) return;
        const timer = window.setTimeout(() => onQuery({ ...query, q: words }), 300);
        return () => window.clearTimeout(timer);
    }, [words, query, onQuery]);
    useEffect(() => {
        if (!asked) return;
        const controller = new AbortController();
        // eslint-disable-next-line react-hooks/set-state-in-effect -- a new search clears the last one's problem
        setError('');
        searchMessages(chatId, { q: query.q.trim(), from: query.from, has: query.has }, controller.signal)
            .then(page => { setFound(page.messages); setMore(page.more); })
            .catch(failure => { if (!controller.signal.aborted) setError(problem(copy, failure, ['The search failed.', 'ძიება ვერ მოხერხდა.'])); });
        return () => controller.abort();
    }, [chatId, query, asked, copy]);

    const loadMore = async () => {
        const last = found?.at(-1);
        if (!last) return;
        try { const page = await searchMessages(chatId, { q: query.q.trim(), from: query.from, has: query.has, before: last.id }); setFound(current => [...(current ?? []), ...page.messages]); setMore(page.more); }
        catch (failure) { setError(problem(copy, failure, ['More could not load.', 'მეტი ვერ ჩაიტვირთა.'])); }
    };

    return <section className="tc-search" aria-label={copy('Search the chat', 'ჩატში ძიება')} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
        <div className="tc-search__bar">
            <input ref={input} type="search" className="gk-input tc-search__words" value={words} maxLength={200} placeholder={copy('Search messages and file names', 'ძიება შეტყობინებებსა და ფაილის სახელებში')}
                aria-label={copy('Search words', 'საძიებო სიტყვები')} onChange={event => setWords(event.target.value)} />
            <label className="tc-sr" htmlFor={personId}>{copy('From', 'ვისგან')}</label>
            <select id={personId} className="gk-input tc-search__select" value={query.from ?? ''} onChange={event => onQuery({ ...query, from: event.target.value ? Number(event.target.value) : null })}>
                <option value="">{copy('Anyone', 'ნებისმიერი')}</option>
                {members.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            <label className="tc-sr" htmlFor={hasId}>{copy('With', 'შეიცავს')}</label>
            <select id={hasId} className="gk-input tc-search__select" value={query.has ?? ''} onChange={event => onQuery({ ...query, has: (event.target.value || null) as MediaFilter | null })}>
                {HAS.map(([value, en, ka]) => <option key={value} value={value}>{copy(en, ka)}</option>)}
            </select>
            <Button variant="ghost" iconOnly aria-label={copy('Close search', 'ძიების დახურვა')} onClick={onClose}><X aria-hidden="true" /></Button>
        </div>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {!asked && <p className="tc-faint tc-search__hint">{copy('Type words, or choose a person or a kind of file.', 'ჩაწერეთ სიტყვები, ან აირჩიეთ ადამიანი ან ფაილის სახეობა.')}</p>}
        {asked && found && !found.length && <p className="tc-faint tc-search__hint" role="status">{copy('Nothing found.', 'ვერაფერი მოიძებნა.')}</p>}
        {asked && found && found.length > 0 && <ul className="tc-results" aria-label={copy('Results', 'შედეგები')}>
            {found.map(message => {
                const person = members.find(candidate => candidate.id === message.senderId);
                const kinds = new Set(message.attachments.map(file => file.kind));
                return <li key={message.id}><button type="button" className="tc-result" onClick={() => onPick(message.id)}>
                    <Avatar src={person?.avatarUrl} name={message.senderName} size={28} />
                    <span className="tc-result__main">
                        <span className="tc-result__head"><strong>{message.senderName}</strong><span className="tc-faint">{fullTime(copy, message.createdAt)}</span>
                            {kinds.has('IMAGE') && <ImageIcon aria-label={copy('Pictures', 'სურათები')} />}{kinds.has('VIDEO') && <Film aria-label={copy('Videos', 'ვიდეო')} />}{kinds.has('FILE') && <FileText aria-label={copy('Files', 'ფაილები')} />}
                        </span>
                        <span className="tc-result__text"><Marked text={message.content || message.attachments.map(file => file.name).join(', ')} words={query.q.trim()} /></span>
                    </span>
                </button></li>;
            })}
        </ul>}
        {asked && more && <Button variant="ghost" size="sm" onClick={() => void loadMore()}>{copy('More results', 'მეტი შედეგი')}</Button>}
    </section>;
}
