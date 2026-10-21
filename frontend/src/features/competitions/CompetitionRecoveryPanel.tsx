import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../../context/AuthContext';
import {apiClient} from '../../api/axiosConfig';
import {readPendingCommands} from './commandRecovery';
import {useCompetitionCommand} from './useCompetitionCommand';
export function CompetitionRecoveryPanel({id,changed}:{id?:number;changed?:()=>Promise<void>}){
 const {user,sessionId}=useAuth();const {i18n}=useTranslation();const copy=(en:string,ka:string)=>i18n.language.startsWith('ka')?ka:en;
 const scope=`competition-command:${user?.id}:${sessionId}:${window.location.pathname}`;
 const [journal,setJournal]=useState(()=>readPendingCommands(scope));const commands=useCompetitionCommand();
 useEffect(()=>{const update=()=>setJournal(readPendingCommands(scope));update();window.addEventListener('competition-intent',update);return()=>window.removeEventListener('competition-intent',update);},[scope]);
 const actions=journal.filter(a=>id?/^(?:draw|divisions|resources)(?:\/[\w/-]*)?$|^(?:rounds|challenges|entries|fixtures|finish|resolve-rank|reopen-season)(?:\/[\w/-]*)?$/.test(a.path):/^\/competitions\/\d+\/resources\/referees\/\d+\/decision$/.test(a.path));
 if(!actions.length)return null;
 return <section className="mc-panel co-panel" aria-labelledby="competition-recovery"><h2 id="competition-recovery">{copy('Confirm an interrupted submission','შეწყვეტილი მოქმედების გადამოწმება')}</h2><p>{copy('The original details are saved for this account. Retry to retrieve the committed result or receive a current rejection before submitting different details.','ამ ანგარიშისთვის საწყისი მონაცემები შენახულია. გაიმეორეთ მოქმედება შედეგის ან მიმდინარე უარის მისაღებად, შემდეგ შეცვალეთ მონაცემები.')}</p>{commands.error&&<p role="alert">{commands.error}</p>}{commands.notice&&<p role="status">{commands.notice}</p>}{actions.map(a=><div key={a.requestId}><p>{String(a.body.reason||a.body.terms||copy('Competition update','შეჯიბრების ცვლილება'))}</p><button type="button" disabled={commands.busy} onClick={()=>void commands.run(a.path,a.body,a.revision,async payload=>(await apiClient.post(id?`/competitions/${id}/${a.path.replace(/\/$/,'')}`:a.path,payload)).data,async()=>{if(changed)await changed();},()=>{if(changed)void changed();})}>{copy('Confirm original submission','საწყისი მოქმედების გადამოწმება')}</button></div>)}</section>;
}
