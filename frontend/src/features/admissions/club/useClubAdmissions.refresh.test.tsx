import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useClubAdmissions } from './useClubAdmissions';
import { emitNotificationsChanged } from '../../../utils/notifications';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),copy:(key:string)=>key}));
vi.mock('../api',()=>({fetchClubAdmissions:mocks.fetch}));
vi.mock('./copy',()=>({useClubAdmissionCopy:()=>({c:mocks.copy})}));
const data=(name:string)=>({organizationId:1,groups:[],staff:[],squads:[],cases:[],inquiries:name?[{id:1,playerName:name}]:[]});
afterEach(()=>vi.clearAllMocks());
it('refreshes the open queue and metric source together, coalesces inflight events, and does not refresh other tabs',async()=>{
 mocks.fetch.mockResolvedValueOnce(data(''));
 const {result,rerender,unmount}=renderHook(({live})=>useClubAdmissions(1,null,live),{initialProps:{live:true}});
 await waitFor(()=>expect(result.current.loading).toBe(false));
 let resolve!:(value:unknown)=>void;mocks.fetch.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));
 act(()=>{emitNotificationsChanged();emitNotificationsChanged();});expect(mocks.fetch).toHaveBeenCalledTimes(2);
 await act(async()=>resolve(data('New player')));expect(result.current.data?.inquiries?.[0].playerName).toBe('New player');
 rerender({live:false});act(()=>emitNotificationsChanged());expect(mocks.fetch).toHaveBeenCalledTimes(2);unmount();
});

it('a manual refresh after an action supersedes an older background response',async()=>{
 mocks.fetch.mockResolvedValueOnce(data('Initial'));
 const {result,unmount}=renderHook(()=>useClubAdmissions(1,null,true));await waitFor(()=>expect(result.current.loading).toBe(false));
 let old!:(value:unknown)=>void;mocks.fetch.mockImplementationOnce(()=>new Promise(r=>{old=r}));
 act(()=>emitNotificationsChanged());mocks.fetch.mockResolvedValueOnce(data('Newest'));
 await act(async()=>{await result.current.reload()});expect(result.current.data?.inquiries?.[0].playerName).toBe('Newest');
 await act(async()=>old(data('Stale')));expect(result.current.data?.inquiries?.[0].playerName).toBe('Newest');unmount();
});
