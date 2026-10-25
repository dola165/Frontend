import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AlertCircle, FileText, Film, Paperclip, Pencil, Reply, RotateCcw, Send, X } from 'lucide-react';
import { createMessageRecovery } from '../../components/chat/messageRecovery';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { ChatMessage, ChatPerson, ChatQuote } from './api';
import { fileSize } from './teamChatWords';
import type { ChatUploads } from './useChatUploads';
import type { TeamChatModel } from './useTeamChat';

/** What the person is answering or changing, above the box. */
export type Context = { kind: 'reply'; quote: ChatQuote } | { kind: 'edit'; message: ChatMessage } | null;

/** "@Gi…" at the caret: the team's names starting so (never you), longest match first. */
function suggestions(text: string, caret: number, people: ChatPerson[], me: number | null) {
    const typed = text.slice(0, caret).match(/(^|\s)@([^\s@]{0,30})$/u);
    if (!typed) return null;
    const start = caret - typed[2].length - 1;
    const query = typed[2].toLowerCase();
    const matches = people
        .filter(person => person.id !== me && person.name && person.name.toLowerCase().startsWith(query))
        .slice(0, 6);
    return matches.length ? { start, matches } : null;
}

/**
 * Writing to the team: Enter sends (Shift+Enter for a new line; on phones the button sends), ↑ in an empty box edits
 * your last message, Esc lets go of a reply or an edit. "@" offers the team's names. Files come by the clip, a paste or
 * a drop; the message waits until they are uploaded. The draft is kept per login while you are away.
 */
export function Composer({ model, uploads, context, onClearContext, onEditLast }: {
    model: TeamChatModel; uploads: ChatUploads; context: Context; onClearContext: () => void; onEditLast: () => void;
}) {
    const copy = useJourneyCopy();
    const { state } = model;
    const conversation = state?.chat.id ?? null;
    const limit = state?.limits.maxLength ?? 2000;
    const [recovery] = useState(createMessageRecovery);
    const [text, setText] = useState(() => conversation ? recovery.readDraft(conversation) : '');
    const [caret, setCaret] = useState(0);
    const [active, setActive] = useState(0);
    const [closed, setClosed] = useState(false);
    const box = useRef<HTMLTextAreaElement>(null);
    const file = useRef<HTMLInputElement>(null);
    const listId = useId(), hintId = useId();
    const editing = context?.kind === 'edit' ? context.message : null;
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

    // The draft follows the conversation once it is known; an edit starts from the message's words (and the box).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- loading the stored draft or the edited words once they are known
        if (editing) setText(editing.content);
        else if (conversation) setText(recovery.readDraft(conversation));
        if (editing) box.current?.focus();
    }, [editing, conversation, recovery]);
    useEffect(() => { if (context?.kind === 'reply') box.current?.focus(); }, [context]);

    useLayoutEffect(() => {
        const element = box.current;
        if (!element) return;
        element.style.height = 'auto';
        element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
    }, [text]);

    const write = (value: string, at: number) => {
        setText(value);
        setCaret(at);
        setActive(0);
        setClosed(false);
        if (!editing && conversation) recovery.writeDraft(conversation, value);
        model.typingNow(value.trim().length > 0);
    };
    const offered = !closed ? suggestions(text, caret, state?.members ?? [], state?.me ?? null) : null;
    const pick = (person: ChatPerson) => {
        if (!offered || !person.name) return;
        const value = `${text.slice(0, offered.start)}@${person.name} ${text.slice(caret)}`;
        const at = offered.start + person.name.length + 2;
        write(value, at);
        requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(at, at); });
    };

    const words = text.trim();
    const tooLong = text.length > limit;
    const canSend = !tooLong && !uploads.busy
        && (editing ? words.length > 0 || editing.attachments.length > 0 : words.length > 0 || uploads.ready)
        && !uploads.items.some(item => item.state === 'failed');
    const submit = async () => {
        if (!canSend) return;
        model.typingNow(false);
        if (editing) {
            if (words === editing.content || await model.edit(editing.id, words)) {
                onClearContext();
                setText(conversation ? recovery.readDraft(conversation) : '');
            }
            return;
        }
        model.send(words, context?.kind === 'reply' ? context.quote : null, uploads.attachments);
        uploads.sent();
        write('', 0);
        onClearContext();
    };
    const keys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (offered) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setActive(current => (current + (event.key === 'ArrowDown' ? 1 : offered.matches.length - 1)) % offered.matches.length);
                return;
            }
            if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); pick(offered.matches[active]); return; }
            if (event.key === 'Escape') { event.preventDefault(); setClosed(true); return; }
        }
        if (event.key === 'Escape' && context) {
            event.preventDefault();
            onClearContext();
            if (editing) setText(conversation ? recovery.readDraft(conversation) : '');
            return;
        }
        if (event.key === 'ArrowUp' && !text && !context) { event.preventDefault(); onEditLast(); return; }
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !coarse) { event.preventDefault(); void submit(); }
    };

    return <form className="tc-composer" onSubmit={event => { event.preventDefault(); void submit(); }}>
        {context && <div className="tc-composer__context">
            {context.kind === 'reply' ? <Reply aria-hidden="true" /> : <Pencil aria-hidden="true" />}
            <span className="tc-composer__about">{context.kind === 'reply'
                ? <>
                    {copy('Replying to', 'პასუხი:')} <strong>{context.quote.senderName}</strong> <span className="tc-faint">{context.quote.excerpt}</span>
                </>
                : copy('Editing your message · Esc to stop', 'შეტყობინების რედაქტირება · Esc გასაუქმებლად')}</span>
            <button type="button" className="tc-tool" aria-label={copy('Stop', 'გაუქმება')}
                onClick={() => { onClearContext(); if (editing) setText(conversation ? recovery.readDraft(conversation) : ''); }}>
                <X aria-hidden="true" />
            </button>
        </div>}
        {uploads.items.length > 0 && !editing && <ul className="tc-tray" aria-label={copy('Files to send', 'გასაგზავნი ფაილები')}>
            {uploads.items.map(item => <li key={item.id} data-state={item.state}>
                <span className="tc-tray__thumb">
                    {item.preview ? <img src={item.preview} alt="" /> : item.kind === 'VIDEO' ? <Film aria-hidden="true" /> : <FileText aria-hidden="true" />}
                </span>
                <span className="tc-tray__about">
                    <span className="tc-tray__name">{item.file.name}</span>
                    <span className="tc-faint">
                        {item.state === 'failed'
                            ? item.error
                            : item.state === 'uploading'
                                ? copy(`Uploading… ${Math.round(item.progress * 100)}%`, `იტვირთება… ${Math.round(item.progress * 100)}%`)
                                : fileSize(item.file.size)}
                    </span>
                    {item.state === 'uploading' && <span className="tc-tray__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                        aria-valuenow={Math.round(item.progress * 100)} aria-label={item.file.name}>
                        <span style={{ width: `${Math.round(item.progress * 100)}%` }} />
                    </span>}
                </span>
                {item.state === 'failed' && <button type="button" className="tc-tool"
                    aria-label={copy(`Try ${item.file.name} again`, `${item.file.name}-ის ხელახლა ატვირთვა`)} onClick={() => uploads.retry(item.id)}>
                    <RotateCcw aria-hidden="true" />
                </button>}
                <button type="button" className="tc-tool"
                    aria-label={item.state === 'uploading'
                        ? copy(`Stop uploading ${item.file.name}`, `${item.file.name}-ის ატვირთვის შეწყვეტა`)
                        : copy(`Remove ${item.file.name}`, `${item.file.name}-ის მოშორება`)}
                    onClick={() => uploads.cancel(item.id)}>
                    <X aria-hidden="true" />
                </button>
            </li>)}
        </ul>}
        {uploads.refusal && <p className="tc-composer__refusal" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{uploads.refusal}</span>
            <button type="button" className="tc-tool" aria-label={copy('Dismiss', 'დახურვა')} onClick={uploads.dismiss}><X aria-hidden="true" /></button>
        </p>}
        <div className="tc-composer__row">
            {!editing && <>
                <button type="button" className="tc-tool tc-tool--big"
                    aria-label={copy('Add pictures, videos or files', 'სურათის, ვიდეოს ან ფაილის დამატება')}
                    title={copy('Add pictures, videos or files (or paste, or drop them here)', 'სურათი, ვიდეო ან ფაილი (ან ჩასვით, ან ჩააგდეთ აქ)')}
                    onClick={() => file.current?.click()}>
                    <Paperclip aria-hidden="true" />
                </button>
                <input ref={file} type="file" multiple hidden
                    onChange={event => { if (event.target.files?.length) uploads.add([...event.target.files]); event.target.value = ''; }} />
            </>}
            <div className="tc-composer__field">
                <textarea ref={box} className="tc-composer__input" rows={1} value={text} aria-label={copy('Message the team', 'შეტყობინება გუნდს')}
                    placeholder={copy('Message the team…', 'მისწერეთ გუნდს…')}
                    title={copy('@ mentions someone, GK-12 links a task. Enter sends, Shift+Enter starts a new line.',
                        '@ მოიხსენიებს ვინმეს, GK-12 საქმის ბმულია. Enter აგზავნის, Shift+Enter ახალ ხაზზე გადადის.')}
                    aria-describedby={hintId} role="combobox" aria-autocomplete="list" aria-expanded={!!offered} aria-controls={listId}
                    aria-activedescendant={offered ? `${listId}-${active}` : undefined}
                    onChange={event => write(event.target.value, event.target.selectionStart)}
                    onSelect={event => setCaret(event.currentTarget.selectionStart)}
                    onKeyDown={keys} onBlur={() => { setClosed(true); model.typingNow(false); }}
                    onPaste={event => {
                        const files = [...event.clipboardData.files];
                        if (!files.length || editing || event.clipboardData.getData('text/plain')) return;
                        event.preventDefault();
                        uploads.add(files);
                    }} />
                {offered && <ul id={listId} role="listbox" className="tc-mentions" aria-label={copy('Mention someone', 'მოიხსენიეთ ვინმე')}>
                    {offered.matches.map((person, index) => <li key={person.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}
                        onMouseDown={event => { event.preventDefault(); pick(person); }}>@{person.name}</li>)}
                </ul>}
            </div>
            <button type="submit" className="tc-send" disabled={!canSend}
                aria-label={editing ? copy('Save', 'შენახვა') : copy('Send', 'გაგზავნა')} title={editing ? copy('Save', 'შენახვა') : copy('Send', 'გაგზავნა')}>
                <Send aria-hidden="true" />
            </button>
        </div>
        <p id={hintId} className="tc-composer__hint" data-warn={tooLong || undefined}>
            {tooLong ? copy(`${text.length - limit} characters too long`, `${text.length - limit} სიმბოლოთი გრძელია`)
                : uploads.busy ? copy('Sending waits until the files are uploaded.', 'გაგზავნა ფაილების ატვირთვას დაელოდება.')
                    : text.length > limit - 200 ? `${text.length}/${limit}` : ''}
        </p>
    </form>;
}
