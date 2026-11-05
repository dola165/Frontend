import { useContext, useState } from 'react';
import { Button } from '../../design/primitives';
import { useResultCopy } from '../matchHistory/copy';
import type { ScoreRecord, ScoreSettlement, ScoreWrite } from './api';
import { emptyGoals, goalsFrom, goalsReady, type GoalsDraft } from './goals';
import { ScoreInputs, type Team } from './ScoreInputs';
import { ReportAsContext } from './reportAs';
import { goals, partyName } from './status';

type Send = (write: ScoreWrite, done: string) => Promise<boolean>;
const stamp = (record: ScoreRecord) => ({ revision: record.revision, requestId: crypto.randomUUID() });
const numbers = (value: GoalsDraft) => ({ homeScore: Number(value.home), awayScore: Number(value.away) });

/**
 * The one step open to this person on the record, if any: report the score (nobody has yet), confirm or dispute it
 * with their own score (the other side's report), or settle a dispute (the organiser or the referee). The only change
 * to a reported score is the correction of a one-sided calendar score by its own club, for 48 hours, with a reason.
 */
export function ScoreAnswer({ record, home, away, busy, send }: { record: ScoreRecord; home: Team; away: Team; busy: boolean; send: Send }) {
  const { copy } = useResultCopy();
  const who = (side: Parameters<typeof partyName>[0]) => partyName(side, home.name, away.name, copy);
  const { report, respond, settle, correct } = record.permissions;
  if (record.status === 'NONE' && report.length) return <ReportForm record={record} home={home} away={away} busy={busy} send={send} />;
  if (record.status === 'REPORTED' && respond.length) return <Respond record={record} home={home} away={away} busy={busy} send={send} />;
  if (record.status === 'DISPUTED' && settle.length) return <Settle record={record} home={home} away={away} busy={busy} send={send} />;
  if (record.oneSided && correct?.length) return <Correct record={record} home={home} away={away} busy={busy} send={send} />;
  // Waiting on someone else: say on whom, once.
  if (record.status === 'REPORTED') {
    const waiting = record.responders.filter(side => !record.confirmations.includes(side));
    if (waiting.length && record.permissions.parties.length) return <p className="gk-score__wait"><span className="gk-score__dot" aria-hidden="true" />
      {copy(`Waiting for ${waiting.map(who).join(' and ')} to confirm`, `ელოდება დადასტურებას: ${waiting.map(who).join(', ')}`)}</p>;
  }
  return null;
}

function ReportForm({ record, home, away, busy, send }: { record: ScoreRecord; home: Team; away: Team; busy: boolean; send: Send }) {
  const { copy } = useResultCopy();
  const [value, setValue] = useState(emptyGoals);
  const sides = record.permissions.report;
  const reportAs = useContext(ReportAsContext);
  const [side, setSide] = useState(sides.find(item => item === reportAs) ?? sides[0]);
  const submit = async () => {
    if (!goalsReady(value)) return;
    const done = await send({ action: 'report', body: { ...stamp(record), ...numbers(value), side } }, record.oneSided
      ? copy('Score saved. It counts now; you can correct it for 48 h.', 'ანგარიში შენახულია. ის უკვე ითვლება; 48 სთ-ის განმავლობაში შეგიძლიათ შეასწოროთ.')
      : copy('Score reported. The other side can confirm or dispute it.', 'ანგარიში შეტანილია. მეორე მხარეს შეუძლია დაადასტუროს ან გაასაჩივროს.'));
    if (done) setValue(emptyGoals);
  };
  return <form className="gk-score__form" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <ScoreInputs home={home} away={away} value={value} onChange={setValue} disabled={busy} />
    {sides.length > 1 && <SideChoice sides={sides} value={side} onChange={setSide} home={home.name} away={away.name} disabled={busy} />}
    <div className="gk-score__actions"><Button type="submit" variant="primary" disabled={busy || !goalsReady(value)}>{copy('Report score', 'ანგარიშის შეტანა')}</Button></div>
  </form>;
}

function Respond({ record, home, away, busy, send }: { record: ScoreRecord; home: Team; away: Team; busy: boolean; send: Send }) {
  const { copy } = useResultCopy();
  const side = record.permissions.respond[0];
  const reported = goalsFrom(record.reported?.homeScore, record.reported?.awayScore);
  const [disputing, setDisputing] = useState(false);
  const [value, setValue] = useState(reported);
  const [note, setNote] = useState('');
  const same = value.home === reported.home && value.away === reported.away;
  const confirm = () => void send({ action: 'confirm', body: { ...stamp(record), side } }, copy('Confirmed. The score is official.', 'დადასტურდა. ანგარიში ოფიციალურია.'));
  const dispute = () => goalsReady(value) && !same && void send({ action: 'dispute', body: { ...stamp(record), ...numbers(value), side, ...(note.trim() ? { note: note.trim() } : {}) } },
    copy('Your score is sent. Both versions now show.', 'თქვენი ანგარიში გაიგზავნა. ახლა ორივე ვერსია ჩანს.'));
  if (!disputing) return <div className="gk-score__ask">
    <span>{copy(`Is ${goals(record.reported?.homeScore, record.reported?.awayScore)} right?`, `${goals(record.reported?.homeScore, record.reported?.awayScore)} სწორია?`)}</span>
    <div className="gk-score__actions">
      <Button variant="primary" disabled={busy} onClick={confirm}>{copy('Confirm', 'დადასტურება')}</Button>
      <Button disabled={busy} onClick={() => setDisputing(true)}>{copy('Dispute with my score', 'გასაჩივრება ჩემი ანგარიშით')}</Button>
    </div>
  </div>;
  return <form className="gk-score__form" onSubmit={event => { event.preventDefault(); dispute(); }}>
    <p className="gk-score__label">{copy('Your score', 'თქვენი ანგარიში')}</p>
    <ScoreInputs home={home} away={away} value={value} onChange={setValue} disabled={busy} autoFocus />
    {same && goalsReady(value) && <p className="gk-score__hint">{copy('That is their score too. Confirm it instead.', 'ეს მათი ანგარიშიცაა. სჯობს დაადასტუროთ.')}</p>}
    <NoteField value={note} onChange={setNote} disabled={busy} />
    <div className="gk-score__actions">
      <Button type="submit" variant="primary" disabled={busy || !goalsReady(value) || same}>{copy('Send my score', 'ჩემი ანგარიშის გაგზავნა')}</Button>
      <Button variant="ghost" disabled={busy} onClick={() => { setDisputing(false); setValue(reported); setNote(''); }}>{copy('Back', 'უკან')}</Button>
    </div>
  </form>;
}

function Settle({ record, home, away, busy, send }: { record: ScoreRecord; home: Team; away: Team; busy: boolean; send: Send }) {
  const { copy } = useResultCopy();
  const who = (side: Parameters<typeof partyName>[0]) => partyName(side, home.name, away.name, copy);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<ScoreSettlement['choice'] | null>(null);
  const [value, setValue] = useState(emptyGoals);
  const [reason, setReason] = useState('');
  const versions = [
    record.reported && { choice: 'REPORTED' as const, side: record.reported.side, score: goals(record.reported.homeScore, record.reported.awayScore) },
    // A dispute from before 26 October carries no score of its own: only the reported version or a corrected one.
    record.disputed && record.disputed.homeScore != null && { choice: 'DISPUTED' as const, side: record.disputed.side, score: goals(record.disputed.homeScore, record.disputed.awayScore) },
  ].filter(Boolean) as { choice: 'REPORTED' | 'DISPUTED'; side: Parameters<typeof partyName>[0]; score: string }[];
  const ready = choice != null && reason.trim().length > 0 && (choice !== 'CORRECTED' || goalsReady(value));
  const submit = () => ready && void send({ action: 'settle', body: { ...stamp(record), settlement: choice, side: record.permissions.settle[0], reason: reason.trim(), ...(choice === 'CORRECTED' ? numbers(value) : {}) } },
    copy('Settled. The score is official.', 'გადაწყდა. ანგარიში ოფიციალურია.'));
  if (!open) return <div className="gk-score__ask"><span>{copy('You settle this dispute.', 'ამ დავას თქვენ წყვეტთ.')}</span>
    <div className="gk-score__actions"><Button variant="primary" disabled={busy} onClick={() => setOpen(true)}>{copy('Settle', 'გადაწყვეტა')}</Button></div></div>;
  return <form className="gk-score__form" onSubmit={event => { event.preventDefault(); submit(); }}>
    <fieldset className="gk-score__choices" disabled={busy}>
      <legend className="gk-score__label">{copy('Which score stands?', 'რომელი ანგარიში რჩება?')}</legend>
      {versions.map(version => <label key={version.choice} className="gk-score__choice">
        <input type="radio" name="settlement" checked={choice === version.choice} onChange={() => setChoice(version.choice)} />
        <span>{copy(`${who(version.side)}'s`, `${who(version.side)}:`)}</span><strong className="gk-num">{version.score}</strong>
      </label>)}
      <label className="gk-score__choice">
        <input type="radio" name="settlement" checked={choice === 'CORRECTED'} onChange={() => setChoice('CORRECTED')} />
        <span>{copy('Another score', 'სხვა ანგარიში')}</span>
      </label>
    </fieldset>
    {choice === 'CORRECTED' && <ScoreInputs home={home} away={away} value={value} onChange={setValue} disabled={busy} autoFocus />}
    <label className="gk-score__field">{copy('Reason', 'მიზეზი')}
      <textarea className="gk-input" required maxLength={1000} rows={2} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
    <div className="gk-score__actions">
      <Button type="submit" variant="primary" disabled={busy || !ready}>{copy('Settle score', 'ანგარიშის გადაწყვეტა')}</Button>
      <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{copy('Back', 'უკან')}</Button>
    </div>
  </form>;
}

/** A one-sided calendar score, corrected by its own club within 48 hours: a different score and a reason. */
function Correct({ record, home, away, busy, send }: { record: ScoreRecord; home: Team; away: Team; busy: boolean; send: Send }) {
  const { copy } = useResultCopy();
  const current = goalsFrom(record.reported?.homeScore ?? record.homeScore, record.reported?.awayScore ?? record.awayScore);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current);
  const [reason, setReason] = useState('');
  const same = value.home === current.home && value.away === current.away;
  const ready = goalsReady(value) && !same && reason.trim().length > 0;
  const submit = async () => {
    if (!ready) return;
    const done = await send({ action: 'correct', body: { ...stamp(record), ...numbers(value), side: record.permissions.correct[0], reason: reason.trim() } },
      copy('Score corrected. History keeps the earlier one.', 'ანგარიში შესწორდა. ისტორია ძველსაც ინახავს.'));
    if (done) { setOpen(false); setReason(''); }
  };
  if (!open) return <div className="gk-score__actions"><Button disabled={busy} onClick={() => { setValue(current); setOpen(true); }}>{copy('Correct the score', 'ანგარიშის შესწორება')}</Button></div>;
  return <form className="gk-score__form" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <ScoreInputs home={home} away={away} value={value} onChange={setValue} disabled={busy} autoFocus />
    <label className="gk-score__field">{copy('Reason', 'მიზეზი')}
      <textarea className="gk-input" required maxLength={1000} rows={2} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
    <div className="gk-score__actions">
      <Button type="submit" variant="primary" disabled={busy || !ready}>{copy('Save correction', 'შესწორების შენახვა')}</Button>
      <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{copy('Back', 'უკან')}</Button>
    </div>
  </form>;
}

function NoteField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const { copy } = useResultCopy();
  return <label className="gk-score__field">{copy('Note (optional)', 'შენიშვნა (არასავალდებულო)')}
    <textarea className="gk-input" maxLength={1000} rows={2} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /></label>;
}

/** Rare: someone who holds more than one side of the same match (staff of both clubs, or staff and the referee) picks which. */
function SideChoice<S extends 'HOME' | 'AWAY' | 'REFEREE'>({ sides, value, onChange, home, away, disabled }: { sides: S[]; value: S; onChange: (side: S) => void; home: string; away: string; disabled: boolean }) {
  const { copy } = useResultCopy();
  return <label className="gk-score__field">{copy('Reporting for', 'ვისი სახელით')}
    <select className="gk-input" value={value} disabled={disabled} onChange={event => onChange(event.target.value as S)}>
      {sides.map(side => <option key={side} value={side}>{partyName(side, home, away, copy)}</option>)}
    </select></label>;
}
