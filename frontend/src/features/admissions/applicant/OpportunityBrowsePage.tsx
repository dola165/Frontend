import { useCallback, useMemo, useState } from 'react';
import { fetchAdmissionHome, searchOpportunities } from '../api';
import type { AdmissionMethod, DiscoveryQuery } from '../types';
import { useAuth } from '../../../context/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';
import { playerPath, positivePlayerId, usePlayerSelection } from '../../parents/playerSelection';
import { useAdmissionData } from './useAdmissionData';
import { AdmissionError, AdmissionFrame, AdmissionLoading } from './AdmissionFrame';
import { OpportunityCard } from './OpportunityCard';
import { useAdmissionCopy } from './copy';
import { ExistingClubGroups } from './ExistingClubGroups';
import { fetchClubLocationOptions } from '../../discovery/api';

export function OpportunityBrowsePage() {
    const {user,sessionId}=useAuth();
    return <OpportunityBrowseContent key={`${user?.id}:${sessionId}`}/>;
}
function OpportunityBrowseContent() {
    const {isAuthenticated,sessionId}=useAuth();
    const {copy,method}=useAdmissionCopy();
    const [params,setParams]=useSearchParams();
    const {requestedPlayerId,selectPlayer:rememberPlayer}=usePlayerSelection();
    const initial = {acceptingOnly:true,includeWaitlist:false,size:20,page:0,clubId:positivePlayerId(params.get("club")),organizationId:positivePlayerId(params.get("organization"))};
    const [draft,setDraft]=useState<DiscoveryQuery>(initial);
    const [query,setQuery]=useState(draft);
    const home=useAdmissionData(useCallback(signal=>isAuthenticated?fetchAdmissionHome(sessionId,signal):Promise.resolve({participants:[],cases:[]}),[isAuthenticated,sessionId]),isAuthenticated?sessionId:undefined);
    const authorizedHome=home.error?null:home.data;
    const clubs=useAdmissionData(useCallback(()=>fetchClubLocationOptions(),[]));
    const selected=authorizedHome?.participants.find(p=>p.id===requestedPlayerId);
    const playerId=selected?.id;
    const appliedPlayer=playerId;
    const searchQuery=useMemo(()=>selected?{...query,birthYear:selected.dateOfBirth?Number(selected.dateOfBirth.slice(0,4)):undefined,gender:query.gender||selected.gender||undefined}:query,[query,selected]);
    const results=useAdmissionData(useCallback(signal=>searchOpportunities(searchQuery,signal),[searchQuery]));
    const apply=(value:DiscoveryQuery)=>{setQuery(value);const next=new URLSearchParams(params);if(value.clubId)next.set('club',String(value.clubId));else next.delete('club');if(value.organizationId)next.set('organization',String(value.organizationId));else next.delete('organization');setParams(next,{replace:true});};
    const selectPlayer=(id:number|undefined)=>{rememberPlayer(id);const p=authorizedHome?.participants.find(p=>p.id===id);const details={birthYear:p?.dateOfBirth?Number(p.dateOfBirth.slice(0,4)):undefined,gender:p?.gender||undefined};setDraft(d=>({...d,...details}));setQuery(q=>({...q,...details,page:0}));};
    return <AdmissionFrame title={copy('Find somewhere to play','იპოვეთ ადგილი ფეხბურთისთვის')} description={copy('Choose a real group, its training venue and the way to join. Browse freely; select a player only when useful.','აირჩიეთ რეალური ჯგუფი, ვარჯიშის ადგილი და მონაწილეობის გზა. დაათვალიერეთ თავისუფლად; საჭიროებისას აირჩიეთ მოთამაშე.')}>
        <form className="admission-panel" onSubmit={e=>{e.preventDefault();apply({...draft,page:0});}}>
            <div className="admission-fields"><label>{copy('Group or organization','ჯგუფი ან ორგანიზაცია')}<input value={draft.q||''} maxLength={100} onChange={e=>setDraft({...draft,q:e.target.value})}/></label>
                <label>{copy('Club','კლუბი')}<select value={draft.clubId??''} onChange={e=>setDraft({...draft,clubId:Number(e.target.value)||undefined,organizationId:undefined})}><option value="">{copy('All clubs','ყველა კლუბი')}</option>{clubs.data?.map(c=><option key={c.clubId} value={c.clubId}>{c.clubName}</option>)}</select></label>
                <label>{copy('Joining method','ჩარიცხვის მეთოდი')}<select value={draft.method||''} onChange={e=>setDraft({...draft,method:(e.target.value||undefined) as AdmissionMethod|undefined})}><option value="">{copy('Any method','ყველა მეთოდი')}</option>{(['DIRECT','INTRODUCTION','SELECTIVE'] as const).map(m=><option key={m} value={m}>{method(m)}</option>)}</select></label>
                <label>{copy('Selected player','არჩეული მოთამაშე')}<select value={playerId??''} onChange={e=>selectPlayer(e.target.value?Number(e.target.value):undefined)}><option value="">{copy('Browse for anyone','ყველასთვის დათვალიერება')}</option>{authorizedHome?.participants.map(p=><option key={p.id} value={p.id}>{p.name}{p.minor?` · ${copy('child','ბავშვი')}`:` · ${copy('adult','სრულწლოვანი')}`}</option>)}</select></label>
                <label>{copy('Birth year','დაბადების წელი')}<input type="number" min={1900} max={2100} disabled={Boolean(playerId)} value={playerId?(selected?.dateOfBirth?.slice(0,4)||''):(draft.birthYear??'')} onChange={e=>setDraft({...draft,birthYear:e.target.value?Number(e.target.value):undefined})}/></label>
                <label>{copy('Gender category','სქესის კატეგორია')}<select value={draft.gender||''} onChange={e=>setDraft({...draft,gender:(e.target.value||undefined) as 'MALE'|'FEMALE'|undefined})}><option value="">{copy('Any category','ყველა კატეგორია')}</option><option value="MALE">{copy('Boys / men','ბიჭები / კაცები')}</option><option value="FEMALE">{copy('Girls / women','გოგოები / ქალები')}</option></select></label>
            </div>
            <div className="admission-actions"><label className="admission-check"><input type="checkbox" checked={draft.beginner===true} onChange={e=>setDraft({...draft,beginner:e.target.checked?true:undefined})}/>{copy('Beginners welcome','დამწყებები მისასალმებელია')}</label><label className="admission-check"><input type="checkbox" checked={draft.acceptingOnly===true} onChange={e=>setDraft({...draft,acceptingOnly:e.target.checked})}/>{copy('Accepting players','მოთამაშეებს იღებს')}</label><label className="admission-check"><input type="checkbox" checked={draft.includeWaitlist===true} onChange={e=>setDraft({...draft,includeWaitlist:e.target.checked})}/>{copy('Include waiting lists','მოლოდინის სიების ჩათვლით')}</label></div>
            <p className="admission-muted">{copy('Accepting players includes available places, applications, introductory sessions and assessments. Waiting-list-only groups appear when you include them. Every filter matches the same group.','მიღება მოიცავს ადგილებს, განაცხადებს, გაცნობით სესიებსა და შეფასებებს. მოლოდინის ჯგუფები ჩანს მათი ჩართვისას. ყველა ფილტრი ერთსა და იმავე ჯგუფს ეხება.')}</p>
            {(draft.clubId||draft.organizationId)&&<p>{copy("Showing this club’s groups.","ამ კლუბის ჯგუფები.")} <button type="button" className="admission-button" onClick={()=>{const all={...draft,clubId:undefined,organizationId:undefined,page:0};setDraft(all);apply(all);}}>{copy("Search all clubs","ყველა კლუბში ძებნა")}</button></p>}
            <div className="admission-actions"><button className="admission-button admission-primary">{copy('Show groups','ჯგუფების ჩვენება')}</button><Link className="admission-button" to={playerPath("/world",playerId)}>{copy('Browse the map','რუკის დათვალიერება')}</Link></div>
            {home.error&&<AdmissionError message={home.error} retry={home.refresh}/>}
            {clubs.error&&<AdmissionError message={clubs.error} retry={clubs.refresh}/>}
        </form>
        {query.clubId&&<ExistingClubGroups key={query.clubId} clubId={query.clubId} playerId={appliedPlayer}/>}
        <div className="admission-stack" style={{marginTop:24}}>{results.loading?<AdmissionLoading/>:results.error?<AdmissionError message={results.error} retry={results.refresh}/>:<>
            <p role="status" className="admission-muted">{results.data?.total??0} {copy('matching groups','შესაბამისი ჯგუფი')}{appliedPlayer?` · ${authorizedHome?.participants.find(p=>p.id===appliedPlayer)?.name||''}`:''}</p>
            <div className="admission-grid">{results.data?.items.map(o=><OpportunityCard key={o.id} opportunity={o} playerId={appliedPlayer}/>)}</div>
            {results.data?.items.length===0&&<section className="admission-panel"><h2>{copy('No suitable group in this search','შესაბამისი ჯგუფი ვერ მოიძებნა')}</h2><p>{copy('Try another joining method or include waiting lists. Your player card stays the same.','სცადეთ სხვა მეთოდი ან ჩართეთ მოლოდინის სიები. მოთამაშის ბარათი უცვლელია.')}</p></section>}
            <div className="admission-actions">{(query.page??0)>0&&<button className="admission-button" onClick={()=>setQuery({...query,page:(query.page??0)-1})}>{copy('Previous','წინა')}</button>}{results.data?.hasMore&&<button className="admission-button" onClick={()=>setQuery({...query,page:(query.page??0)+1})}>{copy('Next groups','შემდეგი ჯგუფები')}</button>}</div>
        </>}</div>
    </AdmissionFrame>;
}
