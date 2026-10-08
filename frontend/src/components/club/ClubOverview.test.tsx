import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ClubOverview } from './ClubOverview';
import { ClubProfileStickyHeader } from './ClubProfileStickyHeader';
import type { ClubProfile } from '../../pages/ClubProfilePage';
import type { NavigationCapabilities } from '../../context/navigationCapabilities';
import { apiClient } from '../../api/axiosConfig';
const auth=vi.hoisted(()=>({sessionId:'one',status:'authenticated',user:{id:7,role:'FAN',navigationCapabilities:{version:1,workspaces:[]} as NavigationCapabilities}}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn()}}));
vi.mock('./ClubPresentation',()=>({ClubSponsors:()=>null}));
vi.mock('./ClubOpportunities',()=>({ClubOpportunities:()=>null}));
const club={id:1,name:'Dinamo',presentation:{programmes:[],sponsors:[],affiliations:[]}} as unknown as ClubProfile;
const cap=(id:string,type='user',target=7)=>({id,context:{type,id:target,label:'Dinamo'}});
const renderOverview=(entry={})=>render(<MemoryRouter><ClubOverview club={club} entry={entry}/></MemoryRouter>);
beforeEach(()=>{
    vi.resetAllMocks();auth.sessionId='one';auth.user.role='FAN';auth.user.navigationCapabilities={version:1,workspaces:[]};
    vi.mocked(apiClient.get).mockImplementation(async (url)=>({data:String(url).includes('/posts/')?{posts:[]}:String(url).includes('/schedule/')?{events:[]}:[]}));
});
it.each(['OWNER','COACH','PARENT','REFEREE','AGENT','PLAYER','ORGANIZER','VENUE_MANAGER','CLUB_STAFF','FAN'])('does not turn the %s identity into a management permission',async role=>{
    auth.user.role=role;renderOverview();await screen.findByText('The next chapter starts here.');
    expect(screen.queryByRole('link',{name:'Open club workspace'})).not.toBeInTheDocument();
    expect(screen.queryByRole('link',{name:'Staff & responsibilities'})).not.toBeInTheDocument();
});
it('keeps all approved personal responsibilities next to the club without granting leadership',async()=>{
    auth.user.navigationCapabilities={version:1,workspaces:[cap('club.member','club',1),cap('referee.workspace'),cap('agent.hub'),cap('parent.hub')]};
    renderOverview({canOpenWorkspace:true});
    expect(screen.getByRole('link',{name:'Open club workspace'})).toHaveAttribute('href','/clubs/1/workspace');
    for(const name of ['Referee workspace','Agent Hub','Parent Hub'])expect(screen.getByRole('link',{name})).toBeVisible();
    expect(screen.queryByRole('link',{name:'Staff & responsibilities'})).not.toBeInTheDocument();
    await screen.findByText('The next chapter starts here.');
});
it('distinguishes an invitation from active work and removes revoked actions',async()=>{
    const view=renderOverview({canOpenWorkspace:true,canManageStaff:true,invitationOnly:true});
    expect(screen.getByRole('link',{name:'Review invitation'})).toBeVisible();
    expect(screen.queryByRole('link',{name:'Staff & responsibilities'})).not.toBeInTheDocument();
    view.rerender(<MemoryRouter><ClubOverview club={club} entry={null}/></MemoryRouter>);
    expect(screen.queryByRole('link',{name:'Review invitation'})).not.toBeInTheDocument();await screen.findByText('The next chapter starts here.');
});
it('uses real destinations for club essentials and preserves the Posts tab',async()=>{
    renderOverview();await screen.findByText('The next chapter starts here.');
    await waitFor(()=>expect(apiClient.get).toHaveBeenCalledWith('/clubs/1/facilities',expect.anything()));
    expect(screen.getByRole('link',{name:/Venues & facilities/})).toHaveAttribute('href','/clubs/1?tab=facilities');
    expect(screen.getByRole('link',{name:'All posts'})).toHaveAttribute('href','/clubs/1?tab=posts');
    render(<ClubProfileStickyHeader activeTab="posts" onTabChange={vi.fn()} club={club}/>);
    const tabs=screen.getByRole('navigation',{name:'Club sections'}).querySelectorAll('button');
    expect(tabs[0]).toHaveTextContent('Overview');expect(tabs[1]).toHaveTextContent('Posts');expect(tabs[1]).toHaveAttribute('aria-current','page');
});
it('isolates a failed request and recovers without showing an empty success state',async()=>{
    vi.mocked(apiClient.get).mockImplementation(async url=>{if(String(url).includes('/posts/'))throw Error('offline');return {data:String(url).includes('/schedule/')?{events:[]}:[]};});
    renderOverview();expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t be loaded');expect(screen.queryByText('The next chapter starts here.')).not.toBeInTheDocument();
    vi.mocked(apiClient.get).mockResolvedValue({data:{posts:[]}});fireEvent.click(screen.getByRole('button',{name:'Try again'}));await screen.findByText('The next chapter starts here.');
});
it('drops old responses on session change',async()=>{
    let resolveOld:(value:unknown)=>void=()=>{};
    vi.mocked(apiClient.get).mockImplementation(url=>String(url).includes('/posts/')?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve({data:String(url).includes('/schedule/')?{events:[]}:[]}));
    const view=renderOverview();auth.sessionId='two';vi.mocked(apiClient.get).mockResolvedValue({data:{posts:[],events:[]}});
    view.rerender(<MemoryRouter><ClubOverview club={club}/></MemoryRouter>);
    await act(async()=>{resolveOld({data:{posts:[{id:9,content:'Old private content'}]}});});
    expect(screen.queryByText('Old private content')).not.toBeInTheDocument();
});
