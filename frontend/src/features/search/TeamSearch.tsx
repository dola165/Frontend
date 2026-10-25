import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { useAuth } from '../../context/AuthContext';
import { Button, GkRoot } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { reportMiss, type SearchGroup, type SearchHit } from './api';
import { MissedList } from './MissedList';
import { openedAfterMiss, pendingMiss, rememberMiss } from './searchMiss';
import { openedIn, pathOf, refOf } from './searchLinks';
import { SearchRow } from './SearchRow';
import { groupName } from './searchWords';
import { useTeamSearch } from './useTeamSearch';
import '../../design/dialog.css';
import '../teamWork/team-work.css';
import './team-search.css';

/** Someone is typing in a field (where "/" is a character, not a shortcut). */
const typing = (target: EventTarget | null) => target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Team work's search: a box in the page's header, opened by a click, "/" or Ctrl+K (⌘K). It finds tasks, steps,
 * ideas, plans, Now notes, chat messages and pictures and files by what people mean; each result says its short name,
 * why it matched and where it is. Enter opens the top result.
 */
export function TeamSearch() {
    const copy = useJourneyCopy();
    const me = useAuth().user?.id ?? null;
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [params] = useSearchParams();

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || document.querySelector('[aria-modal="true"]')) return;
            const shortcut = (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !typing(event.target))
                || ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k');
            if (!shortcut) return;
            event.preventDefault();
            setOpen(true);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    // After "Not what I was looking for", the next thing opened on Team work is what was wanted.
    const where = params.toString();
    useEffect(() => {
        const opened = openedIn(new URLSearchParams(where));
        if (opened && pendingMiss(me)) openedAfterMiss(me, opened, where);
    }, [where, me]);

    return <div className="tw-search">
        <button type="button" className="tw-search__box" aria-haspopup="dialog" aria-keyshortcuts="/ Control+K" onClick={() => setOpen(true)}>
            <Search aria-hidden="true" />
            <span className="tw-search__words" data-typed={query ? true : undefined}>{query || copy('Search tasks, plans, chats and pictures', 'ძიება: საქმეები, გეგმები, ჩატი, სურათები')}</span>
            <kbd className="tw-search__key">/</kbd>
        </button>
        {open && <SearchPalette query={query} onQuery={setQuery} me={me} where={where} onClose={() => setOpen(false)} />}
    </div>;
}

type Row = { hit: SearchHit } | { more: SearchGroup };

function SearchPalette({ query, onQuery, me, where, onClose }: { query: string; onQuery: (query: string) => void; me: number | null; where: string; onClose: () => void }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const dialog = useRef<HTMLElement>(null), input = useRef<HTMLInputElement>(null);
    const listId = useId(), headingId = useId();
    const [missed, setMissed] = useState(false);
    const [miss, setMiss] = useState<{ query: string; state: 'sending' | 'kept' | 'failed' } | null>(null);
    const [active, setActive] = useState<{ at: number; for: unknown }>({ at: 0, for: null });
    useDialogFocus(true, dialog, onClose, input);
    const { status, results, stale, best, loadingMore, loadMore } = useTeamSearch(query);
    const picked = best?.status === 'ready' && best.answer?.status === 'PICKED' ? best.answer.hits : [];
    const groups = results?.groups ?? [];

    // Every row in screen order, for the arrow keys: the best matches, then each group with its "more".
    const rows: Row[] = [...picked.map(hit => ({ hit })), ...groups.flatMap(group => [...group.hits.map(hit => ({ hit })), ...(group.more ? [{ more: group.group }] : [])])];
    const shown = rows.flatMap(row => 'hit' in row ? [refOf(row.hit)] : []).slice(0, 10);
    const optionId = (index: number) => `${listId}-${index}`;
    // New results start at the top result again.
    const current = active.for === results && results ? Math.min(active.at, Math.max(0, rows.length - 1)) : 0;
    const choose = (at: number) => setActive({ at, for: results });
    const asked = query.trim().length > 0;
    const missState = miss?.query === query ? miss.state : 'idle';

    useEffect(() => { document.getElementById(optionId(current))?.scrollIntoView?.({ block: 'nearest' }); });

    const open = (hit: SearchHit) => {
        openedAfterMiss(me, refOf(hit));
        onClose();
        navigate(pathOf(hit.open));
    };
    const pick = (row: Row | undefined) => { if (!row) return; if ('hit' in row) open(row.hit); else void loadMore(row.more); };
    const onKeyDown = (event: ReactKeyboardEvent) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (rows.length) choose((current + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            pick(rows[current]);
        }
    };
    const sayMissed = async () => {
        const words = query;
        setMiss({ query: words, state: 'sending' });
        try { rememberMiss((await reportMiss(words.trim(), shown)).id, me, where); setMiss({ query: words, state: 'kept' }); }
        catch { setMiss({ query: words, state: 'failed' }); }
    };

    // Where each group's rows start among all rows: the best matches come first.
    const starts = groups.reduce<number[]>((all, _group, at) => [...all, at === 0 ? picked.length : all[at - 1] + groups[at - 1].hits.length + (groups[at - 1].more ? 1 : 0)], []);
    const row = (hit: SearchHit, at: number) =>
        <SearchRow key={`${hit.kind}-${hit.id}`} hit={hit} id={optionId(at)} active={at === current} onOpen={() => open(hit)} onHover={() => { if (at !== current) choose(at); }} />;
    const more = (group: SearchGroup, at: number) =>
        <li id={optionId(at)} role="option" aria-selected={at === current} className="tw-search-more" data-active={at === current || undefined}
            onClick={() => void loadMore(group)} onMouseMove={() => { if (at !== current) choose(at); }}>
            {loadingMore === group ? copy('Loading…', 'იტვირთება…') : copy('Show more', 'მეტის ნახვა')}
        </li>;
    const nothing = asked && status === 'ready' && !groups.length && !picked.length;
    const limited = best?.answer?.status === 'LIMIT_YOU' || best?.answer?.status === 'LIMIT_TEAM';

    return createPortal(<GkRoot className="gk-dialog-layer tw-search-layer">
        <div className="gk-dialog-backdrop" data-dialog-backdrop="" onClick={onClose} aria-hidden="true" />
        <section ref={dialog} className="gk-dialog gk-dialog--lg tw-search-dialog" role="dialog" aria-modal="true" aria-labelledby={headingId}>
            <h2 id={headingId} className="tw-search-sr">{copy('Search Team work', 'ძიება გუნდის სამუშაოში')}</h2>
            <div className="tw-search-dialog__head">
                <Search aria-hidden="true" />
                <input ref={input} type="search" className="tw-search-dialog__input" value={query} maxLength={200} autoComplete="off" spellCheck={false} autoFocus
                    placeholder={copy('What are you looking for?', 'რას ეძებთ?')} aria-label={copy('Search words', 'საძიებო სიტყვები')}
                    role="combobox" aria-expanded={rows.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={rows.length ? optionId(current) : undefined}
                    onChange={event => onQuery(event.target.value)} onKeyDown={onKeyDown} />
                <Button variant="ghost" size="sm" onClick={onClose}>{copy('Close', 'დახურვა')}<kbd className="tw-search__key">Esc</kbd></Button>
            </div>
            <div className="tw-search-dialog__body" data-stale={stale || undefined}>
                {!asked && <p className="tw-search-dialog__hint">{copy(
                    'Tasks, plans, ideas, Now notes, the chat and its pictures. Type the way you talk, in English or Georgian, a key like GK-12, or a name.',
                    'საქმეები, გეგმები, იდეები, „ახლა“ ჩანაწერები, ჩატი და მისი სურათები. დაწერეთ ისე, როგორც ლაპარაკობთ — ქართულად ან ინგლისურად, გასაღებით (GK-12) ან სახელით.')}</p>}
                {asked && status === 'loading' && !results && <p className="tw-search-dialog__hint" role="status">{copy('Searching…', 'ვეძებ…')}</p>}
                {asked && status === 'error' && <p className="gk-notice gk-notice--danger" role="alert">{copy('Search isn’t working right now. Try again in a moment.', 'ძიება ახლა ვერ მუშაობს. სცადეთ ცოტა ხანში.')}</p>}
                {nothing && <p className="tw-search-dialog__hint" role="status">{copy(
                    `Nothing found for “${query.trim()}”. Try other words, a key like GK-12, or a person’s name.`,
                    `„${query.trim()}“ — ვერაფერი მოიძებნა. სცადეთ სხვა სიტყვები, გასაღები (GK-12) ან ადამიანის სახელი.`)}</p>}
                {asked && <ul id={listId} role="listbox" className="tw-search-dialog__list" aria-label={copy('Results', 'შედეგები')}>
                    {picked.length > 0 && <li role="presentation" className="tw-search-group tw-search-group--best">
                        <p className="tw-search-group__title" id={`${listId}-best`}><Sparkles aria-hidden="true" />{copy('Best matches', 'ყველაზე შესაფერისი')}</p>
                        <ul role="group" aria-labelledby={`${listId}-best`}>{picked.map((hit, at) => row(hit, at))}</ul>
                    </li>}
                    {groups.map((group, g) => <li key={group.group} role="presentation" className="tw-search-group">
                        <p className="tw-search-group__title" id={`${listId}-${group.group}`}>{groupName(copy, group.group)}</p>
                        <ul role="group" aria-labelledby={`${listId}-${group.group}`}>
                            {group.hits.map((hit, at) => row(hit, starts[g] + at))}
                            {group.more && more(group.group, starts[g] + group.hits.length)}
                        </ul>
                    </li>)}
                </ul>}
                {asked && best?.status === 'asking' && <p className="tw-search-dialog__hint tw-search-dialog__asking" role="status"><Sparkles aria-hidden="true" />{copy('Looking for what you meant…', 'ვეძებ, რას გულისხმობდით…')}</p>}
                {asked && limited && <p className="tw-search-dialog__hint">{copy('Best matches are used up for today; these are the plain results.', 'დღევანდელი „ყველაზე შესაფერისი“ ამოიწურა; ეს ჩვეულებრივი შედეგებია.')}</p>}
            </div>
            <div className="tw-search-dialog__foot">
                {asked && status === 'ready' && missState === 'idle' && <button type="button" className="tw-link-button" onClick={() => void sayMissed()}>{copy('Not what I was looking for', 'ეს არ არის, რასაც ვეძებდი')}</button>}
                {missState === 'sending' && <span className="gk-faint">{copy('Saving…', 'ინახება…')}</span>}
                {missState === 'kept' && <span className="tw-search-dialog__kept" role="status">{copy('Thanks. Now open what you were looking for — search will learn from it.', 'მადლობა. ახლა გახსენით ის, რასაც ეძებდით — ძიება ამით ისწავლის.')}</span>}
                {missState === 'failed' && <span className="gk-notice gk-notice--danger" role="alert">{copy('That couldn’t be saved.', 'ვერ შეინახა.')}</span>}
                <button type="button" className="tw-link-button tw-search-dialog__missed" onClick={() => setMissed(true)}>{copy('What search missed', 'რა ვერ იპოვა ძიებამ')}</button>
            </div>
        </section>
        {missed && <MissedList onClose={() => setMissed(false)} onOpen={open} />}
    </GkRoot>, document.body);
}
