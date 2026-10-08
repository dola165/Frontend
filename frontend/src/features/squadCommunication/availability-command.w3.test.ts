import { expect,it,vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import { attendance } from './api';
vi.mock('../../api/axiosConfig',()=>({apiClient:{put:vi.fn().mockResolvedValue({data:{saved:true}})}}));
it('transmits the caller request UUID with its exact occurrence, player and viewed revision',async()=>{
    await attendance(10,9,61,'GOING',4,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(apiClient.put).toHaveBeenCalledWith('/squad-communication/10/sessions/9/attendance',{playerId:61,response:'GOING',revision:4,requestId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'});
});
