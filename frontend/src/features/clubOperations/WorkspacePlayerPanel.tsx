import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, ClipboardCheck, ExternalLink, Plus, X } from 'lucide-react';
import { squadLabel } from '../../components/squads/squadLabels';
import type { SquadRosterPlayer } from '../../components/squads/SquadRosterTable';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, post, root, label, type Bootstrap, type OperationRecord } from './api';
import { operationTab, operationTabs } from './workspaceNavigation';
import type { OpenWorkspace } from './workspaceStructure';
import { useClubEditorClose } from './useClubEditorClose';
import { canReadSquad } from './squadAccess';
import '../../components/squads/squad-design.css';
import './workspace-polish.css';

export function WorkspacePlayerPanel({player,squad,squadName,boot,onClose,onOpen}:{player:SquadRosterPlayer;squad:number;squadName:string;boot:Bootstrap|null;onClose:()=>void;onOpen:OpenWorkspace}) {
  const {t}=useTranslation();
  const [observation,setObservation]=useState(''),[nextSteps,setNextSteps]=useState(''),[adding,setAdding]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[revision,setRevision]=useState(0);
  const [records,setRecords]=useState<{module:string;rows:OperationRecord[];error:string}[]|null>(null);
  const {requestClose,confirmation}=useClubEditorClose(Boolean(observation.trim()||nextSteps.trim()),busy,onClose);
  const ref=useRef<HTMLDivElement>(null),closeRef=useRef<HTMLButtonElement>(null),lock=useRef(false);
  useDialogFocus(true,ref,requestClose,closeRef);
  const development=canReadSquad(boot,'DEVELOPMENT',squad),restrictions=canReadSquad(boot,'AVAILABILITY',squad);
  const writable=Boolean(boot?.settings.enabled_modules.includes('DEVELOPMENT')&&boot.modules.some(m=>m.id==='DEVELOPMENT'&&(m.globalWrite||m.writeSquads.includes(squad))));
  const club=boot?.clubId;
  useEffect(()=>{const c=new AbortController();const modules=[...(restrictions?['AVAILABILITY']:[]),...(development?['DEVELOPMENT']:[])];void Promise.all(modules.map(async module=>{try{return {module,rows:await get<OperationRecord[]>(`/clubs/${club}/workspace-roles/work?module=${module}&squad=${squad}&person=${player.id}${module==='AVAILABILITY'?'&state=open':''}`,c.signal),error:''};}catch(e){return {module,rows:[],error:extractApiErrorMessage(e,'Could not load player information.')};}})).then(value=>{if(!c.signal.aborted)setRecords(value);});return()=>c.abort();},[club,player.id,squad,development,restrictions,revision]);
  const save=async()=>{if(lock.current||!writable||!observation.trim())return;lock.current=true;setBusy(true);setError('');try{await post(`${root(club!)}/records`,{kind:'OBSERVATION',title:`Observation · ${player.name} · ${new Date().toLocaleDateString()}`.slice(0,160),squadId:squad,subjectUserId:player.id,data:{observation:observation.trim(),nextSteps:nextSteps.trim()}});setObservation('');setNextSteps('');setAdding(false);setSaved(true);setRevision(v=>v+1);}catch(e){setError(extractApiErrorMessage(e,'Could not save this observation.'));}finally{lock.current=false;setBusy(false);}};
  const tools=operationTabs.filter(t=>['DEVELOPMENT','ATTENDANCE','GUARDIANS','REGISTRATION','EQUIPMENT','TRAVEL'].includes(t.module)&&canReadSquad(boot,t.module,squad)&&boot?.settings.enabled_modules.includes(t.module));
  return <div className="wo-dialog-backdrop wo-drawer-backdrop"><div ref={ref} className="squad-design wo-player-panel" role="dialog" aria-modal="true" aria-labelledby="workspace-player-title"><header><div><span className="sd-eyebrow">{squadName}</span><h2 id="workspace-player-title">{player.name}</h2><p>{[player.number!=null?`#${player.number}`:null,player.position?squadLabel(player.position,t):null,player.age!=null?`Age ${player.age}`:null].filter(Boolean).join(' · ')||'Squad player'}</p></div><button type="button" className="sd-icon-button" ref={closeRef} onClick={requestClose} disabled={busy} aria-label="Close player details"><X size={20}/></button></header>
    <div className="wo-player-body">{player.isRegistered!==false&&<Link className="wo-profile-link" to={`/profile/${player.id}`} onClick={e=>{if(observation.trim()||nextSteps.trim()||busy){e.preventDefault();setError('Save or discard your observation before opening the public profile.');}}}>View public profile<ExternalLink size={13}/></Link>}
    {saved&&<p role="status" className="wo-success">Observation saved as a draft. Review or share it in Development.</p>}{error&&<p role="alert" className="ops-alert">{error}</p>}
    {adding?<form className="wo-observation-form" onSubmit={e=>{e.preventDefault();void save();}}><h3>Coach observation</h3><label>Observation<textarea required rows={5} maxLength={4000} placeholder="What did you notice?" value={observation} onChange={e=>setObservation(e.target.value)} disabled={busy}/></label><label>Next steps <span>(optional)</span><textarea rows={2} maxLength={4000} value={nextSteps} onChange={e=>setNextSteps(e.target.value)} disabled={busy}/></label><div><button type="submit" className="sd-primary" disabled={busy||!observation.trim()}>{busy?'Saving…':'Save observation'}</button><button type="button" className="sd-button" disabled={busy} onClick={()=>{if(observation.trim()||nextSteps.trim())requestClose();else setAdding(false);}}>Cancel</button></div></form>:writable&&<button type="button" className="sd-primary wo-observation-add" onClick={()=>{setSaved(false);setAdding(true);}}><Plus size={15}/>Add observation</button>}
    {records===null?<p role="status" className="wo-quiet">Loading player information…</p>:records.map(group=><section className="wo-player-records" key={group.module}><header><h3>{group.module==='AVAILABILITY'?'Participation restrictions':'Recent development'}</h3><button type="button" onClick={()=>onOpen(operationTab(group.module),{squad:String(squad),person:String(player.id)})}>View all<ArrowRight size={13}/></button></header>{group.error?<p role="alert">{group.error}<button type="button" onClick={()=>setRevision(v=>v+1)}>Retry</button></p>:group.rows.length?group.rows.slice(0,4).map(r=><button type="button" key={r.id} onClick={()=>onOpen(operationTab(r.module),{squad:String(squad),person:String(player.id),record:String(r.id)})}><span><strong>{r.title}</strong><small>{group.module==='AVAILABILITY'?r.data.restrictions:label(r.status)}</small>{r.data.reviewOn&&<small>Review {r.data.reviewOn}</small>}</span><ChevronRight size={14}/></button>):<p className="wo-quiet">{group.module==='AVAILABILITY'?'No open restrictions recorded here.':'No development entries recorded here.'}</p>}</section>)}
    {tools.length>0&&<section className="wo-player-tools"><h3>Player tools</h3>{tools.map(t=><button type="button" key={t.id} onClick={()=>onOpen(t.id,{squad:String(squad),person:String(player.id)})}><t.icon size={15}/>{t.label}<ChevronRight size={14}/></button>)}</section>}
    {!boot&&<p className="wo-quiet"><ClipboardCheck size={17}/>Player workflows are temporarily unavailable.</p>}
    </div>{confirmation}
  </div></div>;
}
