import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExistingClubGroups } from './ExistingClubGroups';
import { fetchClubJoiningOptions } from '../../joining-contract/api';
vi.mock('../../joining-contract/api',()=>({fetchClubJoiningOptions:vi.fn()}));
vi.mock('../../squadCommunication/journeyCopy',()=>({useJourneyCopy:()=>((en:string)=>en)}));
afterEach(cleanup);
describe('Existing club squad discovery',()=>{
    it('keeps the same child and squad when asking about an unconfigured existing group',async()=>{
        vi.mocked(fetchClubJoiningOptions).mockResolvedValue({clubId:1,organizationId:3,options:[{squadId:12,squadName:'Dinamo U11',programmeIds:[2],opportunity:null,availability:'ENQUIRY_ONLY',destination:null}]});render(<MemoryRouter><ExistingClubGroups clubId={1} playerId={61}/></MemoryRouter>);expect(await screen.findByRole('link',{name:'Ask about this group'})).toHaveAttribute('href','/admissions/organizations/3/inquire?squad=12&player=61');expect(screen.queryByText('No mandatory charges')).not.toBeInTheDocument();
    });
    it('keeps a standalone programme actionable without inventing a squad',async()=>{
        vi.mocked(fetchClubJoiningOptions).mockResolvedValue({clubId:1,organizationId:3,options:[{squadId:null,squadName:'Beginner introduction',programmeIds:[4],opportunity:null,availability:'ENQUIRY_ONLY',destination:null}]});render(<MemoryRouter><ExistingClubGroups clubId={1} playerId={61}/></MemoryRouter>);expect(await screen.findByRole('link',{name:'Ask about this group'})).toHaveAttribute('href','/admissions/organizations/3/inquire?programme=4&player=61');
    });
    it('shows unavailable groups truthfully while allowing a question',async()=>{
        vi.mocked(fetchClubJoiningOptions).mockResolvedValue({clubId:1,organizationId:3,options:[{squadId:12,squadName:'Dinamo U11',programmeIds:[],opportunity:null,availability:'CLOSED',destination:null}]});render(<MemoryRouter><ExistingClubGroups clubId={1}/></MemoryRouter>);expect(await screen.findByText('Currently unavailable')).toBeVisible();expect(screen.queryByRole('button',{name:/enroll|apply/i})).not.toBeInTheDocument();
    });
});
