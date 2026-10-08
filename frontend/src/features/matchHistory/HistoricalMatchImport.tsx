import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Plus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { safeNotificationLink } from '../../utils/notificationDestinations';
import { useResultCopy } from './copy';
import { getHistoricalImportOptions, searchHistoricalOpponents, importHistoricalMatch, type ImportOptions, type HistoricalMatchCreated } from './api';

export function HistoricalMatchImport({ clubId, onSaved }: { clubId?: number; onSaved: () => void }) {
  const { sessionId } = useAuth();
  const { copy } = useResultCopy();
  const [options, setOptions] = useState<ImportOptions>(), [retry, setRetry] = useState(0), [optionsError, setOptionsError] = useState('');
  const [open, setOpen] = useState(false), [homeClub, setHomeClub] = useState(''), [squad, setSquad] = useState('');
  const [playedAt, setPlayedAt] = useState<'HOME' | 'AWAY'>('HOME');
  const [search, setSearch] = useState(''), [page, setPage] = useState(0), [opponents, setOpponents] = useState<{ content: { id: number; name: string; city?: string }[]; totalElements: number }>();
  const [opponent, setOpponent] = useState(''), [searchError, setSearchError] = useState('');
  const [title, setTitle] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState(''), [home, setHome] = useState(''), [away, setAway] = useState(''), [reason, setReason] = useState(''), [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [existingPath, setExistingPath] = useState(''), [saved, setSaved] = useState<HistoricalMatchCreated>();
  const inFlight = useRef(false), writeController = useRef<AbortController | null>(null), submission = useRef<{ signature: string; requestId: string } | null>(null);
  const optionsFailure = copy('Historical entry options could not load.', 'ისტორიული ჩანაწერის პარამეტრები ვერ ჩაიტვირთა.');
  const searchFailure = copy('Could not search registered clubs.', 'რეგისტრირებული კლუბების ძიება ვერ მოხერხდა.');
  useEffect(() => {
    const abort = new AbortController();
    void getHistoricalImportOptions(abort.signal, sessionId).then(next => { if (!abort.signal.aborted) { setOptions(next); setOptionsError(''); } }).catch(cause => { if (!abort.signal.aborted) setOptionsError(extractApiErrorMessage(cause, optionsFailure)); });
    return () => abort.abort();
  }, [sessionId, retry, optionsFailure]);
  useEffect(() => () => writeController.current?.abort(), []);
  useEffect(() => {
    if (!open || search.trim().length < 2) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      void searchHistoricalOpponents(search.trim(), page, abort.signal, sessionId).then(next => { if (!abort.signal.aborted) { setOpponents(next); setSearchError(''); } }).catch(cause => { if (!abort.signal.aborted) { setOpponents(undefined); setSearchError(extractApiErrorMessage(cause, searchFailure)); } });
    }, 250);
    return () => { abort.abort(); clearTimeout(timer); };
  }, [search, page, open, sessionId, searchFailure]);
  const selectedClub = options?.clubs.find(club => String(club.id) === homeClub) ?? options?.clubs.find(club => club.id === clubId) ?? options?.clubs[0];
  const candidates = opponents?.content.filter(club => club.id !== selectedClub?.id) ?? [];
  const validScores = home !== '' && away !== '' && [Number(home), Number(away)].every(value => Number.isInteger(value) && value >= 0 && value <= 100);
  async function submit() {
    if (!selectedClub || !opponent || !candidates.some(club => club.id === Number(opponent)) || !validScores || !reason.trim() || !start || !end || inFlight.current) return;
    if (end <= start || new Date(end).getTime() >= Date.now()) { setError(copy('Choose a match that has ended, with the end after kickoff.', 'აირჩიეთ წარსული მატჩი, რომლის დასრულების დრო დაწყების შემდეგაა.')); return; }
    const body = { clubId: playedAt === 'HOME' ? selectedClub.id : Number(opponent), opponentClubId: playedAt === 'HOME' ? Number(opponent) : selectedClub.id, homeSquadId: playedAt === 'HOME' && squad ? Number(squad) : undefined, awaySquadId: playedAt === 'AWAY' && squad ? Number(squad) : undefined, title: title.trim() || undefined, startsAt: `${start}:00`, endsAt: `${end}:00`, homeScore: Number(home), awayScore: Number(away), visibility, reason: reason.trim() };
    const signature = JSON.stringify(body);
    if (submission.current?.signature !== signature) submission.current = { signature, requestId: crypto.randomUUID() };
    const abort = new AbortController(); writeController.current = abort;
    inFlight.current = true; setBusy(true); setError(''); setExistingPath('');
    try {
      const result = await importHistoricalMatch({ ...body, requestId: submission.current.requestId }, abort.signal, sessionId);
      if (abort.signal.aborted) return;
      setSaved(result); setOpen(false); setTitle(''); setStart(''); setEnd(''); setHome(''); setAway(''); setReason(''); setOpponent(''); setSearch(''); setOpponents(undefined); setVisibility('PRIVATE'); submission.current = null; onSaved();
    } catch (cause) {
      if (abort.signal.aborted) return;
      setError(extractApiErrorMessage(cause, copy('Could not add the historical match. Check whether it already exists.', 'ისტორიული მატჩი ვერ დაემატა. შეამოწმეთ, ხომ არ არსებობს უკვე.')));
      if (isAxiosError(cause) && cause.response?.status === 409) {
        const link = safeNotificationLink(cause.response.data?.existingDetailPath);
        if (link) setExistingPath(link.pathname + link.search + link.hash);
      }
    } finally { if (!abort.signal.aborted) { inFlight.current = false; setBusy(false); } }
  }
  if (optionsError && !options) return <p className="mx-muted">{optionsError} <button type="button" onClick={() => setRetry(n => n + 1)}>{copy('Retry', 'ხელახლა ცდა')}</button></p>;
  if (!options?.clubs.length) return null;
  return <div className="mh-import">
    {!open && <button type="button" onClick={() => { setOpen(true); setSaved(undefined); }}><Plus size={16} aria-hidden="true" />{copy('Add past match', 'წარსული მატჩის დამატება')}</button>}
    {saved && <p role="status" className="mx-notice">{copy('Past match added as a club record.', 'წარსული მატჩი დაემატა კლუბის ჩანაწერის სახით.')} <Link to={saved.detailPath}>{copy('Open recorded match', 'დაფიქსირებული მატჩის გახსნა')} →</Link></p>}
    {open && <section className="mx-panel"><header className="mx-head"><div><h2>{copy('Add a past match', 'წარსული მატჩის დამატება')}</h2><p className="mx-muted">{copy('Use this for a match missing from GrassKickZ. For an existing match, open its result to add or correct the score.', 'გამოიყენეთ GrassKickZ-ში გამოტოვებული მატჩისთვის. არსებული მატჩის ანგარიშის შესავსებად ან შესასწორებლად გახსენით მისი შედეგი.')}</p></div><button type="button" disabled={busy} aria-label={copy('Close historical entry', 'ისტორიული ჩანაწერის დახურვა')} onClick={() => setOpen(false)}><X size={18} /></button></header>
      <form className="mx-form" onSubmit={e => { e.preventDefault(); void submit(); }}>
        <label>{copy('Your club', 'თქვენი კლუბი')}<select required disabled={busy} value={selectedClub?.id ?? ''} onChange={e => { setHomeClub(e.target.value); setSquad(''); setOpponent(''); }}>{options.clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
        <label>{copy('Your squad (optional)', 'თქვენი გუნდი (არასავალდებულო)')}<select disabled={busy} value={squad} onChange={e => setSquad(e.target.value)}><option value="">{copy('No squad specified', 'გუნდი მითითებული არ არის')}</option>{selectedClub?.squads.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        <label>{copy('Find the opponent club', 'მეტოქე კლუბის ძიება')}<input type="search" value={search} disabled={busy} placeholder={copy('At least 2 characters', 'მინიმუმ 2 სიმბოლო')} onChange={e => { setSearch(e.target.value); setOpponent(''); setOpponents(undefined); setPage(0); setSearchError(''); }} /></label>
        <label>{copy('Registered opponent', 'რეგისტრირებული მეტოქე')}<select required value={opponent} disabled={busy || !candidates.length} onChange={e => setOpponent(e.target.value)}><option value="">{copy('Choose the opponent club', 'აირჩიეთ მეტოქე კლუბი')}</option>{candidates.map(club => <option key={club.id} value={club.id}>{club.name}{club.city ? ` · ${club.city}` : ''}</option>)}</select></label>
        {searchError && <p className="mx-wide mx-error" role="alert">{searchError}</p>}{search.length >= 2 && !opponents && !searchError && <p className="mx-wide mx-muted" role="status">{copy('Searching clubs…', 'კლუბების ძიება…')}</p>}{opponents && !candidates.length && <p className="mx-wide mx-muted">{copy('No clubs found. Try another name.', 'კლუბები ვერ მოიძებნა. სცადეთ სხვა სახელი.')}</p>}
        {opponents && opponents.totalElements > 20 && <div className="mx-wide mx-actions"><button type="button" disabled={busy || page === 0} onClick={() => { setPage(p => p - 1); setOpponent(''); setOpponents(undefined); }}>{copy('Previous clubs', 'წინა კლუბები')}</button><button type="button" disabled={busy || (page + 1) * 20 >= opponents.totalElements} onClick={() => { setPage(p => p + 1); setOpponent(''); setOpponents(undefined); }}>{copy('Next clubs', 'შემდეგი კლუბები')}</button></div>}
        <label className="mx-wide">{copy('Your club played', 'თქვენი კლუბი თამაშობდა')}<select value={playedAt} disabled={busy} onChange={e => { setPlayedAt(e.target.value as 'HOME' | 'AWAY'); setHome(''); setAway(''); }}><option value="HOME">{copy('At home', 'მასპინძლად')}</option><option value="AWAY">{copy('Away', 'სტუმრად')}</option></select></label>
        <p className="mx-wide mx-muted">{copy('Home', 'მასპინძელი')}: {playedAt === 'HOME' ? selectedClub?.name : candidates.find(club => String(club.id) === opponent)?.name || '—'} · {copy('Away', 'სტუმარი')}: {playedAt === 'AWAY' ? selectedClub?.name : candidates.find(club => String(club.id) === opponent)?.name || '—'}</p>
        <label className="mx-wide">{copy('Match title (optional)', 'მატჩის სახელი (არასავალდებულო)')}<input maxLength={140} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
        <label>{copy('Local kickoff date & time', 'დაწყების ადგილობრივი თარიღი და დრო')}<input type="datetime-local" required value={start} disabled={busy} onChange={e => setStart(e.target.value)} /></label><label>{copy('Local end date & time', 'დასრულების ადგილობრივი თარიღი და დრო')}<input type="datetime-local" required min={start || undefined} value={end} disabled={busy} onChange={e => setEnd(e.target.value)} /></label>
        <label>{copy('Home score', 'მასპინძლის ანგარიში')}<input required type="number" min={0} max={100} step={1} value={home} disabled={busy} onChange={e => setHome(e.target.value)} /></label><label>{copy('Away score', 'სტუმრის ანგარიში')}<input required type="number" min={0} max={100} step={1} value={away} disabled={busy} onChange={e => setAway(e.target.value)} /></label>
        <label className="mx-wide">{copy('Record source / reason', 'ჩანაწერის წყარო / მიზეზი')}<textarea required maxLength={1000} value={reason} disabled={busy} placeholder={copy('For example, the dated club scorebook or signed match report.', 'მაგალითად, კლუბის დათარიღებული ოქმი ან ხელმოწერილი ანგარიში.')} onChange={e => setReason(e.target.value)} /></label>
        <label className="mx-wide">{copy('Visibility', 'ხილვადობა')}<select value={visibility} disabled={busy} onChange={e => setVisibility(e.target.value as 'PRIVATE' | 'PUBLIC')}><option value="PRIVATE">{copy('Private club record', 'კლუბის კერძო ჩანაწერი')}</option><option value="PUBLIC">{copy('Public match record', 'მატჩის საჯარო ჩანაწერი')}</option></select></label>
        <p className="mx-muted mx-wide">{copy('Recorded by your club. Independent confirmation, referee appointments and opponent approval are not recorded by this action. Private records follow club calendar access.', 'ფიქსირდება თქვენი კლუბის მიერ. ეს მოქმედება არ აფიქსირებს დამოუკიდებელ დადასტურებას, მსაჯის დანიშვნას ან მეტოქის თანხმობას. კერძო ჩანაწერზე ვრცელდება კლუბის კალენდრის წვდომის წესები.')}</p>
        {error && <p className="mx-error mx-wide" role="alert">{error}{existingPath && <> <Link to={existingPath}>{copy('Open existing match', 'არსებული მატჩის გახსნა')}</Link></>}</p>}<footer><button className="mx-primary" disabled={busy || !opponent || !validScores || !reason.trim() || !start || !end}>{copy('Add historical record', 'ისტორიული ჩანაწერის დამატება')}</button></footer>
      </form>
    </section>}
  </div>;
}
