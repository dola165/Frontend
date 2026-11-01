import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Trophy } from 'lucide-react';
import { Button } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { relativeTime } from '../../utils/relativeTime';
import { matchPath, type MatchFrom } from '../matches/matchContext';
import { ScoreDialog } from '../scores/ScoreDialog';
import { writeScore } from '../scores/api';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { scoreTargetOf, type ResultWaiting } from './api';
import { refreshResultsWaiting, useResultsWaiting } from './useResultsWaiting';
import './actions.css';

type Copy = ReturnType<typeof useJourneyCopy>;
const score = (goals?: { home: number; away: number } | null) => goals ? `${goals.home}–${goals.away}` : '';
const teams = (item: ResultWaiting) => item.squadName && item.opponentName ? `${item.squadName} v ${item.opponentName}` : item.title;

/** What a row waits for, in words with the dot's colour: amber to decide, red when disputed. */
function stateOf(item: ResultWaiting, copy: Copy): { words: string; tone: 'warning' | 'danger' } {
    if (item.action === 'CONFIRM') return { words: copy(`They reported ${score(item.reported)}`, `მათ შეიყვანეს ${score(item.reported)}`), tone: 'warning' };
    if (item.action === 'SETTLE') return { words: copy('Disputed: yours to settle', 'სადავოა: თქვენ წყვეტთ'), tone: 'danger' };
    if (item.action === 'DISPUTED') return { words: copy(`Disputed ${score(item.reported)} / ${score(item.disputed)}`, `სადავოა ${score(item.reported)} / ${score(item.disputed)}`), tone: 'danger' };
    return { words: copy('Needs a result', 'შედეგი აკლია'), tone: 'warning' };
}

/**
 * Every match waiting on the person's score, one row each with its one tap (the 26 October score rules unchanged):
 * Report opens the score; Confirm agrees with the other side's report at once; Dispute opens the score with ours; a
 * dispute opens its match. Home, the inbox and My squads › Matches show this same list.
 */
export function ResultsWaitingList({ squadIds, limit, from, compact = false, onOpen }: {
    /** Only these squads' matches (My squads with a squad picked). */ squadIds?: number[]; limit?: number;
    /** Where the match page opens from. */ from?: (item: ResultWaiting) => MatchFrom | null; compact?: boolean;
    /** Opening a match (the inbox closes itself). */ onOpen?: () => void;
}) {
    const copy = useJourneyCopy();
    const { sessionId } = useAuth();
    const waiting = useResultsWaiting();
    const [open, setOpen] = useState<ResultWaiting | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const [error, setError] = useState('');
    const items = (waiting ?? []).filter(item => !squadIds || (item.squadId != null && squadIds.includes(item.squadId)));
    if (!items.length) return null;
    const shown = limit ? items.slice(0, limit) : items;
    const page = (item: ResultWaiting) => item.kind === 'MATCH_EXCHANGE' ? matchPath(item.id, from?.(item) ?? (item.squadId ? { kind: 'squad', id: item.squadId } : null), '#result') : null;
    const confirm = async (item: ResultWaiting) => {
        if (item.revision == null || !item.answerAs) { setOpen(item); return; }
        setBusy(item.id); setError('');
        try {
            await writeScore(scoreTargetOf(item), { action: 'confirm', body: { side: item.answerAs, revision: item.revision, requestId: crypto.randomUUID() } }, new AbortController().signal, sessionId);
            refreshResultsWaiting();
        } catch (cause) {
            // A score changed meanwhile: the list reads again and the row shows what now waits.
            setError(extractApiErrorMessage(cause, copy('The score could not be confirmed. Try again.', 'ანგარიში ვერ დადასტურდა. სცადეთ თავიდან.')));
            refreshResultsWaiting();
        } finally { setBusy(null); }
    };
    return <>
        <ul className="gk-results-waiting" data-compact={compact || undefined} aria-label={copy('Results waiting', 'შედეგები ელოდება')}>
            {shown.map(item => {
                const state = stateOf(item, copy), to = page(item);
                return <li key={`${item.kind}:${item.id}`} className="gk-results-waiting__row">
                    <span className="gk-results-waiting__icon" aria-hidden="true"><Trophy /></span>
                    <span className="gk-results-waiting__text">
                        {to ? <Link to={to} onClick={onOpen}><strong>{teams(item)}</strong></Link> : <strong>{teams(item)}</strong>}
                        <small><span className="gk-action-dot" data-tone={state.tone} aria-hidden="true" /><b data-tone={state.tone}>{state.words}</b><span>{relativeTime(item.startsAt)}</span></small>
                    </span>
                    <span className="gk-results-waiting__do">
                        {item.action === 'CONFIRM' ? <>
                            <Button size="sm" variant="primary" disabled={busy === item.id} onClick={() => void confirm(item)}>{copy('Confirm', 'დადასტურება')}</Button>
                            <Button size="sm" variant="ghost" disabled={busy === item.id} onClick={() => setOpen(item)}>{copy('Dispute', 'გასაჩივრება')}</Button>
                        </> : item.action === 'SETTLE' || item.action === 'DISPUTED'
                            ? to && <Link className="gk-results-waiting__open" to={to} onClick={onOpen} aria-label={copy(`Open ${teams(item)}`, `${teams(item)} — გახსნა`)}><ArrowRight aria-hidden="true" /></Link>
                            : <Button size="sm" variant="primary" onClick={() => setOpen(item)}>{copy('Report', 'შეყვანა')}</Button>}
                    </span>
                </li>;
            })}
        </ul>
        {items.length > shown.length && <p className="gk-faint gk-results-waiting__more">{copy(`${items.length - shown.length} more waiting`, `კიდევ ${items.length - shown.length} ელოდება`)}</p>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        {open && <ScoreDialog target={scoreTargetOf(open)} title={teams(open)} description={teams(open)} reportAs={open.reportAs ?? null}
            onClose={() => setOpen(null)} onChanged={() => { refreshResultsWaiting(); }} />}
    </>;
}
