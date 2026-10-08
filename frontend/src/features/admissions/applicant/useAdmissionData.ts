import { useEffect, useState } from 'react';
import { isCurrentAuthSession, type AuthSessionId } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';

export function useAdmissionData<T>(fetcher: (signal: AbortSignal) => Promise<T>, sessionId?: AuthSessionId) {
    const [data,setData]=useState<T|null>(null);
    const [loading,setLoading]=useState(true);
    const [error,setError]=useState('');
    const [revision,setRevision]=useState(0);
    useEffect(()=>{
        const controller=new AbortController();
        setLoading(true);setError('');
        const current=()=>!controller.signal.aborted&&(sessionId===undefined||isCurrentAuthSession(sessionId));
        void fetcher(controller.signal).then(result=>{if(current())setData(result);}).catch(e=>{if(current())setError(extractApiErrorMessage(e,'Could not load this information.'));}).finally(()=>{if(current())setLoading(false);});
        return ()=>controller.abort();
    },[fetcher,sessionId,revision]);
    return {data,loading,error,setData,refresh:()=>setRevision(v=>v+1)};
}
