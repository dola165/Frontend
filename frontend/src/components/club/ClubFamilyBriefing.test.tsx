import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { ClubFamilyBriefing } from './ClubFamilyBriefing';
const auth=vi.hoisted(()=>({sessionId:'one',status:'authenticated'}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn()}}));
beforeEach(()=>{vi.resetAllMocks();auth.sessionId='one';});
it('shows only linked squads at this club, with real changes and coach announcements',async()=>{
    vi.mocked(apiClient.get).mockImplementation(async url=>({data:url==='/parents/hub'?{children:[{userId:8,clubId:1,fullName:'Ana',squadNames:['U12']},{userId:9,clubId:2,fullName:'Other child',squadNames:['U16']}]}:url==='/squad-communication'?[{id:11,club_id:1,name:'U12'},{id:12,club_id:2,name:'U16'},{id:13,club_id:1,name:'Senior'}]:String(url).includes('/sessions?')?[{id:5,title:'Changed session',starts_at:'2099-01-01T18:00:00Z',ends_at:'2099-01-01T19:00:00Z',status:'CANCELLED',cancellation_reason:'Pitch closed',attendance:[]}]:[{id:6,title:'New meeting point',body:'Meet at the south gate.',created_at:'2026-09-30',important:true,acknowledgement_requested:true}]}));
    render(<MemoryRouter><ClubFamilyBriefing clubId={1}/></MemoryRouter>);
    expect(await screen.findByText('New meeting point')).toBeVisible();expect(screen.getByText('Cancelled · Pitch closed')).toBeVisible();
    expect(screen.queryByText('Other child')).not.toBeInTheDocument();expect(screen.queryByText('Senior')).not.toBeInTheDocument();
    expect(vi.mocked(apiClient.get).mock.calls.some(([url])=>String(url).startsWith('/squad-communication/12/'))).toBe(false);
    expect(screen.getByRole('link',{name:/Changed session/})).toHaveAttribute('href',expect.stringContaining('sessionId=5'));
});
it('drops private family information immediately when the authentication session changes',async()=>{
    let resolve:(data:unknown)=>void=()=>{};
    vi.mocked(apiClient.get).mockImplementation(url=>url==='/parents/hub'?new Promise(done=>{resolve=done;}):Promise.resolve({data:[]}));
    const view=render(<MemoryRouter><ClubFamilyBriefing clubId={1}/></MemoryRouter>);
    auth.sessionId='two';vi.mocked(apiClient.get).mockImplementation(async url=>({data:url==='/parents/hub'?{children:[]}:[]}));
    view.rerender(<MemoryRouter><ClubFamilyBriefing clubId={1}/></MemoryRouter>);
    await act(async()=>{resolve({data:{children:[{clubId:1,fullName:'Old family',squadNames:[]}]}});});
    await waitFor(()=>expect(screen.queryByText('Loading your family’s week…')).not.toBeInTheDocument());expect(screen.queryByText('Old family')).not.toBeInTheDocument();
});
