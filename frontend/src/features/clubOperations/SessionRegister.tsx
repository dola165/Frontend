import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { get, post, root, label, type Bootstrap, type OperationRecord } from './api';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useClubEditorClose } from './useClubEditorClose';
import { TrainingVisitorsRegister } from './TrainingVisitorsRegister';

export function SessionRegister({boot,session,squad,onRecord}:{boot:Bootstrap;session:number;squad:number;onRecord:(r:OperationRecord)=>void}) {
  const [records,setRecords]=useState<OperationRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState<number|null>(null),[revision,setRevision]=useState(0),[query,setQuery]=useState('');
  const lock=useRef(false);
  const [historicalVisitors,setHistoricalVisitors]=useState<number[]>([]);
  const recordHistoricalPlayers=useCallback((ids:number[])=>setHistoricalVisitors(ids),[]);
  const [correction,setCorrection]=useState<OperationRecord|null>(null),[reason,setReason]=useState('');
  const {confirmation}=useClubEditorClose(Boolean(reason.trim()),busy!==null,()=>{setCorrection(null);setReason('');});
  const info=boot.sessions.find(s=>s.id===session),permission=boot.modules.find(m=>m.id==='ATTENDANCE');
  const writable=boot.settings.enabled_modules.includes('ATTENDANCE')&&Boolean(permission?.globalWrite||permission?.writeSquads.includes(squad));
  const development=boot.modules.find(m=>m.id==='DEVELOPMENT');
  const canSeeVisitors=writable&&Boolean(development?.globalWrite||development?.writeSquads.includes(squad));
  const members=boot.people.filter(p=>boot.peopleBySquad?.some(link=>link.id===p.id&&link.squad_id===squad));
  // Include existing attendance for players who have since left this roster.
  const people=[...members,...records.filter(r=>r.subject_user_id&&!members.some(p=>p.id===r.subject_user_id)).map(r=>({id:r.subject_user_id!,name:boot.people.find(p=>p.id===r.subject_user_id)?.name??`Former player #${r.subject_user_id}`}))].filter(person=>!historicalVisitors.includes(person.id));
  useEffect(()=>{const c=new AbortController();
    void (async()=>{const all:OperationRecord[]=[];for(let page=0;page<30;page++){const rows=await get<OperationRecord[]>(`/clubs/${boot.clubId}/workspace-roles/work?module=ATTENDANCE&squad=${squad}&session=${session}&page=${page}`,c.signal);all.push(...rows.filter(r=>r.status!=='CANCELLED'));if(rows.length<100){if(!c.signal.aborted){setRecords(all);setError('');setLoading(false);}return;}}throw new Error('This register is too large. Open the attendance records to review it.');})().catch(e=>{if(!c.signal.aborted){setError(extractApiErrorMessage(e,'Could not load the session register.'));setLoading(false);}});
    return()=>c.abort();
  },[boot.clubId,session,squad,revision]);
  const setStatus=async(person:{id:number;name:string},status:string,existing?:OperationRecord,note?:string)=>{
    if(lock.current)return;lock.current=true;setBusy(person.id);setError('');
    try {
      let record=existing;
      if(!record){record=await post<OperationRecord>(`${root(boot.clubId)}/records`,{kind:'ATTENDANCE',title:`${person.name} · ${info?.title??'Training session'}`.slice(0,160),squadId:squad,sessionId:session,subjectUserId:person.id,data:{}});setRecords(rows=>[...rows.filter(r=>r.id!==record!.id),record!]);}
      const updated=await post<OperationRecord>(`${root(boot.clubId)}/records/${record.id}/transition`,{status,revision:record.revision,note:note??null});
      setRecords(rows=>[...rows.filter(r=>r.id!==updated.id),updated]);setCorrection(null);setReason('');
    } catch(e){setError(extractApiErrorMessage(e,'Could not update attendance. Reload the register before trying again.'));}
    finally{lock.current=false;setBusy(null);}
  };
  const visible=people.filter(p=>p.name.toLowerCase().includes(query.toLowerCase()));
  return <section className="work-panel work-register" aria-label="Session register"><header><h2>Session register</h2><span>{records.filter(r=>r.status==='ARRIVED').length} arrived · {records.filter(r=>r.status==='ABSENT').length} absent · {records.filter(r=>r.status==='COLLECTED').length} collected</span></header>
    <div className="work-tool-search"><label><Search size={16}/><input aria-label="Find a player in the register" placeholder="Find a player…" value={query} onChange={e=>setQuery(e.target.value)}/></label><button disabled={busy!==null} onClick={()=>{setLoading(true);setRevision(v=>v+1);}}>Reload register</button></div>
    {error&&<p role="alert" className="ops-alert">{error}</p>}
    {correction&&<form className="work-register-correction" onSubmit={e=>{e.preventDefault();void setStatus({id:correction.subject_user_id!,name:''},'EXPECTED',correction,reason);}}><label>Why is this attendance being corrected?<input required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button type="submit" disabled={busy!==null||!reason.trim()}>Save correction</button><button type="button" disabled={busy!==null} onClick={()=>{setCorrection(null);setReason('');}}>Cancel</button></form>}
    {loading?<p className="work-empty" role="status">Loading register…</p>:visible.map(p=>{const record=records.find(r=>r.subject_user_id===p.id),status=record?.status??'EXPECTED',canAct=writable&&(!record||record.transitions.length>0);return <div className="work-row" key={p.id}><span className="work-person-avatar" aria-hidden>{p.name.split(/\s+/).slice(0,2).map(n=>n[0]).join('')}</span><span><strong>{p.name}</strong><small>{record?label(status):'Not recorded'}</small></span><div className="work-register-actions">{status==='EXPECTED'&&canAct&&<><button disabled={busy!==null} onClick={()=>{void setStatus(p,'ARRIVED',record);}}><Check size={14}/>Mark arrived</button><button disabled={busy!==null} onClick={()=>{void setStatus(p,'ABSENT',record);}}>Mark absent</button></>}{record&&<button disabled={busy!==null} onClick={()=>onRecord(record)}>{status==='ARRIVED'?'Collection & details':'Details'}</button>}{record&&record.transitions.includes('EXPECTED')&&writable&&<button disabled={busy!==null} onClick={()=>{setCorrection(record);setReason('');}}>Correct</button>}{busy===p.id&&<span role="status">Saving…</span>}</div></div>;})}
    {!loading&&!visible.length&&<p className="work-empty">{query?'No player matches this search.':'No roster is available here. Use attendance records below to add a player.'}</p>}
    {canSeeVisitors&&<TrainingVisitorsRegister squad={squad} session={session} revision={revision} onHistoricalPlayers={recordHistoricalPlayers}/>}
    <p className="work-register-note">Collection is recorded in the player’s details after checking collection permission.</p>{confirmation}
  </section>;
}
