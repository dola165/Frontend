import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Check } from 'lucide-react';
import { Button, ButtonLink, GkRoot, LoadFailed } from '../../design/primitives';
import { FaceStack, type Face } from '../../design/visuals';
import { extractApiErrorMessage } from '../../utils/apiError';
import { HelperEmailWait } from '../../components/auth/EmailWait';
import { needsConfirmedEmail } from '../../components/auth/emailConfirmation';
import { formatDate, formatTime } from '../../utils/formatting';
import { useCopy } from '../../locales/useCopy';
import { mySquadsEn } from '../../locales/mySquadsDesign';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { ActivityBadge } from '../clubWorkspace/coachHub/CoachVisuals';
import { acceptHelping, helperInvitations, helping, register, saveRegister, stopHelping, type Helping, type HelperInvitation, type HelpingPlayer } from './api';
import './helpers.css';

const TONE: Record<string, Face['tone']> = { GOING: 'accent', NOT_GOING: 'danger', UNANSWERED: 'warning', UNSURE: 'info' };
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
/** First names, with the last name's initial where two players in the register share one ("Mako B.", "Mako K."). */
const namesOf = (players: HelpingPlayer[]) => new Map(players.map(p => [p.id,
    p.lastInitial && players.some(other => other.id !== p.id && other.firstName === p.firstName) ? `${p.firstName} ${p.lastInitial}.` : p.firstName]));

/**
 * Home for a helper (decision 3): the session they help at, its place and coach, who's coming by first name (no photos,
 * no contacts), and its register with Save who came. Nothing else of the club: no other days or places, no My squads.
 * Someone who helps nowhere sees nothing; a Home that couldn't ask says so, with Try again. A new helper whose email
 * waits sees "Confirm your email to see your session" with Resend (claiming their link confirms nothing).
 */
export function HelpingCard({ helperId, sessionId }: { helperId?: number; sessionId?: number } = {}) {
    const copy = useCopy('mySquads', mySquadsEn);
    const words = useJourneyCopy();
    const [loaded, setLoaded] = useState(false);
    const [sessions, setSessions] = useState<Helping[]>([]);
    const [invitations, setInvitations] = useState<HelperInvitation[]>([]);
    const [revision, setRevision] = useState(0), [failed, setFailed] = useState(false), [emailWait, setEmailWait] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        void helperInvitations(controller.signal).then(rows => { if (!controller.signal.aborted) setInvitations(rows); }).catch(() => undefined);
        void helping(controller.signal).then(rows => { if (!controller.signal.aborted) { setSessions(rows); setFailed(false); setEmailWait(false); setLoaded(true); } })
            .catch(error => {
                if (controller.signal.aborted) return;
                setSessions([]); setLoaded(true);
                setEmailWait(needsConfirmedEmail(error));
                setFailed(!(isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0)));
            });
        return () => controller.abort();
    }, [revision]);
    const reload = () => setRevision(value => value + 1);
    const next = sessions.find(session => (helperId == null || session.helperId === helperId) && (sessionId == null || session.sessionId === sessionId));
    const asks = invitations.filter(invitation => sessionId == null && (helperId == null || invitation.helperId === helperId)).map(invitation => <HelperAsk key={invitation.helperId} invitation={invitation} onAnswered={reload} />);
    if (emailWait) return <GkRoot><HelperEmailWait what={null} session next="/home" /></GkRoot>;
    if (failed && !next) return <GkRoot>{asks}<LoadFailed text={copy('helpingFailed')} retry={copy('tryAgain')} onRetry={reload} /></GkRoot>;
    if (!next) return asks.length ? <GkRoot>{asks}</GkRoot> : (helperId || sessionId) ? <p role="status">{loaded ? words('This session is no longer available to you.', 'ეს ვარჯიში თქვენთვის აღარ არის ხელმისაწვდომი.') : words('Loading your session…', 'თქვენი ვარჯიში იტვირთება…')}</p> : null;
    return <GkRoot>{asks}<HelpingSession key={`${next.helperId}-${next.sessionId ?? `m${next.eventId}`}`} session={next} onStopped={reload} /></GkRoot>;
}

/** "Koba added you as a helper: U12 Mixed, Tue 17:00 · Accept / Not for me": nothing opens before Accept. */
function HelperAsk({ invitation, onAnswered }: { invitation: HelperInvitation; onAnswered: () => void }) {
    const copy = useCopy('mySquads', mySquadsEn);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const when = invitation.startsAt ? new Date(invitation.startsAt) : null;
    const answer = async (yes: boolean) => {
        setBusy(true); setError('');
        try { await (yes ? acceptHelping(invitation.helperId) : stopHelping(invitation.helperId)); onAnswered(); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('answerFailed'))); setBusy(false); }
    };
    const where = [invitation.squadName, when ? `${formatDate(when, { weekday: 'short' })} ${formatTime(when)}` : null].filter(Boolean).join(', ');
    return <section className="gk-panel hp-ask" aria-label={copy('invitedHelper', { name: invitation.addedBy ?? invitation.clubName })}>
        <ActivityBadge kind="TRAINING" size={36} />
        <span className="hp-card__title">
            <strong>{copy('invitedHelper', { name: invitation.addedBy ?? invitation.clubName })}</strong>
            <span className="hp-quiet">{[where, invitation.title, invitation.clubName].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="hp-ask__actions">
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void answer(true)}>{copy('accept')}</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void answer(false)}>{copy('notForMe')}</Button>
        </span>
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </section>;
}

function HelpingSession({ session, onStopped }: { session: Helping; onStopped: () => void }) {
    const copy = useCopy('mySquads', mySquadsEn);
    const [players, setPlayers] = useState<HelpingPlayer[]>(session.players);
    const [revision, setRevision] = useState(session.registerRevision);
    // Until a register is saved, the likely answer is ticked: the players whose family said they're coming.
    const [came, setCame] = useState<Set<number>>(() => new Set(session.players.filter(p => p.register ? p.register === 'ARRIVED' : p.response === 'GOING').map(p => p.id)));
    const [busy, setBusy] = useState(false), [notice, setNotice] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
    const requestId = useRef(crypto.randomUUID());
    const start = new Date(session.startsAt), today = sameDay(start, new Date());
    const when = today ? copy('helpingToday', { time: formatTime(start) }) : copy('helpingOn', { day: formatDate(start, { weekday: 'long' }), time: formatTime(start) });
    const names = namesOf(players);
    const count = (response: string) => players.filter(p => p.response === response).length;
    const cant = count('NOT_GOING'), waiting = count('UNANSWERED');
    const summary = [copy('coming', { count: count('GOING') }), cant ? copy('cant', { count: cant }) : '', waiting ? copy('notAnswered', { count: waiting }) : ''].filter(Boolean).join(' · ');
    // A changed tick is a new save: only a repeat of the very same save is a retry, which the server saves once.
    const toggle = (id: number) => {
        requestId.current = crypto.randomUUID();
        setCame(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };
    // A match the helper helps at (a session typed as a match became it): its page, no register.
    const match = session.sessionId == null && session.eventId != null ? session.eventId : null;
    const save = async () => {
        if (session.sessionId == null) return;
        const sessionId = session.sessionId;
        setBusy(true); setNotice(null);
        try {
            const saved = await saveRegister(sessionId, { came: [...came], requestId: requestId.current, revision });
            // The ticks and the count are the register as the server keeps it (a coach's arrivals included).
            const arrived = saved.players.filter(p => p.register === 'ARRIVED').map(p => p.id);
            setPlayers(saved.players); setRevision(saved.revision); setCame(new Set(arrived));
            requestId.current = crypto.randomUUID();
            setNotice({ tone: 'success', text: copy('registerSaved', { count: arrived.length }) });
            window.dispatchEvent(new Event('requests-updated'));
        } catch (error) {
            const changed = isAxiosError(error) && error.response?.status === 409 && error.response.data?.code === 'REGISTER_CHANGED';
            setNotice({ tone: 'danger', text: changed ? copy('registerChanged') : extractApiErrorMessage(error, copy('registerFailed')) });
            // Someone saved in between: show the register as it is now, the coach's ticks added to the helper's, to save again.
            if (isAxiosError(error) && error.response?.status === 409) {
                requestId.current = crypto.randomUUID();
                const fresh = await register(sessionId).catch(() => null);
                if (fresh) { setPlayers(fresh.players); setRevision(fresh.revision); setCame(current => new Set([...current, ...fresh.players.filter(p => p.register === 'ARRIVED').map(p => p.id)])); }
            }
        }
        finally { setBusy(false); }
    };
    const stop = async () => {
        if (!window.confirm(copy('stopHelpingConfirm', { squad: session.squadName }))) return;
        try { await stopHelping(session.helperId); onStopped(); }
        catch (error) { setNotice({ tone: 'danger', text: extractApiErrorMessage(error, copy('stopHelpingFailed')) }); }
    };
    const faces: Face[] = players.map(p => ({ id: p.id, name: names.get(p.id) ?? p.firstName, tone: TONE[p.response] }));
    return <section className="gk-panel hp-card" aria-label={when}>
        <div className="hp-card__top">
            <ActivityBadge kind={match ? (session.kind === 'MATCH' ? 'MATCH' : 'FRIENDLY') : 'TRAINING'} size={36} />
            <span className="hp-card__title">
                <strong>{when}</strong>
                <span className="hp-quiet">{[session.squadName, session.title, session.location, session.coach ? copy('withCoach', { name: session.coach }) : null].filter(Boolean).join(' · ')}</span>
            </span>
        </div>
        {match ? <ButtonLink to={`/matches/${match}`}>{copy('openMatch')}</ButtonLink>
            : <span className="hp-card__coming"><FaceStack people={faces} max={8} size={26} label={summary} /><span className="hp-quiet">{summary}</span></span>}
        {session.registerOpen && <>
            <ul className="hp-register" aria-label={copy('register')}>{players.map(player => <li key={player.id}>
                <label className="hp-register__row">
                    <input type="checkbox" checked={came.has(player.id)} onChange={() => toggle(player.id)} />
                    <span className="hp-register__name">{names.get(player.id)}</span>
                    {player.register && <span className={`hp-status${player.register === 'ARRIVED' ? '' : ' hp-status--danger'}`}>{copy(player.register === 'ARRIVED' ? 'cameShort' : 'absentShort')}</span>}
                    {came.has(player.id) && <Check aria-hidden="true" className="hp-register__tick" />}
                </label>
            </li>)}</ul>
            <Button variant="primary" disabled={busy} onClick={() => void save()}>{copy('saveWhoCame')}</Button>
        </>}
        {notice && <p className={`gk-notice ${notice.tone === 'danger' ? 'gk-notice--danger' : 'hp-notice--success'}`} role="status">{notice.text}</p>}
        <button type="button" className="hp-card__stop" onClick={() => void stop()}>{copy('stopHelping')}</button>
    </section>;
}
