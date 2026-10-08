import {useCompetitionCopy} from './competitionCopy';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DrawState } from './api';

export function CompetitionReplayPanel({id,draw,editable,busy,run}:{id:number;draw:DrawState;editable:boolean;busy:boolean;run:(path:string,body:Record<string,unknown>)=>Promise<void>}){
  const activityCopy=useCompetitionCopy();
  const [start,setStart]=useState(''),[reason,setReason]=useState('');
  return <>{draw.aggregates.filter(tie=>tie.resolution==='REPLAY').map(tie=><article key={tie.deciding_fixture_id}>
    {tie.replay_fixture_id?<><p>{activityCopy("Actual replay:")}<Link to={`/tournaments/${id}?tab=matches&fixtureId=${tie.replay_fixture_id}`}>{activityCopy("Open replay preparation and result")}</Link></p>{editable&&!tie.winner&&<details><summary>{activityCopy("Retract an unplayed replay")}</summary><label>{activityCopy("Reason")}<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button type="button" disabled={busy||!reason.trim()} onClick={()=>void run('retract-replay',{fixtureId:tie.deciding_fixture_id,reason})}>{activityCopy("Retract replay")}</button></details>}</>:editable&&tie.ready&&tie.tied&&!tie.winner&&<form onSubmit={event=>{event.preventDefault();const value=new Date(start);if(Number.isFinite(value.getTime()))void run('replay',{fixtureId:tie.deciding_fixture_id,startsAt:value.toISOString(),reason});}}><h4>{activityCopy("Draw the agreed replay")}</h4><p>{activityCopy("The two leg scores stay intact. Advancement waits for the replay's confirmed outcome.")}</p><label>{activityCopy("Replay kick-off (")}{' '}{Intl.DateTimeFormat().resolvedOptions().timeZone})<input type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label><label>{activityCopy("Reason and agreed conditions")}<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button type="submit" disabled={busy}>{activityCopy("Create replay fixture")}</button></form>}
  </article>)}</>;
}
