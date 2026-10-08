import '../../i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SessionRegister } from './SessionRegister';
import type { Bootstrap } from './api';
import { apiClient } from '../../api/axiosConfig';
import { setStoredAccessToken,setStoredUserId } from '../../utils/authStorage';

vi.mock('../../api/axiosConfig',()=>({apiClient:{get:vi.fn(),post:vi.fn(),put:vi.fn()}}));
const visitor={participationId:5,caseId:8,playerId:50,caseVersion:3,participationVersion:2,name:'Synthetic visitor',status:'CONFIRMED',permissionStatus:'CURRENT',emergencyContact:'Synthetic emergency contact',canRecord:true};
const boot={clubId:1,people:[],peopleBySquad:[],sessions:[{id:9,title:'Training'}],settings:{enabled_modules:['ATTENDANCE']},modules:[{id:'ATTENDANCE',globalWrite:true,writeSquads:[]},{id:'DEVELOPMENT',globalWrite:true,writeSquads:[]}]} as unknown as Bootstrap;
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();setStoredAccessToken(`e30.${btoa(JSON.stringify({sub:'20'}))}.test`);setStoredUserId(20);vi.mocked(apiClient.get).mockImplementation(async route=>({data:String(route).includes('introductory-visitors')?{sessionRevision:4,visitors:[visitor]}:[]}));});
it('ordinary session register saves the case-bound visitor instead of creating a regular roster attendance record',async()=>{
    vi.mocked(apiClient.put).mockResolvedValue({data:{...visitor,status:'ATTENDED',permissionStatus:'HISTORICAL',canRecord:false,emergencyContact:null}});
    render(<SessionRegister boot={boot} session={9} squad={10} onRecord={vi.fn()}/>);
    expect(await screen.findByRole('region',{name:'Introductory visitors'})).toBeVisible();
    fireEvent.change(screen.getByRole('combobox',{name:'Actual attendance for Synthetic visitor'}),{target:{value:'ATTENDED'}});
    fireEvent.click(screen.getByRole('button',{name:'Save attendance for Synthetic visitor'}));
    await waitFor(()=>expect(apiClient.put).toHaveBeenCalledWith('/squad-communication/10/sessions/9/introductory-visitors/5/attendance',expect.objectContaining({caseId:8,caseVersion:3,participationVersion:2,sessionRevision:4,attendance:'ATTENDED'}),expect.any(Object)));
    expect(apiClient.post).not.toHaveBeenCalled();
});
it('a staff member without current admission scope is not asked for private visitor details',async()=>{
    render(<SessionRegister boot={{...boot,modules:[boot.modules[0]]}} session={9} squad={10} onRecord={vi.fn()}/>);
    await screen.findByText(/No roster is available/);expect(screen.queryByText('Synthetic visitor')).not.toBeInTheDocument();expect(vi.mocked(apiClient.get).mock.calls.every(args=>!String(args[0]).includes('introductory-visitors'))).toBe(true);
});
it('later enrollment preserves the historical introductory fact without a second regular row',async()=>{
    vi.mocked(apiClient.get).mockImplementation(async route=>({data:String(route).includes('introductory-visitors')?{sessionRevision:4,visitors:[{...visitor,status:'ATTENDED',permissionStatus:'HISTORICAL',emergencyContact:null,canRecord:false}]}:[]}));
    render(<SessionRegister boot={{...boot,people:[{id:50,name:'Synthetic visitor'}],peopleBySquad:[{id:50,squad_id:10}]}} session={9} squad={10} onRecord={vi.fn()}/>);
    await screen.findByText('Attended');await waitFor(()=>expect(screen.getAllByText('Synthetic visitor')).toHaveLength(1));expect(screen.queryByRole('button',{name:'Mark arrived'})).not.toBeInTheDocument();
});
