import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {apiClient} from '../../api/axiosConfig';
import {SessionRegister} from './SessionRegister';
import {RecordDetail} from './RecordDetail';
import type {Bootstrap,Definition,OperationRecord} from './api';

vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn(),post:vi.fn(),put:vi.fn()}}));
const definition:Definition={module:'ATTENDANCE',kind:'ATTENDANCE',label:'Attendance and collection',states:['EXPECTED','ARRIVED','COLLECTED','ABSENT','CANCELLED'],fields:[]};
const boot:Bootstrap={clubId:1,clubName:'FC Dinamo Tbilisi Academy',actorId:7,leadership:false,definitions:[definition],specialisations:[],permissions:[],settings:{setting:'CLUB_ACADEMY',playing_level:'AMATEUR',enabled_modules:['ATTENDANCE'],revision:0},modules:[{id:'ATTENDANCE',writable:true,globalWrite:false,writeSquads:[2]}],squads:[{id:2,name:'U12'}],people:[{id:4,name:'Synthetic player'}],peopleBySquad:[{id:4,squad_id:2}],staff:[],guardians:[],events:[],sessions:[{id:9,title:'Training',squad_id:2,squad_name:'U12',starts_at:'2026-10-03T14:00:00Z'}],links:[],venues:[]};
const collected:OperationRecord={id:18,club_id:1,module:'ATTENDANCE',kind:'ATTENDANCE',title:'Synthetic attendance',status:'COLLECTED',revision:2,squad_id:2,subject_user_id:4,assigned_user_id:null,event_id:null,session_id:9,related_record_id:null,due_on:null,data:{collector:'Old collector'},canEdit:false,transitions:['EXPECTED'],created_at:'2026-10-03T14:00:00Z',updated_at:'2026-10-03T14:00:00Z'};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(apiClient.get).mockResolvedValue({data:[collected]});});afterEach(cleanup);

it('uses the offered correction route on the existing collected record and sends its current revision and reason',async()=>{
    vi.mocked(apiClient.post).mockResolvedValue({data:{...collected,status:'EXPECTED',revision:3,data:{},canEdit:true,transitions:['ARRIVED','ABSENT','CANCELLED']}});
    render(<SessionRegister boot={boot} session={9} squad={2} onRecord={vi.fn()}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Correct'}));
    const save=screen.getByRole('button',{name:'Save correction'});expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Why is this attendance being corrected?'),{target:{value:'Collection marked on the wrong player'}});fireEvent.click(save);
    await waitFor(()=>expect(apiClient.post).toHaveBeenCalledWith('/clubs/1/operations/records/18/transition',{status:'EXPECTED',revision:2,note:'Collection marked on the wrong player'}));
    expect(await screen.findByRole('button',{name:'Mark arrived'})).toBeVisible();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
});

it('retains a departed player in the register and shows a server rejection without inventing a correction',async()=>{
    vi.mocked(apiClient.post).mockRejectedValue({response:{data:{message:'This record changed. Reload before saving.'}}});
    render(<SessionRegister boot={{...boot,people:[],peopleBySquad:[]}} session={9} squad={2} onRecord={vi.fn()}/>);
    expect(await screen.findByText('Former player #4')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Correct'}));
    fireEvent.change(screen.getByLabelText('Why is this attendance being corrected?'),{target:{value:'Correction'}});fireEvent.click(screen.getByRole('button',{name:'Save correction'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('This record changed. Reload before saving.');
    expect(screen.queryByRole('button',{name:'Mark arrived'})).not.toBeInTheDocument();
    expect(screen.getByLabelText('Why is this attendance being corrected?')).toHaveValue('Correction');
});

it('record detail exposes the audited correction action even while collected details remain immutable',async()=>{
    vi.mocked(apiClient.get).mockImplementation(async url=>({data:String(url).endsWith('/history')?[{id:20,action:'TRANSITION',to_status:'COLLECTED',actor:'Synthetic coach',created_at:'2026-10-03T14:00:00Z',note:'Original record'}]:[]}));
    vi.mocked(apiClient.post).mockResolvedValue({data:{...collected,status:'EXPECTED',revision:3}});const changed=vi.fn().mockResolvedValue(undefined);
    render(<MemoryRouter><RecordDetail club={1} boot={boot} record={collected} definition={definition} onEdit={vi.fn()} onChanged={changed} onClose={vi.fn()}/></MemoryRouter>);
    expect(screen.queryByRole('button',{name:'Edit details'})).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Decision or action note'),{target:{value:'Correcting collection'}});fireEvent.click(screen.getByRole('button',{name:/Correct attendance/}));
    await waitFor(()=>expect(changed).toHaveBeenCalledOnce());
    expect(apiClient.post).toHaveBeenCalledWith('/clubs/1/operations/records/18/transition',{status:'EXPECTED',revision:2,note:'Correcting collection'});
    expect(await screen.findByText('Original record')).toBeInTheDocument();
});
