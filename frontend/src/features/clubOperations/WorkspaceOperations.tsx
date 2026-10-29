import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Button, ButtonLink, EmptyNote, PageFrame, PageHeader, Panel, Skeleton } from '../../design/primitives';
import { nextSort, type TableSort } from '../../design/tableSort';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, root, moduleNames, type Bootstrap, type OperationRecord } from './api';
import { RecordDetail } from './RecordDetail';
import { OperationsSettings } from './OperationsSettings';
import { FinanceSummary } from './FinanceSummary';
import { SessionRegister } from './SessionRegister';
import { operationDescriptions, operationTabs, toolLabel } from './workspaceNavigation';
import { RecordForm } from './records/RecordForm';
import { RecordTable, RecordToolbar, type RecordView } from './records/RecordList';
import { SessionRegisters } from './records/SessionRegisters';
import { useScopedSearchParams } from './scopedParams';
import { clubRecordsEn } from '../../locales/clubRecords';
import { translate, useCopy } from '../../locales/useCopy';
import { appLanguage } from '../../utils/formatting';
import './records/records.css';
import '../clubWorkspace/club-workspace.css';


/** Record kinds no new record starts as: a purchase request is a project now (step 4). */
const RETIRED_KINDS = new Set(['PURCHASE']);
/** One club tool (duties, attendance, travel and the rest): its records, filters, a register where it has one, and a record or form when one is open. */
export function WorkspaceOperations({ boot, module, onRefresh, origin, scope }: {
  boot: Bootstrap; module: string; onRefresh: () => Promise<void>;
  /** Opened inside another page (a drawer beside a player): its URL parameters live under this prefix. */
  scope?: string;
  /** Where the person came from (More tools, My squads, a squad): the way back, when they did not open a record from this list. */
  origin?: { label: string; onBack: () => void };
}) {
  const copy = useCopy('clubRecords', clubRecordsEn);
  const [params, setParams, hrefOf] = useScopedSearchParams(scope);
  const [result, setResult] = useState<{ key: string; records: OperationRecord[]; error: string } | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailRevision, setDetailRevision] = useState(0);
  const [savedRecord, setSavedRecord] = useState<{ clubId: number; actorId: number; id: number; title: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const page = Math.max(0, Number(params.get('page')) || 0), search = params.get('q') ?? '', kind = params.get('kind') ?? '', squad = params.get('squad') ?? '', session = params.get('session') ?? '', person = params.get('person') ?? '';
  const view: RecordView = params.get('mine') === 'true' ? 'mine' : params.get('state') === 'open' ? 'open' : 'all';
  // Sorting orders the loaded page; the server keeps its own order across pages until it accepts `sort` and `dir`.
  const sortBy = params.get('sort'), sort: TableSort | null = sortBy ? { by: sortBy, descending: params.get('dir') === 'desc' } : null;
  const [selected, setSelected] = useState<OperationRecord | null>(null), [editing, setEditing] = useState(false), [newKind, setNewKind] = useState(''), [choosing, setChoosing] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const selectRequest = useRef(0);
  const club = boot.clubId, linked = params.get('record');
  const definitions = boot.definitions.filter(d => d.module === module), permission = boot.modules.find(m => m.id === module);
  // Buying something for the club is a project now (step 4): older purchase requests stay readable here, no new one starts.
  const newKinds = definitions.filter(d => !RETIRED_KINDS.has(d.kind));
  const definition = boot.definitions.find(d => d.kind === (newKind || selected?.kind));
  const enabled = boot.settings.enabled_modules.includes(module), canCreate = permission?.writable && enabled && (!squad || permission.globalWrite || permission.writeSquads.includes(Number(squad)));
  const filter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page'); next.delete('record');
    if (key === 'squad') { next.delete('session'); next.delete('person'); }
    setParams(next, { replace: key === 'q' });
  };
  const chooseView = (value: RecordView) => {
    const next = new URLSearchParams(params);
    ['mine', 'state', 'page', 'record'].forEach(key => next.delete(key));
    if (value === 'mine') next.set('mine', 'true'); else if (value === 'open') next.set('state', 'open');
    setParams(next);
  };
  const changeSort = (by: string) => {
    const next = new URLSearchParams(params), value = nextSort(sort, by);
    next.delete('sort'); next.delete('dir');
    if (value) { next.set('sort', value.by); if (value.descending) next.set('dir', 'desc'); }
    setParams(next, { replace: true });
  };
  const clearFilters = () => { const next = new URLSearchParams(params); ['q', 'squad', 'kind', 'session', 'person', 'page'].forEach(key => next.delete(key)); setParams(next); };
  const query = new URLSearchParams({ module, page: String(page), q: search, kind, mine: String(view === 'mine'), state: view === 'open' ? 'open' : 'all' });
  if (squad) query.set('squad', squad); if (session) query.set('session', session); if (person) query.set('person', person);
  const requestKey = `${club}:${query}:${refresh}`;
  const records = result?.records ?? [], loading = result?.key !== requestKey, error = result?.key === requestKey ? result.error : '';
  const selectedSession = boot.sessions.find(s => String(s.id) === session);
  const isRegister = module === 'ATTENDANCE' && Boolean(selectedSession?.squad_id) && Boolean(boot.peopleBySquad);
  const editorBoot = { ...boot, defaultSquadId: squad ? Number(squad) : undefined, defaultSessionId: selectedSession?.id, defaultSubjectId: boot.people.find(p => String(p.id) === person)?.id };
  useEffect(() => {
    if (module === 'SETTINGS' || isRegister && !showRecords) return;
    const c = new AbortController();
    const timer = setTimeout(() => {
      void get<OperationRecord[]>(`/clubs/${club}/workspace-roles/work?${query}`, c.signal)
        .then(rows => { if (!c.signal.aborted) setResult({ key: requestKey, records: rows, error: '' }); })
        .catch(e => { if (!c.signal.aborted) setResult({ key: requestKey, records: [], error: extractApiErrorMessage(e, translate('clubRecords', clubRecordsEn, 'loadError')) }); });
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); c.abort(); };
  // query is represented by requestKey to avoid restarting identical requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, module, isRegister, showRecords]);
  useEffect(() => {
    if (!linked) { setSelected(null); setDetailError(''); return; }
    setSelected(null); setDetailError('');
    const c = new AbortController(), request = ++selectRequest.current;
    void get<OperationRecord>(`${root(club)}/records/${encodeURIComponent(linked)}`, c.signal).then(value => {
      if (!c.signal.aborted && request === selectRequest.current) { setSelected(value); setEditing(false); setNewKind(''); }
    }).catch(e => { if (!c.signal.aborted) setDetailError(extractApiErrorMessage(e, translate('clubRecords', clubRecordsEn, 'unavailable'))); });
    return () => c.abort();
  }, [club, linked, detailRevision]);
  const close = () => { selectRequest.current++; setSelected(null); setEditing(false); setNewKind(''); const next = new URLSearchParams(params); next.delete('record'); next.delete('from'); setParams(next, { replace: true }); };
  // A record opened from this tool's list goes back to the list; one opened from elsewhere goes back there.
  const hrefFor = (record: OperationRecord) => { const next = new URLSearchParams(params); next.set('record', String(record.id)); next.set('from', 'list'); return hrefOf(next); };
  const openId = (id: number) => { const next = new URLSearchParams(params); next.set('record', String(id)); next.set('from', 'list'); setParams(next); };
  const open = (record: OperationRecord) => openId(record.id);
  const reload = () => { setRefresh(v => v + 1); };
  const changed = async (record?: Pick<OperationRecord, 'id' | 'title'>) => {
    await onRefresh();
    if (record) setSavedRecord({ clubId: club, actorId: boot.actorId, id: record.id, title: record.title });
    close(); reload();
  };
  const create = (value: string) => { setNewKind(value); setEditing(true); setSelected(null); setChoosing(false); };
  const tool = operationTabs.find(t => t.module === module);
  const title = tool ? toolLabel(tool.id) : moduleNames[module];
  const listLabel = copy('backTo', { name: title.toLowerCase() });
  const toOrigin = Boolean(origin) && params.get('from') !== 'list';
  const backLabel = toOrigin ? origin!.label : listLabel;
  const back = toOrigin ? origin!.onBack : () => close();
  const originBack = origin && <div className="rec-back"><Button variant="ghost" size="sm" onClick={origin.onBack}><ArrowLeft aria-hidden="true" />{origin.label}</Button></div>;
  const narrowed = Boolean(search || kind || squad || person), filtered = narrowed || view !== 'all' || page > 0;
  const empty = narrowed ? { title: copy('noMatching'), body: copy('noMatchingHint') }
    : view === 'mine' ? { title: copy('nothingMine'), body: copy('nothingMineHint') }
    : view === 'open' ? { title: copy('nothingOpen'), body: copy('nothingOpenHint') }
    : { title: copy('noneYetNamed', { name: title.toLowerCase() }), body: canCreate ? operationDescriptions[module] : copy('sharedHint') };
  const openRegister = (s: Bootstrap['sessions'][number]) => {
    const next = new URLSearchParams(params);
    ['q', 'kind', 'mine', 'state', 'person', 'page', 'record'].forEach(key => next.delete(key));
    next.set('squad', String(s.squad_id)); next.set('session', String(s.id));
    setShowRecords(false); setParams(next);
  };
  const changePage = (to: number) => { const next = new URLSearchParams(params); next.set('page', String(to)); setParams(next); };
  const addOne = (what: string) => copy('add', { what: what.toLowerCase() });
  const addLabel = newKinds.length === 1 ? addOne(newKinds[0].label) : copy('addRecord');
  const receipt = savedRecord?.clubId === club && savedRecord.actorId === boot.actorId ? savedRecord : null;
  const ka = appLanguage() === 'ka';
  const savedNotice = receipt && <div className="gk-notice cw-notices__success" role="status">
    <span className="cw-notices__text">{ka ? `შენახულია: ${receipt.title} · #${receipt.id}` : `Saved: ${receipt.title} · #${receipt.id}`}</span>
    <Button size="sm" onClick={() => openId(receipt.id)}>{ka ? 'ჩანაწერის გახსნა' : 'Open record'}</Button>
  </div>;
  const pager = page > 0 || records.length === 100 ? <><span>{copy('page', { page: page + 1 })}</span><span className="gk-row">
    <Button size="sm" disabled={page === 0 || loading} onClick={() => changePage(page - 1)}>{copy('previous')}</Button>
    <Button size="sm" disabled={records.length < 100 || loading} onClick={() => changePage(page + 1)}>{copy('next')}</Button></span></> : null;

  if (module === 'SETTINGS') return <PageFrame><OperationsSettings key={boot.settings.revision} boot={boot} onSaved={onRefresh} /></PageFrame>;
  if (linked && !selected) return <PageFrame className="rec-page">
    <div className="rec-back"><Button variant="ghost" size="sm" onClick={back}><ArrowLeft aria-hidden="true" />{backLabel}</Button></div>
    {receipt?.id === Number(linked) && savedNotice}
    {detailError ? <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{detailError}</span><Button size="sm" onClick={() => setDetailRevision(value => value + 1)}>{copy('tryAgain')}</Button></div> : <div className="cw-loading" role="status" aria-label={copy('opening')}><Skeleton height={34} width="40%" /><Skeleton height={200} /></div>}
  </PageFrame>;
  if (editing && definition) return <PageFrame><RecordForm key={`${newKind}-${selected?.id ?? 'new'}`} boot={editorBoot} definition={definition} record={selected ?? undefined} backLabel={listLabel} onSaved={changed} onCancel={close} /></PageFrame>;
  if (selected && definition) return <PageFrame><RecordDetail club={club} boot={boot} record={selected} definition={definition} backLabel={backLabel} onEdit={() => setEditing(true)} onChanged={changed} onClose={back} /></PageFrame>;

  const contextName = person ? (boot.people.find(p => String(p.id) === person)?.name ?? `Player #${person}`) : (selectedSession?.title ?? `Training session #${session}`);
  return <PageFrame className="rec-page" aria-label={title}>
    {originBack}
    <PageHeader title={title} subtitle={operationDescriptions[module]}
      actions={canCreate && newKinds.length > 0 && (newKinds.length <= 2
        ? <>{newKinds.slice(1).map(d => <Button key={d.kind} onClick={() => create(d.kind)}>{addOne(d.label)}</Button>)}<Button variant="primary" onClick={() => create(newKinds[0].kind)}><Plus aria-hidden="true" />{addOne(newKinds[0].label)}</Button></>
        : <Button variant="primary" aria-expanded={choosing} onClick={() => setChoosing(v => !v)}><Plus aria-hidden="true" />{addLabel}</Button>)} />
    <div className="gk-stack">
      {savedNotice}
      {choosing && <Panel flush title={copy('whatToAdd')} action={<Button size="sm" variant="ghost" iconOnly aria-label={copy('closeChoices')} onClick={() => setChoosing(false)}><X aria-hidden="true" /></Button>}>
        <div className="rec-choices">{newKinds.map(d => <button type="button" className="rec-choice" key={d.kind} onClick={() => create(d.kind)}><strong>{d.label}</strong></button>)}</div>
      </Panel>}
      {error && <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" onClick={reload}>{copy('tryAgain')}</Button></div>}
      {!enabled && <div className="gk-notice" role="status">{copy('toolOff')}</div>}
      {module === 'STAFF' && <div className="gk-notice" role="status"><span className="cw-notices__text">{copy('staffNotice')}</span><ButtonLink size="sm" to={`/clubs/${club}/office`}>{copy('openStaff')}</ButtonLink></div>}
      {module === 'FINANCE' && <FinanceSummary club={club} revision={boot} />}
      {(session || person) && <div className="gk-notice"><span className="cw-notices__text"><strong>{contextName}</strong>{squad ? ` · ${boot.squads.find(s => String(s.id) === squad)?.name ?? `Squad #${squad}`}` : ''}{selectedSession ? ` · ${new Date(selectedSession.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</span>
        <Button size="sm" onClick={() => { const next = new URLSearchParams(params); next.delete('session'); next.delete('person'); next.delete('page'); setParams(next); }}>{copy('clear')}</Button></div>}
      {isRegister && <><SessionRegister boot={boot} session={Number(session)} squad={selectedSession!.squad_id!} onRecord={open} />
        <div><Button variant="ghost" aria-expanded={showRecords} onClick={() => setShowRecords(v => !v)}>{showRecords ? copy('hideAttendance') : copy('moreAttendance')}</Button></div></>}
      {module === 'ATTENDANCE' && !isRegister && boot.peopleBySquad && <SessionRegisters boot={boot} squad={squad} onOpen={openRegister} />}
      <section className="gk-stack gk-stack--tight" hidden={isRegister && !showRecords} aria-busy={loading} aria-label={`${title}: ${copy('records')}`}>
        <RecordToolbar boot={boot} module={module} definitions={definitions} view={view} filters={{ search, squad, kind }} count={records.length} loading={loading} page={page}
          onView={chooseView} onChange={filter} onClear={clearFilters} />
        {loading && !result ? <Panel><div className="cw-skeleton-rows" role="status" aria-label={copy('loading')}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={44} />)}</div></Panel>
          : records.length ? <div inert={loading} data-updating={loading || undefined}>
            <RecordTable records={records} boot={boot} sort={sort} onSort={changeSort} hrefFor={hrefFor} onOpen={open} footer={pager} />
          </div>
            : !error && <Panel>
              <EmptyNote title={empty.title} action={canCreate && !filtered && newKinds.length ? <Button size="sm" onClick={() => newKinds.length <= 2 ? create(newKinds[0].kind) : setChoosing(true)}><Plus aria-hidden="true" />{newKinds.length <= 2 ? addOne(newKinds[0].label) : addLabel}</Button>
                : view === 'open' && !narrowed ? <Button size="sm" onClick={() => chooseView('all')}>{copy('showAll')}</Button> : undefined}>{empty.body}</EmptyNote>
              {pager && <div className="rec-pager">{pager}</div>}
            </Panel>}
      </section>
    </div>
  </PageFrame>;
}
