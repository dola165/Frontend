import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import type { TournamentSeries } from './api';
import './tournament-series.css';
export function TournamentSeriesPage(){const {seriesId}=useParams();const {sessionId}=useAuth();return <SeriesPage key={`${seriesId}:${sessionId}`} id={Number(seriesId)}/>;}
function SeriesPage({id}:{id:number}){
    const [series,setSeries]=useState<TournamentSeries|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
    useEffect(()=>{const abort=new AbortController();void apiClient.get<TournamentSeries>(`/tournament-series/${id}`,{signal:abort.signal}).then(r=>setSeries(r.data)).catch(e=>{if(!abort.signal.aborted)setError(extractApiErrorMessage(e,'This competition is unavailable.'));});return()=>abort.abort();},[id,revision]);
    return <main className="tw-workspace"><Link to="/tournaments">← Tournaments</Link>{error?<div role="alert"><p>{error}</p><button onClick={()=>{setError('');setRevision(n=>n+1);}}>Try again</button></div>:!series?<p role="status">Loading competition…</p>:<section className="ts-panel"><h1>{series.name}</h1>{series.description&&<p>{series.description}</p>}<h2>Editions & divisions</h2>{series.editions.map(e=><article className="ts-edition" key={e.id}><h3>{e.label}</h3><p>{e.startDate.slice(0,10)} – {e.endDate.slice(0,10)}</p><ul>{e.divisions.map(d=><li key={d.id}><Link to={`/tournaments/${d.tournamentId}`}>{d.name}</Link><span>{d.status.toLowerCase()}{d.visibility==='PRIVATE'?' · Private draft':''}</span>{series.canManage&&<Link to={`/tournaments/${d.tournamentId}/workspace`}>Manage division</Link>}</li>)}</ul></article>)}</section>}</main>;
}
