import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { ClubOpportunitySpotlight } from './ClubOpportunitySpotlight';
import {useClubOpportunityPreview} from './useClubOpportunityPreview';
const auth = vi.hoisted(() => ({ sessionId: 'one', status: 'authenticated' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
const View = () => <ClubOpportunitySpotlight clubId={1} items={useClubOpportunityPreview(1)}/>;
beforeEach(() => { vi.clearAllMocks(); auth.sessionId='one'; });
it('shows actual previews and keeps each destination available when one source fails', async () => {
    vi.mocked(apiClient.get).mockImplementation(async url => {
        if (String(url).startsWith('/campaigns')) throw Error('offline');
        return { data: String(url).includes('/store/') ? { content: [{ id: 8, name: 'Training shirt', price: 45, currency: 'GEL' }], totalElements: 4 } : [{ id: 9, title: 'Matchday coordinator', engagementType: 'VOLUNTEER' }] };
    });
    render(<MemoryRouter><View/></MemoryRouter>);
    expect(await screen.findByRole('link',{name:/Training shirt/})).toHaveAttribute('href','/store/products/8');
    expect(await screen.findByRole('link',{name:/Matchday coordinator/})).toHaveAttribute('href','/jobs/9');
    expect(screen.getByText('4 products')).toBeVisible();
    expect(screen.getByText('Currently unavailable')).toBeVisible();
    expect(screen.getByRole('link',{name:'Explore campaigns'})).toHaveAttribute('href','/clubs/1/campaigns');
    vi.mocked(apiClient.get).mockResolvedValue({data:{content:[],totalElements:0}});
    fireEvent.click(screen.getByRole('button',{name:'Try again'}));
    await waitFor(()=>expect(screen.queryByText('Currently unavailable')).not.toBeInTheDocument());
    expect(screen.queryByRole('link',{name:'Explore campaigns'})).not.toBeInTheDocument();
});
it('does not display a previous session’s late opportunity response', async () => {
    let finish:(data:unknown)=>void=()=>{};
    vi.mocked(apiClient.get).mockImplementation(url=>String(url).includes('/store/')?new Promise(resolve=>{finish=resolve;}):Promise.resolve({data:[]}));
    const view=render(<MemoryRouter><View/></MemoryRouter>);
    auth.sessionId='two';
    vi.mocked(apiClient.get).mockImplementation(async url=>({data:String(url).includes('/jobs')?[]:{content:[],totalElements:0}}));
    view.rerender(<MemoryRouter><View/></MemoryRouter>);
    await act(async()=>{finish({data:{content:[{id:8,name:'Old product'}],totalElements:1}});});
    expect(screen.queryByText('Old product')).not.toBeInTheDocument();
});

it('shows multiple products, reported campaign progress and useful role facts with individual previews', async () => {
    vi.mocked(apiClient.get).mockImplementation(async url => ({data: String(url).includes('/store/') ? {content:[{id:1,name:'Scarf',price:35,currency:'GEL'},{id:2,name:'Club membership',price:40,currency:'GEL'},{id:3,name:'Summer camp',price:250,currency:'GEL'}],totalElements:10}
        : String(url).startsWith('/campaigns') ? {content:[{id:4,title:'Boot library',summary:'Equipment for everyone',goalAmount:5000,reportedAmount:1800,currency:'GEL',endsOn:'2026-11-01',images:[]}],totalElements:1}
        : [{id:5,title:'Academy coach',category:'COACHING',engagementType:'VOLUNTEER',requiredRole:'COACH',ageGroup:'U12'}]}));
    render(<MemoryRouter><View/></MemoryRouter>);
    for (const [name,id] of [['Scarf',1],['Club membership',2],['Summer camp',3]] as const) expect(await screen.findByRole('link',{name:new RegExp(name)})).toHaveAttribute('href',`/store/products/${id}`);
    expect(screen.getByRole('progressbar',{name:'Club-reported progress'})).toHaveAttribute('value','36');
    expect(screen.getByText(/1,800.00 reported by the club/)).toBeVisible();
    expect(screen.getByText('Ongoing volunteer role')).toBeVisible();
    expect(screen.getByText('In-app application')).toBeVisible();
    expect(screen.getByRole('link',{name:/Boot library/})).toHaveAttribute('href','/campaigns/4');
    expect(screen.getByRole('link',{name:/Academy coach/})).toHaveAttribute('href','/jobs/5');
});
