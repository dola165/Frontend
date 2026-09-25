import { SessionRegister } from './SessionRegister';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Search, X } from 'lucide-react';
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
  const records=result?.key===requestKey?result.records:[],loading=result?.key!==requestKey,error=result?.key===requestKey?result.error:'';
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
      <div hidden={isRegister&&!showRecords}>
      <div className="work-record-filter">
        <label>Squad<select aria-label="Record squad" value={squad} onChange={e=>filter('squad',e.target.value)}><option value="">All accessible squads</option>{boot.squads.filter(s=>module==='HOME'?boot.modules.some(m=>m.globalRead||m.readSquads?.includes(s.id)):permission?.globalRead||permission?.readSquads?.includes(s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        {definitions.length>1&&<label>Type<select value={kind} onChange={e=>filter('kind',e.target.value)}><option value="">All record types</option>{definitions.map(d=><option value={d.kind} key={d.kind}>{d.label}</option>)}</select></label>}
        {module!=='HOME'&&<label>Status<select value={state} onChange={e=>filter('state',e.target.value)}><option value="all">All records</option><option value="open">Open records</option></select></label>}
        <label><input type="checkbox" checked={mine} onChange={e=>filter('mine',e.target.checked?'true':'')}/>Assigned to me</label>
      </div>
      <div className="workspace-record-tools"><label><Search size={15}/><input aria-label="Search records" value={search} maxLength={160} onChange={e=>filter('q',e.target.value)} placeholder="Search all accessible records…"/></label><span>{loading?'Loading…':`${visible.length} records${page?` · page ${page+1}`:''}`}</span></div>
      {loading ? <p role="status" className="workspace-list-message">Loading records…</p> : !error && visible.length ? <div className="workspace-record-table"><table><thead><tr><th>Record</th><th>Responsibility</th><th>Status</th><th>Review / due</th></tr></thead><tbody>{visible.map(r => <tr key={r.id}><td><button type="button" onClick={() => open(r)}>{r.title}</button><small>{module === 'HOME' ? `${moduleNames[r.module]} · ` : ''}{boot.definitions.find(d => d.kind === r.kind)?.label}</small></td><td>{boot.staff.find(s => s.id === r.assigned_user_id)?.name ?? boot.guardians.find(g => g.id === r.assigned_user_id)?.name ?? 'Unassigned'}<small>{r.squad_id?(boot.squads.find(s=>s.id===r.squad_id)?.name??`Squad #${r.squad_id}`):'Club-wide'}</small></td><td><span className={`ops-badge ${r.expired ? 'urgent' : ''}`}>{r.expired ? 'Expired · ' : ''}{label(r.status)}</span></td><td>{r.attentionDate ?? r.due_on ?? '—'}</td></tr>)}</tbody></table></div> : !error && <div className="workspace-list-message"><h2>{search || kind ? 'No matching records' : module === 'HOME' ? 'You’re up to date' : 'Nothing here yet'}</h2><p>{search || kind ? 'Try another search or record type.' : module === 'HOME' ? 'New deadlines and decisions will appear here.' : canCreate ? `Add your first ${definitions[0]?.label.toLowerCase() ?? 'record'} to get started.` : 'Records shared with your role will appear here.'}</p>{canCreate && !search && !kind && <button type="button" className="workspace-add-button" onClick={() => definitions.length === 1 ? create(definitions[0].kind) : setChoosing(true)}><Plus size={15} />Get started</button>}</div>}
      {(page > 0 || records.length === 100) && <div className="ops-footer"><button disabled={page === 0 || loading} onClick={() => changePage(page - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={records.length < 100 || loading} onClick={() => changePage(page + 1)}>Next</button></div>}
      </div>
      </>}
    </>}
  </section>;
}
