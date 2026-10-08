import { EmptyState } from '../../components/ui/EmptyState';
import { SessionRegister } from './SessionRegister';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Search, X, ClipboardCheck, CalendarDays } from 'lucide-react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, root, label, moduleNames, type Bootstrap, type OperationRecord } from './api';
import { RecordEditor } from './RecordEditor';
import { RecordDetail } from './RecordDetail';
import { OperationsSettings } from './OperationsSettings';
import { FinanceSummary } from './FinanceSummary';
import { AppointmentActions } from './AppointmentActions';
import { operationDescriptions } from './workspaceNavigation';
import './operations.css';
import './workspace-operations.css';
import './staff-team.css';
export function WorkspaceOperations({ boot, module, onRefresh }: { boot: Bootstrap; module: string; onRefresh: () => Promise<void>; roleView?: string }) {
  const [params, setParams] = useSearchParams();
  const [result,setResult]=useState<{key:string;records:OperationRecord[];error:string}|null>(null);
  const [detailError,setDetailError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const page=Math.max(0,Number(params.get('page'))||0),search=params.get('q')??'',kind=params.get('kind')??'',squad=params.get('squad')??'',session=params.get('session')??'',person=params.get('person')??'',mine=params.get('mine')==='true',state=params.get('state')==='open'?'open':'all';
  const [selected, setSelected] = useState<OperationRecord | null>(null), [editing, setEditing] = useState(false), [newKind, setNewKind] = useState(''), [choosing, setChoosing] = useState(false);
  const staffEditing = false; const [showRecords,setShowRecords]=useState(false);
  const selectRequest = useRef(0);
  const club = boot.clubId, linked = params.get('record');
  const definitions = boot.definitions.filter(d => d.module === module), permission = boot.modules.find(m => m.id === module);
  const definition = boot.definitions.find(d => d.kind === (newKind || selected?.kind));
  const enabled = boot.settings.enabled_modules.includes(module), canCreate = permission?.writable && enabled && (!squad||permission.globalWrite||permission.writeSquads.includes(Number(squad)));
  const filter=(key:string,value:string)=>{const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);next.delete('page');next.delete('record');if(key==='squad'){next.delete('session');next.delete('person');}setParams(next,{replace:key==='q'});};
  const query=new URLSearchParams({module,page:String(page),q:search,kind,mine:String(mine),state});
  if(squad)query.set('squad',squad);if(session)query.set('session',session);if(person)query.set('person',person);
  const requestKey=`${club}:${query}:${refresh}`;
  const records=result?.records??[],loading=result?.key!==requestKey,error=result?.key===requestKey?result.error:'';
  const selectedSession=boot.sessions.find(s=>String(s.id)===session);
  const isRegister=module==='ATTENDANCE'&&Boolean(selectedSession?.squad_id)&&Boolean(boot.peopleBySquad);
  const editorBoot={...boot,defaultSquadId:squad?Number(squad):undefined,defaultSessionId:selectedSession?.id,defaultSubjectId:boot.people.find(p=>String(p.id)===person)?.id};
  useEffect(() => {
    if (module === 'SETTINGS'||isRegister&&!showRecords) return;
    const c = new AbortController();
    const timer=setTimeout(()=>{void get<OperationRecord[]>(`/clubs/${club}/workspace-roles/work?${query}`,c.signal)
      .then(records=>{if(!c.signal.aborted)setResult({key:requestKey,records,error:''});})
      .catch(e=>{if(!c.signal.aborted)setResult({key:requestKey,records:[],error:extractApiErrorMessage(e,'Could not load this section.')});});},search?250:0);
    return()=>{clearTimeout(timer);c.abort();};
  // query is represented by requestKey to avoid restarting identical requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey,module,isRegister,showRecords]);
  useEffect(() => {
    if (!linked) { setSelected(null); setDetailError('');return; }
    setSelected(null);setDetailError('');
    const c = new AbortController(), request = ++selectRequest.current;
    void get<OperationRecord>(`${root(club)}/records/${encodeURIComponent(linked)}`, c.signal).then(value => {
      if (!c.signal.aborted && request === selectRequest.current) { setSelected(value); setEditing(false); setNewKind(''); }
    }).catch(e => { if (!c.signal.aborted) setDetailError(extractApiErrorMessage(e, 'This record is unavailable.')); });
    return () => c.abort();
  }, [club, linked]);
  const close = () => { selectRequest.current++; setSelected(null); setEditing(false); setNewKind(''); const next = new URLSearchParams(params); next.delete('record'); setParams(next, { replace: true }); };
  const open = (record: OperationRecord) => { const next = new URLSearchParams(params); next.set('record', String(record.id)); setParams(next); };
  const reload = () => { setRefresh(v => v + 1); };
  const changed = async () => { await onRefresh(); close(); reload(); };
  const create = (value: string) => { setNewKind(value); setEditing(true); setSelected(null); setChoosing(false); };
  const title = module === 'HOME' ? 'Work queue' : moduleNames[module];
  const visible=records;
  const filtered = Boolean(search || kind || (module === 'ATTENDANCE' && (squad || mine || state === 'open' || person || page)));
  const scheduledSessions = module === 'ATTENDANCE' && boot.peopleBySquad ? boot.sessions.filter(s =>
    s.squad_id && (permission?.globalRead || permission?.readSquads?.includes(s.squad_id)) &&
    (!squad || String(s.squad_id) === squad) && new Date(s.starts_at).getTime() >= Date.now()
  ).sort((a,b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()).slice(0,3) : [];
  const openRegister = (s: Bootstrap['sessions'][number]) => {
    const next = new URLSearchParams(params);
    ['q','kind','mine','state','person','page','record'].forEach(key => next.delete(key));
    next.set('squad', String(s.squad_id)); next.set('session', String(s.id));
    setShowRecords(false); setParams(next);
  };
  const changePage=(page:number)=>{const next=new URLSearchParams(params);next.set('page',String(page));setParams(next);};
  if (module === 'SETTINGS') return <section className="club-ops club-ops-embedded"><OperationsSettings key={boot.settings.revision} boot={boot} onSaved={onRefresh} /></section>;
  return <section className="club-ops club-ops-embedded" aria-label={title}>
    {linked&&!selected?<><button className="workspace-record-back" onClick={close}><ArrowLeft size={15}/>Back to {title.toLowerCase()}</button>{detailError?<p role="alert" className="ops-alert">{detailError}</p>:<p role="status">Opening record…</p>}</>:editing && definition ? <RecordEditor key={`${newKind}-${selected?.id ?? 'new'}`} boot={editorBoot} definition={definition} record={selected ?? undefined} onSaved={changed} onCancel={close} /> : selected && definition ? <>
      <button type="button" className="workspace-record-back" onClick={close}><ArrowLeft size={15} />Back to {title.toLowerCase()}</button>
      <RecordDetail club={club} boot={boot} record={selected} definition={definition} onEdit={() => setEditing(true)} onChanged={changed} onClose={close} />
    </> : <>
      {!staffEditing && <header className="workspace-section-heading"><div><p className="workspace-section-kicker">Club workspace / {module === 'HOME' ? 'Today' : title}</p><h1>{title}</h1><p>{operationDescriptions[module]}</p></div>
        {canCreate && definitions.length > 0 && <button type="button" className="workspace-add-button" onClick={() => definitions.length === 1 ? create(definitions[0].kind) : setChoosing(v => !v)} aria-expanded={choosing}><Plus size={16} />Add {definitions.length === 1 ? definitions[0].label.toLowerCase() : title.toLowerCase().replace(' & duties', '')}</button>}
      </header>}
      {error && <div role="alert" className="ops-alert">{error} <button onClick={reload}>Retry</button></div>}
      {module !== 'HOME' && !enabled && <p className="workspace-history-note">This section is hidden from everyday navigation. Saved history and outstanding responsibilities remain available. Enable it in Workspace settings to add or edit records.</p>}
      {choosing && <section className="workspace-create-choices" aria-label={`Add ${title.toLowerCase()}`}><div><h2>What would you like to add?</h2><button type="button" aria-label="Close choices" onClick={() => setChoosing(false)}><X size={16} /></button></div><div>{definitions.map(d => <button type="button" key={d.kind} onClick={() => create(d.kind)}><span>{d.label}</span><ArrowRight size={15} /></button>)}</div></section>}
      {module === 'STAFF' && <p className="staff-access-note">Staff appointments and invitations are now together in Staff. <button onClick={()=>{const next=new URLSearchParams();next.set('tab','personnel');setParams(next);}}>Open staff team</button></p>}
      {!staffEditing && <>
      {module === 'HOME' && boot.modules.some(m => m.id === 'STAFF') && <AppointmentActions club={club} onOpen={() => { const next = new URLSearchParams(params); next.set('tab', 'staff-duties'); next.delete('record'); setParams(next); }} />}
      {module === 'FINANCE' && <FinanceSummary club={club} revision={boot} />}
      {(session||person)&&<div className="work-context-banner"><div><strong>{person?(boot.people.find(p=>String(p.id)===person)?.name??`Player #${person}`):(selectedSession?.title??`Training session #${session}`)}</strong><small>{squad?(boot.squads.find(s=>String(s.id)===squad)?.name??`Squad #${squad}`):''}{selectedSession?` · ${new Date(selectedSession.starts_at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}`:''}</small></div><button onClick={()=>{const next=new URLSearchParams(params);next.delete('session');next.delete('person');next.delete('page');setParams(next);}}>Clear context</button></div>}
      {isRegister&&<><SessionRegister boot={boot} session={Number(session)} squad={selectedSession!.squad_id!} onRecord={open}/><button className="work-register-more" aria-expanded={showRecords} onClick={()=>setShowRecords(v=>!v)}>{showRecords?'Hide attendance records':'Attendance records & additional options'}</button></>}
      <div className="workspace-record-collection" hidden={isRegister&&!showRecords} aria-busy={loading}>
      <div className="work-record-filter">
        <label>Squad<select aria-label="Record squad" value={squad} onChange={e=>filter('squad',e.target.value)}><option value="">All accessible squads</option>{boot.squads.filter(s=>module==='HOME'?boot.modules.some(m=>m.globalRead||m.readSquads?.includes(s.id)):permission?.globalRead||permission?.readSquads?.includes(s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        {definitions.length>1&&<label>Type<select value={kind} onChange={e=>filter('kind',e.target.value)}><option value="">All record types</option>{definitions.map(d=><option value={d.kind} key={d.kind}>{d.label}</option>)}</select></label>}
        {module!=='HOME'&&<label>Status<select value={state} onChange={e=>filter('state',e.target.value)}><option value="all">All records</option><option value="open">Open records</option></select></label>}
        <label><input type="checkbox" checked={mine} onChange={e=>filter('mine',e.target.checked?'true':'')}/>Assigned to me</label>
      </div>
      <div className="workspace-record-tools"><label><Search size={15}/><input aria-label="Search records" value={search} maxLength={160} onChange={e=>filter('q',e.target.value)} placeholder="Search all accessible records…"/></label><span role="status">{loading?'Updating records…':`${visible.length} records${page?` · page ${page+1}`:''}`}</span></div>
      {loading && !result ? <p role="status" className="workspace-list-message">Loading records…</p> : visible.length ? <div className="workspace-record-table" inert={loading} data-updating={loading}><table><thead><tr><th>Record</th><th>Responsibility</th><th>Status</th><th>Review / due</th></tr></thead><tbody>{visible.map(r => <tr key={r.id}><td><button type="button" onClick={() => open(r)}>{r.title}</button><small>{module === 'HOME' ? `${moduleNames[r.module]} · ` : ''}{boot.definitions.find(d => d.kind === r.kind)?.label}</small></td><td>{boot.staff.find(s => s.id === r.assigned_user_id)?.name ?? boot.guardians.find(g => g.id === r.assigned_user_id)?.name ?? 'Unassigned'}<small>{r.squad_id?(boot.squads.find(s=>s.id===r.squad_id)?.name??`Squad #${r.squad_id}`):'Club-wide'}</small></td><td><span data-status={r.status} className={`ops-badge ${r.expired ? 'urgent' : ''}`}>{r.expired ? 'Expired · ' : ''}{label(r.status)}</span></td><td>{r.attentionDate ?? r.due_on ?? '—'}</td></tr>)}</tbody></table></div> : !error && <EmptyState icon={filtered ? Search : ClipboardCheck} title={filtered ? 'No matching records' : module === 'HOME' ? 'You’re up to date' : `Start your ${title.toLowerCase()} records`} description={filtered ? 'Try another search, squad or status to find the work you need.' : module === 'HOME' ? 'New deadlines and decisions will appear here. Your club’s work queue brings the next steps together.' : canCreate ? `${operationDescriptions[module] ?? 'Keep the information for this responsibility together.'} Add your first ${definitions[0]?.label.toLowerCase() ?? 'record'} when you are ready.` : 'Records shared with your approved responsibility will appear here. Club leadership controls which tools and records you can use.'} action={canCreate && !filtered ? {label:'Get started',onClick:()=>definitions.length === 1 ? create(definitions[0].kind) : setChoosing(true)} : undefined}/>}
      {(page > 0 || records.length === 100) && <div className="ops-footer"><button disabled={page === 0 || loading} onClick={() => changePage(page - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={records.length < 100 || loading} onClick={() => changePage(page + 1)}>Next</button></div>}
      </div>
      {module === 'ATTENDANCE' && !isRegister && boot.peopleBySquad && <section className="attendance-sessions" aria-label="Scheduled sessions">
        <header><div><p className="workspace-section-kicker">From your club schedule</p><h2>Session registers</h2><p>Upcoming session records. Check the calendar for schedule changes.</p></div><Link to={`/calendar?clubId=${club}`}><CalendarDays size={15} aria-hidden="true"/>Open calendar<ArrowRight size={14} aria-hidden="true"/></Link></header>
        {scheduledSessions.length ? <div className="attendance-session-grid">{scheduledSessions.map(s => <button type="button" className="attendance-session" key={s.id} onClick={() => openRegister(s)}>
          <span className="attendance-session-icon"><CalendarDays size={20} aria-hidden="true"/></span><span><small>{s.squad_name}</small><strong>{s.title}</strong><time dateTime={s.starts_at}>{new Date(s.starts_at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:boot.settings.timezone || undefined})}</time><span className="attendance-session-action">Open register<ArrowRight size={14} aria-hidden="true"/></span></span>
        </button>)}</div> : <p className="attendance-session-empty">No upcoming training sessions in this accessible schedule. Open the calendar to review or plan sessions.</p>}
        {scheduledSessions.length > 0 && boot.settings.timezone && <p className="attendance-session-timezone">Times in {boot.settings.timezone.replaceAll('_',' ')}</p>}
      </section>}
      </>}
    </>}
  </section>;
}
