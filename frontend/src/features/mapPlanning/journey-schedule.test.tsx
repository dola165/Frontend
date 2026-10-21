import { render,screen,fireEvent,waitFor,cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,expect,it,vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { JourneyEventDetails } from './JourneySchedule';
import { mergeJourneyEntries, type JourneyEntry } from './journeyScheduleData';
import type { ScheduleWorkspaceEvent } from '../../components/schedule/workspaceTypes';
vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn(),post:vi.fn()}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const entry={id:'journey:3:meet',planId:3,activityKey:'meet',version:2,clubId:1,squadId:4,squadName:'U16',clubName:'Dinamo',journeyTitle:'Away day',timezone:'Asia/Tbilisi',title:'Meet the squad',kind:'ACTIVITY',startsAt:'2026-10-10T05:00:00Z',endsAt:'2026-10-10T05:15:00Z',status:'SCHEDULED',sourceChanged:false,place:null,eventId:null,sessionId:null,staff:false,itinerary:{} as JourneyEntry['itinerary'],subjects:[{id:8,name:'Ana',guardian:true,canRespond:true,response:'AWAITING_REPLY'},{id:9,name:'Sibling',guardian:true,canRespond:true,response:'AWAITING_REPLY'}],attendance:{total:2,going:0,pending:2},replyScope:'Whole journey'} satisfies JourneyEntry;
it('merges linked fixtures once and keeps both families as explicit subjects',()=>{
 const fixture={id:'match:5',eventId:5,origin:'MATCH_EXCHANGE',startsAt:entry.startsAt,endsAt:entry.endsAt} as ScheduleWorkspaceEvent;
 const events=mergeJourneyEntries([fixture],[{...entry,eventId:5}, {...entry,id:'journey:3:return',activityKey:'return'}]);
 expect(events).toHaveLength(2);expect(events[0].id).toBe('match:5');expect(events[0].journeys?.[0].subjects).toHaveLength(2);expect(events[1].origin).toBe('JOURNEY');
});
it('never deduplicates different source kinds with the same numeric ID',()=>{
 const fixture={id:'session:5',eventId:5,origin:'SQUAD_SESSION',startsAt:entry.startsAt,endsAt:entry.endsAt} as ScheduleWorkspaceEvent;
 expect(mergeJourneyEntries([fixture],[{...entry,eventId:5}])).toHaveLength(2);
});
it('replies only for the chosen child and clearly separates travel permission',async()=>{
 vi.mocked(apiClient.post).mockResolvedValue({data:{recorded:true}});
 render(<MemoryRouter><JourneyEventDetails entries={[entry]} onClose={()=>{}}/></MemoryRouter>);
 expect(screen.getAllByText(/Attendance and travel permission are separate/)).toHaveLength(2);
 fireEvent.click(screen.getAllByRole('button',{name:'I am going'})[1]);
 await waitFor(()=>expect(apiClient.post).toHaveBeenCalledWith('/journeys/3/reply',{version:2,subjectId:9,response:'GOING'},{timeout:20000}));
 expect(await screen.findByText('Going')).toBeVisible();
});
it('a saved response never carries across journeys or a newly published version',async()=>{
 vi.mocked(apiClient.post).mockResolvedValue({data:{recorded:true}});
 const first={...entry,subjects:[entry.subjects[0]]};const other={...first,id:'journey:4:meet',planId:4,journeyTitle:'Another away day'};
 const {rerender}=render(<MemoryRouter><JourneyEventDetails entries={[first,other]} onClose={()=>{}}/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'I am going'}));expect(await screen.findByText('Going')).toBeVisible();
 fireEvent.change(screen.getByRole('combobox',{name:'Journey'}),{target:{value:other.id}});expect(screen.queryByText('Going')).toBeNull();expect(screen.getByText('Awaiting your reply')).toBeVisible();
 fireEvent.change(screen.getByRole('combobox',{name:'Journey'}),{target:{value:first.id}});expect(screen.getByText('Going')).toBeVisible();
 rerender(<MemoryRouter><JourneyEventDetails entries={[{...first,version:3,subjects:[{...first.subjects[0],response:'RECONFIRMATION_REQUIRED'}]},other]} onClose={()=>{}}/></MemoryRouter>);expect(screen.queryByText('Going')).toBeNull();expect(screen.getByText('Please confirm the updated journey')).toBeVisible();
});
it('failed and cancelled invitations do not claim a reply was saved',async()=>{
 vi.mocked(apiClient.post).mockRejectedValue(new Error('Connection lost'));
 render(<MemoryRouter><JourneyEventDetails entries={[{...entry,subjects:[entry.subjects[0]]}]} onClose={()=>{}}/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'I am going'}));await screen.findByRole('alert');expect(screen.queryByText('Going')).toBeNull();expect(screen.getByRole('button',{name:'I am going'})).toBeEnabled();
 cleanup();render(<MemoryRouter><JourneyEventDetails entries={[{...entry,status:'CANCELLED'}]} onClose={()=>{}}/></MemoryRouter>);expect(screen.queryByRole('button',{name:'I am going'})).toBeNull();
});
