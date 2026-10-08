import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchClubAdmissions } from '../api';
import type { AdmissionWorkspace } from '../types';
import type { AuthSessionId } from '../../../utils/authStorage';
import { subscribeNotificationsChanged } from '../../../utils/notifications';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useClubAdmissionCopy } from './copy';

class InvalidAdmissionResponse extends Error {}

export function useClubAdmissions(clubId: number, sessionId: AuthSessionId, live = true) {
  const {c}=useClubAdmissionCopy();
  const scope=`${sessionId}:${clubId}`;
  const [data,setData] = useState<AdmissionWorkspace | null>(null), [loading,setLoading] = useState(true), [error,setError] = useState('');
  const [dataScope,setDataScope]=useState(scope);
  const sequence = useRef(0);
  const inFlight = useRef<string | null>(null);
  const reload = useCallback(async (background = false) => {
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
  },[clubId,sessionId,scope,c]);
  useEffect(() => { void reload(); return () => { sequence.current++;inFlight.current=null; }; },[reload]);
  useEffect(() => {
    if(!live)return;
    const refresh=()=>{if(document.visibilityState==='visible'&&navigator.onLine)void reload(true);};
    const stop=subscribeNotificationsChanged(refresh);refresh();return stop;
  },[live,reload]);
  return {data:dataScope===scope?data:null,loading:loading||dataScope!==scope,error:dataScope===scope?error:'',reload,setData};
}
