import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../android/bridge',()=>({isAndroidApp:true}));
import { beginReply, readUncertainReply, replyScope, requireReplyScope } from './availabilityRecovery';
import { setStoredUserId } from '../../utils/authStorage';
beforeEach(()=>{localStorage.clear();setStoredUserId(20);vi.stubGlobal('location',new URL('https://abc123-account-20.appassets.androidplatform.net'));});
afterEach(()=>vi.unstubAllGlobals());
it('supports the current account-specific native origin without exposing a JWT',()=>{
 const scope=replyScope()!;expect(scope).toEqual({actorId:20,sessionId:null});const command=beginReply(scope,10,9,61,'GOING',4);expect(readUncertainReply(scope,10,9,61)).toEqual(command);
});
it('rejects a mismatched native account and cannot reuse the prior account command',()=>{
 const command=beginReply(replyScope()!,10,9,61,'GOING',4);setStoredUserId(21);expect(replyScope()).toBeNull();vi.stubGlobal('location',new URL('https://abc123-account-21.appassets.androidplatform.net'));expect(()=>requireReplyScope(command)).toThrow(/account changed/);expect(readUncertainReply(replyScope()!,10,9,61)).toBeNull();
});
