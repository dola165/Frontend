import { clubViewerRole } from '../../club/clubViewerRole';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ClubOpportunityOverview } from '../../club/ClubOpportunityOverview';
import { fetchStoreCatalog } from '../../../features/store/api';
import { fetchCampaigns, type Campaign } from '../../../features/campaigns/api';
import { fetchClubJobs } from '../../../features/clubs/api';
vi.mock('../../../features/store/api',async original=>({...await original<typeof import('../../../features/store/api')>(),fetchStoreCatalog:vi.fn()}));
vi.mock('../../../features/campaigns/api',async original=>({...await original<typeof import('../../../features/campaigns/api')>(),fetchCampaigns:vi.fn()}));
vi.mock('../../../features/clubs/api',()=>({fetchClubJobs:vi.fn()}));
beforeEach(()=>{vi.resetAllMocks();vi.mocked(fetchStoreCatalog).mockResolvedValue({content:[{id:1,clubId:10,name:'Youth shirt',price:40,currency:'GEL',variants:[{stock:3,label:'M'}]}],totalElements:8});vi.mocked(fetchCampaigns).mockResolvedValue({content:[{id:2,title:'New pitch',summary:'Room for young players',reportedAmount:200,goalAmount:1000,currency:'GEL'} as Campaign],totalElements:2});vi.mocked(fetchClubJobs).mockResolvedValue([{id:3,clubId:10,title:'Youth coach',requiredRole:'COACH',engagementType:'PAID',category:'COACHING'}]);});
const show=(role:null|'OWNER'=null)=>render(<MemoryRouter><ClubOpportunityOverview clubId={10} role={role}/></MemoryRouter>);
it('shows real previews, independent counts and exact destinations',async()=>{
 show();expect(await screen.findByText('8 published products')).toBeVisible();expect(await screen.findByText('2 active campaigns')).toBeVisible();expect(await screen.findByText('1 open role')).toBeVisible();
 expect(screen.getByRole('link',{name:/Youth shirt/})).toHaveAttribute('href','/store/products/1');expect(screen.getByRole('link',{name:'New pitch'})).toHaveAttribute('href','/campaigns/2');expect(screen.getByRole('link',{name:/Youth coach/})).toHaveAttribute('href','/jobs/3');expect(screen.getByText(/reported by the club/)).toBeVisible();expect(fetchStoreCatalog).toHaveBeenCalledWith(expect.objectContaining({clubId:10,size:3}),expect.any(AbortSignal));expect(fetchClubJobs).toHaveBeenCalledWith(10,expect.any(AbortSignal));expect(screen.queryByText('Manage products')).not.toBeInTheDocument();
});
it('keeps other previews usable when one source fails instead of showing a fake zero',async()=>{
 vi.mocked(fetchCampaigns).mockRejectedValue(new Error('offline'));show();expect(await screen.findByText('8 published products')).toBeVisible();const panel=screen.getByRole('region',{name:'Club campaign preview'});expect(await within(panel).findByRole('alert')).toHaveTextContent('Could not load campaigns');expect(within(panel).queryByText('0 active campaigns')).not.toBeInTheDocument();
});
it('shows only permission-appropriate workspace shortcuts',async()=>{
 show('OWNER');await screen.findByText('8 published products');expect(screen.getByRole('link',{name:'Manage products'})).toHaveAttribute('href','/clubs/10/workspace?tab=store');expect(screen.getByRole('link',{name:'Manage campaigns'})).toHaveAttribute('href','/clubs/10/workspace?tab=campaigns');
});
it('does not accept a delayed response belonging to a previous club',async()=>{
 let finish!:(value:Awaited<ReturnType<typeof fetchStoreCatalog>>)=>void;vi.mocked(fetchStoreCatalog).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({content:[],totalElements:0});const view=show();view.rerender(<MemoryRouter><ClubOpportunityOverview clubId={20} role={null}/></MemoryRouter>);await waitFor(()=>expect(fetchStoreCatalog).toHaveBeenLastCalledWith(expect.objectContaining({clubId:20}),expect.any(AbortSignal)));await act(async()=>finish({content:[{id:99,name:'Previous club shirt'}],totalElements:1}));expect(screen.queryByText('Previous club shirt')).not.toBeInTheDocument();
});

it('does not borrow an owner role from another club',()=>{expect(clubViewerRole(20,null,10,'OWNER')).toBeNull();});
it('recovers the role only for the matching club',()=>{expect(clubViewerRole(10,null,10,'OWNER')).toBe('OWNER');});
it('uses the viewed profile role ahead of a cached membership',()=>{expect(clubViewerRole(10,'COACH',10,'OWNER')).toBe('COACH');});
