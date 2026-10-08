import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerLinkCode } from '../PlayerLinkCode';
import { createPlayerLinkCode } from '../../joining-contract/api';
import type { JoiningChild } from '../../joining-contract/types';
const auth=vi.hoisted(()=>({user:{id:7},sessionId:'code-session'}));
vi.mock('../../../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../../../utils/authStorage',()=>({getAuthSessionId:()=>auth.sessionId,isCurrentAuthSession:(session:string)=>session===auth.sessionId}));
vi.mock('../../squadCommunication/journeyCopy',()=>({useJourneyCopy:()=>((en:string)=>en)}));
vi.mock('../../joining-contract/api',()=>({createPlayerLinkCode:vi.fn()}));
const child=():JoiningChild=>({playerId:61,identity:{playerId:61,version:1,fullName:'Synthetic child',dateOfBirth:'2016-05-01',gender:null,photoUrl:null,positions:[],dominantFoot:null,heightCm:null,weightKg:null,canEdit:true,minor:true},clubs:[{clubId:1,clubName:'FC Dinamo Tbilisi Academy',cardId:501,affiliationStatus:'ACTIVE',consentStatus:'CONFIRMED',squadNames:[]}],cases:[],inquiries:[]});
const show=()=>render(<MemoryRouter><PlayerLinkCode child={child()}/></MemoryRouter>);
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();vi.mocked(createPlayerLinkCode).mockResolvedValue({id:9,code:'SYNTHETIC-SECRET',expiresAt:'2026-10-11T10:00:00Z',clubId:null});});
afterEach(cleanup);
describe('Parent offline linking code',()=>{
    it('creates a club-scoped code without ending another participation or accepting terms',async()=>{
        show();fireEvent.click(screen.getByText('Spoken to a club? Share a linking code'));fireEvent.change(screen.getByLabelText('Who can use this code?'),{target:{value:'1'}});fireEvent.click(screen.getByRole('button',{name:'Create linking code'}));await screen.findByLabelText('Linking code');expect(createPlayerLinkCode).toHaveBeenCalledWith(61,{requestId:expect.any(String),clubId:1},'code-session');expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
    it('does not persist the returned secret in browser storage',async()=>{
        show();fireEvent.click(screen.getByText('Spoken to a club? Share a linking code'));fireEvent.click(screen.getByRole('button',{name:'Create linking code'}));await screen.findByLabelText('Linking code');expect(JSON.stringify({...sessionStorage})).not.toContain('SYNTHETIC-SECRET');expect(JSON.stringify({...localStorage})).not.toContain('SYNTHETIC-SECRET');
    });
    it('replays the original creation receipt after an interrupted response and reload',async()=>{
        vi.mocked(createPlayerLinkCode).mockRejectedValueOnce(new Error('Lost reply')).mockResolvedValue({id:9,code:'SYNTHETIC-SECRET',expiresAt:'2026-10-11T10:00:00Z',clubId:null});const first=show();fireEvent.click(screen.getByText('Spoken to a club? Share a linking code'));fireEvent.click(screen.getByRole('button',{name:'Create linking code'}));await screen.findByRole('alert');const request=vi.mocked(createPlayerLinkCode).mock.calls[0][1];first.unmount();show();fireEvent.click(screen.getByText('Spoken to a club? Share a linking code'));fireEvent.click(screen.getByRole('button',{name:'Retry code creation'}));await waitFor(()=>expect(createPlayerLinkCode).toHaveBeenCalledTimes(2));expect(vi.mocked(createPlayerLinkCode).mock.calls[1][1]).toEqual(request);
    });
});
