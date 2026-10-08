import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useSearchParams} from 'react-router-dom';
import {apiClient} from '../../api/axiosConfig';
import {extractApiErrorMessage} from '../../utils/apiError';
import {useCompetitionCommand} from './useCompetitionCommand';
type Assignment={id:number;tournament_id:number;fixture_id:number;competition:string;status:string;starts_at:string;ends_at:string;revision:number;volunteer:boolean;fee:number;currency:string;terms:string;report?:string};
export function CompetitionOfficialAssignments(){
 const {i18n}=useTranslation();const copy=(en:string,ka:string)=>i18n.language.startsWith('ka')?ka:en;const [params]=useSearchParams();
 const [rows,setRows]=useState<Assignment[]>(),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[reason,setReason]=useState<Record<number,string>>({});
 const commands=useCompetitionCommand();
 useEffect(()=>{const abort=new AbortController();void apiClient.get<Assignment[]>('/competitions/official-assignments',{signal:abort.signal}).then(r=>{if(!abort.signal.aborted){setRows(r.data);setError('');}}).catch(e=>{if(!abort.signal.aborted){setRows(undefined);setError(extractApiErrorMessage(e,'Could not load your competition appointments.'));}});return()=>abort.abort();},[attempt]);
 async function act(a:Assignment,action:string){const path=`/competitions/${a.tournament_id}/resources/referees/${a.id}/decision`;await commands.run(path,{action,reason:reason[a.id]?.trim()||copy('Invitation decision','მოწვევის პასუხი')},a.revision,async body=>(await apiClient.post<Assignment[]>(path,body)).data,async value=>setRows(value),()=>setAttempt(a=>a+1));}
 return <section className="mc-panel co-panel" aria-labelledby="competition-official-work"><h2 id="competition-official-work">{copy('Your competition appointments','თქვენი დანიშვნები შეჯიბრებებზე')}</h2>
 {error&&<p role="alert">{error}<button type="button" onClick={()=>setAttempt(a=>a+1)}>{copy('Retry','ხელახლა')}</button></p>}{commands.error&&<p role="alert">{commands.error}</p>}{commands.notice&&<p role="status">{commands.notice}</p>}{!rows&&!error&&<p role="status">{copy('Loading appointments…','დანიშვნები იტვირთება…')}</p>}
 {rows?.length===0&&<p>{copy('Invitations and assigned duties will appear here.','მოწვევები და დანიშვნები აქ გამოჩნდება.')}</p>}
 {rows?.map(a=><article id={`competition-appointment-${a.id}`} key={a.id} className={params.get('competitionAppointment')===String(a.id)?'co-selected':''}><h3>{a.competition}</h3><p>{new Date(a.starts_at).toLocaleString(i18n.language)} – {new Date(a.ends_at).toLocaleTimeString(i18n.language)} · {a.status}</p><p>{a.terms}</p><p>{a.volunteer?copy('Volunteer appointment','მოხალისე მსაჯი'):`${a.fee} ${a.currency}`}</p>{a.report&&<p>{copy('Your private report','თქვენი პირადი ანგარიში')}: {a.report}</p>}
 {a.status==='INVITED'&&new Date(a.starts_at)>new Date()&&<div><button type="button" disabled={commands.busy} onClick={()=>void act(a,'ACCEPT')}>{copy('Accept invitation','მოწვევის მიღება')}</button><button type="button" disabled={commands.busy} onClick={()=>void act(a,'DECLINE')}>{copy('Decline','უარი')}</button></div>}
 {a.status==='ACCEPTED'&&<><label>{copy('Private report or withdrawal reason','პირადი ანგარიში ან უარის მიზეზი')}<textarea value={reason[a.id]||''} maxLength={4000} onChange={e=>setReason({...reason,[a.id]:e.target.value})}/></label>{new Date(a.ends_at)<=new Date()?<button type="button" disabled={commands.busy||!reason[a.id]?.trim()} onClick={()=>void act(a,'REPORT')}>{copy('Submit private report','პირადი ანგარიშის გაგზავნა')}</button>:<button type="button" disabled={commands.busy||!reason[a.id]?.trim()} onClick={()=>void act(a,'WITHDRAW')}>{copy('Withdraw with reason','უარი მიზეზით')}</button>}</>}
 </article>)}</section>;
}
