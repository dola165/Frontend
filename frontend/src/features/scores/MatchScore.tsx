import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Status } from '../../design/DataTable';
import { Button } from '../../design/primitives';
import { Crest } from '../../design/visuals';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorCode, extractApiErrorMessage } from '../../utils/apiError';
import { formatTime } from '../../utils/formatting';
import { useResultCopy } from '../matchHistory/copy';
import { useClock } from '../matchExchange/hooks';
import { getScoreRecord, writeScore, type ScoreKind, type ScoreRecord, type ScoreWrite } from './api';
import { correctWindow, disputeWindow, goals, partyName, scoreState } from './status';
import { ScoreAnswer } from './ScoreAnswer';
import { ScoreHistoryList } from './ScoreHistoryList';
import type { Team } from './ScoreInputs';
import './scores.css';

export type ScoreTeams = { home: Team; away: Team };
/**
 * `revision` is the newest one the page has seen elsewhere (its summary): a newer one than the card holds reloads it.
 * `line` is false where the page already shows both teams and the score (the match page's fixture band).
 * `kind` is CALENDAR for a match on a club's own calendar (`eventId` is then the calendar event).
 */
type Props = ScoreTeams & { eventId: number; kind?: ScoreKind; revision?: number; onChanged?: () => void; title?: boolean; line?: boolean };

/**
 * One match's score as a shared record: what stands, who reported it, and the one thing this person can do now
 * (report, confirm or dispute, settle, or correct a one-sided calendar score), then its history. The same card on the
 * match page, on calendar events and in every dialog that opens a finished match. Buttons follow the record's own
 * permissions; nobody involved can edit a score the other club can answer.
 */
export function MatchScore(props: Props) {
  const { sessionId } = useAuth();
  return <ScoreCard key={`${sessionId}:${props.kind ?? 'EXCHANGE'}:${props.eventId}`} {...props} />;
}

function ScoreCard({ eventId, kind = 'EXCHANGE', revision, home, away, onChanged, title = true, line = true }: Props) {
  const { sessionId } = useAuth();
  const { copy } = useResultCopy();
  const now = useClock();
  const [record, setRecord] = useState<ScoreRecord>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false), alive = useRef(true);
  const loader = useRef<AbortController | undefined>(undefined), writer = useRef<AbortController | undefined>(undefined);
  const failed = copy('The score could not load.', 'ანგარიში ვერ ჩაიტვირთა.');

  const load = useCallback(async () => {
    loader.current?.abort();
    const controller = new AbortController(); loader.current = controller;
    try {
      const next = await getScoreRecord({ kind, eventId }, controller.signal, sessionId);
      if (controller.signal.aborted || !alive.current) return;
      // A slower read never replaces a newer record this card already holds.
      setRecord(current => current && current.revision > next.revision ? current : next); setError('');
    } catch (cause) {
      if (controller.signal.aborted || !alive.current) return;
      if (isAxiosError(cause) && [403, 404].includes(cause.response?.status ?? 0)) setRecord(undefined);
      setError(extractApiErrorMessage(cause, failed));
    }
  }, [eventId, kind, sessionId, failed]);

  useEffect(() => {
    alive.current = true;
    void load();
    const refresh = () => { if (document.visibilityState === 'visible' && !busyRef.current) void load(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { alive.current = false; loader.current?.abort(); writer.current?.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  const held = record?.revision;
  useEffect(() => { if (revision != null && held != null && revision > held && !busyRef.current) void load(); }, [revision, held, load]);

  /** Sends one action; the reply is the record as it now stands. A stale or already-answered record reloads instead. */
  const send = async (write: ScoreWrite, done: string) => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    loader.current?.abort();
    const controller = new AbortController(); writer.current = controller;
    try {
      const next = await writeScore({ kind, eventId }, write, controller.signal, sessionId);
      if (!alive.current) return false;
      setRecord(next); setNotice(done); onChanged?.();
      return true;
    } catch (cause) {
      if (controller.signal.aborted || !alive.current) return false;
      if (isAxiosError(cause) && cause.response?.status === 409 && ['RECORD_STALE', 'RECORD_ALREADY_REPORTED', 'RECORD_NOT_OPEN', 'RECORD_FINAL', 'RECORD_NOT_DISPUTED', 'RECORD_NOT_CORRECTABLE', 'RECORD_CORRECTION_CLOSED'].includes(extractApiErrorCode(cause) ?? '')) {
        setNotice(copy('The score changed meanwhile. This is the latest.', 'ანგარიში ამასობაში შეიცვალა. ეს უახლესი ვერსიაა.'));
        void load(); onChanged?.();
      } else setError(extractApiErrorMessage(cause, copy('That did not go through. Try again.', 'ვერ შესრულდა. სცადეთ ხელახლა.')));
      return false;
    } finally { if (alive.current) { busyRef.current = false; setBusy(false); } }
  };

  if (!record) return <section className="gk gk-score" aria-busy={!error} aria-label={copy('Score', 'ანგარიში')}>
    {title && <h2 className="gk-score__title">{copy('Score', 'ანგარიში')}</h2>}
    {error ? <p className="gk-score__error" role="alert">{error} <Button size="sm" variant="ghost" onClick={() => void load()}>{copy('Try again', 'ხელახლა')}</Button></p>
      : <p className="gk-score__quiet" role="status">{copy('Loading the score…', 'ანგარიში იტვირთება…')}</p>}
  </section>;

  const cancelled = record.fixtureStatus === 'CANCELLED';
  const state = scoreState(record.status, { legacy: record.legacy, cancelled });
  const who = (side: Parameters<typeof partyName>[0]) => partyName(side, home.name, away.name, copy);
  // The official score once there is one; until then the reported version, marked as such by the status beside it.
  const shown = record.official ? goals(record.homeScore, record.awayScore) : goals(record.reported?.homeScore, record.reported?.awayScore);
  const meta = record.status === 'REPORTED' && record.reported ? [copy(`Reported by ${who(record.reported.side)}`, `შეიტანა: ${who(record.reported.side)}`), disputeWindow(record.deadlines.disputeUntil, now, copy)]
    : record.status === 'SETTLED' && record.settled ? [copy(`Settled by ${who(record.settled.side)}`, `გადაწყვიტა: ${who(record.settled.side)}`)]
      : record.status === 'CONFIRMED' && record.reported ? [copy(`Reported by ${who(record.reported.side)}, confirmed`, `შეიტანა: ${who(record.reported.side)}, დადასტურდა`)]
        // A one-sided calendar score counts at once; its club may correct it for 48 hours.
        : record.status === 'FINAL' && record.reported && record.oneSided ? [copy(`Reported by ${who(record.reported.side)}`, `შეიტანა: ${who(record.reported.side)}`), correctWindow(record.deadlines.correctUntil, now, copy)]
          : record.status === 'FINAL' && record.reported ? [copy(`Reported by ${who(record.reported.side)}, not disputed in 48 h`, `შეიტანა: ${who(record.reported.side)}, 48 სთ-ში არ გასაჩივრდა`)] : [];
  const refereeFirst = record.status === 'NONE' && !record.permissions.report.length && record.deadlines.refereeOnlyUntil && Date.parse(record.deadlines.refereeOnlyUntil) > now
    && record.permissions.parties.some(party => party === 'HOME' || party === 'AWAY');

  return <section className="gk gk-score" aria-label={copy('Score', 'ანგარიში')}>
    <header className="gk-score__head">
      {title && <h2 className="gk-score__title">{copy('Score', 'ანგარიში')}</h2>}
      <Status tone={state.tone}>{copy(...state.words)}</Status>
    </header>
    {record.status === 'DISPUTED' && record.reported && record.disputed
      ? <ul className="gk-score__versions" aria-label={copy('Both versions', 'ორივე ვერსია')}>
        {[record.reported, record.disputed].map(version => <li key={version.side}>
          <span>{copy(`${who(version.side)}'s score`, `${who(version.side)}: ანგარიში`)}</span>
          <strong className="gk-num">{goals(version.homeScore, version.awayScore) ?? copy('no score given', 'ანგარიში არ მიუთითებია')}</strong>
        </li>)}
      </ul>
      : line && shown && <div className="gk-score__line">
        <span className="gk-score__team"><Crest src={home.logo} name={home.name} size={28} /><span title={home.name}>{home.name}</span></span>
        <strong className="gk-score__goals gk-num" aria-label={copy(`Score ${shown}`, `ანგარიში ${shown}`)}>{shown}</strong>
        <span className="gk-score__team gk-score__team--away"><span title={away.name}>{away.name}</span><Crest src={away.logo} name={away.name} size={28} /></span>
      </div>}
    {meta.length > 0 && <p className="gk-score__meta">{meta.filter(Boolean).join(' · ')}</p>}
    {record.status === 'DISPUTED' && !record.permissions.settle.length && <p className="gk-score__meta">{record.settler
      ? copy(`Waiting for ${who(record.settler)} to settle it.`, `ელოდება, როდის გადაწყვეტს ${who(record.settler)}.`)
      : copy('No referee or organiser can settle this friendly, so both scores stay.', 'ამ ამხანაგურ მატჩს მსაჯი ან ორგანიზატორი არ ჰყავს, ამიტომ ორივე ანგარიში რჩება.')}</p>}
    {refereeFirst && <p className="gk-score__meta">{copy(`The referee reports first. If they haven't by ${formatTime(record.deadlines.refereeOnlyUntil!)}, you can.`, `ჯერ მსაჯი შეიტანს. თუ ${formatTime(record.deadlines.refereeOnlyUntil!)}-მდე არ შეიტანა, შეძლებთ თქვენ.`)}</p>}
    {record.status === 'NONE' && !record.permissions.report.length && !refereeFirst && !cancelled && <p className="gk-score__quiet">{copy('No score has been reported yet.', 'ანგარიში ჯერ არ შეუტანიათ.')}</p>}
    {error && <p className="gk-score__error" role="alert">{error}</p>}
    {notice && <p className="gk-score__notice" role="status">{notice}</p>}
    {!cancelled && <ScoreAnswer record={record} home={home} away={away} busy={busy} send={send} />}
    {record.history.length > 0 && <ScoreHistoryList history={record.history} home={home.name} away={away.name} />}
  </section>;
}
