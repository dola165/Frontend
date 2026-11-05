import { Fragment, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, ExternalLink, ImagePlus, ListChecks, Plus, ScanSearch, Send, Sparkles, X } from 'lucide-react';
import { DIALOG_COMPANION } from '../../components/workspace/useDialogFocus';
import { useAuth } from '../../context/AuthContext';
import { hasNavigationCapability } from '../../context/navigationCapabilities';
import { Button, GkRoot } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { agentDolaConversation, agentDolaStatus, awaitsApproval, decideAgentDola, forgetAgentDola, sendAgentDola, uploadAgentDolaPicture, type AgentDolaGuide, type AgentDolaPicture, type AgentDolaReply, type AgentDolaStatus } from '../dola/agentDola';
import { AGENT_DOLA_OPEN, type AgentDolaOpenRequest } from '../dola/agentDolaEvents';
import { startGuide, useGuide } from '../dola/dolaGuide';
import { onPage, opensOnce } from '../dola/pageForm';
import { followChoice } from '../world/directory/followChoice';
import { DolaTrace } from './TeamWorkDolaTrace';
import { useDolaTraceSetting } from './TeamWorkDolaTraceSetting';
import './team-work-dola.css';

type Copy = ReturnType<typeof useJourneyCopy>;
/** `picture` is the picture the person sent with the message (only they can see it). */
interface Turn { id: number; message: string | null; answer: AgentDolaReply | null; decided?: 'confirm' | 'reject' | 'closed'; picture?: string | null }

const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
/** Replies that changed something on the board, so the page reloads what it shows. */
const CHANGED = new Set(['ACTION_COMPLETED']);
/** `?dola=open` (the header's Agent Dola link) opens the panel on arrival. */
const OPEN_PARAM = 'dola';
/** The pictures the image pipeline takes (it turns each into a JPEG). */
const PICTURE_TYPES = 'image/jpeg,image/png,image/gif,image/webp';

/** Why Dola can't answer: in the status's own terms for the team, so a developer knows what to fix; plainly for customers. */
function unavailableText(status: AgentDolaStatus, copy: Copy, team: boolean) {
    if (!team) return copy('Agent Dola isn’t available right now. Everything else works as usual.',
        'აგენტი დოლა ახლა მიუწვდომელია. დანარჩენი ყველაფერი ჩვეულებრივ მუშაობს.');
    switch (status.reason) {
        case 'SWITCHED_OFF': return copy('Dola is switched off on this server (DOLA_ENABLED). The board works as usual.',
            'დოლა ამ სერვერზე გამორთულია (DOLA_ENABLED). დაფა ჩვეულებრივ მუშაობს.');
        case 'NO_LANGUAGE_KEY': return copy('Dola can’t understand messages: TYPESAFE_API_KEY isn’t set on this server. The board works as usual.',
            'დოლა შეტყობინებებს ვერ იგებს: ამ სერვერზე TYPESAFE_API_KEY არ არის. დაფა ჩვეულებრივ მუშაობს.');
        case 'LANGUAGE_KEY_REJECTED': return copy('Dola can’t understand messages: the language service rejected this server’s key. The board works as usual.',
            'დოლა შეტყობინებებს ვერ იგებს: ენის სერვისმა ამ სერვერის გასაღები არ მიიღო. დაფა ჩვეულებრივ მუშაობს.');
        default: return copy('Dola is switched off or can’t understand messages right now. The board works as usual.',
            'დოლა გამორთულია ან ახლა შეტყობინებებს ვერ იგებს. დაფა ჩვეულებრივ მუშაობს.');
    }
}

/** For the team only: why Dola can't answer in its own words right now, and what fixes it. Customers never see it. */
function writerProblemText(problem: string | null | undefined, copy: Copy) {
    if (problem === 'NO_BALANCE') return copy('Dola can’t answer questions in its own words: the writer model’s account has no credit left (HTTP 402). Top it up — it works again on the next message, no restart.',
        'დოლა კითხვებს საკუთარი სიტყვებით ვერ პასუხობს: წერის მოდელის ანგარიშზე თანხა აღარ არის (HTTP 402). შეავსეთ — შემდეგივე შეტყობინებიდან იმუშავებს, გადატვირთვა არ სჭირდება.');
    if (problem === 'KEY_REJECTED') return copy('Dola can’t answer questions in its own words: the writer model rejected its key (HTTP 401/403). Check the key in the server’s settings.',
        'დოლა კითხვებს საკუთარი სიტყვებით ვერ პასუხობს: წერის მოდელმა გასაღები არ მიიღო (HTTP 401/403). შეამოწმეთ გასაღები სერვერის პარამეტრებში.');
    return null;
}

/** An answer still being written: a `**` whose closing pair hasn't come yet isn't shown as two stars. */
function soFar(text: string) {
    const stars = text.split('**').length - 1;
    const open = stars % 2 === 1 ? text.lastIndexOf('**') : -1;
    return (open >= 0 ? text.slice(0, open) + text.slice(open + 2) : text).trimStart();
}

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
    // A preview waits as long as the chat (up to two hours): "1:59:59", or "4:59" in its last hour.
    const two = (value: number) => String(value).padStart(2, '0');
    const hours = Math.floor(left / 3600);
    const clock = hours > 0 ? `${hours}:${two(Math.floor(left / 60) % 60)}:${two(left % 60)}` : `${Math.floor(left / 60)}:${two(left % 60)}`;
    return <span className="tw-dola__expiry">{left === 0 ? copy('Expired', 'ვადა გაუვიდა') : copy(`Waits ${clock}`, `ელოდება ${clock}`)}</span>;
}

/**
 * An answer's own words around it (Open …, Confirm, Cancel, the countdown) are in the answer's language, never the
 * site's: a Georgian answer on the English site reads Georgian throughout. Languages the site has no words for
 * (Estonian, Russian) keep the site's.
 */
function answerCopy(language: AgentDolaReply['language'], site: Copy): Copy {
    if (language === 'ka') return ((_english: string, georgian: string) => georgian) as Copy;
    if (language === 'en') return ((english: string) => english) as Copy;
    return site;
}

function Answer({ turn, now, busy, copy: site, onDecide, onQuick, onGuide }: {
    turn: Turn; now: number; busy: boolean; copy: Copy; onDecide: (turn: Turn, decision: 'confirm' | 'reject') => void; onQuick: (text: string) => void;
    onGuide: (guide: AgentDolaGuide) => void;
}) {
    const location = useLocation();
    const answer = turn.answer;
    if (!answer) return null;
    const copy = answerCopy(answer.language, site);
    // A card that chooses a club on the World map flies the map to it, keeping the map's own filters when it is on screen.
    const linkTo = (webPath: string) => followChoice(webPath, location);
    const pending = awaitsApproval(answer.status) && answer.actionId && answer.proposal && !turn.decided
        && Date.parse(answer.proposal.expiresAt) > now;
    // The page this answer opens ("open the calendar", a created match), unless a card already links there.
    const open = answer.navigation?.webPath && !answer.cards.some(card => card.link?.webPath === answer.navigation?.webPath)
        ? answer.navigation : null;
    return <div className={`tw-dola__answer tw-dola__answer--${answer.status.toLowerCase()}`}>
        {answer.reply && <p><Words text={answer.reply} /></p>}
        {answer.proposal && answer.actionId && <section className="tw-dola__proposal" aria-label={answer.proposal.title}>
            <h3>{answer.proposal.title}</h3>
            {answer.proposal.pictureUrl && <img className="tw-dola__picture tw-dola__picture--proposal" src={resolveMediaUrl(answer.proposal.pictureUrl)}
                alt={copy('The picture you sent', 'თქვენ მიერ გამოგზავნილი სურათი')} />}
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
            {card.link?.webPath ? <Link {...linkTo(card.link.webPath)}><strong>{card.title}</strong>{card.subtitle && <span>{card.subtitle}</span>}</Link>
                : <span><strong>{card.title}</strong>{card.subtitle && <span>{card.subtitle}</span>}</span>}
        </li>)}</ul>}
        {answer.guide && <section className="tw-dola__guide" aria-label={answer.guide.title}>
            <Button size="sm" variant="primary" onClick={() => onGuide(answer.guide!)}><ListChecks aria-hidden="true" />{copy('Show me step by step', 'ნაბიჯ-ნაბიჯ მაჩვენე')}</Button>
        </section>}
        {open?.webPath && <Link className="tw-dola__open" to={open.webPath}>{copy(`Open ${open.label}`, `გახსნა: ${open.label}`)}<ArrowRight aria-hidden="true" /></Link>}
        {answer.sources.length > 0 && <ul className="tw-dola__sources" aria-label={copy('Sources from the web', 'წყაროები ინტერნეტიდან')}>{answer.sources.map((source, index) => <li key={index}>
            <a href={source.url} target="_blank" rel="noopener noreferrer"><strong>{source.title}</strong><ExternalLink aria-hidden="true" /></a>
            {source.snippet && <span>{source.snippet}</span>}
        </li>)}</ul>}
        {answer.quickReplies.length > 0 && !pending && <div className="tw-dola__chips">{answer.quickReplies.map(chip =>
            <button key={chip} type="button" className="tw-dola__chip" disabled={busy} onClick={() => onQuick(chip)}>{chip}</button>)}</div>}
        {answer.trace && <DolaTrace trace={answer.trace} copy={copy} />}
    </div>;
}

/**
 * Agent Dola, the GrassKickZ assistant: one panel for the whole app, opened from the header on any page (and with a
 * launcher on Team work), for every signed-in customer. Each role gets its own Dola, decided by the server: club staff
 * arrange, move and cancel matches and notify their team; players, parents, agents and fans get what their own screens
 * offer; the Team work tools exist only for the team. The welcome and its example chips come from the server for the
 * person's role. Every change goes through a preview the person approves. Team members testing Dola can turn on "How
 * Dola understood this" (off by default); nobody else sees that switch.
 *
 * The panel sits directly under <body> as a dialog's companion, above World's drawers: "Ask Dola" on the guide's step
 * card opens it over the form being filled, says which field the question is about, and offers to explain it.
 */
export function TeamWorkDola({ onChanged }: { onChanged: () => void }) {
    const copy = useJourneyCopy();
    const { i18n } = useTranslation();
    const language = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka') ? 'ka' as const : 'en' as const;
    const { user } = useAuth();
    // Team work, its pasted reports and the trace of how Dola understood a message are the team's alone.
    const team = hasNavigationCapability(user?.navigationCapabilities, 'team.work');
    const location = useLocation();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [status, setStatus] = useState<AgentDolaStatus | null>(null);
    const [open, setOpen] = useState(() => params.get(OPEN_PARAM) === 'open');
    const [tracing, setTracing] = useDolaTraceSetting();
    const [turns, setTurns] = useState<Turn[]>([]);
    const [draft, setDraft] = useState('');
    // A picture waiting to go with the next message, and whether one is uploading.
    const [picture, setPicture] = useState<AgentDolaPicture | null>(null);
    const [uploading, setUploading] = useState(false);
    const pictureInput = useRef<HTMLInputElement>(null);
    // One clock for every proposal's countdown, ticking only while the panel is open.
    const [now, setNow] = useState(() => Date.now());
    const [busy, setBusy] = useState(false);
    // The message being answered: what Dola is doing now, and the words of its answer so far.
    const [live, setLive] = useState<{ id: number; step: string | null; words: string } | null>(null);
    const [error, setError] = useState('');
    // A question asked as the panel opens (a first-time tip's "Help me"); sent once the earlier conversation is in.
    const [asked, setAsked] = useState<string | null>(null);
    const [historyIn, setHistoryIn] = useState(false);
    const ask = useRef<(message: string) => void>(() => undefined);
    const nextId = useRef(1);
    const end = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLTextAreaElement>(null);
    // The field Dola's guide is framing: what a question asked now is about (it goes along with each message).
    const guiding = useGuide();
    const field = guiding ? guiding.steps[guiding.index] ?? null : null;

    useEffect(() => {
        const controller = new AbortController();
        agentDolaStatus(controller.signal, language).then(next => { if (!controller.signal.aborted) setStatus(next); })
            .catch(() => { if (!controller.signal.aborted) setStatus(null); });
        return () => controller.abort();
    }, [language]);
    useEffect(() => {
        if (!open || !status?.available) return;
        const controller = new AbortController();
        agentDolaConversation(controller.signal).then(history => {
            if (controller.signal.aborted) return;
            setTurns(current => current.length ? current : history.map(turn => ({ id: nextId.current++, message: turn.message || null,
                answer: turn.answer, picture: turn.pictureUrl })));
        }).catch(() => undefined).finally(() => { if (!controller.signal.aborted) setHistoryIn(true); });
        input.current?.focus();
        return () => controller.abort();
    }, [open, status?.available]);
    // The header link lands here with ?dola=open (also when Team work is already on screen); the flag is then dropped so
    // closing the panel and moving around the board does not open it again.
    const openRequested = params.get(OPEN_PARAM) === 'open';
    useEffect(() => {
        if (!openRequested) return;
        setOpen(true);
        setParams(current => { const next = new URLSearchParams(current); next.delete(OPEN_PARAM); return next; }, { replace: true });
    }, [openRequested, setParams]);
    // The header asks the panel to open wherever the person is; a tip's "Help me" also says what to ask.
    useEffect(() => {
        const show = (event: Event) => {
            setOpen(true);
            const question = (event as CustomEvent<AgentDolaOpenRequest | null>).detail?.ask;
            if (question) setAsked(question);
        };
        window.addEventListener(AGENT_DOLA_OPEN, show);
        return () => window.removeEventListener(AGENT_DOLA_OPEN, show);
    }, []);
    useEffect(() => {
        if (!asked || !open || !historyIn || busy || !status?.available) return;
        setAsked(null);
        ask.current(asked);
    }, [asked, open, historyIn, busy, status?.available]);
    useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [turns, busy, live]);
    useEffect(() => {
        if (!open) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [open]);

    if (!status) return null;
    // A guide frames fields on the page itself: open its page and step aside so the page can be seen.
    const guide = (next: AgentDolaGuide) => {
        startGuide(next);
        if (next.webPath && (opensOnce(next.webPath) || !onPage(next.webPath, location.pathname, location.search))) navigate(next.webPath);
        setOpen(false);
    };
    const settle = (answer: AgentDolaReply) => {
        if (CHANGED.has(answer.status)) onChanged();
        if (answer.guide) guide(answer.guide);
    };
    const failed = (failure: unknown) => setError(statusOf(failure) === 404
        ? copy('Dola is not available here.', 'დოლა აქ მიუწვდომელია.')
        : extractApiErrorMessage(failure, copy('Dola didn’t answer. Try again.', 'დოლამ არ უპასუხა. სცადეთ ხელახლა.')));

    /** @param withPicture whether the picture waiting in the box goes along (a typed message; never a tapped chip). */
    const send = async (raw: string, withPicture = false) => {
        const message = raw.trim();
        const sent = withPicture ? picture : null;
        if ((!message && !sent) || busy || uploading) return;
        setBusy(true); setError(''); setDraft('');
        if (sent) setPicture(null);
        const id = nextId.current++;
        setTurns(current => [...current, { id, message: message || null, answer: null, picture: sent?.url ?? null }]);
        setLive({ id, step: null, words: '' });
        try {
            const answer = await sendAgentDola(message, location.pathname + location.search, { trace: team && tracing, pictureId: sent?.id }, {
                step: step => setLive(current => current?.id === id ? { ...current, step } : current),
                words: words => setLive(current => current?.id === id ? { ...current, words: current.words + words } : current),
            });
            setTurns(current => current.map(turn => turn.id === id ? { ...turn, answer } : turn));
            settle(answer);
        } catch (failure) {
            failed(failure); setDraft(message); if (sent) setPicture(sent);
            setTurns(current => current.filter(turn => turn.id !== id));
        }
        finally { setLive(null); setBusy(false); input.current?.focus(); }
    };
    const attach = async (file: File | null | undefined) => {
        if (!file || uploading) return;
        if (!file.type.startsWith('image/')) { setError(copy('Only pictures can be sent to Dola.', 'დოლასთვის მხოლოდ სურათის გაგზავნაა შესაძლებელი.')); return; }
        setUploading(true); setError('');
        try { setPicture(await uploadAgentDolaPicture(file)); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('That picture couldn’t be added. Try another one.', 'ეს სურათი ვერ დაემატა. სცადეთ სხვა.'))); }
        finally { setUploading(false); input.current?.focus(); }
    };
    // A picture pasted into the box is attached, as if chosen with the picture button.
    const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
        if (!status.pictures) return;
        const file = Array.from(event.clipboardData?.files ?? []).find(item => item.type.startsWith('image/'));
        if (!file) return;
        event.preventDefault();
        void attach(file);
    };
    ask.current = message => void send(message);
    const decide = async (turn: Turn, decision: 'confirm' | 'reject') => {
        if (!turn.answer?.actionId || busy) return;
        setBusy(true); setError('');
        try {
            const answer = await decideAgentDola(turn.answer.actionId, decision, { trace: team && tracing });
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
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(draft, true); }
    };
    // Only the newest turn can still be waiting: a later message in the chat approved it ("yes" runs it and echoes its id),
    // declined it, or asked about it (the proposal comes back again below).
    const shown: Turn[] = turns.map((turn, index) => {
        if (!turn.answer || !awaitsApproval(turn.answer.status) || turn.decided) return turn;
        const later = turns.slice(index + 1).filter(next => next.answer);
        if (later.length === 0) return turn;
        const ran = later.some(next => next.answer?.actionId === turn.answer?.actionId && !!next.answer && !awaitsApproval(next.answer.status));
        return { ...turn, decided: ran ? 'confirm' : 'closed' };
    });
    // The person's own welcome and examples, for their role, from the server: never another role's things to ask for.
    const welcome: ReactNode = <div className="tw-dola__answer">
        <p>{status.welcome || copy('I’m Dola, your GrassKickZ assistant. Tell me in your own words what you need; I show you every change before I make it.',
            'მე ვარ დოლა, თქვენი GrassKickZ-ის ასისტენტი. თქვენი სიტყვებით მითხარით, რა გჭირდებათ; ყოველ ცვლილებას ჯერ გაჩვენებთ.')}</p>
        {status.examples.length > 0 && <div className="tw-dola__chips">{status.examples
            .map(chip => <button key={chip} type="button" className="tw-dola__chip" disabled={busy || !status.available} onClick={() => void send(chip)}>{chip}</button>)}</div>}
    </div>;

    return <>
        {!open && location.pathname.startsWith('/team-work') && <button type="button" className="tw-dola-launch" onClick={() => setOpen(true)} aria-label={copy('Ask Dola', 'ჰკითხე დოლას')}>
            <Sparkles aria-hidden="true" /><span>{copy('Ask Dola', 'ჰკითხე დოლას')}</span>
        </button>}
        {open && createPortal(<GkRoot className="tw-dola-layer" {...{ [DIALOG_COMPANION]: '' }}>
        {/* Escape closes the panel only, not the drawer or the guide behind it. */}
        <aside className="tw-dola" role="dialog" aria-label="Agent Dola" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } }}>
            <header className="tw-dola__head">
                <span className="tw-dola__title"><Sparkles aria-hidden="true" />Agent Dola</span>
                {team && <Button size="sm" variant="ghost" iconOnly className="tw-dola__trace-toggle" aria-pressed={tracing} onClick={() => setTracing(!tracing)}
                    aria-label={copy('Show how Dola understood each reply', 'მაჩვენე, როგორ გაიგო დოლამ თითოეული პასუხი')}
                    title={tracing ? copy('How Dola understood this: on', 'როგორ გაიგო დოლამ: ჩართულია') : copy('How Dola understood this: off', 'როგორ გაიგო დოლამ: გამორთულია')}>
                    <ScanSearch aria-hidden="true" /></Button>}
                <Button size="sm" variant="ghost" iconOnly disabled={busy || turns.length === 0} onClick={() => void restart()} aria-label={copy('New conversation', 'ახალი საუბარი')} title={copy('New conversation', 'ახალი საუბარი')}><Plus aria-hidden="true" /></Button>
                <Button size="sm" variant="ghost" iconOnly onClick={() => setOpen(false)} aria-label={copy('Close', 'დახურვა')} title={copy('Close', 'დახურვა')}><X aria-hidden="true" /></Button>
            </header>
            {/* aria-busy: a screen reader reads the finished answer once, not every word as it comes. */}
            <div className="tw-dola__body" aria-live="polite" aria-busy={Boolean(live?.words)}>
                {!status.available && <p className="gk-notice">{unavailableText(status, copy, team)}</p>}
                {status.available && team && writerProblemText(status.writerProblem, copy) && <p className="gk-notice">{writerProblemText(status.writerProblem, copy)}</p>}
                {turns.length === 0 && welcome}
                {shown.map(turn => <div key={turn.id} className="tw-dola__turn">
                    {turn.picture && <img className="tw-dola__picture tw-dola__picture--mine" src={resolveMediaUrl(turn.picture)}
                        alt={copy('Your picture', 'თქვენი სურათი')} />}
                    {turn.message && <p className="tw-dola__mine">{turn.message}</p>}
                    <Answer turn={turn} now={now} busy={busy} copy={copy} onDecide={(target, decision) => void decide(target, decision)} onQuick={chip => void send(chip)} onGuide={guide} />
                    {live?.id === turn.id && !turn.answer && live.words && <div className="tw-dola__answer tw-dola__answer--writing">
                        <p><Words text={soFar(live.words)} /><span className="tw-dola__caret" aria-hidden="true" /></p>
                    </div>}
                </div>)}
                {busy && !live?.words && <p key={live?.step ?? 'thinking'} className="tw-dola__thinking" role="status">{live?.step ?? copy('Dola is thinking…', 'დოლა ფიქრობს…')}</p>}
                <div ref={end} />
            </div>
            {error && <p className="gk-notice gk-notice--danger tw-dola__error" role="alert">{error}</p>}
            {field && guiding && <section className="tw-dola__about" aria-label={copy('The field you are on', 'ველი, რომელზეც ხართ')}>
                <p><span>{copy(`${guiding.guide.title || 'Guide'} · step ${guiding.index + 1} of ${guiding.steps.length}`, `${guiding.guide.title || 'გზამკვლევი'} · ნაბიჯი ${guiding.index + 1} / ${guiding.steps.length}`)}</span>
                    <strong>{field.label}</strong></p>
                <div className="tw-dola__chips">
                    <button type="button" className="tw-dola__chip" disabled={busy || !status.available} onClick={() => void send(copy(`What is “${field.label}”?`, `რა არის „${field.label}“?`))}>{copy(`What is “${field.label}”?`, `რა არის „${field.label}“?`)}</button>
                    <button type="button" className="tw-dola__chip tw-dola__chip--back" onClick={() => setOpen(false)}><ArrowRight aria-hidden="true" />{copy('Back to the form', 'ფორმაზე დაბრუნება')}</button>
                </div>
            </section>}
            {(picture || uploading) && <div className="tw-dola__attached">
                {picture ? <img src={resolveMediaUrl(picture.url)} alt={copy('Picture to send', 'გასაგზავნი სურათი')} />
                    : <span className="tw-dola__attached-wait" role="status">{copy('Adding the picture…', 'სურათი ემატება…')}</span>}
                {picture && <span>{copy('Goes with your next message. Tell me what to do with it, or just send it.',
                    'შემდეგ შეტყობინებასთან ერთად გაიგზავნება. მითხარით, რა ვუყო, ან უბრალოდ გამოგზავნეთ.')}</span>}
                {picture && <Button size="sm" variant="ghost" iconOnly disabled={busy} onClick={() => setPicture(null)}
                    aria-label={copy('Remove the picture', 'სურათის მოშორება')} title={copy('Remove the picture', 'სურათის მოშორება')}><X aria-hidden="true" /></Button>}
            </div>}
            <form className="tw-dola__compose" onSubmit={event => { event.preventDefault(); void send(draft, true); }}>
                {status.pictures && <>
                    <input ref={pictureInput} type="file" accept={PICTURE_TYPES} hidden tabIndex={-1}
                        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void attach(file); }} />
                    <Button size="sm" variant="ghost" iconOnly disabled={busy || uploading || !status.available} onClick={() => pictureInput.current?.click()}
                        aria-label={copy('Send a picture', 'სურათის გაგზავნა')} title={copy('Send a picture', 'სურათის გაგზავნა')}><ImagePlus aria-hidden="true" /></Button>
                </>}
                <textarea ref={input} className="gk-input" rows={2} value={draft} maxLength={status.maxMessageLength} disabled={!status.available} onPaste={onPaste}
                    placeholder={field ? copy(`Ask about “${field.label}” or anything else…`, `იკითხეთ „${field.label}“-ზე ან სხვა რამეზე…`)
                        : team ? copy('Ask Dola, or paste a worker’s report…', 'ჰკითხეთ დოლას, ან ჩასვით მუშის რეპორტი…')
                        : copy('Ask Dola anything about your football here…', 'ჰკითხეთ დოლას ნებისმიერი რამ აქაურ ფეხბურთზე…')}
                    aria-label={copy('Message to Dola', 'შეტყობინება დოლას')} onChange={event => setDraft(event.target.value)} onKeyDown={onKey} />
                <Button type="submit" variant="primary" size="sm" iconOnly disabled={busy || uploading || (!draft.trim() && !picture) || !status.available} aria-label={copy('Send', 'გაგზავნა')}><Send aria-hidden="true" /></Button>
            </form>
        </aside>
        </GkRoot>, document.body)}
    </>;
}
