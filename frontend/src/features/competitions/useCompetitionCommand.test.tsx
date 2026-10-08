import {act,renderHook} from '@testing-library/react';
import {AxiosError,AxiosHeaders} from 'axios';
import {useCompetitionCommand} from './useCompetitionCommand';
import {useAuth} from '../../context/AuthContext';
import {readPendingCommands} from './commandRecovery';
vi.mock('../../context/AuthContext',()=>({useAuth:vi.fn()}));
const auth=(id:number,sessionId:string):ReturnType<typeof useAuth>=>({user:{id,profileComplete:true,onboardingRequired:false,mustChangePassword:false,emailVerified:true},sessionId,status:'authenticated',isAuthenticated:true,isBootstrapping:false,bootstrapSession:vi.fn(),refreshNavigationCapabilities:vi.fn(),loginWithAccessToken:vi.fn(),logout:vi.fn()});
beforeEach(()=>{sessionStorage.clear();vi.mocked(useAuth).mockReturnValue(auth(1,'session-one'));});
it('recovers a lost acknowledgement after remount using the original UUID and submitted revision',async()=>{
  const submit=vi.fn().mockRejectedValueOnce(new AxiosError('Network unavailable')).mockResolvedValue({saved:true}),saved=vi.fn().mockResolvedValue(undefined),reload=vi.fn();
  const first=renderHook(()=>useCompetitionCommand());await act(()=>first.result.current.run('rounds',{startsAt:'2099-10-02T12:00:00+04:00'},3,submit,saved,reload));first.unmount();
  expect(readPendingCommands(`competition-command:1:session-one:${window.location.pathname}`)).toEqual([expect.objectContaining({path:'rounds',body:{startsAt:'2099-10-02T12:00:00+04:00'},revision:3})]);
  const second=renderHook(()=>useCompetitionCommand());await act(()=>second.result.current.run('rounds',{startsAt:'2099-10-02T12:00:00+04:00'},4,submit,saved,reload));
  expect(submit.mock.calls[1][0]).toEqual(submit.mock.calls[0][0]);expect(submit.mock.calls[1][0].revision).toBe(3);expect(saved).toHaveBeenCalledOnce();expect(sessionStorage.length).toBe(0);
});
it('uses fresh current state after a definite conflict and prevents simultaneous duplicate submissions',async()=>{
  const rejection=new AxiosError('Stale state',undefined,undefined,undefined,{status:409,statusText:'Conflict',headers:new AxiosHeaders(),config:{headers:new AxiosHeaders()},data:{}});let fail!:(value:unknown)=>void;
  const submit=vi.fn().mockImplementationOnce(()=>new Promise((_resolve,reject)=>{fail=reject;})).mockResolvedValue({saved:true}),saved=vi.fn().mockResolvedValue(undefined),reload=vi.fn();
  const hook=renderHook(()=>useCompetitionCommand());let pending!:Promise<void>;
  act(()=>{pending=hook.result.current.run('finish',{reason:'Results reviewed'},3,submit,saved,reload);void hook.result.current.run('finish',{reason:'Results reviewed'},3,submit,saved,reload);});
  expect(submit).toHaveBeenCalledOnce();await act(async()=>{fail(rejection);await pending;});
  await act(()=>hook.result.current.run('finish',{reason:'Results reviewed'},4,submit,saved,reload));expect(submit.mock.calls[1][0].revision).toBe(4);expect(submit.mock.calls[1][0].requestId).not.toBe(submit.mock.calls[0][0].requestId);
});
it('does not deliver an old account response or reuse its uncertain command after an account change',async()=>{
  let finish!:(value:unknown)=>void;const submit=vi.fn<(body:Record<string,unknown>)=>Promise<unknown>>().mockImplementation(()=>new Promise(resolve=>{finish=resolve;})),saved=vi.fn(),reload=vi.fn();
  const first=renderHook(()=>useCompetitionCommand());let pending!:Promise<void>;act(()=>{pending=first.result.current.run('rounds',{},1,submit,saved,reload);});first.unmount();
  vi.mocked(useAuth).mockReturnValue(auth(2,'session-two'));
  const second=renderHook(()=>useCompetitionCommand());const next=vi.fn().mockResolvedValue('new');await act(()=>second.result.current.run('rounds',{},2,next,async()=>{},reload));
  await act(async()=>{finish('old');await pending;});expect(saved).not.toHaveBeenCalled();expect(next.mock.calls[0][0].requestId).not.toBe(submit.mock.calls[0][0].requestId);
});
it('allows a new account command in the same mounted page and isolates both pending acknowledgements',async()=>{
  let oldDone!:(value:string)=>void,newDone!:(value:string)=>void;
  const oldSubmit=vi.fn().mockImplementation(()=>new Promise<string>(resolve=>{oldDone=resolve;})),newSubmit=vi.fn().mockImplementation(()=>new Promise<string>(resolve=>{newDone=resolve;}));
  const oldSaved=vi.fn(),newSaved=vi.fn(),reload=vi.fn();const hook=renderHook(()=>useCompetitionCommand());let first!:Promise<void>,second!:Promise<void>;
  act(()=>{first=hook.result.current.run('rounds',{},1,oldSubmit,oldSaved,reload);});
  vi.mocked(useAuth).mockReturnValue(auth(2,'session-two'));hook.rerender();expect(hook.result.current.busy).toBe(false);
  act(()=>{second=hook.result.current.run('rounds',{},2,newSubmit,newSaved,reload);});expect(newSubmit).toHaveBeenCalledOnce();
  await act(async()=>{oldDone('old');await first;});expect(oldSaved).not.toHaveBeenCalled();expect(hook.result.current.busy).toBe(true);
  await act(async()=>{newDone('new');await second;});expect(newSaved).toHaveBeenCalledWith('new');expect(hook.result.current.busy).toBe(false);
});

it('requires recovery before replacing an uncertain command with edited details',async()=>{
 const submit=vi.fn().mockRejectedValueOnce(new AxiosError('Network unavailable')).mockResolvedValue({saved:true}),saved=vi.fn().mockResolvedValue(undefined),reload=vi.fn();
 const hook=renderHook(()=>useCompetitionCommand());await act(()=>hook.result.current.run('finish',{reason:'Original outcome'},3,submit,saved,reload));
 await act(()=>hook.result.current.run('finish',{reason:'Edited outcome'},4,submit,saved,reload));expect(submit).toHaveBeenCalledOnce();expect(hook.result.current.error).toContain('earlier submission');
 await act(()=>hook.result.current.run('finish',{reason:'Original outcome'},4,submit,saved,reload));expect(submit).toHaveBeenCalledTimes(2);expect(submit.mock.calls[1][0]).toEqual(submit.mock.calls[0][0]);
});
it('does not describe a committed command as uncertain when its refreshed view fails',async()=>{
 const submit=vi.fn().mockResolvedValue({saved:true}),saved=vi.fn().mockRejectedValue(new Error('View failed')),reload=vi.fn();const hook=renderHook(()=>useCompetitionCommand());
 await act(()=>hook.result.current.run('finish',{reason:'Reviewed'},3,submit,saved,reload));expect(sessionStorage.length).toBe(0);expect(hook.result.current.notice).toBe('Saved.');expect(reload).toHaveBeenCalledOnce();
});

