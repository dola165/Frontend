import { describe, expect, it } from 'vitest';
import { initialStore } from './fixtures';
import { ackCount, clashes, departureReasons, loadStore, permissionCount, publishReasons, reducer, SAVE_KEY, totals } from './store';
import type { Command } from './store';
import type { Store } from './model';
// Exercise transitions through public commands, including publication boundaries.
const run=(s:Store,...commands:Command[])=>commands.reduce(reducer,s);
describe('map workspace simulation',()=>{
  it('derives cents accurately and never records payments for approvals',()=>{
    let s=initialStore();expect(totals(s.plans.camp)).toEqual({estimate:1168000,committed:1128000,paid:345000,headroom:32000});
    s=reducer(s,{type:'host-change'});expect(totals(s.plans.camp).estimate).toBe(1216000);expect(totals(s.plans.camp).headroom).toBe(-16000);
    s=reducer(s,{type:'approve',approved:true});expect(s.plans.camp.approval.amount).toBe(1216000);expect(totals(s.plans.camp).paid).toBe(345000);
    s=reducer(s,{type:'supplier',confirmed:true});expect(totals(s.plans.camp).paid).toBe(345000);
  });
  it('compares accommodation without inheriting confirmation or meals, with undo',()=>{
    let s=run(initialStore(),{type:'hotel',id:'harbour'});expect(totals(s.plans.camp).estimate).toBe(1132800);expect(s.plans.camp.draft.hotelDecision).toBe('pending');expect(s.plans.camp.draft.mealsResolved).toBe(false);
    s=reducer(s,{type:'host-change'});expect(totals(s.plans.camp).estimate).toBe(1180800);expect(totals(s.plans.camp).headroom).toBe(19200);
    s=reducer(s,{type:'undo'});expect(s.plans.camp.draft.accommodation).toBe('harbour');
    s=reducer(s,{type:'undo'});expect(totals(s.plans.camp).estimate).toBe(1216000);expect(s.plans.camp.draft.accommodation).toBe('lodge');
  });
  it('repairs the conflict but keeps required authority and supplier decisions',()=>{
    const s=run(initialStore(),{type:'host-change'},{type:'prepare'},{type:'apply'});expect(clashes(s.plans.camp)).toHaveLength(0);expect(publishReasons(s.plans.camp)).toContain('Spending approval needed');expect(publishReasons(s.plans.camp)).toContain('Confirm transport amendment');
  });
  it('protects against repeated and outdated proposals and invalid edits',()=>{
    let s=run(initialStore(),{type:'host-change'},{type:'prepare'});
    const a={...s.plans.camp.draft.activities[0],title:'Changed'};s=reducer(s,{type:'activity',activity:a});const stale=s;s=reducer(s,{type:'apply'});expect(s).toBe(stale);
    s=run(s,{type:'prepare'},{type:'edit-proposal',patch:{trainingEnd:'10:30'}},{type:'apply'});expect(s.plans.camp.proposal?.applied).toBe(false);
    s=run(s,{type:'prepare'},{type:'apply'});const applied=s;expect(reducer(s,{type:'apply'})).toBe(applied);
  });
  it('publishes an isolated snapshot and resets acknowledgement without revoking original travel permission',()=>{
    let s=run(initialStore(),{type:'host-change'},{type:'prepare'},{type:'apply'});expect(s.plans.camp.published?.draft.activities.find(a=>a.id==='match3')?.start).toBe('14:00');
    s=run(s,{type:'approve',approved:true},{type:'supplier',confirmed:true},{type:'publish'});expect(s.plans.camp.published?.version).toBe(2);expect(ackCount(s.plans.camp)).toBe(0);expect(permissionCount(s.plans.camp)).toBe(18);
    s=reducer(s,{type:'ack'});expect(ackCount(s.plans.camp)).toBe(1);expect(s.plans.camp.families[1].acknowledgedVersion).toBe(1);
  });
  it('requires renewed permission for an overnight-location change and retains the old decision',()=>{
    const s=run(initialStore(),{type:'hotel',id:'harbour'},{type:'hotel-decision',confirmed:true},{type:'meals'},{type:'publish'});expect(permissionCount(s.plans.camp)).toBe(0);expect(s.plans.camp.families[0].permissions[0].status).toBe('granted');
    expect(departureReasons(s.plans.camp)).toContain('Resolve current guardian travel permissions');
  });
  it('retains the pending host revision when requesting original arrangements',()=>{
    const s=run(initialStore(),{type:'host-change'},{type:'retain-original'});expect(s.plans.camp.incoming?.status).toBe('requested');expect(clashes(s.plans.camp)).not.toHaveLength(0);expect(s.plans.camp.published?.version).toBe(1);
  });
  it('gates departure and never boards an absent passenger by clicking departure',()=>{
    let s=run(initialStore(),{type:'advance'},{type:'depart'});expect(s.plans.camp.progress).toBe('boarding');
    s=run(s,{type:'boarding',id:'player-1',status:'absent'},{type:'board-rest'},{type:'depart'});expect(s.plans.camp.progress).toBe('boarding');expect(s.plans.camp.boarding['player-1']).toBe('absent');
    s=run(s,{type:'boarding',id:'player-1',status:'boarded'},{type:'depart'},{type:'arrive'});expect(s.plans.camp.progress).toBe('arrived');expect(s.plans.camp.milestone?.actor).toContain('Ana');
  });
  it('isolates plans and repeated host events and recovers incompatible persistence',()=>{
    let s=run(initialStore(),{type:'host-change'});const before=s;expect(reducer(s,{type:'host-change'})).toBe(before);s=reducer(s,{type:'switch',id:'local'});expect(totals(s.plans.local).estimate).toBe(40000);expect(s.plans.local.incoming).toBeNull();
    const storage={getItem:(key:string)=>key===SAVE_KEY?JSON.stringify(s):null};expect(loadStore(storage).store).toEqual(s);expect(loadStore({getItem:()=>'{broken'}).recovery).toBe(true);expect(reducer(s,{type:'reset'})).toEqual(initialStore());
  });
  it('recomputes preparation and journey clashes for the local matchday',()=>{
    const original=initialStore();expect(clashes(original.plans.local)).toEqual([]);expect(clashes(original.plans.camp)).toEqual([]);
    const match=original.plans.local.draft.activities.find(a=>a.id==='local-match')!;
    const s=run(original,{type:'switch',id:'local'},{type:'activity',activity:{...match,end:'16:15'}});
    expect(clashes(s.plans.local).some(c=>c.includes('preparation'))).toBe(true);
  });
  it('uses an edited repair in its publication summary and refuses corrupt linked records',()=>{
    const s=run(initialStore(),{type:'host-change'},{type:'prepare'},{type:'edit-proposal',patch:{trainingStart:'08:15'}},{type:'apply'},{type:'approve',approved:true},{type:'supplier',confirmed:true},{type:'publish'});
    expect(s.plans.camp.published?.summary).toContain('08:15');
    const broken=structuredClone(s);broken.plans.camp.families[0].permissions=null as never;
    expect(loadStore({getItem:()=>JSON.stringify(broken)}).recovery).toBe(true);
  });
  it('keeps repeated decisions idempotent and a revised leadership decline actionable',()=>{
    const s=run(initialStore(),{type:'host-change'},{type:'prepare'},{type:'apply'},{type:'approve',approved:true},{type:'supplier',confirmed:true});
    expect(reducer(s,{type:'approve',approved:true})).toBe(s);expect(reducer(s,{type:'supplier',confirmed:true})).toBe(s);
    const declined=reducer(s,{type:'approve',approved:false});expect(publishReasons(declined.plans.camp)).toContain('Revise declined spending request');
    const revised=run(declined,{type:'prepare'},{type:'apply'});expect(revised.plans.camp.approval.decision).toBe('declined');
    const published=run(s,{type:'publish'},{type:'ack',bulk:true});expect(reducer(published,{type:'ack',bulk:true})).toBe(published);
    expect(reducer(published,{type:'permission',bulk:true})).toBe(published);expect(published.plans.camp.families[0].permissions[0].actor).toBe('Guardian 01 Demo');
  });
});
