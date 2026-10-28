import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button, GkRoot } from '../../design/primitives';
import { FaceStack, type Face } from '../../design/visuals';
import { extractApiErrorMessage } from '../../utils/apiError';
import { formatDate, formatTime } from '../../utils/formatting';
import { useCopy } from '../../locales/useCopy';
import { mySquadsEn } from '../../locales/mySquadsDesign';
import { ActivityBadge } from '../clubWorkspace/coachHub/CoachVisuals';
import { helping, saveRegister, stopHelping, type Helping, type HelpingPlayer } from './api';
import './helpers.css';

const TONE: Record<string, Face['tone']> = { GOING: 'accent', NOT_GOING: 'danger', UNANSWERED: 'warning', UNSURE: 'info' };
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/**
 * Home for a helper (decision 3): the session they help at, its place and coach, who's coming by first name (no photos,
 * no contacts), and its register with Save who came. Nothing else of the club: no other days or places, no My squads.
 */
export function HelpingCard() {
    const [sessions, setSessions] = useState<Helping[]>([]);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        void helping(controller.signal).then(rows => { if (!controller.signal.aborted) setSessions(rows); }).catch(() => { /* Not a helper anywhere: nothing on Home. */ });
        return () => controller.abort();
    }, [revision]);
    const next = sessions[0];
    if (!next) return null;
    return <GkRoot><HelpingSession key={`${next.helperId}-${next.sessionId}`} session={next} onStopped={() => setRevision(value => value + 1)} /></GkRoot>;
}

function HelpingSession({ session, onStopped }: { session: Helping; onStopped: () => void }) {
    const copy = useCopy('mySquads', mySquadsEn);
    const [players, setPlayers] = useState<HelpingPlayer[]>(session.players);
    // Until a register is saved, the likely answer is ticked: the players whose family said they're coming.
    const [came, setCame] = useState<Set<number>>(() => new Set(session.players.filter(p => p.register ? p.register === 'ARRIVED' : p.response === 'GOING').map(p => p.id)));
    const [busy, setBusy] = useState(false), [notice, setNotice] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
    const requestId = useRef(crypto.randomUUID());
    const start = new Date(session.startsAt), today = sameDay(start, new Date());
    const when = today ? copy('helpingToday', { time: formatTime(start) }) : copy('helpingOn', { day: formatDate(start, { weekday: 'long' }), time: formatTime(start) });
    const count = (response: string) => players.filter(p => p.response === response).length;
    const cant = count('NOT_GOING'), waiting = count('UNANSWERED');
    const summary = [copy('coming', { count: count('GOING') }), cant ? copy('cant', { count: cant }) : '', waiting ? copy('notAnswered', { count: waiting }) : ''].filter(Boolean).join(' · ');
    const toggle = (id: number) => setCame(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    const save = async () => {
        setBusy(true); setNotice(null);
        try {
            setPlayers(await saveRegister(session.sessionId, [...came], requestId.current));
            requestId.current = crypto.randomUUID();
            setNotice({ tone: 'success', text: copy('registerSaved', { count: came.size }) });
        } catch (error) { setNotice({ tone: 'danger', text: extractApiErrorMessage(error, copy('registerFailed')) }); }
        finally { setBusy(false); }
    };
    const stop = async () => {
        if (!window.confirm(copy('stopHelpingConfirm', { squad: session.squadName }))) return;
        try { await stopHelping(session.helperId); onStopped(); }
        catch (error) { setNotice({ tone: 'danger', text: extractApiErrorMessage(error, copy('stopHelpingFailed')) }); }
    };
    const faces: Face[] = players.map(p => ({ id: p.id, name: p.firstName, tone: TONE[p.response] }));
    return <section className="gk-panel hp-card" aria-label={when}>
        <div className="hp-card__top">
            <ActivityBadge kind="TRAINING" size={36} />
            <span className="hp-card__title">
                <strong>{when}</strong>
                <span className="ch-quiet">{[session.squadName, session.title, session.location, session.coach ? copy('withCoach', { name: session.coach }) : null].filter(Boolean).join(' · ')}</span>
            </span>
        </div>
        <span className="hp-card__coming"><FaceStack people={faces} max={8} size={26} label={summary} /><span className="ch-quiet">{summary}</span></span>
        {session.registerOpen && <>
            <ul className="hp-register" aria-label={copy('register')}>{players.map(player => <li key={player.id}>
                <label className="hp-register__row">
                    <input type="checkbox" checked={came.has(player.id)} onChange={() => toggle(player.id)} />
                    <span className="hp-register__name">{player.firstName}</span>
                    {player.register && <span className={`cw-status${player.register === 'ARRIVED' ? '' : ' cw-status--danger'}`}>{copy(player.register === 'ARRIVED' ? 'cameShort' : 'absentShort')}</span>}
                    {came.has(player.id) && <Check aria-hidden="true" className="hp-register__tick" />}
                </label>
            </li>)}</ul>
            <Button variant="primary" disabled={busy} onClick={() => void save()}>{copy('saveWhoCame')}</Button>
        </>}
        {notice && <p className={`gk-notice ${notice.tone === 'danger' ? 'gk-notice--danger' : 'cw-notices__success'}`} role="status">{notice.text}</p>}
        <button type="button" className="hp-card__stop" onClick={() => void stop()}>{copy('stopHelping')}</button>
    </section>;
}
