import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParentHubPage } from '../../../pages/ParentHubPage';
import { fetchJoiningChildren } from '../api';
import type { ChildDirectory, JoiningChild } from '../../joining-contract/types';
const auth = vi.hoisted(() => ({ user: { id: 7 }, sessionId: 'parent-session', isAuthenticated: true }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../api', () => ({ fetchJoiningChildren: vi.fn() }));
vi.mock('../FamilyRelationships', () => ({ FamilyRelationships: () => <p>Guardian tools</p> }));
vi.mock('../AddChild', () => ({ AddChild: ({onCreated}:{onCreated:(id:number)=>void}) => <button onClick={()=>onCreated(63)}>Create synthetic child</button> }));
vi.mock('../PlayerLinkCode', () => ({ PlayerLinkCode: () => null }));
vi.mock('../../players/PlayerIdentityEditor', () => ({ PlayerIdentityEditor: () => null }));
vi.mock('../FamilySchedule', () => ({ ChildSquadSchedule: ({child}:{child:{fullName:string;clubName:string}}) => <p>{child.fullName} schedule for {child.clubName}</p> }));
vi.mock('../../../utils/authStorage', () => ({getAuthSessionId:()=>auth.sessionId,isCurrentAuthSession:(id:string)=>id===auth.sessionId}));
vi.mock('../../squadCommunication/journeyCopy', () => ({useJourneyCopy:()=>((en:string)=>en)}));
const child=(playerId:number,name:string):JoiningChild=>({playerId,identity:{playerId,version:1,fullName:name,dateOfBirth:'2016-01-01',gender:null,photoUrl:null,positions:[],dominantFoot:null,heightCm:null,weightKg:null,canEdit:true,minor:true},clubs:[],cases:[],inquiries:[]});
const fixture=():ChildDirectory=>({children:[child(61,'Nika'),child(62,'Saba')]});
const show=(path='/parent')=>render(<MemoryRouter initialEntries={[path]}><ParentHubPage/></MemoryRouter>);
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();auth.user={id:7};auth.sessionId='parent-session';vi.mocked(fetchJoiningChildren).mockResolvedValue(fixture());});
afterEach(cleanup);
describe('Canonical Parent Hub selection',()=>{
    it('shows a child with no club and keeps their identity through group and map links',async()=>{
        show();expect(await screen.findByRole('button',{name:'Nika No club yet'})).toHaveAttribute('aria-pressed','true');
        expect(screen.getByRole('link',{name:'Find a club'})).toHaveAttribute('href','/map?player=61');
        expect(screen.getByRole('link',{name:'Explore the map'})).toHaveAttribute('href','/world?player=61');
        expect(screen.queryByText(/schedule for/)).not.toBeInTheDocument();
    });
    it('immediately selects a newly created child after directory refresh',async()=>{
        vi.mocked(fetchJoiningChildren).mockResolvedValueOnce(fixture()).mockResolvedValue({children:[...fixture().children,child(63,'New child')]});show();await screen.findByRole('button',{name:'Nika No club yet'});fireEvent.click(screen.getByRole('link',{name:'Player cards 2'}));fireEvent.click(screen.getByRole('button',{name:'Create synthetic child'}));
        expect(await screen.findByRole('button',{name:'New child No club yet'})).toHaveAttribute('aria-pressed','true');expect(screen.getByRole('link',{name:'Find a club'})).toHaveAttribute('href','/map?player=63');
    });
    it('keeps siblings separate and restores the selected identity after reload',async()=>{
        const first=show();fireEvent.click(await screen.findByRole('button',{name:'Saba No club yet'}));expect(screen.getByRole('link',{name:'Find a club'})).toHaveAttribute('href','/map?player=62');first.unmount();show();expect(await screen.findByRole('button',{name:'Saba No club yet'})).toHaveAttribute('aria-pressed','true');
    });
    it('does not turn several club contexts into duplicate children',async()=>{
        const data=fixture();data.children[0].clubs=[{clubId:1,clubName:'Dinamo',cardId:501,affiliationStatus:'ACTIVE',consentStatus:'CONFIRMED',squadNames:['U11']},{clubId:2,clubName:'Extra training',cardId:502,affiliationStatus:'ACTIVE',consentStatus:'CONFIRMED',squadNames:['Skills']}];vi.mocked(fetchJoiningChildren).mockResolvedValue(data);show();
        await screen.findByRole('button',{name:'Nika Dinamo · Extra training'});expect(screen.getAllByRole('button',{name:/Nika/})).toHaveLength(1);expect(screen.getByText('Nika schedule for Dinamo')).toBeVisible();expect(screen.getByText('Nika schedule for Extra training')).toBeVisible();
    });
    it('only offers club discovery to a child without a club, including while joining',async()=>{
        const data=fixture();data.children[0].clubs=[{clubId:1,clubName:'Dinamo',cardId:501,affiliationStatus:'ACTIVE',consentStatus:'CONFIRMED',squadNames:['U11']}];vi.mocked(fetchJoiningChildren).mockResolvedValue(data);show();
        await screen.findByRole('button',{name:'Nika Dinamo'});expect(screen.queryByRole('link',{name:'Find a club'})).not.toBeInTheDocument();expect(screen.getAllByRole('link',{name:'Open club & squads'})[0]).toHaveAttribute('href','/clubs/1?tab=teams&player=61');
        fireEvent.click(screen.getByRole('button',{name:'Saba No club yet'}));expect(screen.getByRole('link',{name:'Find a club'})).toHaveAttribute('href','/map?player=62');expect(screen.queryByText('Nika schedule for Dinamo')).not.toBeInTheDocument();
    });
    it('shows consent review instead of discovery while a club connection is pending',async()=>{
        const data=fixture();data.children[0].clubs=[{clubId:1,clubName:'Dinamo',cardId:501,affiliationStatus:'TRIALIST',consentStatus:'PENDING',squadNames:['U11']}];vi.mocked(fetchJoiningChildren).mockResolvedValue(data);show();
        expect(await screen.findByRole('link',{name:'Review club consent'})).toHaveAttribute('href','/parent?tab=connections&player=61');expect(screen.queryByRole('link',{name:'Find a club'})).not.toBeInTheDocument();expect(screen.queryByText(/schedule for/)).not.toBeInTheDocument();
    });
    it('rejects an unauthorized selected identity from a stale URL',async()=>{
        show('/parent?player=999');await screen.findByRole('button',{name:'Nika No club yet'});expect(screen.getByRole('link',{name:'Find a club'})).toHaveAttribute('href','/map?player=61');
    });
    it('distinguishes an empty directory from a failed request and supports retry',async()=>{
        vi.mocked(fetchJoiningChildren).mockRejectedValueOnce(new Error('Failed')).mockResolvedValueOnce({children:[]});show();await screen.findByRole('alert');expect(screen.queryByText('Start your child’s football journey')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(await screen.findByText('Start your child’s football journey')).toBeVisible();
    });
    it('ignores a response from a previous account',async()=>{
        let finish!:(data:ChildDirectory)=>void;vi.mocked(fetchJoiningChildren).mockReturnValueOnce(new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce({children:[]});const first=show();auth.user={id:8};auth.sessionId='other-session';first.rerender(<MemoryRouter><ParentHubPage/></MemoryRouter>);await screen.findByText('Start your child’s football journey');await act(async()=>finish(fixture()));expect(screen.queryByRole('button',{name:'Nika No club yet'})).not.toBeInTheDocument();
    });
});
