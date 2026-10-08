import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { RepresentationPanel } from './RepresentationPanel';

vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn(),post:vi.fn(),patch:vi.fn()}}));
vi.mock('../../context/AuthContext',()=>({useAuth:vi.fn()}));

const legacy={id:91,recordKey:'representation:91:3',recordType:'RECORDED_CONNECTION',agent_user_id:7,player_user_id:8,requested_by:null,representation_type:'FULL',message:'',status:'ACTIVE',agent_name:'Agent Ada',player_name:'Player Pia',canRespond:false,representation_id:91,representation_generation:3,recordedConnection:true};
const endedLegacy={...legacy,recordKey:'representation:91:1',status:'ENDED',representation_generation:1};
const history={id:41,recordKey:'request:41',recordType:'REQUEST',agent_user_id:7,player_user_id:8,requested_by:7,representation_type:'LIMITED',message:'Historic proposal',status:'CANCELLED',agent_name:'Agent Ada',player_name:'Player Pia',canRespond:false,representation_id:null,representation_generation:null,recordedConnection:false};

describe('RepresentationPanel lifecycle',()=>{
    beforeEach(()=>{
        vi.clearAllMocks();
        vi.mocked(useAuth).mockReturnValue({sessionId:'player-session',status:'authenticated',user:{id:8,role:'PLAYER',username:'pia'}} as ReturnType<typeof useAuth>);
        vi.mocked(apiClient.get).mockImplementation((url:string,config?:{params?:{page?:number;generation?:number}})=>Promise.resolve({data:url.endsWith('/history')?{items:config?.params?.page===1?[{...history,id:40,recordKey:'request:40',message:'Older proposal'}]:[history],page:config?.params?.page??0,size:50,total:51,hasMore:(config?.params?.page??0)===0}:url.includes('/representations/91')?endedLegacy:[legacy,history]}));
        vi.mocked(apiClient.patch).mockResolvedValue({data:{...legacy,status:'FORMER'}});
    });

    it('explains and ends a recorded legacy connection with its inspected generation',async()=>{
        render(<MemoryRouter><RepresentationPanel profileId={8} own roles={['PLAYER']}/></MemoryRouter>);
        expect(await screen.findByText(/does not verify contract terms or legal authority/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button',{name:'End representation'}));
        fireEvent.click(screen.getByRole('button',{name:'Confirm end'}));
        await waitFor(()=>expect(apiClient.patch).toHaveBeenCalledWith('/representation-requests/representations/91',{action:'END',expectedGeneration:3}));
    });

    it('pages older outcomes independently from live connections',async()=>{
        render(<MemoryRouter><RepresentationPanel profileId={8} own roles={['PLAYER']}/></MemoryRouter>);
        const load=await screen.findByRole('button',{name:'Load older history'});
        fireEvent.click(load);
        expect(await screen.findByText('Older proposal')).toBeInTheDocument();
        expect(apiClient.get).toHaveBeenCalledWith('/representation-requests/history',expect.objectContaining({params:{page:1,size:50}}));
    });

    it('focuses the exact representation linked by a notification',async()=>{
        render(<MemoryRouter initialEntries={['/profile/8?representationRecord=91&representationGeneration=3']}><RepresentationPanel profileId={8} own roles={['PLAYER']}/></MemoryRouter>);
        const cards=await screen.findAllByText('Agent Ada');
        const active=cards.find(item=>item.closest('article')?.id==='representation-representation-91-3');
        await waitFor(()=>expect(active?.closest('article')).toHaveFocus());
    });

    it('fetches an exact older generation once when it is beyond the loaded history',async()=>{
        render(<MemoryRouter initialEntries={['/profile/8?representationRecord=91&representationGeneration=1']}><RepresentationPanel profileId={8} own roles={['PLAYER']}/></MemoryRouter>);
        await waitFor(()=>expect(document.getElementById('representation-representation-91-1')).toHaveFocus());
        expect(document.getElementById('representation-representation-91-1')).toHaveTextContent('Ended');
        const direct=vi.mocked(apiClient.get).mock.calls.filter(([url])=>url==='/representation-requests/representations/91');
        expect(direct).toHaveLength(1);
        expect(direct[0]?.[1]).toEqual(expect.objectContaining({params:{generation:1}}));
    });

    it('uses an already-loaded accepted-request outcome for a representation-generation link',async()=>{
        const acceptedEnd={...history,id:42,recordKey:'request:42',status:'ENDED',representation_id:91,representation_generation:1};
        vi.mocked(apiClient.get).mockImplementation((url:string)=>Promise.resolve({data:url.endsWith('/history')?{items:[acceptedEnd],page:0,size:50,total:1,hasMore:false}:[legacy,acceptedEnd]}));
        render(<MemoryRouter initialEntries={['/profile/8?representationRecord=91&representationGeneration=1']}><RepresentationPanel profileId={8} own roles={['PLAYER']}/></MemoryRouter>);
        await waitFor(()=>expect(document.getElementById('representation-request-42')).toHaveFocus());
        expect(vi.mocked(apiClient.get).mock.calls.filter(([url])=>url==='/representation-requests/representations/91')).toHaveLength(0);
    });

    it('lets an agent end a protected record without rendering the player identity',async()=>{
        const protectedRecord={...legacy,player_user_id:null,player_name:null,protectedIdentity:true};
        vi.mocked(useAuth).mockReturnValue({sessionId:'agent-session',status:'authenticated',user:{id:7,role:'AGENT',username:'ada'}} as ReturnType<typeof useAuth>);
        vi.mocked(apiClient.get).mockImplementation((url:string)=>Promise.resolve({data:url.endsWith('/history')?{items:[],page:0,size:50,total:0,hasMore:false}:[protectedRecord]}));
        render(<MemoryRouter><RepresentationPanel profileId={7} own roles={['AGENT']}/></MemoryRouter>);
        expect(await screen.findByText('Protected recorded connection')).toBeInTheDocument();
        expect(screen.queryByText('Player Pia')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button',{name:'End representation'}));
        fireEvent.click(screen.getByRole('button',{name:'Confirm end'}));
        await waitFor(()=>expect(apiClient.patch).toHaveBeenCalledWith('/representation-requests/representations/91',{action:'END',expectedGeneration:3}));
    });
});
