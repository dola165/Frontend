import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useJourneyCopy } from './journeyCopy';
import { recordVisitorAttendance, type IntroductoryVisitor, type VisitorAttendanceCommand } from './api';
import { extractApiErrorMessage } from '../../utils/apiError';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';

export type VisitorAttendanceProps = { squadId: number; sessionId: number; revision: number; visitors: IntroductoryVisitor[]; onSaved: () => void };

/**
 * Recording what happened at an introductory session, for any presentation: each save is one idempotent command
 * bound to the case, participation and session versions, retried as the same command, and dropped when the account changes.
 */
export function useVisitorAttendance({ squadId, sessionId, revision, visitors, onSaved }: VisitorAttendanceProps) {
    const copy=useJourneyCopy(), authSessionId=useSyncExternalStore(subscribeAuthSession,getAuthSessionId);
    const [rows,setRows]=useState(visitors),[choice,setChoice]=useState<Record<number,'ATTENDED'|'NO_SHOW'>>({}),[busy,setBusy]=useState<number|null>(null),[error,setError]=useState('');
    const pending=useRef(new Map<number,VisitorAttendanceCommand>()),saving=useRef(false),scope=useRef(authSessionId);
    useEffect(()=>{setRows(visitors);},[visitors]);
    useEffect(()=>{if(scope.current!==authSessionId){pending.current.clear();setRows([]);setChoice({});setError('');scope.current=authSessionId;}},[authSessionId]);
    const permission=(row:IntroductoryVisitor)=>row.permissionStatus==='CURRENT'?copy('Current session permission','მიმდინარე სესიის ნებართვა'):
        row.permissionStatus==='HISTORICAL'?copy('Historical attendance; no current permission implied','ისტორიული დასწრება; მიმდინარე ნებართვას არ გულისხმობს'):
        row.permissionStatus==='GUARDIAN_REVIEW'?copy('Guardian authority needs review; contact admissions','მეურვის უფლებამოსილება გადასახედია; დაუკავშირდით მიღების პასუხისმგებელს'):
        row.permissionStatus==='INTRODUCTION_PERMISSION_REQUIRED'?row.canRecord?copy('Prior session permission is recorded; current contact permission is unavailable','წინა სესიის ნებართვა ჩაწერილია; მიმდინარე კონტაქტის წვდომა მიუწვდომელია'):copy('Current-club permission needs review','მიმდინარე კლუბის ნებართვა გადასახედია'):
        row.permissionStatus==='RECONFIRM_REQUIRED'||row.permissionStatus==='CONSENT_RECONFIRM_REQUIRED'?copy('Changed arrangement; confirmation needs review','შეცვლილი შეთანხმება; თანხმობა გადასახედია'):
        row.permissionStatus==='CANCELLED'||row.permissionStatus==='SESSION_CANCELLED'?copy('Invitation or session cancelled','მოწვევა ან სესია გაუქმებულია'):
        copy('Participation is unavailable; contact admissions','მონაწილეობა მიუწვდომელია; დაუკავშირდით მიღების პასუხისმგებელს');
    const record=async(row:IntroductoryVisitor)=>{
        if(saving.current||scope.current!==authSessionId)return;
        const earlier=pending.current.get(row.participationId);
        const attendance=earlier?.attendance??choice[row.participationId];if(!attendance)return;
        const command=earlier??{requestId:crypto.randomUUID(),caseId:row.caseId,caseVersion:row.caseVersion,participationVersion:row.participationVersion,sessionRevision:revision,attendance};
        pending.current.set(row.participationId,command);saving.current=true;setBusy(row.participationId);setError('');
        try { const result=await recordVisitorAttendance(squadId,sessionId,row.participationId,command,authSessionId);
            if(getAuthSessionId()!==authSessionId)return;
            pending.current.delete(row.participationId);setRows(current=>current.map(value=>value.participationId===result.participationId?result:value));onSaved();
        } catch(e) { if(getAuthSessionId()===authSessionId)setError(extractApiErrorMessage(e,copy('Attendance could not be checked. Retry the same recording or reload the session.','დასწრების შემოწმება ვერ მოხერხდა. ხელახლა სცადეთ იგივე ჩანაწერი ან განაახლეთ სესია.'))); }
        finally { saving.current=false;setBusy(null); }
    };
    const pendingFor=(row:IntroductoryVisitor)=>pending.current.get(row.participationId);
    const select=(row:IntroductoryVisitor,value:'ATTENDED'|'NO_SHOW')=>setChoice(current=>({...current,[row.participationId]:value}));
    return { copy, rows, choice, busy, error, permission, record, pendingFor, select };
}
