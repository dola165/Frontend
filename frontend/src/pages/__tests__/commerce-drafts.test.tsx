import { useState } from 'react';
import { CommerceDraftScope } from '../../components/workspace/CommerceDraftScope';
import { useCommerceDraftState, useClearCommerceForm } from '../../components/workspace/commerceDraftState';
import {apiClient} from '../../api/axiosConfig';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { StoreTab } from '../../components/workspace/tabs/StoreTab';
import { CampaignsTab } from '../../components/workspace/tabs/CampaignsTab';
import { JobsTab } from '../../components/workspace/tabs/JobsTab';
import * as store from '../../features/store/api';
import * as campaigns from '../../features/campaigns/api';
import * as jobs from '../../features/clubs/api';
const {translate} = vi.hoisted(()=>({translate:(key:string)=>key}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:translate})}));
vi.mock('../../features/store/api',async original=>({...await original<typeof import('../../features/store/api')>(),deleteStoreProduct:vi.fn(),fetchAllClubStoreProducts:vi.fn(),createStoreProduct:vi.fn(),updateStoreProduct:vi.fn()}));
vi.mock('../../features/campaigns/api',async original=>({...await original<typeof import('../../features/campaigns/api')>(),changeCampaignState:vi.fn(),fetchManagedCampaigns:vi.fn(),fetchManagedCampaign:vi.fn(),createCampaign:vi.fn(),editCampaign:vi.fn(),postCampaignUpdate:vi.fn()}));
vi.mock('../../features/clubs/api',async original=>({...await original<typeof import('../../features/clubs/api')>(),deleteClubJob:vi.fn(),fetchAllClubJobs:vi.fn(),createClubJob:vi.fn(),updateClubJob:vi.fn()}));
vi.mock('../../api/axiosConfig',()=>({DEPLOYMENT_URLS:{mediaBaseUrl:'http://localhost:8080'},apiClient:{post:vi.fn()}}));
vi.mock('../../components/ui/MediaImage',()=>({MediaImage:({src,alt}:{src:string;alt:string})=><img src={src} alt={alt}/>}));
const campaign = {id:1,clubId:10,title:'Pitch',summary:'Summary',description:'Purpose',beneficiary:'Youth',useOfFunds:'Goals',category:'FACILITIES',currency:'GEL',goalAmount:100,reportedAmount:null,reportedNote:'',startsOn:null,endsOn:null,images:[],status:'PUBLISHED',phase:'ACTIVE',version:3,publishedAt:'2026-09-09T12:00:00Z',updates:[]} as unknown as campaigns.Campaign;
function Page() {
 const {id,feature}=useParams();const navigate=useNavigate();
 return <><Link to="/away">Leave workspace</Link><button onClick={()=>navigate(-1)}>Browser back</button><Link to={`/clubs/${id}/Store`}>Store tab</Link><Link to={`/clubs/${id}/Campaigns`}>Campaigns tab</Link><Link to={`/clubs/${id}/Jobs`}>Jobs tab</Link><Link to="/clubs/20/Store">Other club</Link>{feature==='Store'?<StoreTab clubId={Number(id)}/>:feature==='Campaigns'?<CampaignsTab clubId={Number(id)}/>:<JobsTab clubId={Number(id)} currentUserId={55} canReviewAllApplications pendingKey={null}/>}</>;
}
function Away(){const navigate=useNavigate();return <button onClick={()=>navigate(-1)}>Return to workspace</button>;}
const setup=(feature='Store')=>render(<MemoryRouter initialEntries={[`/clubs/10/${feature}`]}><Routes><Route path="/clubs/:id/:feature" element={<Page/>}/><Route path="/away" element={<Away/>}/></Routes></MemoryRouter>);
const leave=()=>fireEvent.click(screen.getByRole('link',{name:'Leave workspace'}));
const back=()=>fireEvent.click(screen.getByRole('button',{name:'Return to workspace'}));
const beforeUnload=()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;};
beforeEach(()=>{
 vi.resetAllMocks();localStorage.clear();window.dispatchEvent(new Event('gk-auth-changed'));localStorage.setItem('userId','55');window.dispatchEvent(new Event('gk-auth-changed'));
 vi.mocked(store.fetchAllClubStoreProducts).mockResolvedValue([]);vi.mocked(campaigns.fetchManagedCampaigns).mockResolvedValue([]);vi.mocked(jobs.fetchAllClubJobs).mockResolvedValue([]);
});
afterEach(()=>{cleanup();localStorage.clear();window.dispatchEvent(new Event('gk-auth-changed'));});
const cases = [
 {feature:'Store',create:'Add product',field:'Product name',save:'Save product',api:store.createStoreProduct,result:{id:2},close:'Close editor'},
 {feature:'Campaigns',create:'Create campaign',field:'Campaign title',save:'Save campaign',api:campaigns.createCampaign,result:{...campaign,id:2},close:'Close editor'},
 {feature:'Jobs',create:'jobs.postJob',field:'Role title',save:'jobs.save',api:jobs.createClubJob,result:{id:2},close:'Close role editor'},
] as const;
for(const c of cases){
 it(`${c.feature} preserves drafts across tab changes and route/back, and confirms discard`,async()=>{
  setup(c.feature);fireEvent.click(await screen.findByRole('button',{name:c.create}));fireEvent.change(screen.getByLabelText(c.field),{target:{value:'Unsaved work'}});
  if(c.feature==='Store'){fireEvent.change(screen.getByLabelText('Stock 1'),{target:{value:'7'}});fireEvent.change(screen.getByLabelText('Price'),{target:{value:'12.34'}});}
  expect(beforeUnload()).toBe(true);
  fireEvent.click(screen.getByRole('link',{name:c.feature==='Jobs'?'Store tab':'Jobs tab'}));fireEvent.click(screen.getByRole('link',{name:`${c.feature} tab`}));
  expect(await screen.findByLabelText(c.field)).toHaveValue('Unsaved work');leave();expect(beforeUnload()).toBe(true);back();expect(await screen.findByLabelText(c.field)).toHaveValue('Unsaved work');
  if(c.feature==='Store')expect(screen.getByLabelText('Stock 1')).toHaveValue(7);
  fireEvent.click(screen.getByRole('button',{name:c.close}));fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));expect(screen.getByLabelText(c.field)).toHaveValue('Unsaved work');
  fireEvent.click(screen.getByRole('button',{name:c.close}));fireEvent.click(screen.getByRole('button',{name:'Discard edits'}));expect(screen.queryByLabelText(c.field)).not.toBeInTheDocument();expect(beforeUnload()).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:c.create}));expect(screen.getByLabelText(c.field)).toHaveValue('');
 });
 it(`${c.feature} keeps a pending save single-flight through navigation and clears only on success`,async()=>{
  let finish!:(value:never)=>void;vi.mocked(c.api).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}) as never);
  setup(c.feature);fireEvent.click(await screen.findByRole('button',{name:c.create}));fireEvent.change(screen.getByLabelText(c.field),{target:{value:'Save me'}});
  if(c.feature==='Store') fireEvent.change(screen.getByLabelText('Price'),{target:{value:'12.34'}});fireEvent.submit(screen.getByLabelText(c.field).closest('form')!);expect(c.api).toHaveBeenCalledTimes(1);leave();back();expect(await screen.findByLabelText(c.field)).toHaveValue('Save me');expect(screen.getByLabelText(c.field)).toBeDisabled();
  leave();await act(async()=>finish(c.result as never));back();await screen.findByRole('button',{name:c.create});expect(screen.queryByLabelText(c.field)).not.toBeInTheDocument();expect(c.api).toHaveBeenCalledTimes(1);expect(beforeUnload()).toBe(false);
 });
 it(`${c.feature} retains a failed save after leaving and offers retry without losing fields`,async()=>{
  let fail!:(reason:Error)=>void;vi.mocked(c.api).mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;}) as never);
  setup(c.feature);fireEvent.click(await screen.findByRole('button',{name:c.create}));fireEvent.change(screen.getByLabelText(c.field),{target:{value:'Retry me'}});if(c.feature==='Store') fireEvent.change(screen.getByLabelText('Price'),{target:{value:'12.34'}});fireEvent.submit(screen.getByLabelText(c.field).closest('form')!);leave();await act(async()=>fail(new Error('Offline')));back();
  expect(await screen.findByLabelText(c.field)).toHaveValue('Retry me');expect(screen.getByLabelText(c.field)).not.toBeDisabled();expect(screen.getByRole('button',{name:c.save})).toBeEnabled();
 });
}
it('campaign updates preserve their text and failure across navigation, then clear on confirmed discard',async()=>{
 vi.mocked(campaigns.fetchManagedCampaigns).mockResolvedValue([campaign]);vi.mocked(campaigns.fetchManagedCampaign).mockResolvedValue(campaign);
 setup('Campaigns');fireEvent.click(await screen.findByRole('button',{name:'Updates for Pitch'}));fireEvent.change(await screen.findByLabelText('Update title'),{target:{value:'New goals'}});fireEvent.change(screen.getByLabelText('Update message'),{target:{value:'Full update text'}});
 leave();back();expect(await screen.findByLabelText('Update message')).toHaveValue('Full update text');fireEvent.click(screen.getByRole('button',{name:'Close updates'}));fireEvent.click(screen.getByRole('button',{name:'Keep writing'}));expect(screen.getByLabelText('Update title')).toHaveValue('New goals');fireEvent.click(screen.getByRole('button',{name:'Close updates'}));fireEvent.click(screen.getByRole('button',{name:'Discard update'}));expect(beforeUnload()).toBe(false);
});
it('club/account changes isolate drafts and logout retires the previous account session',async()=>{
 setup();fireEvent.click(await screen.findByRole('button',{name:'Add product'}));fireEvent.change(screen.getByLabelText('Product name'),{target:{value:'Private draft'}});fireEvent.click(screen.getByRole('link',{name:'Other club'}));expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Browser back'}));expect(await screen.findByLabelText('Product name')).toHaveValue('Private draft');
 act(()=>{localStorage.setItem('userId','66');window.dispatchEvent(new Event('gk-auth-changed'));});expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument();
 act(()=>{localStorage.removeItem('userId');window.dispatchEvent(new Event('gk-auth-changed'));localStorage.setItem('userId','55');window.dispatchEvent(new Event('gk-auth-changed'));});expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument();expect(beforeUnload()).toBe(false);
});
it('Jobs does not replace an open editor through New or Edit on another posting',async()=>{
 vi.mocked(jobs.fetchAllClubJobs).mockResolvedValue([{id:1,clubId:10,title:'Coach A',status:'OPEN'},{id:2,clubId:10,title:'Coach B',status:'OPEN'}]);setup('Jobs');fireEvent.click(await screen.findByRole('button',{name:'Edit Coach A'}));fireEvent.change(screen.getByLabelText('Role title'),{target:{value:'My edits'}});expect(screen.queryByRole('button',{name:'Edit Coach B'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'jobs.postJob'})).not.toBeInTheDocument();expect(screen.getByLabelText('Role title')).toHaveValue('My edits');
});

it('an in-flight photo upload stays attached to its draft after leaving and returning',async()=>{
 let finish!:(value:unknown)=>void;vi.mocked(apiClient.post).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}) as never);
 setup();fireEvent.click(await screen.findByRole('button',{name:'Add product'}));fireEvent.change(screen.getByLabelText('Product name'),{target:{value:'Photo draft'}});fireEvent.change(screen.getByLabelText('Add product photo (up to 8)'),{target:{files:[new File(['photo'],'photo.png',{type:'image/png'})]}});
 leave();back();expect(await screen.findByLabelText('Product name')).toBeDisabled();await act(async()=>finish({data:{url:'/api/media/44'}}));expect(await screen.findByAltText('Product photo 1')).toHaveAttribute('src','http://localhost:8080/api/media/44');expect(screen.getByLabelText('Product name')).toHaveValue('Photo draft');expect(screen.getByLabelText('Product name')).not.toBeDisabled();
});
it('campaign update completion is recorded even when its originating page has closed',async()=>{
 vi.mocked(campaigns.fetchManagedCampaigns).mockResolvedValue([campaign]);vi.mocked(campaigns.fetchManagedCampaign).mockResolvedValue(campaign);
 let finish!:(value:campaigns.Campaign)=>void;vi.mocked(campaigns.postCampaignUpdate).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 setup('Campaigns');fireEvent.click(await screen.findByRole('button',{name:'Updates for Pitch'}));fireEvent.change(await screen.findByLabelText('Update title'),{target:{value:'Milestone'}});fireEvent.change(screen.getByLabelText('Update message'),{target:{value:'Full update'}});fireEvent.submit(screen.getByLabelText('Update title').closest('form')!);leave();back();expect(await screen.findByLabelText('Update title')).toBeDisabled();leave();await act(async()=>finish({...campaign,version:4}));back();expect(await screen.findByText('Campaign update published.')).toBeInTheDocument();expect(screen.queryByLabelText('Update title')).not.toBeInTheDocument();expect(campaigns.postCampaignUpdate).toHaveBeenCalledTimes(1);expect(beforeUnload()).toBe(false);
});
it('a late save from a logged-out account cannot clear or change the next accounts draft',async()=>{
 let finish!:(value:never)=>void;vi.mocked(store.createStoreProduct).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}) as never);
 setup();fireEvent.click(await screen.findByRole('button',{name:'Add product'}));fireEvent.change(screen.getByLabelText('Product name'),{target:{value:'First account'}});fireEvent.change(screen.getByLabelText('Price'),{target:{value:'12.34'}});fireEvent.submit(screen.getByLabelText('Product name').closest('form')!);
 act(()=>{localStorage.removeItem('userId');window.dispatchEvent(new Event('gk-auth-changed'));localStorage.setItem('userId','66');window.dispatchEvent(new Event('gk-auth-changed'));});fireEvent.click(await screen.findByRole('button',{name:'Add product'}));fireEvent.change(screen.getByLabelText('Product name'),{target:{value:'Second account'}});await act(async()=>finish({id:3} as never));expect(screen.getByLabelText('Product name')).toHaveValue('Second account');expect(screen.getByRole('button',{name:'Save product'})).toBeEnabled();expect(beforeUnload()).toBe(true);
});

for (const feature of ['Store', 'Campaigns']) {
 it(`${feature} blocks an already-open discard confirmation until upload completes`, async () => {
  let finish!:(value:unknown)=>void;
  vi.mocked(apiClient.post).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}) as never);
  const isStore=feature==='Store', create=isStore?'Add product':'Create campaign', field=isStore?'Product name':'Campaign title';
  setup(feature);fireEvent.click(await screen.findByRole('button',{name:create}));
  fireEvent.change(screen.getByLabelText(field),{target:{value:'Original draft'}});
  fireEvent.click(screen.getByRole('button',{name:'Close editor'}));
  fireEvent.change(screen.getByLabelText(isStore?'Add product photo (up to 8)':'Add campaign photo (up to 8)'),{target:{files:[new File(['photo'],'photo.png',{type:'image/png'})]}});
  expect(screen.getByRole('button',{name:'Discard edits'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Discard edits'}));
  expect(screen.getByLabelText(field)).toHaveValue('Original draft');
  leave();back();expect(await screen.findByLabelText(field)).toBeDisabled();
  await act(async()=>finish({data:{url:'/api/media/original-photo'}}));
  expect(screen.getByAltText(isStore?'Product photo 1':'Campaign photo 1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Close editor'}));
  fireEvent.click(screen.getByRole('button',{name:'Discard edits'}));
  fireEvent.click(screen.getByRole('button',{name:create}));
  expect(screen.getByLabelText(field)).toHaveValue('');
  expect(screen.queryByAltText(isStore?'Product photo 1':'Campaign photo 1')).not.toBeInTheDocument();
 });
}
for(const c of cases.filter(c=>c.feature!=='Jobs')) {
 it(`${c.feature} blocks pending-save discard and permits discard after failure`,async()=>{
  let fail!:(error:Error)=>void;vi.mocked(c.api).mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;}) as never);
  setup(c.feature);fireEvent.click(await screen.findByRole('button',{name:c.create}));
  fireEvent.change(screen.getByLabelText(c.field),{target:{value:'Keep my work'}});
  fireEvent.click(screen.getByRole('button',{name:'Close editor'}));
  if(c.feature==='Store') fireEvent.change(screen.getByLabelText('Price'),{target:{value:'12.34'}});fireEvent.submit(screen.getByLabelText(c.field).closest('form')!);
  expect(screen.getByRole('button',{name:'Discard edits'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Discard edits'}));
  expect(screen.getByLabelText(c.field)).toHaveValue('Keep my work');
  await act(async()=>fail(new Error('Save failed')));
  expect(screen.getByRole('button',{name:'Discard edits'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Discard edits'}));
  expect(screen.queryByLabelText(c.field)).not.toBeInTheDocument();
 });
}
it('campaign update discard cannot interrupt a pending publish',async()=>{
 vi.mocked(campaigns.fetchManagedCampaigns).mockResolvedValue([campaign]);vi.mocked(campaigns.fetchManagedCampaign).mockResolvedValue(campaign);
 let fail!:(error:Error)=>void;vi.mocked(campaigns.postCampaignUpdate).mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;}));
 setup('Campaigns');fireEvent.click(await screen.findByRole('button',{name:'Updates for Pitch'}));
 fireEvent.change(await screen.findByLabelText('Update title'),{target:{value:'Milestone'}});fireEvent.change(screen.getByLabelText('Update message'),{target:{value:'Keep this update'}});
 fireEvent.click(screen.getByRole('button',{name:'Close updates'}));fireEvent.submit(screen.getByLabelText('Update title').closest('form')!);
 expect(screen.getByRole('button',{name:'Discard update'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Discard update'}));
 expect(screen.getByLabelText('Update message')).toHaveValue('Keep this update');
 await act(async()=>fail(new Error('Failed')));fireEvent.click(screen.getByRole('button',{name:'Discard update'}));expect(screen.queryByLabelText('Update message')).not.toBeInTheDocument();
});

it('retired form callbacks cannot write into a replacement form in the same scope',()=>{
 let lateWrite!:()=>void;
 function Form(){
  const [images,setImages]=useCommerceDraftState<string[]>('form:images',[]);
  return <><output aria-label="Images">{images.join(',')}</output><button onClick={()=>{lateWrite=()=>setImages(current=>[...current,'old-photo']);}}>Start delayed upload</button></>;
 }
 function Editor(){const clear=useClearCommerceForm();const [generation,setGeneration]=useState(0);return <><Form key={generation}/><button onClick={()=>{clear();setGeneration(n=>n+1);}}>Replace draft</button></>;}
 render(<CommerceDraftScope clubId={10} feature="retirement-test"><Editor/></CommerceDraftScope>);
 fireEvent.click(screen.getByRole('button',{name:'Start delayed upload'}));fireEvent.click(screen.getByRole('button',{name:'Replace draft'}));
 act(()=>lateWrite());expect(screen.getByLabelText('Images')).toHaveTextContent('');expect(screen.getByLabelText('Images')).not.toHaveTextContent('old-photo');
});

for(const action of ['close','delete']) {
 it(`Jobs ${action} stays pending through navigation and refreshes the returned list`,async()=>{
  let finish!:(value:never)=>void;const api=action==='close'?jobs.updateClubJob:jobs.deleteClubJob;
  vi.mocked(api).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}) as never);
  const job={id:1,clubId:10,title:'Coach',status:'OPEN',version:0};vi.mocked(jobs.fetchAllClubJobs).mockResolvedValue([job]);setup('Jobs');
  if(action==='close')fireEvent.click(await screen.findByRole('button',{name:'jobs.close'}));
  else {fireEvent.click(await screen.findByRole('button',{name:'Delete Coach'}));fireEvent.click(screen.getByRole('button',{name:'Confirm delete'}));}
  leave();expect(beforeUnload()).toBe(true);back();expect(await screen.findByRole('button',{name:'jobs.close'})).toBeDisabled();expect(api).toHaveBeenCalledTimes(1);
  vi.mocked(jobs.fetchAllClubJobs).mockResolvedValue(action==='close'?[{...job,status:'CLOSED',version:1}]:[]);
  await act(async()=>finish({} as never));
  await screen.findByText(action==='close'?'Posting closed.':'Posting deleted.');
  if(action==='close')expect(await screen.findByRole('button',{name:'jobs.reopen'})).toBeEnabled();
  else expect(screen.queryByRole('button',{name:'Delete Coach'})).not.toBeInTheDocument();
  expect(beforeUnload()).toBe(false);
 });
}
for(const feature of ['Store','Campaigns','Jobs']) {
 it(`${feature} retains action conflicts across navigation and a second remount`,async()=>{
  let fail!:(error:unknown)=>void;
  const api=feature==='Store'?store.deleteStoreProduct:feature==='Campaigns'?campaigns.changeCampaignState:jobs.updateClubJob;
  vi.mocked(api).mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;}) as never);
  vi.mocked(store.fetchAllClubStoreProducts).mockResolvedValue([{id:1,name:'Kit',active:true,version:0}]);
  vi.mocked(campaigns.fetchManagedCampaigns).mockResolvedValue([campaign]);
  vi.mocked(jobs.fetchAllClubJobs).mockResolvedValue([{id:1,title:'Coach',status:'OPEN',version:0}]);setup(feature);
  if(feature==='Store'){fireEvent.click(await screen.findByRole('button',{name:'Archive Kit'}));fireEvent.click(screen.getByRole('button',{name:'Confirm archive'}));}
  else fireEvent.click(await screen.findByRole('button',{name:feature==='Campaigns'?'Pause Pitch':'jobs.close'}));
  leave();back();await act(async()=>fail({response:{status:409,data:{error:'Changed by colleague'}}}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Changed by colleague');leave();back();expect(await screen.findByRole('alert')).toHaveTextContent('Changed by colleague');
 });
}
it('late action errors from a retired account do not enter the next account',async()=>{
 let fail!:(error:unknown)=>void;vi.mocked(jobs.updateClubJob).mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;}));
 vi.mocked(jobs.fetchAllClubJobs).mockResolvedValue([{id:1,title:'Coach',status:'OPEN',version:0}]);setup('Jobs');fireEvent.click(await screen.findByRole('button',{name:'jobs.close'}));
 act(()=>{localStorage.removeItem('userId');window.dispatchEvent(new Event('gk-auth-changed'));localStorage.setItem('userId','66');window.dispatchEvent(new Event('gk-auth-changed'));});
 await act(async()=>fail({response:{data:{error:'Private old result'}}}));expect(screen.queryByText('Private old result')).not.toBeInTheDocument();expect(beforeUnload()).toBe(false);
});

it('a retired save completion cannot clear the replacement form', () => {
 let completeOldSave!: () => void;
 function Editor() {
  const clear = useClearCommerceForm();
  const [text, setText] = useCommerceDraftState('form:text', '');
  const [, renderAgain] = useState(0);
  return <><input aria-label="Draft text" value={text} onChange={event => setText(event.target.value)}/>
   <button onClick={() => { completeOldSave = clear; }}>Start save</button>
   <button onClick={() => { clear(); renderAgain(n => n + 1); }}>Replace form</button></>;
 }
 render(<CommerceDraftScope clubId={10} feature="clear-retirement-test"><Editor/></CommerceDraftScope>);
 fireEvent.change(screen.getByLabelText('Draft text'), {target:{value:'First'}});
 fireEvent.click(screen.getByRole('button', {name:'Start save'}));
 fireEvent.click(screen.getByRole('button', {name:'Replace form'}));
 fireEvent.change(screen.getByLabelText('Draft text'), {target:{value:'Replacement'}});
 act(() => completeOldSave());
 // A remount reads the retained store, not the previous rendered snapshot.
 cleanup();
 render(<CommerceDraftScope clubId={10} feature="clear-retirement-test"><Editor/></CommerceDraftScope>);
 expect(screen.getByLabelText('Draft text')).toHaveValue('Replacement');
});

for (const feature of ['Store', 'Campaigns', 'Jobs']) {
 it(`${feature} shows the retained action conflict even when the return visit list fails`, async () => {
  let fail!: (error: unknown) => void;
  const api = feature === 'Store' ? store.deleteStoreProduct : feature === 'Campaigns' ? campaigns.changeCampaignState : jobs.updateClubJob;
  vi.mocked(api).mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }) as never);
  vi.mocked(store.fetchAllClubStoreProducts).mockResolvedValue([{id:1,name:'Kit',active:true,version:0}]);
  vi.mocked(campaigns.fetchManagedCampaigns).mockResolvedValue([campaign]);
  vi.mocked(jobs.fetchAllClubJobs).mockResolvedValue([{id:1,title:'Coach',status:'OPEN',version:0}]);
  setup(feature);
  if (feature === 'Store') {
   fireEvent.click(await screen.findByRole('button', {name:'Archive Kit'}));
   fireEvent.click(screen.getByRole('button', {name:'Confirm archive'}));
  } else fireEvent.click(await screen.findByRole('button', {name:feature === 'Campaigns' ? 'Pause Pitch' : 'jobs.close'}));
  leave();
  vi.mocked(store.fetchAllClubStoreProducts).mockRejectedValue(new Error('List unavailable'));
  vi.mocked(campaigns.fetchManagedCampaigns).mockRejectedValue(new Error('List unavailable'));
  vi.mocked(jobs.fetchAllClubJobs).mockRejectedValue(new Error('List unavailable'));
  await act(async () => fail({response:{status:409,data:{error:'This action conflicted with a colleague.'}}}));
  back();
  await screen.findByText(feature === 'Store' ? /Could not load products/ : feature === 'Campaigns' ? /Campaigns could not load/ : 'jobs.loadFailed');
  expect(await screen.findByText(/This action conflicted with a colleague/)).toBeInTheDocument();
  expect(beforeUnload()).toBe(false);
 });
}

it('Jobs shows successful completion even when the return visit list fails', async () => {
 let finish!: () => void;
 vi.mocked(jobs.updateClubJob).mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({id:1,title:'Coach',status:'CLOSED',version:1}); }));
 vi.mocked(jobs.fetchAllClubJobs).mockResolvedValue([{id:1,title:'Coach',status:'OPEN',version:0}]);
 setup('Jobs'); fireEvent.click(await screen.findByRole('button', {name:'jobs.close'})); leave();
 vi.mocked(jobs.fetchAllClubJobs).mockRejectedValue(new Error('List unavailable'));
 await act(async () => finish()); back();
 expect(await screen.findByText('Posting closed.')).toBeInTheDocument();
 expect(beforeUnload()).toBe(false);
});

for (const outcome of ['success', 'failure']) {
 it(`Campaign update loading retains its ${outcome} across navigation`, async () => {
  let finish!: () => void;
  vi.mocked(campaigns.fetchManagedCampaigns).mockResolvedValue([campaign]);
  vi.mocked(campaigns.fetchManagedCampaign).mockImplementationOnce(() => new Promise((resolve, reject) => {
   finish = () => outcome === 'success' ? resolve(campaign) : reject({response:{data:{error:'Updates are unavailable.'}}});
  }));
  setup('Campaigns'); fireEvent.click(await screen.findByRole('button', {name:'Updates for Pitch'}));
  leave(); back(); expect(await screen.findByRole('button', {name:'Updates for Pitch'})).toBeDisabled();
  await act(async () => finish());
  if (outcome === 'success') expect(await screen.findByLabelText('Update title')).toBeInTheDocument();
  else expect(await screen.findByRole('alert')).toHaveTextContent('Updates are unavailable.');
 });
}

for (const feature of ['Store', 'Campaigns']) {
 for (const outcome of ['success', 'failure']) {
  it(`${feature} ignores a retired account upload ${outcome} while the new draft is uploading`, async () => {
   let completeOld!: () => void, completeNew!: () => void;
   vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise((resolve, reject) => {
    completeOld = () => outcome === 'success' ? resolve({data:{url:'/api/media/old'}}) : reject({response:{data:{error:'Old upload failed'}}});
   }) as never).mockImplementationOnce(() => new Promise(resolve => { completeNew = () => resolve({data:{url:'/api/media/new'}}); }) as never);
   const create = feature === 'Store' ? 'Add product' : 'Create campaign';
   const field = feature === 'Store' ? 'Product name' : 'Campaign title';
   const photo = feature === 'Store' ? 'Product photo 1' : 'Campaign photo 1';
   const upload = () => fireEvent.change(screen.getByLabelText(feature === 'Store' ? 'Add product photo (up to 8)' : 'Add campaign photo (up to 8)'), {target:{files:[new File(['photo'],'photo.png',{type:'image/png'})]}});
   setup(feature); fireEvent.click(await screen.findByRole('button', {name:create})); upload();
   act(() => {localStorage.setItem('userId','66');window.dispatchEvent(new Event('gk-auth-changed'));});
   fireEvent.click(await screen.findByRole('button', {name:create}));
   fireEvent.change(screen.getByLabelText(field), {target:{value:'New account draft'}});upload();
   await act(async () => completeOld());
   expect(screen.getByLabelText(field)).toHaveValue('New account draft');
   expect(screen.getByLabelText(field)).toBeDisabled();
   expect(screen.queryByAltText(photo)).not.toBeInTheDocument();
   expect(screen.queryByText('Old upload failed')).not.toBeInTheDocument();
   await act(async () => completeNew());
   expect(screen.getByAltText(photo)).toHaveAttribute('src','http://localhost:8080/api/media/new');
   expect(screen.getByLabelText(field)).toBeEnabled();
  });
 }
}

it('campaign update loading cannot open its editor in a replacement account', async () => {
 let finish!: () => void;
 vi.mocked(campaigns.fetchManagedCampaigns).mockResolvedValue([campaign]);
 vi.mocked(campaigns.fetchManagedCampaign).mockImplementationOnce(() => new Promise(resolve => {finish = () => resolve(campaign);}));
 setup('Campaigns');fireEvent.click(await screen.findByRole('button',{name:'Updates for Pitch'}));
 act(() => {localStorage.setItem('userId','66');window.dispatchEvent(new Event('gk-auth-changed'));});
 fireEvent.click(await screen.findByRole('button',{name:'Create campaign'}));
 fireEvent.change(screen.getByLabelText('Campaign title'),{target:{value:'Replacement account draft'}});
 await act(async () => finish());
 expect(screen.queryByLabelText('Update title')).not.toBeInTheDocument();
 expect(screen.getByLabelText('Campaign title')).toHaveValue('Replacement account draft');
});
