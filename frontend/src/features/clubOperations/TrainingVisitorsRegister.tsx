import { useEffect, useState } from 'react';
import { IntroductoryVisitors } from '../squadCommunication/IntroductoryVisitors';
import { introductoryVisitors, type IntroductoryVisitorRegister } from '../squadCommunication/api';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { extractApiErrorMessage } from '../../utils/apiError';

export function TrainingVisitorsRegister({squad,session,revision,onHistoricalPlayers}:{squad:number;session:number;revision:number;onHistoricalPlayers?:(ids:number[])=>void}) {
    const copy=useJourneyCopy(),[reload,setReload]=useState(0);
    const scope=squad+':'+session+':'+revision+':'+reload;
    const [result,setResult]=useState<{scope:string;data:IntroductoryVisitorRegister|null;error:string}|null>(null);
    const data=result?.scope===scope?result.data:null,error=result?.scope===scope?result.error:'';
    useEffect(()=>{const controller=new AbortController();onHistoricalPlayers?.([]);
        void introductoryVisitors(squad,session,controller.signal).then(value=>{if(!controller.signal.aborted){setResult({scope,data:value,error:''});onHistoricalPlayers?.(value.visitors.filter(row=>['CONFIRMED','ATTENDED','NO_SHOW'].includes(row.status)).map(row=>row.playerId));}}).catch(e=>{if(!controller.signal.aborted)setResult({scope,data:null,error:extractApiErrorMessage(e,'Introductory visitors could not load.')});});
        return()=>controller.abort();
    },[squad,session,scope,onHistoricalPlayers]);
    if(error)return <p role="alert">{error} <button type="button" onClick={()=>setReload(n=>n+1)}>{copy('Reload visitors','სტუმრების განახლება')}</button></p>;
    if(!data)return <p role="status">{copy('Loading introductory visitors…','გაცნობითი სესიის სტუმრები იტვირთება…')}</p>;
    return <IntroductoryVisitors squadId={squad} sessionId={session} revision={data.sessionRevision} visitors={data.visitors} onSaved={()=>setReload(n=>n+1)}/>;
}
