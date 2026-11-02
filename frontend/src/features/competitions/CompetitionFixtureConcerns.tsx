import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import type { TournamentFixtureDto } from '../tournaments/domain';
import { useCompetitionCommand } from './useCompetitionCommand';
import { concernCommand, getFixtureConcerns, type FixtureConcerns, type Concern } from './fixtureReviewApi';
import './fixture-review.css';
import { CompetitionRecoveryPanel } from './CompetitionRecoveryPanel';
import { Link } from 'react-router-dom';

interface Props { id: number; fixture: TournamentFixtureDto; changed: () => Promise<void>; refreshKey?: number; onDecisionReason?: (reason: string) => void }
export function CompetitionFixtureConcerns(props: Props) {
  const { user, sessionId } = useAuth();
  return <FixtureConcernContent key={`${props.id}:${props.fixture.id}:${user?.id}:${sessionId}`} {...props}/>;
}
function FixtureConcernContent({ id, fixture, changed, refreshKey, onDecisionReason }: Props) {
  const { user, sessionId } = useAuth();
  const userId = user?.id;
  const { i18n } = useTranslation();
  const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
  const scope = `${id}:${fixture.id}:${user?.id}:${sessionId}`;
  const [loaded, setLoaded] = useState<{ scope: string; data: FixtureConcerns }>();
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [entry, setEntry] = useState(''), [reason, setReason] = useState('');
  const commands = useCompetitionCommand();
  const data = loaded?.scope === scope ? loaded.data : undefined;
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void getFixtureConcerns(id, fixture.id, controller.signal).then(data => {
      if (!controller.signal.aborted) { setLoaded({ scope, data }); setError(''); }
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setLoaded(undefined);
      setError(isAxiosError(cause) && [401, 403, 404].includes(cause.response?.status ?? 0) ? '' : extractApiErrorMessage(cause, 'Could not load result concerns.'));
    });
    return () => controller.abort();
  }, [id, fixture.id, fixture.homeScore, fixture.awayScore, scope, userId, attempt, refreshKey]);
  if (!user) return null;
  async function run(path: string, body: Record<string, unknown>) {
    if (!data) return;
    await commands.run(path, { ...body, resultRevision: data.resultRevision }, data.revision,
      payload => concernCommand(id, path, payload), async value => { setLoaded({ scope, data: value }); setReason(''); await changed(); }, () => setAttempt(value => value + 1));
  }
  const chosen = entry || (data?.entries.length === 1 ? String(data.entries[0].id) : '');
  const pendingOwn = data?.concerns.some(concern => concern.status === 'PENDING' && concern.entryId === Number(chosen));
  return <section className="competition-fixture-review" aria-label={copy('Result concerns', 'შედეგის განხილვა')}>
    <CompetitionRecoveryPanel id={id} changed={async () => { setAttempt(value => value + 1); await changed(); }}/>
    {error && <p role="alert">{error} <button type="button" disabled={commands.busy} onClick={() => setAttempt(value => value + 1)}>{copy('Retry concerns', 'ხელახლა ცდა')}</button></p>}
    {commands.error && <p role="alert">{commands.error}</p>}
    {commands.notice && <p role="status">{commands.notice}</p>}
    {data && <>
      <h3>{copy('Result concerns', 'შედეგის განხილვა')}</h3>
      {data.concerns.map(concern => <article key={concern.id}>
        <strong>{copy('Concern', 'მიმართვა')} #{concern.id} · {concern.status === 'PENDING' ? copy('Awaiting organiser review', 'ორგანიზატორის განხილვას ელოდება') : concern.status === 'CORRECTED' ? copy('Result corrected', 'შედეგი შესწორებულია') : copy('Concern rejected', 'მიმართვა უარყოფილია')}</strong>
        <p>{concern.reason}</p>
        <details><summary>{copy('Concern history', 'მიმართვის ისტორია')}</summary>{concern.history.map((item, index) => <p key={index}>{item.action} · <time>{item.at}</time><br/>{item.reason}</p>)}</details>
        {data.canReview && concern.status === 'PENDING' && <>
          <Link className="tw-button" to={`/tournaments/${id}/workspace?view=schedule&fixtureId=${fixture.id}`}>{copy('Manage fixture & qualification', 'მატჩისა და კვალიფიკაციის მართვა')}</Link>
          <ConcernDecision key={`${scope}:${concern.id}`} concern={concern} fixture={fixture} busy={commands.busy} onReason={onDecisionReason} run={(body) => run(`fixtures/${fixture.id}/concerns/${concern.id}/review`, body)}/>
        </>}
      </article>)}
      {data.canRaise && !pendingOwn && <form onSubmit={event => { event.preventDefault(); if (chosen && reason.trim()) void run(`fixtures/${fixture.id}/concerns`, { entryId: Number(chosen), reason: reason.trim() }); }}>
        <p>{copy('Ask the organiser to review this recorded result. Your concern stays pending until they record a decision. Only the organiser can change the score.', 'მიმართეთ ორგანიზატორს შედეგის გადასახედად. მიმართვა განხილვას ელოდება, სანამ ორგანიზატორი გადაწყვეტილებას ჩაწერს. ანგარიშს მხოლოდ ორგანიზატორი ცვლის.')}</p>
        {data.entries.length > 1 && <label>{copy('Your entry', 'თქვენი გუნდი')}<select required value={chosen} disabled={commands.busy} onChange={event => setEntry(event.target.value)}><option value="">{copy('Choose entry', 'აირჩიეთ გუნდი')}</option>{data.entries.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>}
        <label>{copy('Concern reason', 'მიმართვის მიზეზი')}<textarea required maxLength={1000} value={reason} disabled={commands.busy} onChange={event => setReason(event.target.value)}/></label>
        <button type="submit" disabled={commands.busy || !chosen || !reason.trim()}>{copy('Submit concern', 'მიმართვის გაგზავნა')}</button>
      </form>}
    </>}
  </section>;
}

function ConcernDecision({ concern, fixture, busy, run, onReason }: { concern: Concern; fixture: TournamentFixtureDto; busy: boolean; run: (body: Record<string, unknown>) => Promise<void>; onReason?: (reason: string) => void }) {
  const { i18n } = useTranslation();
  const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
  const [action, setAction] = useState<'CORRECT' | 'REJECT'>('REJECT');
  const [home, setHome] = useState(String(fixture.homeScore ?? '')), [away, setAway] = useState(String(fixture.awayScore ?? '')), [reason, setReason] = useState('');
  const valid = action === 'REJECT' || [home, away].every(value => value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 999);
  return <form onSubmit={event => { event.preventDefault(); if (valid && reason.trim()) void run({ action, concernVersion: concern.version, homeScore: action === 'CORRECT' ? Number(home) : null, awayScore: action === 'CORRECT' ? Number(away) : null, reason: reason.trim() }); }}>
    <label>{copy('Organiser decision', 'ორგანიზატორის გადაწყვეტილება')}<select value={action} disabled={busy} onChange={event => setAction(event.target.value as typeof action)}><option value="REJECT">{copy('Keep result and reject concern', 'შედეგის შენარჩუნება და მიმართვის უარყოფა')}</option><option value="CORRECT">{copy('Correct result', 'შედეგის შესწორება')}</option></select></label>
    {action === 'CORRECT' && <div className="competition-fixture-review__scores"><label>{copy('Corrected home score', 'მასპინძლის შესწორებული ანგარიში')}<input type="number" required min={0} max={999} disabled={busy} value={home} onChange={event => setHome(event.target.value)}/></label><label>{copy('Corrected away score', 'სტუმრის შესწორებული ანგარიში')}<input type="number" required min={0} max={999} disabled={busy} value={away} onChange={event => setAway(event.target.value)}/></label></div>}
    <label>{copy('Decision reason', 'გადაწყვეტილების მიზეზი')}<textarea required maxLength={1000} disabled={busy} value={reason} onChange={event => { setReason(event.target.value); onReason?.(event.target.value); }}/></label>
    <button type="submit" disabled={busy || !valid || !reason.trim()}>{copy('Record concern decision', 'გადაწყვეტილების ჩაწერა')}</button>
  </form>;
}
