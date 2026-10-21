import { addMinutes, clone, minutes, ownerName, passengers } from './model';
import type { Activity, Draft, Plan, Proposal, Store } from './model';
import { createPlan, initialStore, placeById } from './fixtures';
export const SAVE_KEY='grasskickz:map-workspace-demo:v1';
export function costRows(p:Plan) {
  const extra=p.incoming?48000:0;
  const rows=p.baseCosts.map(c=>({...c,cents:c.cents+(c.category==='Local transport'?extra:0),committed:c.committed+(c.category==='Local transport'&&p.supplier.version===2&&p.supplier.decision==='confirmed'?extra:0)}));
  if(p.draft.accommodation) rows.splice(2,0,{category:'Accommodation',cents:placeById(p.draft.accommodation).price??0,committed:p.draft.hotelDecision==='confirmed'?(placeById(p.draft.accommodation).price??0):0,paid:0});
  return rows;
}
export const totals=(p:Plan)=>{const rows=costRows(p); const estimate=rows.reduce((n,r)=>n+r.cents,0);return {estimate,committed:rows.reduce((n,r)=>n+r.committed,0),paid:rows.reduce((n,r)=>n+r.paid,0),headroom:p.approval.amount-estimate};};
export function clashes(p:Plan):string[] {
  const out:string[]=[];
  const acts=p.draft.activities;
  for(const a of acts) {
    if(minutes(a.end)<=minutes(a.start))out.push(`${a.title}: end time must be after start time.`);
    if(a.estimate&&minutes(a.end)-minutes(a.start)<a.estimate)out.push(`${a.title}: the journey is shorter than its ${a.estimate}-minute estimate.`);
  }
  if(p.incoming) {
    const train=acts.find(a=>a.id==='training3'); const journey=acts.find(a=>a.id==='transfer3');
    const match=acts.find(a=>a.id==='match3');
    const pending=p.incoming.status==='pending'||p.incoming.status==='requested';
    const kickoff=pending?'12:00':match?.start??'12:00';
    const departure=pending?addMinutes(kickoff,-110):journey?.start??'09:45';
    if(train&&minutes(train.end)+15>minutes(departure)) out.push(`Training ends ${train.end}; departure must be ${departure} or earlier with a 15-minute preparation buffer.`);
    if(journey&&!pending&&minutes(journey.start)+65>minutes(kickoff)-45) out.push('Transfer arrives too late for the 45-minute pre-match requirement.');
  }
  for(const day of new Set(acts.map(a=>a.day))) {
    const daily=acts.filter(a=>a.day===day).sort((a,b)=>a.start.localeCompare(b.start));
    for(let i=1;i<daily.length;i++) {
      const previous=daily[i-1],current=daily[i];
      if(minutes(current.start)<minutes(previous.end))out.push(`${previous.title} overlaps ${current.title} on ${day}.`);
      if(current.kind==='travel'&&current.buffer&&minutes(current.start)-minutes(previous.end)<current.buffer)out.push(`${current.title}: allow ${current.buffer} minutes after ${previous.title} for preparation.`);
    }
    for(const match of daily.filter(a=>a.kind==='match')) {
      const arrival=[...daily].reverse().find(a=>a.kind==='travel'&&a.placeId===match.placeId&&a.start<match.start);
      if(arrival&&minutes(match.start)-minutes(arrival.end)<45)out.push(`${match.title}: arrive at the ground at least 45 minutes before kickoff.`);
    }
  }
  return [...new Set(out)];
}
export interface WorkItem {id:string;title:string;detail:string;owner:string;panel:string;blocking:boolean}
export function workItems(p:Plan):WorkItem[] {
  const work:WorkItem[]=[];const t=totals(p);
  if(p.incoming&&p.incoming.status!=='published') work.push({id:'host',title:p.incoming.status==='requested'?'Awaiting host response':p.incoming.status==='applied'?'Publish revised itinerary':'Review host change',detail:p.incoming.status==='requested'?'Request to retain the original ground and time recorded locally. No response received.':'16 Jun · new ground, earlier kickoff, transport amendment',owner:'coach',panel:'impact',blocking:true});
  for(const [i,c] of clashes(p).entries()) work.push({id:`clash-${i}`,title:'Schedule clash',detail:c,owner:'coach',panel:'dola',blocking:true});
  if(t.headroom<0||p.approval.decision==='declined') work.push({id:'budget',title:p.approval.decision==='declined'?'Revise declined spending request':'Spending approval needed',detail:t.headroom<0?`Estimate exceeds the approved limit by ${(Math.abs(t.headroom)/100).toFixed(0)} EUR.`:'Leadership declined this request. Obtain a revised decision before publication.',owner:'leader',panel:'budget',blocking:true});
  if(p.incoming&&(p.supplier.version!==2||p.supplier.decision!=='confirmed')) work.push({id:'supplier',title:p.supplier.decision==='declined'?'Transport amendment declined':'Confirm transport amendment',detail:'Version 2 · additional EUR 480 · supplier decision is separate from spending approval',owner:'travel',panel:'transport',blocking:true});
  if(p.draft.accommodation&&p.draft.hotelDecision!=='confirmed') work.push({id:'stay',title:'Confirm accommodation amendment',detail:placeById(p.draft.accommodation).name,owner:'travel',panel:'accommodation',blocking:true});
  if(p.draft.accommodation&&!p.draft.mealsResolved) work.push({id:'meals',title:'Arrange offsite meals',detail:'Meals remain in the estimate; the supplier and collection arrangement are unresolved.',owner:'care',panel:'accommodation',blocking:true});
  if(!p.equipmentOwner) work.push({id:'equipment',title:'Assign equipment check',detail:'Balls, bibs and first-aid kit · optional follow-up',owner:'assistant',panel:'participants',blocking:false});
  for(const a of p.draft.activities.filter(a=>a.arrangement==='pending'||a.arrangement==='declined'))work.push({id:`arrangement-${a.id}`,title:`Review activity arrangement`,detail:`${a.title} · ${a.arrangement} · ${a.id}`,owner:a.owner,panel:'activity',blocking:true});
  if(p.published&&ackCount(p)<18) work.push({id:'ack',title:'Family acknowledgements',detail:`${ackCount(p)} of 18 have acknowledged itinerary v${p.published.version}.`,owner:'care',panel:'family',blocking:false});
  if(permissionCount(p)<18) work.push({id:'permission',title:p.published?'Travel permissions needed':'Prepare guardian travel permissions',detail:`${permissionCount(p)} of 18 current permissions${p.published&&p.published.permissionVersion>1?' · overnight location changed':' · await published itinerary'}`,owner:'care',panel:'participants',blocking:true});
  return work;
}
export const ackCount=(p:Plan)=>p.published?p.families.filter(f=>f.acknowledgedVersion===p.published!.version).length:0;
export const permissionCount=(p:Plan)=>p.published?p.families.filter(f=>f.permissions.some(x=>x.version===p.published!.permissionVersion&&x.status==='granted')).length:0;
export function publishReasons(p:Plan) {
  const reasons=workItems(p).filter(w=>w.blocking&&!['host','permission'].includes(w.id)).map(w=>w.title);
  if(p.incoming&&p.incoming.status!=='applied'&&p.incoming.status!=='published') reasons.unshift('Apply an agreed schedule repair before publication');
  if(!p.draft.activities.length) reasons.push('Add at least one activity');
  return [...new Set(reasons)];
}
export function departureReasons(p:Plan) {
  const reasons=publishReasons(p);
  if(!p.published||p.published.revision!==p.revision) reasons.push('Publish the current draft');
  if(permissionCount(p)<18) reasons.push('Resolve current guardian travel permissions');
  const unresolved=passengers.filter(x=>p.boarding[x.id]==='expected');
  if(unresolved.length) reasons.push(`Resolve boarding for ${unresolved.length} expected passengers`);
  const absent=passengers.filter(x=>p.boarding[x.id]==='absent');
  if(absent.length) reasons.push(`Resolve ${absent.length} absent passenger${absent.length>1?'s':''} before departure`);
  return [...new Set(reasons)];
}
export const makeProposal=(p:Plan):Proposal=>({id:`repair-${p.id}-${p.revision}`,baseRevision:p.revision,before:{trainingStart:p.draft.activities.find(a=>a.id==='training3')?.start??'—',trainingEnd:p.draft.activities.find(a=>a.id==='training3')?.end??'—',departure:p.draft.activities.find(a=>a.id==='transfer3')?.start??'—',arrival:p.draft.activities.find(a=>a.id==='transfer3')?.end??'—',warmup:p.draft.activities.find(a=>a.id==='warmup3')?.start??'—',kickoff:p.draft.activities.find(a=>a.id==='match3')?.start??'—'},trainingStart:'08:30',trainingEnd:'09:30',departure:'09:45',arrival:'10:50',warmup:'11:15',kickoff:'12:00',applied:false});
export type Command =
 |{type:'switch';id:string}|{type:'reset'}|{type:'create';name:string;squad:string;start:string;end:string;region:Plan['region']}
 |{type:'hotel';id:string}|{type:'undo'}|{type:'hotel-decision';confirmed:boolean}|{type:'meals'}|{type:'save-place';id:string}
 |{type:'activity';activity:Activity}|{type:'remove-activity';id:string}|{type:'host-change'}|{type:'retain-original'}
 |{type:'prepare'}|{type:'edit-proposal';patch:Partial<Proposal>}|{type:'discard'}|{type:'apply'}
 |{type:'approve';approved:boolean}|{type:'supplier';confirmed:boolean}|{type:'publish'}|{type:'ack';childId?:string;bulk?:boolean}
 |{type:'permission';childId?:string;bulk?:boolean}|{type:'equipment';owner:string}|{type:'advance'}|{type:'boarding';id:string;status:'boarded'|'absent'|'expected'}
 |{type:'board-rest'}|{type:'depart'}|{type:'arrive'}|{type:'stale-clock'};
export function reducer(state:Store,cmd:Command):Store {
  if(cmd.type==='reset')return initialStore();
  if(cmd.type==='switch')return state.plans[cmd.id]?{...state,activeId:cmd.id}:state;
  if(cmd.type==='create') {
    const id=`plan-${Object.keys(state.plans).length+1}`;return {...state,activeId:id,plans:{...state.plans,[id]:createPlan(id,cmd.name,cmd.squad,cmd.start,cmd.end,cmd.region)}};
  }
  const s=clone(state),p=s.plans[s.activeId];let text='',actor='coach';
  const edit=()=>{p.undo.push(clone(p.draft));p.undo=p.undo.slice(-20);p.revision++;};
  switch(cmd.type) {
    case 'hotel':if(p.draft.accommodation===cmd.id)return state;edit();p.draft.accommodation=cmd.id;p.draft.hotelDecision='pending';p.draft.mealsResolved=cmd.id!=='harbour';p.draft.activities=p.draft.activities.map(a=>a.placeId===state.plans[state.activeId].draft.accommodation?{...a,placeId:cmd.id}:a);text=`Draft accommodation changed to ${placeById(cmd.id).name}; confirmation required.`;break;
    case 'undo':if(!p.undo.length)return state;p.draft=p.undo.pop()!;p.revision++;p.proposal=null;text='Previous draft restored. Authority decisions and publication history retained.';break;
    case 'hotel-decision':if(p.draft.hotelDecision===(cmd.confirmed?'confirmed':'declined'))return state;p.draft.hotelDecision=cmd.confirmed?'confirmed':'declined';text=`Accommodation amendment ${cmd.confirmed?'confirmed':'declined'} in simulation.`;actor='supplier';break;
    case 'meals':if(p.draft.mealsResolved)return state;p.draft.mealsResolved=true;text='Offsite meal arrangement confirmed in fixture; existing EUR 1,760 estimate retained.';actor='travel';break;
    case 'save-place':p.saved=p.saved.includes(cmd.id)?p.saved.filter(x=>x!==cmd.id):[...p.saved,cmd.id];text=`${placeById(cmd.id).name} ${p.saved.includes(cmd.id)?'saved':'removed from saved candidates'}.`;break;
    case 'activity':edit();p.draft.activities=[...p.draft.activities.filter(a=>a.id!==cmd.activity.id),clone(cmd.activity)];text=`${cmd.activity.title} saved to draft.`;break;
    case 'remove-activity':edit();p.draft.activities=p.draft.activities.filter(a=>a.id!==cmd.id);text='Activity removed from draft.';break;
    case 'host-change':if(p.id!=='camp'||p.incoming)return state;edit();p.incoming={status:'pending'};p.supplier={decision:'pending',version:2};text='Host proposed Ridge Park, 12:00 kickoff and 65-minute transfer. Transport proposal v2 adds EUR 480.';actor='East Bay Academy Demo';break;
    case 'retain-original':if(!p.incoming)return state;p.incoming.status='requested';p.incoming.request='Please retain the original ground and 14:00 kickoff. Our current training and transport arrangements depend on it.';text='Simulated request to retain original arrangements recorded. Host response pending; original family itinerary preserved.';break;
    case 'prepare':if(!p.incoming)return state;p.proposal=makeProposal(p);text=`Dola prepared schedule repair against draft revision ${p.revision}.`;actor='Dola · simulation';break;
    case 'edit-proposal':if(!p.proposal||p.proposal.applied)return state;Object.assign(p.proposal,cmd.patch,{arrival:addMinutes(cmd.patch.departure??p.proposal.departure,65)});text='Dola proposal edited before application.';break;
    case 'discard':p.proposal=null;text='Dola proposal discarded; draft unchanged.';break;
    case 'apply': {
      const q=p.proposal;if(!q||q.applied||q.baseRevision!==p.revision)return state;
      const preview=clone(p);preview.draft.activities=repairActivities(p.draft,q);preview.incoming={status:'applied'};if(clashes(preview).length)return state;
      edit();p.draft.activities=preview.draft.activities;p.draft.extraTransport=48000;p.incoming={status:'applied'};p.proposal!.applied=true;p.supplier={decision:'pending',version:2};if(totals(p).headroom<0&&p.approval.decision!=='declined')p.approval.decision='pending';text='Schedule repair applied to draft. Supplier, spending and family decisions remain independent.';actor='coach';break;
    }
    case 'approve':if((cmd.approved&&p.approval.decision==='confirmed'&&totals(p).headroom>=0)||(!cmd.approved&&p.approval.decision==='declined'))return state;p.approval={amount:cmd.approved?Math.max(totals(p).estimate,p.approval.amount):p.approval.amount,decision:cmd.approved?'confirmed':'declined',version:p.approval.version+1};text=`Leadership ${cmd.approved?'approved revised spending limit':'declined revised spending request'}; no payment recorded.`;actor='leader';break;
    case 'supplier':if(!p.incoming||(p.supplier.version===2&&p.supplier.decision===(cmd.confirmed?'confirmed':'declined')))return state;p.supplier={decision:cmd.confirmed?'confirmed':'declined',version:2};text=`Transport agreement v2 ${cmd.confirmed?'confirmed':'declined'}; additional EUR 480; deposit unchanged.`;actor='supplier';break;
    case 'publish': {
      if(publishReasons(p).length||p.published?.revision===p.revision)return state;
      const previous=p.published;const changedHotel=!!previous&&previous.draft.accommodation!==p.draft.accommodation;
      const version=(previous?.version??0)+1;const permissionVersion=changedHotel?version:previous?.permissionVersion??version;
      const scheduleSummary=p.incoming?.status==='applied'?`Wednesday friendly moves to ${placeById(p.draft.activities.find(a=>a.id==='match3')?.placeId??'new-ground').name} at ${p.draft.activities.find(a=>a.id==='match3')?.start}. Training begins ${p.draft.activities.find(a=>a.id==='training3')?.start}; coach departs ${p.draft.activities.find(a=>a.id==='transfer3')?.start}.`:'';
      const staySummary=changedHotel?`Accommodation changes to ${placeById(p.draft.accommodation).name}. Renewed travel permission required.`:'';
      p.published={version,revision:p.revision,draft:clone(p.draft),at:p.clock,permissionVersion,summary:[scheduleSummary,staySummary].filter(Boolean).join(' ')||'Updated activity times. Please review and acknowledge the new itinerary.'};
      p.publications.push(clone(p.published));if(p.incoming?.status==='applied')p.incoming.status='published';
      if(changedHotel||!previous)for(const f of p.families)f.permissions.push({version:permissionVersion,status:'pending',actor:'Awaiting guardian',at:p.clock});
      p.undo=[];text=`Itinerary v${version} published in simulation. ${changedHotel?'Renewed travel permissions':'Fresh acknowledgements'} required by demo club policy.`;break;
    }
    case 'ack':if(!p.published||p.families.filter(f=>cmd.bulk||f.childId===(cmd.childId??'player-1')).every(f=>f.acknowledgedVersion===p.published!.version))return state;for(const f of p.families)if(cmd.bulk||f.childId===(cmd.childId??'player-1'))f.acknowledgedVersion=p.published.version;text=cmd.bulk?'Fixture event: remaining family acknowledgements simulated.':`Guardian acknowledged itinerary v${p.published.version} for ${cmd.childId??'player-1'}.`;actor=cmd.bulk?'fixture':'Guardian 01 Demo';break;
    case 'permission':if(!p.published||p.families.filter(f=>cmd.bulk||f.childId===(cmd.childId??'player-1')).every(f=>f.permissions.some(x=>x.version===p.published!.permissionVersion&&x.status==='granted')))return state;for(const f of p.families)if(cmd.bulk||f.childId===(cmd.childId??'player-1')) {const existing=f.permissions.find(x=>x.version===p.published!.permissionVersion);if(existing?.status==='granted')continue;if(existing)Object.assign(existing,{status:'granted',actor:cmd.bulk?'Scenario fixture':'Guardian 01 Demo',at:p.clock});else f.permissions.push({version:p.published.permissionVersion,status:'granted',actor:cmd.bulk?'Scenario fixture':'Guardian 01 Demo',at:p.clock});}text=cmd.bulk?'Fixture event: remaining guardian permission decisions simulated.':'Guardian granted travel permission for the current overnight location.';actor=cmd.bulk?'fixture':'Guardian 01 Demo';break;
    case 'equipment':if(p.equipmentOwner===cmd.owner)return state;p.equipmentOwner=cmd.owner;text=`Equipment check assigned to ${ownerName(cmd.owner)}.`;break;
    case 'advance':if(p.progress!=='planning'||p.id.startsWith('plan-'))return state;p.progress='boarding';p.clock=p.region==='Tallinn'?'2027-06-14T04:45:00Z':'2027-06-12T09:10:00Z';text='Scenario clock advanced to boarding; all expected passengers require a decision.';actor='fixture';break;
    case 'boarding':if(p.boarding[cmd.id]===cmd.status)return state;p.boarding[cmd.id]=cmd.status;text=`${passengers.find(x=>x.id===cmd.id)?.name}: ${cmd.status}.`;actor='travel';break;
    case 'board-rest':if(!passengers.some(x=>p.boarding[x.id]==='expected'))return state;for(const x of passengers)if(p.boarding[x.id]==='expected')p.boarding[x.id]='boarded';text='Fixture event: remaining expected passengers marked boarded for rehearsal. Absences preserved.';actor='fixture';break;
    case 'depart':if(p.progress!=='boarding'||departureReasons(p).length)return state;p.progress='departed';p.clock=p.region==='Tallinn'?'2027-06-14T05:00:00Z':'2027-06-12T09:15:00Z';p.milestone={status:'Departure recorded',at:p.clock,actor:'Ana Demo · travel coordinator',next:p.region==='Tallinn'?'Origin departure 09:00 Asia/Tbilisi · illustrative Tallinn arrival 12:30 Europe/Tallinn':'Riverbank arrival 13:40 Asia/Tbilisi'};text='Departure recorded after passenger and arrangement checks.';actor='travel';break;
    case 'arrive':if(p.progress!=='departed')return state;p.progress='arrived';p.clock=p.region==='Tallinn'?'2027-06-14T09:30:00Z':'2027-06-12T09:40:00Z';p.milestone={status:'Arrival recorded',at:p.clock,actor:'Ana Demo · travel coordinator',next:p.region==='Tallinn'?'Group check and transfer to team base':'Warm-up at the friendly ground'};text='Arrival recorded from simulated staff report; no location telemetry.';actor='travel';break;
    case 'stale-clock':p.clock=new Date(new Date(p.clock).getTime()+2*3600000).toISOString();text='Scenario clock advanced two hours without another staff update.';actor='fixture';break;
  }
  if(text)p.history.unshift({id:`event-${p.history.length+1}`,text,actor,at:p.clock});
  return s;
}
export function repairActivities(draft:Draft,q:Proposal):Activity[] {
  return draft.activities.map(a=>a.id==='training3'?{...a,start:q.trainingStart,end:q.trainingEnd}:a.id==='transfer3'?{...a,start:q.departure,end:q.arrival,placeId:'new-ground',estimate:65}:a.id==='warmup3'?{...a,start:q.warmup,end:q.kickoff,placeId:'new-ground'}:a.id==='match3'?{...a,start:q.kickoff,end:addMinutes(q.kickoff,90),placeId:'new-ground'}:a);
}
export function loadStore(storage:Pick<Storage,'getItem'>):{store:Store;recovery:boolean} {
  try {
    const raw=storage.getItem(SAVE_KEY);if(!raw)return {store:initialStore(),recovery:false};
    const v=JSON.parse(raw);if(v.schema!==1||!v.plans?.[v.activeId]||!v.plans.camp||!v.plans.local)throw Error('Incompatible save');
    const validAt=(at:string)=>typeof at==='string'&&Number.isFinite(Date.parse(at));
    const validDraft=(d:Draft)=>d&&Array.isArray(d.activities)&&d.activities.every(a=>a.id&&validAt(`${a.day}T12:00:00Z`)&&/^\d{2}:\d{2}$/.test(a.start)&&/^\d{2}:\d{2}$/.test(a.end)&&placeById(a.placeId)&&typeof a.title==='string')&&(!d.accommodation||placeById(d.accommodation));
    for(const p of Object.values(v.plans) as Plan[]) {
      if(!validDraft(p.draft)||!Array.isArray(p.families)||!Array.isArray(p.history)||!Number.isFinite(p.revision)||!Number.isFinite(p.approval?.amount)||!Array.isArray(p.baseCosts)||!p.boarding||!Array.isArray(p.undo)||!Array.isArray(p.saved)||!p.supplier||!Array.isArray(p.publications)||!validAt(p.clock)||!validAt(`${p.start}T12:00:00Z`)||!validAt(`${p.end}T12:00:00Z`)||!['Tallinn','Tbilisi'].includes(p.region))throw Error('Invalid plan');
      if(!p.families.every(f=>Array.isArray(f.permissions)&&f.permissions.every(x=>validAt(x.at)))||!p.baseCosts.every(c=>Number.isFinite(c.cents)&&Number.isFinite(c.committed)&&Number.isFinite(c.paid))||!p.history.every(h=>validAt(h.at))||!p.undo.every(validDraft))throw Error('Invalid linked records');
      if(p.published&&(!validDraft(p.published.draft)||!validAt(p.published.at)))throw Error('Invalid published version');
      if(p.milestone&&!validAt(p.milestone.at))throw Error('Invalid milestone');
    }
    return {store:v,recovery:false};
  }catch{return {store:initialStore(),recovery:true};}
}
