import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerIdentityEditor } from './PlayerIdentityEditor';
import { fetchPlayerIdentity, savePlayerIdentity, uploadPlayerPhoto } from '../joining-contract/api';
import type { PlayerIdentity } from '../joining-contract/types';
const auth=vi.hoisted(()=>({user:{id:7},sessionId:'identity-session'}));
vi.mock('../../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../../utils/authStorage',()=>({getAuthSessionId:()=>auth.sessionId,isCurrentAuthSession:(session:string)=>session===auth.sessionId}));
vi.mock('../squadCommunication/journeyCopy',()=>({useJourneyCopy:()=>((en:string)=>en)}));
vi.mock('../joining-contract/api',()=>({fetchPlayerIdentity:vi.fn(),savePlayerIdentity:vi.fn(),uploadPlayerPhoto:vi.fn()}));
vi.mock('../../components/ui/MediaImage',()=>({MediaImage:(props:React.ImgHTMLAttributes<HTMLImageElement>)=><img {...props}/>}));
const identity=():PlayerIdentity=>({playerId:61,version:3,fullName:'Synthetic child',dateOfBirth:'2016-05-01',gender:null,photoUrl:null,positions:[],dominantFoot:null,heightCm:null,weightKg:null,canEdit:true,minor:true});
const show=(onSaved=vi.fn())=>render(<MemoryRouter><PlayerIdentityEditor playerId={61} onSaved={onSaved}/></MemoryRouter>);
beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();vi.mocked(fetchPlayerIdentity).mockResolvedValue(identity());vi.mocked(savePlayerIdentity).mockImplementation(async(id,body)=>({...body,playerId:id,version:4,canEdit:true,minor:true}));});
afterEach(cleanup);
describe('Shared private player identity',()=>{
    it('saves minimal identity with empty optional football details',async()=>{
        const saved=vi.fn();show(saved);await screen.findByLabelText('Full name');fireEvent.click(screen.getByRole('button',{name:'Save player card'}));await waitFor(()=>expect(saved).toHaveBeenCalledOnce());expect(savePlayerIdentity).toHaveBeenCalledWith(61,{requestId:expect.any(String),expectedVersion:3,fullName:'Synthetic child',dateOfBirth:'2016-05-01',gender:null,photoUrl:null,positions:[],dominantFoot:null,heightCm:null,weightKg:null},'identity-session');
    });
    it('shares optional positions, foot and measurements with explicit cm/kg units',async()=>{
        show();await screen.findByLabelText('Full name');fireEvent.click(screen.getByLabelText('Left winger'));fireEvent.click(screen.getByLabelText('Striker'));fireEvent.change(screen.getByLabelText('Dominant foot'),{target:{value:'LEFT'}});fireEvent.change(screen.getByLabelText('Height (cm)'),{target:{value:'145.5'}});fireEvent.change(screen.getByLabelText('Weight (kg)'),{target:{value:'38.2'}});fireEvent.click(screen.getByRole('button',{name:'Save player card'}));await waitFor(()=>expect(savePlayerIdentity).toHaveBeenCalledWith(61,expect.objectContaining({positions:['LW','ST'],dominantFoot:'LEFT',heightCm:145.5,weightKg:38.2}),'identity-session'));
    });
    it('allows an optional private photo for a younger child and saves its owned upload reference',async()=>{
        vi.mocked(uploadPlayerPhoto).mockResolvedValue({url:'/uploads/private-owned.jpg'});show();const input=await screen.findByLabelText('Private player photo');const file=new File(['synthetic bytes'],'photo.jpg',{type:'image/jpeg'});fireEvent.change(input,{target:{files:[file]}});await screen.findByRole('img',{name:'Player photo'});expect(uploadPlayerPhoto).toHaveBeenCalledWith(file,'identity-session',expect.any(AbortSignal));fireEvent.click(screen.getByRole('button',{name:'Save player card'}));await waitFor(()=>expect(savePlayerIdentity).toHaveBeenCalledWith(61,expect.objectContaining({photoUrl:'/uploads/private-owned.jpg'}),'identity-session'));
    });
    it('rejects unsupported files before sending an upload',async()=>{
        show();fireEvent.change(await screen.findByLabelText('Private player photo'),{target:{files:[new File(['text'],'document.txt',{type:'text/plain'})]}});expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPG, PNG or WebP photo');expect(uploadPlayerPhoto).not.toHaveBeenCalled();
    });
    it('respects read-only identity authorization',async()=>{
        vi.mocked(fetchPlayerIdentity).mockResolvedValue({...identity(),canEdit:false});show();expect(await screen.findByText(/managed by the player or their current guardian/)).toBeVisible();expect(screen.queryByRole('button',{name:'Save player card'})).not.toBeInTheDocument();expect(savePlayerIdentity).not.toHaveBeenCalled();
    });
    it('retries an interrupted save after remount with exactly the original body and receipt',async()=>{
        vi.mocked(savePlayerIdentity).mockRejectedValueOnce(new Error('Lost reply')).mockResolvedValue(identity());const first=show();await screen.findByLabelText('Full name');fireEvent.click(screen.getByRole('button',{name:'Save player card'}));await screen.findByRole('alert');const original=vi.mocked(savePlayerIdentity).mock.calls[0][1];first.unmount();vi.mocked(fetchPlayerIdentity).mockResolvedValue({...identity(),version:4});show();fireEvent.click(await screen.findByRole('button',{name:'Retry saved update'}));await waitFor(()=>expect(savePlayerIdentity).toHaveBeenCalledTimes(2));expect(vi.mocked(savePlayerIdentity).mock.calls[1][1]).toEqual(original);
    });
    it('does not close a sibling editor when a previous player’s save replies late',async()=>{
        let finish!:(value:PlayerIdentity)=>void;vi.mocked(savePlayerIdentity).mockReturnValue(new Promise(resolve=>{finish=resolve;}));const saved=vi.fn();const first=show(saved);await screen.findByLabelText('Full name');fireEvent.click(screen.getByRole('button',{name:'Save player card'}));vi.mocked(fetchPlayerIdentity).mockResolvedValue({...identity(),playerId:62,fullName:'Sibling'});first.rerender(<MemoryRouter><PlayerIdentityEditor playerId={62} onSaved={saved}/></MemoryRouter>);await screen.findByDisplayValue('Sibling');await act(async()=>finish(identity()));expect(saved).not.toHaveBeenCalled();expect(screen.getByDisplayValue('Sibling')).toBeVisible();
    });
    it('does not show a private upload returned after switching to another player',async()=>{
        let finish!:(value:{url:string})=>void;vi.mocked(uploadPlayerPhoto).mockReturnValue(new Promise(resolve=>{finish=resolve;}));const first=show();fireEvent.change(await screen.findByLabelText('Private player photo'),{target:{files:[new File(['photo'],'photo.jpg',{type:'image/jpeg'})]}});vi.mocked(fetchPlayerIdentity).mockResolvedValue({...identity(),playerId:62,fullName:'Sibling'});first.rerender(<MemoryRouter><PlayerIdentityEditor playerId={62}/></MemoryRouter>);await screen.findByDisplayValue('Sibling');await act(async()=>finish({url:'/uploads/previous-child.jpg'}));expect(screen.queryByRole('img',{name:'Player photo'})).not.toBeInTheDocument();
    });
});
