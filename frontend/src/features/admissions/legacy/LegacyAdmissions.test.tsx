import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LegacyAdmissions } from './LegacyAdmissions';
import type { LegacyTask } from './api';
const api=vi.hoisted(()=>({fetchLegacyTasks:vi.fn(),reconcileLegacy:vi.fn(),respondLegacyInvitation:vi.fn()}));
vi.mock('./api',()=>api);
vi.mock('../applicant/copy',()=>({useAdmissionCopy:()=>({copy:(en:string)=>en})}));
vi.mock('../club/copy',()=>({useClubAdmissionCopy:()=>({c:(key:string)=>key})}));
vi.mock('../../recruitment/RecruitmentApplication',()=>({RecruitmentApplication:({applicationId}:{applicationId:number})=><p>Exact child application {applicationId}</p>}));
const trial:LegacyTask={kind:'AFFILIATION',sourceId:41,playerId:23,playerName:'Existing child',organizationId:8,organizationName:'Dinamo Academy',clubId:1,sourceStatus:'TRIALIST',version:1,state:'REVIEW',caseId:null,destination:null,canRespond:false,canReconcile:true,nextOwner:'CLUB',nextAction:'Choose the agreed group.',reason:null,groups:[{id:11,version:2,name:'Named beginner group'}]};
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();api.fetchLegacyTasks.mockResolvedValue([trial]);api.reconcileLegacy.mockResolvedValue({...trial,state:'LINKED',caseId:91});});afterEach(cleanup);
async function reveal(staff=false) {
  const heading=await screen.findByText(staff?'Requests needing a group decision · 1':'Player participation and earlier requests');
  if (!heading.closest('details')?.open)fireEvent.click(heading);
  fireEvent.click(await screen.findByText('Existing child'));
}
it('continues an earlier request only after choosing the named group and recording the real decision',async()=>{
 render(<MemoryRouter><LegacyAdmissions view="review" sessionId="legacy-test" organizationId={8}/></MemoryRouter>); await reveal(true);
 const button=screen.getByRole('button',{name:'Continue with this group'});expect(button).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Named group'),{target:{value:'11'}});fireEvent.change(screen.getByLabelText('Actual review and routing reason'),{target:{value:'Reviewed the existing request with this coach'}});fireEvent.click(button);
 await waitFor(()=>expect(api.reconcileLegacy).toHaveBeenCalledTimes(1));expect(api.reconcileLegacy).toHaveBeenCalledWith(trial,expect.objectContaining({groupId:11,groupVersion:2,expectedVersion:1,sourceStatus:'TRIALIST',reason:'Reviewed the existing request with this coach'}),'legacy-test');expect(api.respondLegacyInvitation).not.toHaveBeenCalled();
});
it('preserves the exact child application rather than substituting a sibling request',async()=>{
 api.fetchLegacyTasks.mockResolvedValue([{...trial,kind:'APPLICATION',sourceId:54,canReconcile:false,canRespond:true}]);render(<MemoryRouter><LegacyAdmissions sessionId="legacy-test" playerId={23}/></MemoryRouter>);await reveal();
 expect(screen.getByText('Exact child application 54')).toBeVisible();expect(api.fetchLegacyTasks).toHaveBeenCalledWith('legacy-test',undefined,23);
});
it('keeps current players in history with their working schedule and no reapplication',async()=>{
 api.fetchLegacyTasks.mockResolvedValue([{...trial,state:'EXISTING_PARTICIPATION',destination:'/calendar',canReconcile:false}]);render(<MemoryRouter><LegacyAdmissions sessionId="legacy-test" organizationId={8} view="history"/></MemoryRouter>); await reveal();
 expect(screen.getByRole('link',{name:'Open current schedule'})).toHaveAttribute('href','/calendar');expect(screen.queryByRole('button',{name:'Continue with this group'})).not.toBeInTheDocument();
});
it('shows only decisions in the review queue and keeps the long history out of its heading',async()=>{
 api.fetchLegacyTasks.mockResolvedValue([trial,...Array.from({length:86},(_,index)=>({...trial,sourceId:100+index,playerName:`Current player ${index}`,state:'EXISTING_PARTICIPATION',destination:'/calendar',canReconcile:false}))]);
 render(<MemoryRouter><LegacyAdmissions sessionId="legacy-test" organizationId={8} view="review"/></MemoryRouter>);
 expect(await screen.findByText('Requests needing a group decision · 1')).toBeInTheDocument();expect(screen.queryByText(/^Current player \d/)).not.toBeInTheDocument();expect(screen.queryByText(/87/)).not.toBeInTheDocument();
});
it('still requires the named child invitation confirmation before sending its maintained command',async()=>{
 api.fetchLegacyTasks.mockResolvedValue([{...trial,kind:'INVITATION',canRespond:true,canReconcile:false,sourceStatus:'PENDING'}]);api.respondLegacyInvitation.mockResolvedValue({});render(<MemoryRouter><LegacyAdmissions sessionId="legacy-test"/></MemoryRouter>);await reveal();
 fireEvent.click(screen.getByRole('button',{name:'Review old invitation'}));expect(api.respondLegacyInvitation).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Confirm response'}));await waitFor(()=>expect(api.respondLegacyInvitation).toHaveBeenCalledExactlyOnceWith(41,true,'legacy-test'));
});
