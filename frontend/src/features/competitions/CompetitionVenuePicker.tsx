import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {apiClient} from '../../api/axiosConfig';
import {extractApiErrorMessage} from '../../utils/apiError';
type Venue={id:number;displayName:string;city?:string;addressText?:string};
export function CompetitionVenuePicker({value,onChange,disabled}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
 const {i18n}=useTranslation();const copy=(en:string,ka:string)=>i18n.language.startsWith('ka')?ka:en;
 const [q,setQ]=useState(''),[venues,setVenues]=useState<Venue[]>([]),[chosen,setChosen]=useState<Venue>(),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const abort=new AbortController();const timer=setTimeout(()=>{void apiClient.get<{content:Venue[]}>('/venues',{signal:abort.signal,params:{q,size:24}}).then(r=>{if(!abort.signal.aborted){setVenues(r.data.content);setError('');}}).catch(e=>{if(!abort.signal.aborted)setError(extractApiErrorMessage(e,'Could not load published venues.'));});},200);return()=>{clearTimeout(timer);abort.abort();};},[q,attempt]);
 useEffect(()=>{if(!value)return;const abort=new AbortController();void apiClient.get<Venue>(`/venues/${value}`,{signal:abort.signal}).then(r=>{if(!abort.signal.aborted)setChosen(r.data);}).catch(e=>{if(!abort.signal.aborted)setError(extractApiErrorMessage(e,'The selected venue is unavailable. Choose another venue or clear it.'));});return()=>abort.abort();},[value]);
 const options=chosen&&String(chosen.id)===value&&!venues.some(v=>v.id===chosen.id)?[chosen,...venues]:venues;
 return <fieldset className="mc-rule-form" disabled={disabled}><legend>{copy('Competition location','შეჯიბრების ადგილი')}</legend><label>{copy('Search published stadiums','მოძებნეთ გამოქვეყნებული სტადიონები')}<input type="search" value={q} onChange={e=>setQ(e.target.value)} maxLength={200}/></label><label>{copy('Main venue (optional)','ძირითადი სტადიონი (არასავალდებულო)')}<select value={value} onChange={e=>onChange(e.target.value)}><option value="">{copy('Venue to be agreed','ადგილი შესათანხმებელია')}</option>{options.map(v=><option key={v.id} value={v.id}>{v.displayName} · {v.city||v.addressText}</option>)}</select></label><p>{copy('This sets the public competition location. Request and confirm reservations separately for each fixture.','აქ განისაზღვრება შეჯიბრების საჯარო ადგილი. თითოეული მატჩისთვის ცალკე მოითხოვეთ და დაადასტურეთ ჯავშანი.')}</p>{error&&<p role="alert">{error}<button type="button" onClick={()=>setAttempt(a=>a+1)}>{copy('Retry','ხელახლა')}</button></p>}</fieldset>;
}
