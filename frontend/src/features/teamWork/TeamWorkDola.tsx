import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, Plus, Send, Sparkles, X } from 'lucide-react';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { agentDolaConversation, agentDolaStatus, decideAgentDola, forgetAgentDola, sendAgentDola, type AgentDolaReply, type AgentDolaStatus } from '../dola/agentDola';
import './team-work-dola.css';

type Copy = ReturnType<typeof useJourneyCopy>;
interface Turn { id: number; message: string | null; answer: AgentDolaReply | null; decided?: 'confirm' | 'reject' | 'closed' }

const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
/** Replies that changed something on the board, so the page reloads what it shows. */
const CHANGED = new Set(['ACTION_COMPLETED']);

/** `**bold**` and line breaks, nothing else: Dola's replies are plain text with a little emphasis. */
function Words({ text }: { text: string }) {
    return <>{text.split('\n').map((line, index) => <Fragment key={index}>
        {index > 0 && <br />}
        {line.split(/(\*\*[^*]+\*\*)/g).map((part, at) => part.startsWith('**') && part.endsWith('**') && part.length > 4
            ? <strong key={at}>{part.slice(2, -2)}</strong> : <Fragment key={at}>{part}</Fragment>)}
    </Fragment>)}</>;
}

function Countdown({ expiresAt, now, copy }: { expiresAt: string; now: number; copy: Copy }) {
    const ends = Date.parse(expiresAt);
    if (!Number.isFinite(ends)) return null;
    const left = Math.max(0, Math.ceil((ends - now) / 1000));
    return <span className="tw-dola__expiry">{left === 0 ? copy('Expired', 'ვადა გაუვიდა')
        : copy(`Waits ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, `ელოდება ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`)}</span>;
}

function Answer({ turn, now, busy, copy, onDecide, onQuick }: {
    turn: Turn; now: number; busy: boolean; copy: Copy; onDecide: (turn: Turn, decision: 'confirm' | 'reject') => void; onQuick: (text: string) => void;
}) {
    const answer = turn.answer;
    if (!answer) return null;
    const pending = answer.status === 'ACTION_CONFIRMATION_REQUIRED' && answer.actionId && answer.proposal && !turn.decided
        && Date.parse(answer.proposal.expiresAt) > now;
    return <div className={`tw-dola__answer tw-dola__answer--${answer.status.toLowerCase()}`}>
        {answer.reply && <p><Words text={answer.reply} /></p>}
        {answer.proposal && answer.actionId && <section className="tw-dola__proposal" aria-label={answer.proposal.title}>
            <h3>{answer.proposal.title}</h3>
            {answer.proposal.details.length > 0 && <dl>{answer.proposal.details.map((detail, index) =>
                <div key={index}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>}
            {pending ? <>
                <p className="tw-dola__note">{copy('Nothing has changed yet.', 'ჯერ არაფერი შეცვლილა.')} <Countdown expiresAt={answer.proposal.expiresAt} now={now} copy={copy} /></p>
                <div className="tw-dola__buttons">
                    <Button variant="primary" size="sm" disabled={busy} onClick={() => onDecide(turn, 'confirm')}><Check aria-hidden="true" />{answer.proposal.confirmLabel || copy('Confirm', 'დადასტურება')}</Button>
                    <Button size="sm" disabled={busy} onClick={() => onDecide(turn, 'reject')}>{copy('Cancel', 'გაუქმება')}</Button>
                </div>
            </> : <p className="tw-dola__note">{turn.decided === 'confirm' ? copy('Approved', 'დადასტურდა') : turn.decided === 'reject' ? copy('Cancelled', 'გაუქმდა') : copy('No longer waiting', 'აღარ ელოდება')}</p>}
        </section>}
        {answer.cards.length > 0 && <ul className="tw-dola__cards">{answer.cards.map((card, index) => <li key={index}>
            {card.link?.webPath ? <Link to={card.link.webPath}><strong>{card.title}</strong>{card.subtitle && <span>{card.subtitle}</span>}</Link>
                : <span><strong>{card.title}</strong>{card.subtitle && <span>{card.subtitle}</span>}</span>}
        </li>)}</ul>}
        {answer.quickReplies.length > 0 && !pending && <div className="tw-dola__chips">{answer.quickReplies.map(chip =>
            <button key={chip} type="button" className="tw-dola__chip" disabled={busy} onClick={() => onQuick(chip)}>{chip}</button>)}</div>}
    </div>;
}

/**
 * Agent Dola inside Team work: the team's project manager. It turns words into tasks, moves them along, answers
 * workers' questions and fills a task from a pasted report, always through a preview the person approves. It
 * exists only for team members with Dola switched on; for anyone else nothing is shown.
 */
export function TeamWorkDola({ onChanged }: { onChanged: () => void }) {
    const copy = useJourneyCopy();
    const location = useLocation();
    const [status, setStatus] = useState<AgentDolaStatus | null>(null);
    const [open, setOpen] = useState(false);
    const [turns, setTurns] = useState<Turn[]>([]);
    const [draft, setDraft] = useState('');
    // One clock for every proposal's countdown, ticking only while the panel is open.
    const [now, setNow] = useState(() => Date.now());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const nextId = useRef(1);
    const end = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const controller = new AbortController();
        agentDolaStatus(controller.signal).then(next => { if (!controller.signal.aborted) setStatus(next); })
            .catch(() => { if (!controller.signal.aborted) setStatus(null); });
        return () => controller.abort();
    }, []);
    useEffect(() => {
        if (!open || !status?.available) return;
        const controller = new AbortController();
        agentDolaConversation(controller.signal).then(history => {
            if (controller.signal.aborted) return;
            setTurns(current => current.length ? current : history.map(turn => ({ id: nextId.current++, message: turn.message, answer: turn.answer })));
        }).catch(() => undefined);
        input.current?.focus();
        return () => controller.abort();
    }, [open, status?.available]);
    useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [turns, busy]);
    useEffect(() => {
        if (!open) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [open]);

    if (!status) return null;
    const settle = (answer: AgentDolaReply) => { if (CHANGED.has(answer.status)) onChanged(); };
    const failed = (failure: unknown) => setError(statusOf(failure) === 404
        ? copy('Dola is not available here.', 'დოლა აქ მიუწვდომელია.')
        : extractApiErrorMessage(failure, copy('Dola didn’t answer. Try again.', 'დოლამ არ უპასუხა. სცადეთ ხელახლა.')));

    const send = async (raw: string) => {
        const message = raw.trim();
        if (!message || busy) return;
        setBusy(true); setError(''); setDraft('');
        const id = nextId.current++;
        setTurns(current => [...current, { id, message, answer: null }]);
        try {
            const answer = await sendAgentDola(message, location.pathname + location.search);
            setTurns(current => current.map(turn => turn.id === id ? { ...turn, answer } : turn));
            settle(answer);
        } catch (failure) { failed(failure); setDraft(message); setTurns(current => current.filter(turn => turn.id !== id)); }
        finally { setBusy(false); input.current?.focus(); }
    };
    const decide = async (turn: Turn, decision: 'confirm' | 'reject') => {
        if (!turn.answer?.actionId || busy) return;
        setBusy(true); setError('');
        try {
            const answer = await decideAgentDola(turn.answer.actionId, decision);
            setTurns(current => [...current.map(item => item.id === turn.id ? { ...item, decided: decision } : item), { id: nextId.current++, message: null, answer }]);
            settle(answer);
        } catch (failure) { failed(failure); }
        finally { setBusy(false); }
    };
    const restart = async () => {
        setBusy(true); setError('');
        try { await forgetAgentDola(); setTurns([]); } catch (failure) { failed(failure); } finally { setBusy(false); }
    };
    const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(draft); }
    };
    // Only the newest turn can still be waiting: a later message in the chat approved it ("yes" runs it and echoes its id),
    // declined it, or asked about it (the proposal comes back again below).
    const shown: Turn[] = turns.map((turn, index) => {
        if (turn.answer?.status !== 'ACTION_CONFIRMATION_REQUIRED' || turn.decided) return turn;
        const later = turns.slice(index + 1).filter(next => next.answer);
        if (later.length === 0) return turn;
        const ran = later.some(next => next.answer?.actionId === turn.answer?.actionId && next.answer?.status !== 'ACTION_CONFIRMATION_REQUIRED');
        return { ...turn, decided: ran ? 'confirm' : 'closed' };
    });
    const welcome: ReactNode = <div className="tw-dola__answer">
        <p>{copy('I’m Dola, the team’s project manager. Tell me what you need, or paste a worker’s report. I show you every change before I make it.',
            'მე ვარ დოლა, გუნდის პროექტის მენეჯერი. მითხარით, რა გჭირდებათ, ან ჩასვით მუშის რეპორტი. ყოველ ცვლილებას ჯერ გაჩვენებთ.')}</p>
        <div className="tw-dola__chips">{[copy('What’s waiting on me?', 'რა მელოდება?'), copy('Add a task', 'თასქის დამატება'), copy('What’s in progress?', 'რა მიმდინარეობს?')]
            .map(chip => <button key={chip} type="button" className="tw-dola__chip" disabled={busy || !status.available} onClick={() => void send(chip)}>{chip}</button>)}</div>
    </div>;

    return <>
        {!open && <button type="button" className="tw-dola-launch" onClick={() => setOpen(true)} aria-label={copy('Ask Dola', 'ჰკითხე დოლას')}>
            <Sparkles aria-hidden="true" /><span>{copy('Ask Dola', 'ჰკითხე დოლას')}</span>
        </button>}
        {open && <aside className="tw-dola" role="dialog" aria-label="Agent Dola" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
            <header className="tw-dola__head">
                <span className="tw-dola__title"><Sparkles aria-hidden="true" />Agent Dola</span>
                <Button size="sm" variant="ghost" iconOnly disabled={busy || turns.length === 0} onClick={() => void restart()} aria-label={copy('New conversation', 'ახალი საუბარი')} title={copy('New conversation', 'ახალი საუბარი')}><Plus aria-hidden="true" /></Button>
                <Button size="sm" variant="ghost" iconOnly onClick={() => setOpen(false)} aria-label={copy('Close', 'დახურვა')} title={copy('Close', 'დახურვა')}><X aria-hidden="true" /></Button>
            </header>
            <div className="tw-dola__body" aria-live="polite">
                {!status.available && <p className="gk-notice">{copy('Dola is switched off or can’t understand messages right now. The board works as usual.',
                    'დოლა გამორთულია ან ახლა შეტყობინებებს ვერ იგებს. დაფა ჩვეულებრივ მუშაობს.')}</p>}
                {turns.length === 0 && welcome}
                {shown.map(turn => <div key={turn.id} className="tw-dola__turn">
                    {turn.message && <p className="tw-dola__mine">{turn.message}</p>}
                    <Answer turn={turn} now={now} busy={busy} copy={copy} onDecide={(target, decision) => void decide(target, decision)} onQuick={chip => void send(chip)} />
                </div>)}
                {busy && <p className="tw-dola__thinking" role="status">{copy('Dola is thinking…', 'დოლა ფიქრობს…')}</p>}
                <div ref={end} />
            </div>
            {error && <p className="gk-notice gk-notice--danger tw-dola__error" role="alert">{error}</p>}
            <form className="tw-dola__compose" onSubmit={event => { event.preventDefault(); void send(draft); }}>
                <textarea ref={input} className="gk-input" rows={2} value={draft} maxLength={status.maxMessageLength} disabled={!status.available}
                    placeholder={copy('Ask Dola, or paste a worker’s report…', 'ჰკითხეთ დოლას, ან ჩასვით მუშის რეპორტი…')}
                    aria-label={copy('Message to Dola', 'შეტყობინება დოლას')} onChange={event => setDraft(event.target.value)} onKeyDown={onKey} />
                <Button type="submit" variant="primary" size="sm" iconOnly disabled={busy || !draft.trim() || !status.available} aria-label={copy('Send', 'გაგზავნა')}><Send aria-hidden="true" /></Button>
            </form>
        </aside>}
    </>;
}
