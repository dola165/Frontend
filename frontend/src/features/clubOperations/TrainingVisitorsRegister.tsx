import { useEffect, useState } from 'react';
import { IntroductoryVisitors } from '../squadCommunication/IntroductoryVisitors';
import { introductoryVisitors, type IntroductoryVisitorRegister } from '../squadCommunication/api';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { extractApiErrorMessage } from '../../utils/apiError';

export function TrainingVisitorsRegister({squad,session,revision,onHistoricalPlayers}:{squad:number;session:number;revision:number;onHistoricalPlayers?:(ids:number[])=>void}) {
    const copy=useJourneyCopy(),[data,setData]=useState<IntroductoryVisitorRegister|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
    useEffect(()=>{const controller=new AbortController();setData(null);setError('');onHistoricalPlayers?.([]);
        void introductoryVisitors(squad,session,controller.signal).then(value=>{if(!controller.signal.aborted){setData(value);onHistoricalPlayers?.(value.visitors.filter(row=>['CONFIRMED','ATTENDED','NO_SHOW'].includes(row.status)).map(row=>row.playerId));}}).catch(e=>{if(!controller.signal.aborted)setError(extractApiErrorMessage(e,'Introductory visitors could not load.'));});
        return()=>controller.abort();
    },[squad,session,revision,reload,onHistoricalPlayers]);
    if(error)return <p role="alert">{error} <button type="button" onClick={()=>setReload(n=>n+1)}>{copy('Reload visitors','სტუმრების განახლება')}</button></p>;
    if(!data)return <p role="status">{copy('Loading introductory visitors…','გაცნობითი სესიის სტუმრები იტვირთება…')}</p>;
    return <IntroductoryVisitors squadId={squad} sessionId={session} revision={data.sessionRevision} visitors={data.visitors} onSaved={()=>setReload(n=>n+1)}/>;
}
