import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Check } from 'lucide-react';
import { Button, GkRoot, LoadFailed } from '../../design/primitives';
import { FaceStack, type Face } from '../../design/visuals';
import { extractApiErrorMessage } from '../../utils/apiError';
import { formatDate, formatTime } from '../../utils/formatting';
import { useCopy } from '../../locales/useCopy';
import { mySquadsEn } from '../../locales/mySquadsDesign';
import { ActivityBadge } from '../clubWorkspace/coachHub/CoachVisuals';
import { helping, register, saveRegister, stopHelping, type Helping, type HelpingPlayer } from './api';
import './helpers.css';

const TONE: Record<string, Face['tone']> = { GOING: 'accent', NOT_GOING: 'danger', UNANSWERED: 'warning', UNSURE: 'info' };
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
/** First names, with the last name's initial where two players in the register share one ("Mako B.", "Mako K."). */
const namesOf = (players: HelpingPlayer[]) => new Map(players.map(p => [p.id,
    p.lastInitial && players.some(other => other.id !== p.id && other.firstName === p.firstName) ? `${p.firstName} ${p.lastInitial}.` : p.firstName]));

/**
 * Home for a helper (decision 3): the session they help at, its place and coach, who's coming by first name (no photos,
 * no contacts), and its register with Save who came. Nothing else of the club: no other days or places, no My squads.
 * Someone who helps nowhere sees nothing; a Home that couldn't ask says so, with Try again.
 */
export function HelpingCard() {
    const copy = useCopy('mySquads', mySquadsEn);
    const [sessions, setSessions] = useState<Helping[]>([]);
    const [revision, setRevision] = useState(0), [failed, setFailed] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        void helping(controller.signal).then(rows => { if (!controller.signal.aborted) { setSessions(rows); setFailed(false); } })
            .catch(error => { if (!controller.signal.aborted) setFailed(!(isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0))); });
        return () => controller.abort();
    }, [revision]);
    const reload = () => setRevision(value => value + 1);
    const next = sessions[0];
    if (failed && !next) return <GkRoot><LoadFailed text={copy('helpingFailed')} retry={copy('tryAgain')} onRetry={reload} /></GkRoot>;
    if (!next) return null;
    return <GkRoot><HelpingSession key={`${next.helperId}-${next.sessionId}`} session={next} onStopped={reload} /></GkRoot>;
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
    const save = async () => {
        setBusy(true); setNotice(null);
        try {
            const saved = await saveRegister(session.sessionId, { came: [...came], requestId: requestId.current, revision });
            // The ticks and the count are the register as the server keeps it (a coach's arrivals included).
            const arrived = saved.players.filter(p => p.register === 'ARRIVED').map(p => p.id);
            setPlayers(saved.players); setRevision(saved.revision); setCame(new Set(arrived));
            requestId.current = crypto.randomUUID();
            setNotice({ tone: 'success', text: copy('registerSaved', { count: arrived.length }) });
        } catch (error) {
            const changed = isAxiosError(error) && error.response?.status === 409 && error.response.data?.code === 'REGISTER_CHANGED';
            setNotice({ tone: 'danger', text: changed ? copy('registerChanged') : extractApiErrorMessage(error, copy('registerFailed')) });
            // Someone saved in between: show the register as it is now, the coach's ticks added to the helper's, to save again.
            if (isAxiosError(error) && error.response?.status === 409) {
                requestId.current = crypto.randomUUID();
                const fresh = await register(session.sessionId).catch(() => null);
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
            <ActivityBadge kind="TRAINING" size={36} />
            <span className="hp-card__title">
                <strong>{when}</strong>
                <span className="hp-quiet">{[session.squadName, session.title, session.location, session.coach ? copy('withCoach', { name: session.coach }) : null].filter(Boolean).join(' · ')}</span>
            </span>
        </div>
        <span className="hp-card__coming"><FaceStack people={faces} max={8} size={26} label={summary} /><span className="hp-quiet">{summary}</span></span>
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
