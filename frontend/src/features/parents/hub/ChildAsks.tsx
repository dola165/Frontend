import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { Button, Section } from '../../../design/primitives';
import { Crest } from '../../../design/visuals';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { playerPath } from '../playerSelection';
import type { JoiningChild } from '../api';
import { firstName } from './childFacts';
import { answerAsk, askWords, fetchAsks, STANDING, type Ask } from './familyAsks';
import './parent-hub.css';

/**
 * The parents' one list of asks, top of a child's page: photos, trips and a note for the coach, the club's own requests
 * and the consent to play. Each row has the club's crest, one line, and Yes / No in place. Any parent answers and the first
 * answer counts, shown with who gave it; answers fold away with Change. The three standing asks stay no until someone says
 * yes, and nothing waits on them.
 */
export function ChildAsks({ child, revision, onChanged }: { child: JoiningChild; revision: number; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const first = firstName(child);
    const [asks, setAsks] = useState<Ask[] | null>(null);
    const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const abort = new AbortController();
        fetchAsks(child.playerId, abort.signal).then(found => { if (!abort.signal.aborted) { setAsks(found); setFailed(false); } })
            .catch(() => { if (!abort.signal.aborted) setFailed(true); });
        return () => abort.abort();
    }, [child.playerId, revision, attempt]);
    const answered = useCallback((next: Ask[]) => { setAsks(next); onChanged(); }, [onChanged]);
    if (failed && !asks) return <p className="ph-quiet" role="status">{copy('Couldn’t load the questions.', 'კითხვები ვერ ჩაიტვირთა.')} <button type="button" className="ph-link" onClick={() => setAttempt(v => v + 1)}>{copy('Try again', 'ხელახლა ცდა')}</button></p>;
    if (!asks) return null;
    const concernDoor = <Link className="ph-asks__concern" to={playerPath('/parent?tab=connections&concern=1', child.playerId)}>{copy('Worried about something? Raise a concern', 'რამე გაწუხებთ? შეგვატყობინეთ')}</Link>;
    // With nothing to ask, as after a parent's no to the club, the way to raise a concern stays.
    if (!asks.length) return concernDoor;
    const open = asks.filter(ask => ask.answer === 'WAITING'), done = asks.filter(ask => ask.answer !== 'WAITING');
    const row = (ask: Ask) => <AskRow key={ask.key} ask={ask} child={child.playerId} first={first} several={new Set(asks.map(a => a.clubId)).size > 1} onAnswered={answered} onStale={() => setAttempt(v => v + 1)} />;
    return <Section boxed icon={ClipboardCheck} title={copy('Asks', 'კითხვები')} className="ph-section ph-asks" id="asks">
        {open.length > 0 && <ul className="ph-rows">{open.map(row)}</ul>}
        {done.length > 0 && <details className="ph-asks__done" open={!open.length || undefined}>
            <summary>{copy(`Your answers · ${done.length}`, `თქვენი პასუხები · ${done.length}`)}</summary>
            <ul className="ph-rows">{done.map(row)}</ul>
        </details>}
        {concernDoor}
    </Section>;
}

function AskRow({ ask, child, first, several, onAnswered, onStale }: { ask: Ask; child: number; first: string; several: boolean; onAnswered: (next: Ask[]) => void; onStale: () => void }) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [changing, setChanging] = useState(false), [writing, setWriting] = useState(false), [note, setNote] = useState(ask.note ?? '');
    const words = askWords(ask, first, copy);
    const standing = STANDING.includes(ask.kind), waiting = ask.answer === 'WAITING';
    const send = async (yes: boolean, text?: string) => {
        if (busy) return;
        setBusy(true); setError('');
        try { onAnswered(await answerAsk(child, ask, yes, text)); setChanging(false); setWriting(false); }
        catch (failure) {
            setError(extractApiErrorMessage(failure, copy('Couldn’t save your answer. Try again.', 'პასუხი ვერ შეინახა. სცადეთ ხელახლა.')));
            onStale();
        } finally { setBusy(false); }
    };
    const pick = (yes: boolean) => { if (yes && ask.kind === 'MEDICAL') setWriting(true); else void send(yes); };
    const who = ask.answeredBy ? `${ask.answer === 'YES' ? copy('Yes', 'დიახ') : copy('No', 'არა')} · ${ask.answeredBy}${ask.answeredAt ? ` · ${new Date(ask.answeredAt).toLocaleDateString()}` : ''}` : '';
    const showButtons = ask.canAnswer && (waiting || changing);
    return <li className="ph-ask">
        <div className="ph-ask__line">
            {waiting && !standing ? <span className="ph-dot ph-dot--decide" aria-hidden="true" /> : null}
            <Crest src={ask.crestUrl} name={ask.clubName} size={32} />
            <span className="ph-row__text"><strong>{words.title}</strong>
                <small>{several && standing ? `${ask.clubName} · ` : ''}{waiting || changing ? words.detail : who}</small>
                {ask.note && !writing && <small className="ph-ask__note">{ask.note}</small>}</span>
            {showButtons
                ? <span className="ph-ask__answer" role="group" aria-label={words.title}>
                    <Button size="sm" variant={ask.answer === 'YES' ? 'primary' : 'secondary'} aria-pressed={ask.answer === 'YES'} disabled={busy} onClick={() => pick(true)}>{copy('Yes', 'დიახ')}</Button>
                    <Button size="sm" variant="secondary" aria-pressed={ask.answer === 'NO' || (waiting && standing)} disabled={busy} onClick={() => pick(false)}>{copy('No', 'არა')}</Button>
                </span>
                : ask.canAnswer && <button type="button" className="ph-link" onClick={() => setChanging(true)}>{copy('Change', 'შეცვლა')}</button>}
        </div>
        {writing && <form className="ph-ask__write" onSubmit={event => { event.preventDefault(); void send(true, note.trim()); }}>
            <label>{copy('What should the coach know?', 'რა უნდა იცოდეს მწვრთნელმა?')}
                <textarea value={note} maxLength={500} rows={2} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
            <span className="ph-ask__answer">
                <Button size="sm" variant="primary" type="submit" disabled={busy || !note.trim()}>{copy('Tell the coach', 'მწვრთნელს გაუზიარეთ')}</Button>
                <Button size="sm" variant="ghost" type="button" disabled={busy} onClick={() => setWriting(false)}>{copy('Not now', 'ახლა არა')}</Button>
            </span>
        </form>}
        {error && <p className="ph-quiet" role="alert">{error}</p>}
    </li>;
}
