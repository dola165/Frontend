import {ShoppingBag,HeartHandshake,Briefcase} from 'lucide-react';
import {WorkspaceSidebar} from '../../../components/workspace/WorkspaceSidebar';
import {ClubOpportunities} from '../../../components/club/ClubOpportunities';
import type {ClubProfile} from '../../../pages/ClubProfilePage';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {CampaignsPage} from '../../../pages/CampaignsPage';
import {CampaignDetailPage} from '../../../pages/CampaignDetailPage';
import {CampaignsTab} from '../../../components/workspace/tabs/CampaignsTab';
import * as api from '../api';
vi.mock('../api',async original=>({...await original<typeof import('../api')>(),fetchCampaigns:vi.fn(),fetchCampaign:vi.fn(),fetchCampaignLocations:vi.fn(),fetchManagedCampaigns:vi.fn(),fetchManagedCampaign:vi.fn(),createCampaign:vi.fn(),editCampaign:vi.fn(),changeCampaignState:vi.fn(),postCampaignUpdate:vi.fn()}));
vi.mock('../../../api/axiosConfig',()=>({DEPLOYMENT_URLS:{mediaBaseUrl:'http://localhost:8080'},apiClient:{get:vi.fn(async()=>({data:{name:'Alpha FC'}}))}}));
const campaign:api.Campaign={id:1,clubId:10,clubName:'Alpha FC',country:'Georgia',city:'Tbilisi',title:'A pitch for everyone',summary:'Bring youth football home',description:'Create a safe place to play.',beneficiary:'Youth teams',useOfFunds:'New goals and lighting',category:'FACILITIES',currency:'GEL',goalAmount:1000,reportedAmount:200,reportedNote:'Counted club donations',reportedAt:'2026-09-09T10:00:00Z',startsOn:null,endsOn:null,images:['/uploads/one.jpg','/uploads/two.jpg'],status:'PUBLISHED',phase:'ACTIVE',version:3,updatedAt:'2026-09-09T10:00:00Z',publishedAt:'2026-09-09T10:00:00Z',updates:[{id:9,title:'First goals arrived',body:'Thanks to our community.',createdAt:'2026-09-09T10:00:00Z'}]};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.fetchCampaigns).mockResolvedValue({content:[campaign],totalElements:1});vi.mocked(api.fetchCampaignLocations).mockResolvedValue([{country:'Georgia',city:'Tbilisi'},{country:'France',city:'Paris'}]);vi.mocked(api.fetchCampaign).mockResolvedValue(campaign);vi.mocked(api.fetchManagedCampaigns).mockResolvedValue([campaign]);});
afterEach(()=>vi.unstubAllGlobals());
const browse=(path='/campaigns')=>render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/campaigns" element={<CampaignsPage/>}/><Route path="/clubs/:id/campaigns" element={<CampaignsPage/>}/></Routes></MemoryRouter>);
const detail=()=>render(<MemoryRouter initialEntries={['/campaigns/1']}><Routes><Route path="/campaigns/:id" element={<CampaignDetailPage/>}/></Routes></MemoryRouter>);
const manage=()=>render(<MemoryRouter><CampaignsTab clubId={10}/></MemoryRouter>);
it('uses server pagination, exact details and one club scope with a general exit',async()=>{
 vi.mocked(api.fetchCampaigns).mockResolvedValue({content:[campaign],totalElements:13});browse('/clubs/10/campaigns?query=pitch');
 expect(await screen.findByRole('link',{name:'A pitch for everyone'})).toHaveAttribute('href','/campaigns/1');expect(screen.getByRole('link',{name:'Browse all campaigns'})).toHaveAttribute('href','/campaigns');
 expect(api.fetchCampaigns).toHaveBeenCalledWith(expect.objectContaining({clubId:10,query:'pitch',page:0,size:12,state:'ACTIVE'}),expect.any(AbortSignal));fireEvent.click(screen.getByRole('button',{name:'Next'}));await waitFor(()=>expect(api.fetchCampaigns).toHaveBeenLastCalledWith(expect.objectContaining({page:1,clubId:10}),expect.any(AbortSignal)));
});
it('clears a dependent city and offers complete location choices',async()=>{
 browse('/campaigns?country=Georgia&city=Tbilisi');await screen.findByRole('option',{name:'France'});fireEvent.change(screen.getByLabelText('Country'),{target:{value:'France'}});expect(screen.getByLabelText('City')).toHaveValue('');await waitFor(()=>expect(api.fetchCampaigns).toHaveBeenLastCalledWith(expect.objectContaining({country:'France',city:undefined}),expect.any(AbortSignal)));
});
it('ignores a delayed response after a new search',async()=>{
 let resolve!:(value:{content:api.Campaign[];totalElements:number})=>void;vi.mocked(api.fetchCampaigns).mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue({content:[{...campaign,title:'New result'}],totalElements:1});browse();fireEvent.change(screen.getByLabelText('Search campaigns'),{target:{value:'new'}});await screen.findByRole('link',{name:'New result'});await act(async()=>resolve({content:[campaign],totalElements:1}));expect(screen.queryByRole('link',{name:'A pitch for everyone'})).not.toBeInTheDocument();
});
it('labels progress as a club report and never offers an enabled payment action',async()=>{
 detail();await screen.findByRole('heading',{name:campaign.title});expect(screen.getByText('Club-reported funds are not verified by GrassKickZ.',{exact:false})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Online contributions unavailable'})).toBeDisabled();expect(screen.getByRole('link',{name:'Contact the club'})).toHaveAttribute('href','/clubs/10?tab=contact');expect(screen.getByText('First goals arrived')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'View photo 2'}));expect(screen.getByRole('img',{name:'A pitch for everyone — photo 2'})).toHaveAttribute('src',expect.stringContaining('two.jpg'));
});
it('offers a copyable exact link if the clipboard is unavailable',async()=>{
 vi.stubGlobal('navigator',{clipboard:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}});detail();fireEvent.click(await screen.findByRole('button',{name:'Copy campaign link'}));expect(await screen.findByLabelText('Campaign link')).toHaveValue(window.location.origin + '/campaigns/1');
});
it('keeps a stale edit and its original version on save failure',async()=>{
 vi.mocked(api.editCampaign).mockRejectedValue({response:{data:{error:'This campaign changed. Reload its latest version.'}}});manage();fireEvent.click(await screen.findByRole('button',{name:'Edit A pitch for everyone'}));fireEvent.change(screen.getByLabelText('Campaign title'),{target:{value:'Our new title'}});fireEvent.click(screen.getByRole('button',{name:'Save campaign'}));expect(await screen.findByRole('alert')).toHaveTextContent('This campaign changed');expect(screen.getByLabelText('Campaign title')).toHaveValue('Our new title');expect(api.editCampaign).toHaveBeenCalledWith(10,1,expect.objectContaining({version:3,title:'Our new title'}));
 fireEvent.click(screen.getByRole('button',{name:'Close editor'}));fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));expect(screen.getByLabelText('Campaign title')).toHaveValue('Our new title');
});
it('does not archive until confirmed and keeps failures visible',async()=>{
 vi.mocked(api.changeCampaignState).mockRejectedValue({response:{data:{error:'Permission changed'}}});manage();fireEvent.click(await screen.findByRole('button',{name:'Archive A pitch for everyone'}));expect(api.changeCampaignState).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Confirm archive'}));expect(await screen.findByRole('alert')).toHaveTextContent('Permission changed');expect(screen.getByText('A pitch for everyone')).toBeInTheDocument();
});
it('retains update drafts after a failed publication',async()=>{
 vi.mocked(api.fetchManagedCampaign).mockResolvedValue(campaign);vi.mocked(api.postCampaignUpdate).mockRejectedValue(new Error('offline'));manage();fireEvent.click(await screen.findByRole('button',{name:'Updates for A pitch for everyone'}));fireEvent.change(await screen.findByLabelText('Update title'),{target:{value:'A milestone'}});fireEvent.change(screen.getByLabelText('Update message'),{target:{value:'The work is underway.'}});fireEvent.click(screen.getByRole('button',{name:'Publish update'}));await screen.findByRole('alert');expect(screen.getByLabelText('Update message')).toHaveValue('The work is underway.');expect(api.postCampaignUpdate).toHaveBeenCalledWith(10,campaign,'A milestone','The work is underway.');
});

it('keeps all three club opportunity entry points scoped to that club',()=>{
 render(<MemoryRouter><ClubOpportunities club={{id:10} as ClubProfile}/></MemoryRouter>);
 expect(screen.getByRole('link',{name:/Fundraising & campaigns/})).toHaveAttribute('href','/clubs/10/campaigns');
 expect(screen.getByRole('link',{name:/Store/})).toHaveAttribute('href','/clubs/10/store');
 expect(screen.getByRole('link',{name:/Jobs & volunteering/})).toHaveAttribute('href','/clubs/10?tab=business');
});
it('makes Store, Campaigns and Jobs reachable in the workspace navigation',()=>{
 const onTabChange=vi.fn();render(<WorkspaceSidebar clubId={10} overview={null} activeTab="campaigns" tabs={[{id:'store',label:'Store',icon:ShoppingBag},{id:'campaigns',label:'Campaigns',icon:HeartHandshake},{id:'jobs',label:'Jobs & volunteering',icon:Briefcase}]} unreadInboxCount={0} mobileOpen={false} onTabChange={onTabChange} onNavigate={vi.fn()} onClose={vi.fn()}/>);
 for(const [name,id] of [['Store','store'],['Campaigns','campaigns'],['Jobs & volunteering','jobs']]) {fireEvent.click(screen.getByRole('button',{name}));expect(onTabChange).toHaveBeenLastCalledWith(id);}
});
