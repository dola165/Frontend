import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchClubAdmissions } from '../api';
import type { AdmissionWorkspace } from '../types';
import type { AuthSessionId } from '../../../utils/authStorage';
import { subscribeNotificationsChanged } from '../../../utils/notifications';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useClubAdmissionCopy } from './copy';

class InvalidAdmissionResponse extends Error {}

export function useClubAdmissions(clubId: number, sessionId: AuthSessionId, live = true, enabled = true) {
  const {c}=useClubAdmissionCopy();
  const scope=`${sessionId}:${clubId}:${enabled ? 'enabled' : 'disabled'}`;
  const [data,setData] = useState<AdmissionWorkspace | null>(null), [loading,setLoading] = useState(true), [error,setError] = useState('');
  const [dataScope,setDataScope]=useState(scope);
  const sequence = useRef(0);
  const inFlight = useRef<string | null>(null);
  const reload = useCallback(async (background = false) => {
    if(!enabled)return;
    if(background&&inFlight.current===scope)return;
    inFlight.current=scope;
    const current = ++sequence.current; if(!background)setLoading(true); setError('');
    try {
      const result=await fetchClubAdmissions(clubId,sessionId);
      if(!result || !Array.isArray(result.cases) || !Array.isArray(result.groups) || !Array.isArray(result.staff) || !Array.isArray(result.squads) || !Number.isSafeInteger(result.organizationId))throw new InvalidAdmissionResponse();
      if(current===sequence.current){setData(result);setDataScope(scope);}
    }
    catch(e) { if(current===sequence.current) { setData(null);setDataScope(scope);setError(e instanceof InvalidAdmissionResponse?c('responseIncomplete'):extractApiErrorMessage(e,c('error'))); } }
    finally { if(current===sequence.current){setLoading(false);if(inFlight.current===scope)inFlight.current=null;} }
  },[clubId,sessionId,scope,c,enabled]);
  // The cleanup retires this load's answers by advancing the shared request counter.
  useEffect(() => {
    const requests=sequence;
    if(enabled)void reload();
    else {setData(null);setDataScope(scope);setLoading(false);setError('');}
    return () => { requests.current++;inFlight.current=null; };
  },[reload,enabled,scope]);
  useEffect(() => {
    if(!live||!enabled)return;
    const refresh=()=>{if(document.visibilityState==='visible'&&navigator.onLine)void reload(true);};
    const stop=subscribeNotificationsChanged(refresh);refresh();return stop;
  },[live,reload,enabled]);
  return {data:enabled&&dataScope===scope?data:null,loading:enabled&&(loading||dataScope!==scope),error:enabled&&dataScope===scope?error:'',reload,setData};
}
