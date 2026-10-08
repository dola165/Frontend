import { CompetitionEventCard } from './CompetitionEventCard';
import { CompetitionPagination } from './CompetitionPagination';
import { CompetitionOverview } from './CompetitionOverview';
import {useCompetitionCopy} from './competitionCopy';
import {CompetitionHostPicker} from './CompetitionHostPicker';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, LayoutGrid, List, X, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '../../utils/apiError';
import { ages } from '../matchExchange/api';
import { browseCompetitions, familyLabels, structureLabels, structures, type CompetitionCard, type Family } from './api';
import type { PageResult } from '../tournaments/domain';
import './competition-directory.css';
import { useCollectionPosition } from './useCollectionPosition';
import { SelectionIndicator } from '../../components/ui/SelectionIndicator';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';

const labels:Record<string,string>={family:'Family',structure:'Structure',ageGroup:'Age group',discipline:'Discipline',sideSize:'Side size',scope:'Entry type',status:'Status',country:'Country',city:'City',playingLevel:'Level',eligibilityCategory:'Eligibility',hostKind:'Host type',hostId:'Host',openPlaces:'Open places',registration:'Registration',from:'From',to:'Until',currency:'Currency',minFee:'Minimum fee',maxFee:'Maximum fee',feeBasis:'Fee basis',latitude:'Latitude',longitude:'Longitude',radiusKm:'Radius (km)'};
const keys = ['q',...Object.keys(labels),'sort','page','size'];
export default function CompetitionDirectory({ overview = false }: { overview?: boolean } = {}) {
  const activityCopy=useCompetitionCopy();
  const { i18n } = useTranslation();
  const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
  const [params,updateParams] = useSearchParams();
  const setParams: typeof updateParams = (next, options) => updateParams(next, { preventScrollReset: true, ...options });
  const resultsRef = useRef<HTMLDivElement>(null);
  const [radius,setRadius]=useState(()=>Object.fromEntries(['latitude','longitude','radiusKm'].map(k=>[k,params.get(k)||''])));
  const [open,setOpen] = useState(false),[attempt,setAttempt] = useState(0);
  const [narrow,setNarrow]=useState(()=>window.matchMedia('(max-width:767px)').matches),[locationError,setLocationError]=useState('');
  const filterRef=useRef<HTMLElement>(null);
  useEffect(()=>{const media=window.matchMedia('(max-width:767px)');const change=()=>setNarrow(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useDialogFocus(narrow&&open,filterRef,()=>setOpen(false));
  const [response,setResponse] = useState<{ query: string; data: PageResult<CompetitionCard> }>();
  const [failure,setFailure] = useState<{ query: string; error: string }>();
  const query = new URLSearchParams();
  for (const key of keys) if (params.has(key)) query.set(key,params.get(key)!);
  if (!query.has('size')) query.set('size', overview ? '8' : '12');
  const text = query.toString();
  const data = response?.data;
  const { remember, beforeCommit } = useCollectionPosition(response);
  const error = failure?.query === text ? failure.error : '';
  const loading = !error && response?.query !== text;
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => { void browseCompetitions(new URLSearchParams(text),abort.signal).then(data => {
      if (!abort.signal.aborted) { beforeCommit();setResponse({query:text,data});setFailure(undefined); }
    }).catch(cause => { if (!abort.signal.aborted) { setFailure({query:text,error:extractApiErrorMessage(cause,'Could not load competitions. Try again.')}); } }); },200);
    return () => { clearTimeout(timer);abort.abort(); };
  },[text,attempt,beforeCommit]);
  function filter(key: string,value: string) { remember(['page','size'].includes(key) ? resultsRef.current?.querySelector<HTMLElement>('.mc-pagination') ?? null : null); setParams(previous => { const next=new URLSearchParams(previous);if(value)next.set(key,value);else next.delete(key);if(!['page','display'].includes(key))next.delete('page');if(key==='family')next.delete('structure');if(key==='country')next.delete('city');if(key==='currency'){next.delete('minFee');next.delete('maxFee');}if(key==='hostKind')next.delete('hostId');if(['latitude','longitude','radiusKm'].includes(key)&&!value){for(const part of ['latitude','longitude','radiusKm'])next.delete(part);}return next; }); }
  function locate(){if(!navigator.geolocation){setLocationError('Location is unavailable. Enter coordinates below.');return;}navigator.geolocation.getCurrentPosition(position=>{setLocationError('');setParams(previous=>{const next=new URLSearchParams(previous);next.set('latitude',String(position.coords.latitude));next.set('longitude',String(position.coords.longitude));next.set('radiusKm','25');next.delete('page');return next;});},()=>setLocationError('Location was unavailable or declined. Enter a country, city or coordinates.'),{timeout:10000,maximumAge:300000});}
  const active=keys.filter(key=>!['q','sort','page','size'].includes(key)&&params.has(key));
  function reset(){setParams(previous=>{const next=new URLSearchParams(previous);for(const key of keys)next.delete(key);return next;});}
  const family=params.get('family') as Family | null;
  const listView=params.get('display')==='list';
  const filterLabel=(key:string)=>activityCopy(key==='family'?'Tournament type':key==='structure'?'Format':labels[key]);
  const filterValue=(key:string)=>{const value=params.get(key)||'';return activityCopy(key==='family'?(familyLabels[value as Family]||value):key==='structure'?(structureLabels[value as keyof typeof structureLabels]||value):value);};
  const select=(name:string,key:string,options:Record<string,string>)=><label>{activityCopy(name)}<select value={params.get(key)||(key==='sort'?'date':'')} onChange={e=>filter(key,e.target.value)}>{key!=='sort'&&<option value="">{activityCopy("All")}</option>}{Object.entries(options).map(([value,label])=><option key={value} value={value}>{activityCopy(label)}</option>)}</select></label>;
  return <section className="mc-directory" aria-labelledby="competition-directory-title">
    <div className="mc-format-guide"><div className="mc-section-heading"><div><h2>{copy('Choose how you compete', 'აირჩიეთ შეჯიბრების ფორმატი')}</h2><p>{copy('Select a format to explore matching competitions below.', 'აირჩიეთ ფორმატი და ქვემოთ ნახეთ შესაბამისი შეჯიბრებები.')}</p></div>{(family || params.has('structure')) && <button type="button" className="mc-reset-family" onClick={()=>filter('family','')}>{copy('Show all formats', 'ყველა ფორმატის ნახვა')}<X size={14}/></button>}</div><CompetitionOverview family={family} structure={params.get('structure')} onSelect={(nextFamily,structure)=>setParams(previous=>{const next=new URLSearchParams(previous);if(nextFamily)next.set('family',nextFamily);else next.delete('family');if(structure)next.set('structure',structure);else next.delete('structure');next.delete('page');return next;})}/></div>
    <div className="mc-directory-title mc-section-heading"><div><h2 id="competition-directory-title">{overview ? copy('Explore competitions', 'აღმოაჩინეთ შეჯიბრებები') : activityCopy('Tournaments & leagues')}</h2><p>{copy('Find the right event for your club, squad or individual entry.', 'იპოვეთ ღონისძიება კლუბისთვის, გუნდისთვის ან ინდივიდუალურად.')}</p></div><Link to="/matches?section=competitions&view=hosts">{activityCopy('Discover hosts')}<ArrowRight size={15}/></Link></div>
    <div className="mc-collection-toolbar"><div className="mc-entry-tabs app-selection-rail" role="group" aria-label={activityCopy('Entry type')}>{[['','All entries','ყველა'],['CLUB','Club teams','კლუბები'],['SQUAD','Squads','გუნდები'],['PLAYER','Individual players','ინდივიდუალური']].map(([value,en,ka])=><button key={value} type="button" aria-pressed={(params.get('scope')||'')===value} onClick={()=>filter('scope',value)}>{copy(en,ka)}</button>)}<SelectionIndicator value={params.get('scope')||'all'}/></div><div className="mc-view-switch" role="group" aria-label={copy('Results layout', 'შედეგების განლაგება')}><button type="button" aria-label={copy('Grid view','ბადის ხედი')} aria-pressed={!listView} onClick={()=>filter('display','')}><LayoutGrid size={17}/></button><button type="button" aria-label={copy('List view','სიის ხედი')} aria-pressed={listView} onClick={()=>filter('display','list')}><List size={17}/></button></div></div>
    <div className="mc-search"><label><Search size={18} aria-hidden="true"/><input type="search" aria-label={activityCopy('Search competitions')} placeholder={copy('Search competitions…','შეჯიბრებების ძიება…')} value={params.get('q')||''} onChange={e=>filter('q',e.target.value)}/></label>{select('Format','structure',Object.fromEntries((family&&structures[family]?structures[family]:Object.keys(structureLabels)).map(key=>[key,structureLabels[key as keyof typeof structureLabels]])))}<button type="button" aria-expanded={open} aria-controls="competition-filters" onClick={()=>setOpen(!open)}><SlidersHorizontal size={16} aria-hidden="true"/>{activityCopy('Filters')}{active.length ? ` (${active.length})`:''}</button>{select('Sort','sort',{date:'Event date',newest:'Newest',name:'Name'})}</div>
    {active.length>0&&<div className="mc-chips" aria-label={activityCopy("Active filters")}>{active.map(key=><button type="button" key={key} aria-label={`${activityCopy("Remove")} ${filterLabel(key)}: ${filterValue(key)}`} onClick={()=>filter(key,'')}>{filterLabel(key)}: {filterValue(key)}<X size={14} aria-hidden="true" /></button>)}<button type="button" onClick={reset}>{activityCopy("Clear all")}</button></div>}
    <div className={`mc-directory-grid${open ? ' mc-directory-grid--filtered' : ''}`}><aside ref={filterRef} id="competition-filters" className={`mc-filters${open?' mc-filters-open':''}`} role={narrow?'dialog':undefined} aria-modal={narrow&&open?true:undefined} aria-labelledby="competition-filter-title" hidden={!open}>
      <div><h3 id="competition-filter-title">{activityCopy("Find the right competition")}</h3><button type="button" onClick={reset}>{activityCopy("Reset filters")}</button>{narrow&&<button type="button" onClick={()=>setOpen(false)} aria-label={activityCopy("Close filters")}><X size={18}/></button>}</div>
      {select('Structure','structure',Object.fromEntries((family&&structures[family]?structures[family]:Object.keys(structureLabels)).map(key=>[key,structureLabels[key as keyof typeof structureLabels]])))}
      {select('Age group','ageGroup',Object.fromEntries(ages.map(age=>[age,age])))}
      {select('Playing discipline','discipline',{ASSOCIATION:'Association football',FUTSAL:'Futsal',BEACH:'Beach soccer',WALKING:'Walking football',OTHER:'Other ruleset'})}
      {select('Players per side','sideSize',Object.fromEntries([3,4,5,6,7,8,9,10,11].map(n=>[String(n),`${n}v${n}`])))}
      {select('Entry type','scope',{CLUB:'Club teams',SQUAD:'Squads',PLAYER:'Individual players'})}
      {select('Status','status',{PLANNING:'Registration & planning',ACTIVE:'In progress',COMPLETED:'Completed',CANCELLED:'Cancelled'})}
      <label>{activityCopy("Country")}<input value={params.get('country')||''} onChange={e=>filter('country',e.target.value)} maxLength={100}/></label>
      <label>{activityCopy("City")}<input value={params.get('city')||''} onChange={e=>filter('city',e.target.value)} maxLength={120}/></label>
      {select('Playing level','playingLevel',{DEVELOPMENT:'Development',RECREATIONAL:'Recreational',COMPETITIVE:'Competitive',ELITE:'Elite'})}
      <label>{activityCopy("Eligibility category")}<input value={params.get('eligibilityCategory')||''} onChange={e=>filter('eligibilityCategory',e.target.value)} maxLength={100} placeholder={activityCopy("Exact published category")}/></label>
      {select('Registration','registration',{OPEN:'Open now',NOT_OPEN:'Not yet open',CLOSED:'Closed'})}
      {select('Capacity','openPlaces',{true:'Open places only'})}
      <details><summary>{activityCopy("Organiser & host")}</summary>{select('Host type','hostKind',{CLUB:'Club',ORGANIZATION:'Organisation'})}<CompetitionHostPicker kind={params.get('hostKind')||''} value={params.get('hostId')||''} onChange={(value,kind)=>setParams(previous=>{const next=new URLSearchParams(previous);if(value){next.set('hostId',value);next.set('hostKind',kind);}else next.delete('hostId');next.delete('page');return next;})}/><Link to="/matches?section=competitions&view=hosts">{activityCopy("Find a host and its competitions")}</Link></details>
      <details><summary>{activityCopy("Distance from a location")}</summary><button type="button" onClick={locate}>{activityCopy("Use my location")}</button>{locationError&&<p role="status">{locationError}</p>}<p>{activityCopy("Manual coordinates are also supported. A distance search needs all three values.")}</p><form onSubmit={e=>{e.preventDefault();setParams(previous=>{const next=new URLSearchParams(previous);for(const key of ['latitude','longitude','radiusKm'])next.set(key,radius[key]);next.delete('page');return next;});}}>{[['Latitude','latitude',-90,90],['Longitude','longitude',-180,180],['Radius (km)','radiusKm',0.1,500]].map(([label,key,min,max])=><label key={key}>{activityCopy(String(label))}<input type="number" step="any" min={min} max={max} required value={radius[String(key)]||''} onChange={e=>setRadius({...radius,[String(key)]:e.target.value})}/></label>)}<button type="submit">{activityCopy("Apply distance")}</button></form></details>
      <div className="mc-filter-pair"><label>{activityCopy("From")}<input type="date" value={params.get('from')||''} onChange={e=>filter('from',e.target.value)}/></label><label>{activityCopy("Until")}<input type="date" value={params.get('to')||''} onChange={e=>filter('to',e.target.value)}/></label></div>
      <details><summary>{activityCopy("Entry fee")}</summary><p>{activityCopy("Compare fees in the same currency. Each record states its fee basis.")}</p>{select('Currency','currency',{GEL:'GEL',EUR:'EUR',USD:'USD',GBP:'GBP'})}{select('Fee basis','feeBasis',{TEAM:'Per team',PLAYER:'Per player',EVENT:'Per event'})}{[['Minimum fee','minFee'],['Maximum fee','maxFee']].map(([label,key])=><label key={key}>{activityCopy(label)}<input type="number" min="0" max="1000000" disabled={!params.get('currency')} value={params.get(key)||''} onChange={e=>filter(key,e.target.value)}/></label>)}</details>
    </aside><div ref={resultsRef} className="mc-results" aria-busy={loading} data-updating={loading && !!data}>
      <p className="mc-result-count" role="status">{error ? copy(data ? 'Results could not be updated. The previous results are still shown.' : 'Search could not be completed.', data ? 'შედეგები ვერ განახლდა. ნაჩვენებია წინა შედეგები.' : 'ძიება ვერ დასრულდა.') : loading ? copy(data ? 'Updating competitions…' : 'Loading competitions…','შეჯიბრებები იტვირთება…') : data ? copy(`${data.totalElements} ${data.totalElements===1?'competition':'competitions'} matching this search`,`${data.totalElements} შეჯიბრება ამ ძიებაში`) : ''}</p>
      {error && <div className="mc-panel" role="alert"><p>{error}</p><button type="button" onClick={()=>{setFailure(undefined);setAttempt(a=>a+1);}}>{activityCopy("Try again")}</button><button type="button" onClick={reset}>{activityCopy("Reset filters")}</button></div>}
      {!data ? !error && <div className="mc-skeletons" aria-label="Loading competitions" role="status">{[0,1,2].map(n=><div key={n}/> )}</div> : data.content.length===0 ? <div className="mc-panel"><h3>{activityCopy("No competitions match this search")}</h3><p>{activityCopy("Try a different family, location or date.")}</p><button type="button" onClick={reset}>{activityCopy("Clear filters")}</button></div> : <>
        <div className={`mc-cards${listView?' mc-cards--list':''}`}>{data.content.map(event=><CompetitionEventCard key={event.id} event={event} returnTo={`/matches?${params}`}/>)}</div>
        <CompetitionPagination busy={loading || !!error} page={data.pageNumber} totalPages={data.totalPages} pageSize={Number(query.get('size'))} onPageChange={page=>filter('page',String(page))} onPageSizeChange={size=>filter('size',String(size))}/>
      </>}
    </div></div>
  </section>;
}
