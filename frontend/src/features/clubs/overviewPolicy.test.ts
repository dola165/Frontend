import { expect, it } from 'vitest';
import { clubLandingTab, overviewFixtures, overviewLead, overviewProgrammes } from './overviewPolicy';
import type { TrainingProgramme } from './presentation';
import type { ScheduleEventOccurrence } from '../schedule/api';

it.each(['PLAYER','COACH','REFEREE','AGENT','CLUB_STAFF','PARENT','ORGANIZER','VENUE_MANAGER','FAN','ADMIN',undefined])('keeps %s connected work independent of public relevance',role=>{
    expect(overviewLead(1,role,{version:1,workspaces:[{id:'club.family',context:{type:'club',id:1,label:'Dinamo'}}]})).toBe('family');
    expect(['family','club','teams','training']).toContain(overviewLead(1,role,{version:1,workspaces:[]}));
});
it('prioritizes training for a visiting parent and public squads for a visiting coach',()=>{
    expect(overviewLead(1,'PARENT')).toBe('training');expect(overviewLead(1,'COACH')).toBe('teams');
    expect(overviewLead(1,'REFEREE')).toBe('club');
    expect(overviewLead(1,'FAN',{version:1,workspaces:[{id:'parent.hub',context:{type:'user',id:7,label:'Family'}}]})).toBe('training');
});
it('does not publish draft, expired or future training programmes',()=>{
    const p={published:true,name:'Training'} as TrainingProgramme;
    expect(overviewProgrammes([p,{...p,published:false},{...p,validFrom:'2027-01-01'},{...p,validUntil:'2026-08-01'}],'2026-09-29')).toEqual([p]);
});
it('shows only upcoming public fixtures, preserving pending confirmation and limiting the summary',()=>{
    const fixture={eventType:'MATCH',publicNow:true,startsAt:'2026-10-01T14:00:00',endsAt:'2026-10-01T16:00:00',status:'SCHEDULED',challengeStatus:'PENDING'} as ScheduleEventOccurrence;
    const privateEvent={...fixture,publicNow:false},cancelled={...fixture,status:'CANCELLED'},ended={...fixture,status:'COMPLETED'},rejected={...fixture,challengeStatus:'REJECTED'} as ScheduleEventOccurrence;
    expect(overviewFixtures([privateEvent,cancelled,ended,rejected,fixture],Date.parse('2026-09-29'))).toEqual([fixture]);
    expect(overviewFixtures([fixture,fixture,fixture,fixture],Date.parse('2026-09-29'))).toHaveLength(3);
    expect(overviewFixtures([fixture],Date.parse('2026-10-02'))).toEqual([]);
});

it('opens casual visits on Posts without overriding a family or professional context',()=>{
    expect(clubLandingTab(1,'FAN')).toBe('posts');expect(clubLandingTab(1)).toBe('posts');
    expect(clubLandingTab(1,'PARENT')).toBe('overview');expect(clubLandingTab(1,'COACH')).toBe('overview');
    expect(clubLandingTab(1,'FAN',{version:1,workspaces:[{id:'club.family',context:{type:'club',id:1,label:'Home'}}]})).toBe('overview');
    expect(clubLandingTab(1,'FAN',{version:1,workspaces:[{id:'agent.hub',context:{type:'user',id:7,label:'Agent'}}]})).toBe('overview');
    expect(overviewLead(2,'PARENT',{version:1,workspaces:[{id:'club.family',context:{type:'club',id:1,label:'Home'}}]})).toBe('training');
});
