import { expect, it } from 'vitest';
import { overviewFixtures, overviewLead, overviewProgrammes } from './overviewPolicy';
import type { TrainingProgramme } from './presentation';
import type { ScheduleEventOccurrence } from '../schedule/api';

const caps = (workspaces: Array<{ id: string; type: string; cid: number }>) => ({ version: 1 as const, workspaces: workspaces.map(w => ({ id: w.id, context: { type: w.type, id: w.cid, label: 'x' } })) });

it('leads with the family week for a family linked to this club, whatever else they are', () => {
    expect(overviewLead(1, caps([{ id: 'club.family', type: 'club', cid: 1 }, { id: 'club.workspace', type: 'club', cid: 2 }]))).toBe('family');
    expect(overviewLead(2, caps([{ id: 'club.family', type: 'club', cid: 1 }]))).toBe('training');
});
it('reads relevance from confirmed links only, never from an account role', () => {
    expect(overviewLead(1, caps([{ id: 'parent.hub', type: 'user', cid: 7 }]))).toBe('training');
    expect(overviewLead(1, caps([{ id: 'squad.workspace', type: 'squad', cid: 105 }]))).toBe('teams');
    expect(overviewLead(1, caps([{ id: 'club.workspace', type: 'club', cid: 2 }]))).toBe('teams');
    expect(overviewLead(1, caps([{ id: 'club.player', type: 'club', cid: 2 }]))).toBe('training');
    expect(overviewLead(1, caps([{ id: 'club.player', type: 'club', cid: 1 }]))).toBe('club');
    expect(overviewLead(1, caps([]))).toBe('club');
    expect(overviewLead(1, undefined)).toBe('club');
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
